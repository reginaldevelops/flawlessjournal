/**
 * Build a reviewable import plan from wallet sync swaps.
 * Groups fills into trade episodes and labels open / add / reduce / close.
 */

import { supabase } from "../supabaseClient";
import {
  classifyFillRoleAfter,
  computePosition,
  isPositionLive,
  makeFill,
  sortFillsChrono,
} from "./position";

const POSITION_KIND = "position";

function blockTimeToIso(blockTime) {
  const ts = Number(blockTime);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

function swapTs(swap) {
  return blockTimeToIso(swap.blockTime) ?? new Date().toISOString();
}

/** Load live position + known signatures per mint for import context. */
export async function loadMintImportContext(tokenMints = []) {
  const mints = [...new Set(tokenMints.filter(Boolean))];
  const ctx = {};
  for (const mint of mints) ctx[mint] = { tokensOpen: 0, liveTradeId: null, signatures: new Set() };

  if (!mints.length) return ctx;

  const { data, error } = await supabase
    .from("trades")
    .select("id, data")
    .order("id", { ascending: false })
    .limit(400);

  if (error) throw error;

  for (const row of data ?? []) {
    const fj = row.data?._fj;
    if (fj?.kind !== POSITION_KIND || !mints.includes(fj.tokenMint)) continue;

    const entry = ctx[fj.tokenMint];
    if (!entry) continue;

    for (const f of fj.fills ?? []) {
      if (f.signature) entry.signatures.add(`${f.signature}:${f.side}`);
    }

    const computed = fj.computed ?? computePosition(fj.fills ?? []);
    if (entry.liveTradeId == null && isPositionLive(computed)) {
      entry.liveTradeId = row.id;
      entry.tokensOpen = computed.tokensOpen;
    }
  }

  return ctx;
}

function episodeWarnings(fills, { continuesFromJournal = false } = {}) {
  const warnings = [];
  if (!fills.length) return warnings;

  const first = fills[0];
  if (first.role === "orphan") {
    warnings.push("incomplete_start");
  } else if (
    (first.role === "reduce" || first.role === "close") &&
    !continuesFromJournal
  ) {
    warnings.push("incomplete_start");
  }

  const last = fills[fills.length - 1];
  const episodeFills = fills.map((f) =>
    makeFill({
      side: f.side,
      signature: f.signature,
      quoteMint: f.quoteMint,
      quoteSymbol: f.quoteSymbol,
      quoteAmount: f.quoteAmount,
      tokenAmount: f.tokenAmount,
      priceUsd: f.priceUsd,
      usdValue: f.usdValue,
      wallet: f.wallet,
      ts: f.executedAt,
    })
  );
  const computed = computePosition(episodeFills);
  if (isPositionLive(computed)) {
    warnings.push("open_at_end");
  }

  if (continuesFromJournal) {
    warnings.push("continues");
  }

  return warnings;
}

/**
 * @param {object[]} swaps — raw swaps from wallet sync (any order)
 * @param {Record<string, { tokensOpen?: number, liveTradeId?: string|null, signatures?: Set<string> }>} [mintContext]
 */
export function buildImportPlan(swaps = [], mintContext = {}) {
  const byMint = new Map();

  for (const swap of swaps) {
    const mint = swap.tokenMint;
    if (!mint) continue;
    if (!byMint.has(mint)) byMint.set(mint, []);
    byMint.get(mint).push(swap);
  }

  const trades = [];
  let fillIdx = 0;

  for (const [tokenMint, mintSwaps] of byMint) {
    const sorted = [...mintSwaps].sort(
      (a, b) => Date.parse(swapTs(a)) - Date.parse(swapTs(b))
    );

    const ctx = mintContext[tokenMint] ?? { tokensOpen: 0, liveTradeId: null, signatures: new Set() };
    let tokensOpen = ctx.tokensOpen ?? 0;
    let episode = [];
    let episodeIndex = 0;

    const flushEpisode = () => {
      if (!episode.length) return;
      const firstRole = episode[0].role;
      const continuesFromJournal =
        episodeIndex === 0 &&
        (ctx.tokensOpen ?? 0) > 1e-12 &&
        (firstRole === "add" || firstRole === "reduce" || firstRole === "close");
      const warnings = episodeWarnings(episode, { continuesFromJournal });
      const episodeFills = episode.map((f) =>
        makeFill({
          side: f.side,
          signature: f.signature,
          quoteMint: f.quoteMint,
          quoteSymbol: f.quoteSymbol,
          quoteAmount: f.quoteAmount,
          tokenAmount: f.tokenAmount,
          priceUsd: f.priceUsd,
          usdValue: f.usdValue,
          wallet: null,
          ts: f.executedAt,
        })
      );
      const computed = computePosition(episodeFills);
      trades.push({
        id: `${tokenMint}-${episodeIndex}`,
        tokenMint,
        tokenSymbol: episode[0]?.tokenSymbol ?? tokenMint.slice(0, 4),
        tokenName: episode[0]?.tokenName ?? null,
        imageUrl: episode[0]?.imageUrl ?? null,
        linkTradeId: continuesFromJournal ? ctx.liveTradeId : null,
        warnings,
        status: isPositionLive(computed) ? "open" : "closed",
        fills: episode,
      });
      episode = [];
      episodeIndex += 1;
    };

    for (const swap of sorted) {
      const executedAt = swapTs(swap);
      const sigKey = swap.signature ? `${swap.signature}:${swap.side}` : null;
      const alreadyImported = sigKey ? ctx.signatures?.has(sigKey) : false;

      const role = classifyFillRoleAfter(tokensOpen, swap.side, swap.tokenAmount);
      const fill = {
        id: `fill-${fillIdx++}`,
        side: swap.side,
        role,
        signature: swap.signature,
        quoteMint: swap.quoteMint,
        quoteSymbol: swap.quoteSymbol,
        quoteAmount: swap.quoteAmount,
        tokenAmount: swap.tokenAmount,
        priceUsd: swap.priceUsd,
        usdValue: swap.usdValue,
        executedAt,
        blockTime: swap.blockTime ?? null,
        tokenSymbol: swap.tokenSymbol,
        tokenName: swap.tokenName,
        imageUrl: swap.imageUrl,
        included: !alreadyImported,
        alreadyImported,
        excluded: false,
      };

      if (swap.side === "buy") {
        tokensOpen += Number(swap.tokenAmount) || 0;
      } else {
        tokensOpen = Math.max(0, tokensOpen - (Number(swap.tokenAmount) || 0));
      }

      episode.push(fill);

      if (tokensOpen <= 1e-12) {
        flushEpisode();
        tokensOpen = 0;
      }
    }

    flushEpisode();
  }

  trades.sort((a, b) => {
    const ta = Date.parse(a.fills[0]?.executedAt || 0);
    const tb = Date.parse(b.fills[0]?.executedAt || 0);
    return ta - tb;
  });

  const fillCount = trades.reduce((n, t) => n + t.fills.length, 0);
  const includedCount = trades.reduce(
    (n, t) => n + t.fills.filter((f) => f.included && !f.excluded).length,
    0
  );
  const warningCount = trades.filter((t) =>
    t.warnings.some((w) => w === "incomplete_start" || w === "orphan")
  ).length;

  return {
    trades,
    fillCount,
    includedCount,
    warningCount,
  };
}

export function toggleFillInPlan(plan, tradeId, fillId) {
  return {
    ...plan,
    trades: plan.trades.map((trade) => {
      if (trade.id !== tradeId) return trade;
      return {
        ...trade,
        fills: trade.fills.map((fill) => {
          if (fill.id !== fillId) return fill;
          if (fill.alreadyImported) return fill;
          const excluded = !fill.excluded;
          return { ...fill, excluded, included: !excluded };
        }),
      };
    }),
  };
}

export function toggleTradeInPlan(plan, tradeId, included) {
  return {
    ...plan,
    trades: plan.trades.map((trade) => {
      if (trade.id !== tradeId) return trade;
      return {
        ...trade,
        fills: trade.fills.map((fill) =>
          fill.alreadyImported
            ? fill
            : { ...fill, excluded: !included, included }
        ),
      };
    }),
  };
}

export function planSummary(plan) {
  const included = plan.trades.reduce(
    (n, t) => n + t.fills.filter((f) => f.included && !f.excluded && !f.alreadyImported).length,
    0
  );
  const skipped = plan.trades.reduce(
    (n, t) => n + t.fills.filter((f) => f.alreadyImported).length,
    0
  );
  const excluded = plan.trades.reduce(
    (n, t) => n + t.fills.filter((f) => f.excluded && !f.alreadyImported).length,
    0
  );
  const warnings = plan.trades.filter((t) =>
    t.warnings.includes("incomplete_start") &&
    t.fills.some((f) => f.included && !f.excluded)
  ).length;
  return { included, skipped, excluded, warnings };
}

export function warningLabel(code) {
  switch (code) {
    case "incomplete_start":
      return "Batch starts mid-trade — sync Older first for the open, or exclude these fills.";
    case "continues":
      return "Continues an open position from your journal.";
    case "open_at_end":
      return "Position still open at end of batch — OK if you are still holding.";
    default:
      return code;
  }
}

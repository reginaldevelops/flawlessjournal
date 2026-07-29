/**
 * Pure import plan logic (no Supabase) — safe for Node unit tests.
 */

import {
  applyFillToTokensOpen,
  classifyFillRoleAfter,
  computePosition,
  isOversell,
  isPositionLive,
  makeFill,
  sortFillsChrono,
  tokensOpenBefore,
  tokensOpenAtTime,
} from "./position.js";

/** Must match POSITION_KIND in constants.js */
export const JOURNAL_POSITION_KIND = "solana_position";

/** Merge swap lists from multiple scan batches (dedupe by signature+side). */
export function mergeImportSwaps(existing = [], older = []) {
  const byKey = new Map();
  for (const swap of [...older, ...existing]) {
    const key = swap.signature
      ? `${swap.signature}:${swap.side}`
      : `${swap.blockTime ?? 0}:${swap.side}:${swap.tokenMint ?? ""}`;
    if (!byKey.has(key)) byKey.set(key, swap);
  }
  return [...byKey.values()].sort(
    (a, b) => Number(a.blockTime ?? 0) - Number(b.blockTime ?? 0)
  );
}

/** Combine scan metadata after loading an older batch into a pending review. */
export function mergeScanData(base, olderScan) {
  const mergedSwaps = mergeImportSwaps(base.swaps ?? [], olderScan.swaps ?? []);
  return {
    ...base,
    swaps: mergedSwaps,
    scanned: (base.scanned ?? 0) + (olderScan.scanned ?? 0),
    total: (base.total ?? 0) + (olderScan.total ?? 0),
    oldestTime: olderScan.oldestTime ?? base.oldestTime,
    oldestSignature: olderScan.oldestSignature ?? base.oldestSignature,
    hasMoreOlder: Boolean(olderScan.hasMoreOlder),
    mergedBatches: (base.mergedBatches ?? 1) + 1,
  };
}

function blockTimeToIso(blockTime) {
  const ts = Number(blockTime);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

function swapTs(swap) {
  return blockTimeToIso(swap.blockTime) ?? new Date().toISOString();
}

export function buildMintContextFromTrades(tradeRows = [], tokenMints = []) {
  const mints = [...new Set(tokenMints.filter(Boolean))];
  const ctx = {};
  for (const mint of mints) {
    ctx[mint] = {
      tokensOpen: 0,
      liveTradeId: null,
      linkTradeId: null,
      signatures: new Set(),
      allFills: [],
      tradeRows: [],
    };
  }

  for (const row of tradeRows) {
    const fj = row.data?._fj;
    if (fj?.kind !== JOURNAL_POSITION_KIND || !mints.includes(fj.tokenMint)) continue;

    const mint = fj.tokenMint;
    const entry = ctx[mint];
    entry.tradeRows.push(row);
    for (const f of fj.fills ?? []) {
      if (f.signature) entry.signatures.add(`${f.signature}:${f.side}`);
      entry.allFills.push(f);
    }
  }

  for (const mint of mints) {
    const entry = ctx[mint];
    entry.allFills = sortFillsChrono(entry.allFills);

    for (const row of [...entry.tradeRows].sort((a, b) => Number(b.id) - Number(a.id))) {
      const fj = row.data?._fj;
      const computed = fj.computed ?? computePosition(fj.fills ?? []);
      if (isPositionLive(computed)) {
        entry.liveTradeId = row.id;
        entry.tokensOpen = computed.tokensOpen;
        break;
      }
    }
  }

  return ctx;
}

export function findLinkTradeIdAtTime(tradeRows, tokenMint, beforeIso) {
  let best = null;
  let bestOpen = 0;
  for (const row of tradeRows) {
    const fj = row.data?._fj;
    if (fj?.kind !== JOURNAL_POSITION_KIND || fj.tokenMint !== tokenMint) continue;
    const open = tokensOpenBefore(fj.fills ?? [], beforeIso);
    if (open > bestOpen + 1e-12) {
      bestOpen = open;
      best = row.id;
    }
  }
  return best;
}

function episodeWarnings(fills, { continuesFromJournal = false, hasOversell = false } = {}) {
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
  } else if (first.role === "add" && !continuesFromJournal) {
    warnings.push("incomplete_start");
  }

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

  if (hasOversell) {
    warnings.push("oversell");
  }

  return warnings;
}

/** Auto-import when episode is trustworthy; skip orphans/oversells/mid-batch gaps. */
export function isAutoImportEligible(trade) {
  if (!trade?.fills?.length) return false;
  const pending = trade.fills.filter((f) => !f.alreadyImported);
  if (!pending.length) return false;

  if (trade.warnings.includes("oversell")) return false;
  if (trade.warnings.includes("incomplete_start")) return false;

  const first = trade.fills[0];

  // New position from flat — closed or still holding at batch end.
  if (first.role === "open") return true;

  // Adds/reduces/closes on a journal position we can link to.
  if (
    trade.linkTradeId &&
    trade.warnings.includes("continues") &&
    (first.role === "add" || first.role === "reduce" || first.role === "close")
  ) {
    return true;
  }

  return false;
}

export function deriveSkipReason(trade) {
  if (isAutoImportEligible(trade)) return null;
  if (!trade?.fills?.some((f) => !f.alreadyImported)) return "already_imported";

  if (trade.warnings.includes("oversell")) return "oversell";
  if (trade.warnings.includes("incomplete_start")) return "no_open";

  const first = trade.fills[0];
  if (first.role === "orphan") return "no_open";
  if (first.role === "reduce" || first.role === "close") return "no_open";
  if (first.role === "add" && !trade.linkTradeId) return "no_open";

  return "incomplete";
}

function applyAutoImportPolicy(trade) {
  const autoImportEligible = isAutoImportEligible(trade);
  const skipReason = autoImportEligible ? null : deriveSkipReason(trade);
  const fills = trade.fills.map((f) => {
    if (f.alreadyImported) return f;
    if (autoImportEligible) return { ...f, excluded: false, included: true };
    return { ...f, excluded: true, included: false };
  });
  return { ...trade, fills, autoImportEligible, skipReason };
}

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

    const ctx = mintContext[tokenMint] ?? {
      tokensOpen: 0,
      liveTradeId: null,
      signatures: new Set(),
      allFills: [],
      tradeRows: [],
    };

    const batchStartIso = sorted[0] ? swapTs(sorted[0]) : null;
    const openAtBatchStart = batchStartIso
      ? tokensOpenAtTime(ctx.allFills ?? [], batchStartIso)
      : 0;

    let tokensOpen = openAtBatchStart;
    let episode = [];
    let episodeIndex = 0;
    let episodeHasOversell = false;

    const flushEpisode = () => {
      if (!episode.length) return;
      const firstRole = episode[0].role;
      const continuesFromJournal =
        episodeIndex === 0 &&
        openAtBatchStart > 1e-12 &&
        (firstRole === "add" || firstRole === "reduce" || firstRole === "close");
      const linkTradeId = continuesFromJournal
        ? findLinkTradeIdAtTime(ctx.tradeRows ?? [], tokenMint, batchStartIso) ??
          ctx.liveTradeId
        : null;
      const warnings = episodeWarnings(episode, {
        continuesFromJournal,
        hasOversell: episodeHasOversell,
      });
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
      trades.push(
        applyAutoImportPolicy({
          id: `${tokenMint}-${episodeIndex}`,
          tokenMint,
          tokenSymbol: episode[0]?.tokenSymbol ?? tokenMint.slice(0, 4),
          tokenName: episode[0]?.tokenName ?? null,
          imageUrl: episode[0]?.imageUrl ?? null,
          linkTradeId,
          openAtBatchStart: episodeIndex === 0 ? openAtBatchStart : 0,
          warnings,
          status: isPositionLive(computed) ? "open" : "closed",
          fills: episode,
        })
      );
      episode = [];
      episodeIndex += 1;
      episodeHasOversell = false;
    };

    for (const swap of sorted) {
      const executedAt = swapTs(swap);
      const sigKey = swap.signature ? `${swap.signature}:${swap.side}` : null;
      const alreadyImported = sigKey ? ctx.signatures?.has(sigKey) : false;

      const role = classifyFillRoleAfter(tokensOpen, swap.side, swap.tokenAmount);
      const oversell = isOversell(tokensOpen, swap.side, swap.tokenAmount);
      if (oversell) episodeHasOversell = true;

      episode.push({
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
        oversell,
      });

      tokensOpen = applyFillToTokensOpen(tokensOpen, swap.side, swap.tokenAmount);

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
  const warningCount = trades.filter((t) => !t.autoImportEligible && t.skipReason).length;
  const autoImportCount = trades.filter((t) => t.autoImportEligible).length;

  return { trades, fillCount, includedCount, warningCount, autoImportCount };
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
          fill.alreadyImported ? fill : { ...fill, excluded: !included, included }
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
  const warnings = plan.trades.filter(
    (t) => !t.autoImportEligible && t.fills.some((f) => f.included && !f.excluded)
  ).length;
  const manualOnly = plan.trades.filter(
    (t) => !t.autoImportEligible && t.skipReason && t.skipReason !== "already_imported"
  ).length;
  const ready = plan.trades.filter((t) => t.autoImportEligible).length;
  return { included, skipped, excluded, warnings, manualOnly, ready };
}

export function skipReasonLabel(code) {
  switch (code) {
    case "no_open":
      return "Opening buy missing — batch starts mid-trade. Load older batches or add manually in /trades.";
    case "oversell":
      return "Oversell — amounts do not line up. Add manually after checking on-chain history.";
    case "incomplete":
      return "Could not classify safely — add manually in /trades.";
    case "already_imported":
      return "Already in journal.";
    default:
      return code ?? "";
  }
}

export function warningLabel(code) {
  switch (code) {
    case "incomplete_start":
      return "Batch starts mid-trade — skipped for auto-import.";
    case "continues":
      return "Continues an open position from your journal.";
    case "open_at_end":
      return "Position still open — will import as live trade.";
    case "oversell":
      return "Sell exceeds tokens held — skipped for auto-import.";
    default:
      return code;
  }
}

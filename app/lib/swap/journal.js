import { supabase } from "../supabaseClient";
import { POSITION_KIND } from "./constants";
import {
  computePosition,
  currentEpisodeStartTs,
  isPositionLive,
  makeFill,
  mirrorJournalFields,
  sortFillsChrono,
  splitFillEpisodes,
  tokensOpenBefore,
} from "./position";
import { captureFillOhlcSnapshot } from "./ohlcSnapshot";

function tradeSeed({
  tokenMint,
  tokenSymbol,
  tokenName,
  pairUrl,
  imageUrl,
  executedAt,
  existing = {},
}) {
  const when = executedAt ? new Date(executedAt) : new Date();
  const safeWhen = Number.isNaN(when.getTime()) ? new Date() : when;
  const pad = (n) => String(n).padStart(2, "0");
  return {
    ...existing,
    Datum:
      existing.Datum ??
      `${safeWhen.getFullYear()}-${pad(safeWhen.getMonth() + 1)}-${pad(safeWhen.getDate())}`,
    Entreetijd:
      existing.Entreetijd ??
      `${pad(safeWhen.getHours())}:${pad(safeWhen.getMinutes())}`,
    Coin: tokenSymbol,
    Coins: tokenSymbol,
    Direction: existing.Direction || "Long",
    _fj: {
      kind: POSITION_KIND,
      chain: "solana",
      tokenMint,
      tokenSymbol,
      tokenName: tokenName || tokenSymbol,
      pairUrl: pairUrl || null,
      imageUrl: imageUrl || null,
      fills: [],
      computed: computePosition([]),
    },
  };
}

async function insertPositionTrade(seed) {
  const { data: inserted, error: insertError } = await supabase
    .from("trades")
    .insert([{ data: seed }])
    .select("id, data, trade_number")
    .single();

  if (insertError) throw insertError;
  return {
    id: inserted.id,
    trade_number: inserted.trade_number,
    data: inserted.data ?? seed,
  };
}

async function listAllMintTrades(tokenMint) {
  const rows = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("trades")
      .select("id, data, trade_number")
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const fj = row.data?._fj;
      if (fj?.kind === POSITION_KIND && fj?.tokenMint === tokenMint) {
        rows.push(row);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function findTradeWithFillSignature(tokenMint, signature, side) {
  if (!signature || !side) return null;

  const rows = await listAllMintTrades(tokenMint);
  for (const row of rows) {
    const fills = row.data?._fj?.fills ?? [];
    if (fills.some((f) => f.signature === signature && f.side === side)) {
      return {
        id: row.id,
        trade_number: row.trade_number,
        data: row.data ?? {},
      };
    }
  }
  return null;
}

function buildTradePayload(trade, fj, fills) {
  const computed = computePosition(fills);
  const closed = !isPositionLive(computed);
  const symbol = fj.tokenSymbol || trade.data?.Coin || trade.data?.Coins || "TOKEN";
  const mirrored = mirrorJournalFields({
    symbol,
    computed,
    existing: trade.data ?? {},
  });

  return {
    ...trade.data,
    ...mirrored,
    _fj: {
      ...fj,
      fills,
      computed,
      status: closed ? "closed" : "open",
      closedAt: closed ? fj.closedAt ?? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Find the correct journal trade for a fill, or create a new episode.
 * Sells attach to the trade that still held tokens *before* the sell time —
 * never to a newer live re-entry.
 */
export async function findTradeForFill({
  side,
  tokenMint,
  tokenSymbol,
  tokenName,
  pairUrl,
  imageUrl,
  executedAt,
}) {
  const matching = await listAllMintTrades(tokenMint);
  const fillTs = executedAt ?? new Date().toISOString();
  const fillTime = Date.parse(fillTs);

  if (side === "buy") {
    for (const row of matching) {
      const fj = row.data?._fj ?? {};
      const fills = sortFillsChrono(fj.fills);
      const computed = fj.computed ?? computePosition(fills);
      if (!isPositionLive(computed)) continue;

      const episodeStart = currentEpisodeStartTs(fills);
      if (Number.isFinite(fillTime) && fillTime < episodeStart - 60_000) {
        continue;
      }

      return {
        id: row.id,
        trade_number: row.trade_number,
        data: row.data ?? {},
      };
    }

    return insertPositionTrade(
      tradeSeed({ tokenMint, tokenSymbol, tokenName, pairUrl, imageUrl, executedAt: fillTs })
    );
  }

  if (side === "sell") {
    for (const row of matching) {
      const fj = row.data?._fj ?? {};
      const fills = sortFillsChrono(fj.fills);
      const openBefore = tokensOpenBefore(fills, fillTs);
      if (openBefore <= 1e-12) continue;

      const episodeStart = currentEpisodeStartTs(fills);
      if (Number.isFinite(fillTime) && fillTime < episodeStart - 60_000) {
        continue;
      }

      return {
        id: row.id,
        trade_number: row.trade_number,
        data: row.data ?? {},
      };
    }

    for (const row of matching) {
      const fj = row.data?._fj ?? {};
      const fills = sortFillsChrono(fj.fills);
      const openBefore = tokensOpenBefore(fills, fillTs);
      if (openBefore > 1e-12) {
        return {
          id: row.id,
          trade_number: row.trade_number,
          data: row.data ?? {},
        };
      }
    }

    return insertPositionTrade(
      tradeSeed({ tokenMint, tokenSymbol, tokenName, pairUrl, imageUrl, executedAt: fillTs })
    );
  }

  return insertPositionTrade(
    tradeSeed({ tokenMint, tokenSymbol, tokenName, pairUrl, imageUrl, executedAt: fillTs })
  );
}

/** @deprecated use findTradeForFill */
export async function findOrCreatePositionTrade(args) {
  return findTradeForFill({ ...args, side: "buy" });
}

/**
 * If one journal row contains multiple flat→re-open episodes (e.g. old sell +
 * new buys), split into separate trades. Returns { repaired, tradeId }.
 */
export async function repairTradeEpisodes(tradeId) {
  const { data, error } = await supabase
    .from("trades")
    .select("id, data, trade_number")
    .eq("id", tradeId)
    .single();

  if (error) throw error;

  const fj = data?.data?._fj;
  if (fj?.kind !== POSITION_KIND) {
    return { repaired: false, tradeId };
  }

  const episodes = splitFillEpisodes(fj.fills ?? []);
  if (episodes.length <= 1) {
    return { repaired: false, tradeId };
  }

  const meta = {
    tokenMint: fj.tokenMint,
    tokenSymbol: fj.tokenSymbol,
    tokenName: fj.tokenName,
    pairUrl: fj.pairUrl,
    imageUrl: fj.imageUrl,
  };

  const firstPayload = buildTradePayload(data, fj, episodes[0]);
  await supabase.from("trades").update({ data: firstPayload }).eq("id", tradeId);

  let liveTradeId = isPositionLive(firstPayload._fj.computed) ? tradeId : null;

  for (let i = 1; i < episodes.length; i += 1) {
    const ep = episodes[i];
    const firstFill = ep[0];
    const inserted = await insertPositionTrade(
      tradeSeed({
        ...meta,
        executedAt: firstFill?.ts,
      })
    );
    const nextPayload = buildTradePayload(inserted, inserted.data._fj, ep);
    await supabase.from("trades").update({ data: nextPayload }).eq("id", inserted.id);
    if (isPositionLive(nextPayload._fj.computed)) {
      liveTradeId = inserted.id;
    }
  }

  return {
    repaired: true,
    tradeId: liveTradeId ?? tradeId,
    splitCount: episodes.length,
  };
}

/**
 * Resolve the trade row to attach a fill to.
 * When `tradeId` is set, use that journal row (initialize _fj if needed).
 */
async function resolveTradeForFill({
  tradeId,
  side,
  tokenMint,
  tokenSymbol,
  tokenName,
  pairUrl,
  imageUrl,
  executedAt,
}) {
  if (!tradeId) {
    return findTradeForFill({
      side,
      tokenMint,
      tokenSymbol,
      tokenName,
      pairUrl,
      imageUrl,
      executedAt,
    });
  }

  const { data, error } = await supabase
    .from("trades")
    .select("id, data, trade_number")
    .eq("id", tradeId)
    .single();

  if (error) throw error;

  const existingFj = data.data?._fj;
  if (
    existingFj?.kind === POSITION_KIND &&
    existingFj.tokenMint &&
    existingFj.tokenMint !== tokenMint
  ) {
    throw new Error(
      `This trade is linked to ${existingFj.tokenSymbol || "another token"}. Use Swap from the header for a new token.`
    );
  }

  if (existingFj?.kind === POSITION_KIND) {
    return {
      id: data.id,
      trade_number: data.trade_number,
      data: data.data ?? {},
    };
  }

  return {
    id: data.id,
    trade_number: data.trade_number,
    data: tradeSeed({
      tokenMint,
      tokenSymbol,
      tokenName,
      pairUrl,
      imageUrl,
      executedAt,
      existing: data.data ?? {},
    }),
  };
}

/**
 * Append a buy/sell fill and refresh avg entry / invested / PnL mirrors.
 */
export async function appendFillToPosition({
  tradeId,
  tokenMint,
  tokenSymbol,
  tokenName,
  pairUrl,
  imageUrl,
  side,
  signature,
  quoteMint,
  quoteSymbol,
  quoteAmount,
  tokenAmount,
  priceUsd,
  usdValue,
  wallet,
  ts,
  blockTime,
}) {
  const executedAt =
    ts ??
    (blockTime != null
      ? new Date(blockTime > 1e12 ? blockTime : blockTime * 1000).toISOString()
      : undefined);

  let resolvedTradeId = tradeId;
  if (!resolvedTradeId && signature && side) {
    const existingTrade = await findTradeWithFillSignature(tokenMint, signature, side);
    if (existingTrade) resolvedTradeId = existingTrade.id;
  }

  const trade = await resolveTradeForFill({
    tradeId: resolvedTradeId,
    side,
    tokenMint,
    tokenSymbol,
    tokenName,
    pairUrl,
    imageUrl,
    executedAt,
  });

  const fj = trade.data._fj ?? {
    kind: POSITION_KIND,
    chain: "solana",
    tokenMint,
    tokenSymbol,
    fills: [],
  };

  // Dedupe by signature+side — still refresh ts from on-chain time if we have it
  const existingIdx = signature
    ? (fj.fills ?? []).findIndex((f) => f.signature === signature && f.side === side)
    : -1;
  if (existingIdx >= 0) {
    const existing = fj.fills[existingIdx];
    if (
      executedAt &&
      existing.ts &&
      Math.abs(Date.parse(existing.ts) - Date.parse(executedAt)) > 60_000
    ) {
      const fills = [...fj.fills];
      fills[existingIdx] = { ...existing, ts: executedAt };
      fills.sort((a, b) => Date.parse(a.ts || 0) - Date.parse(b.ts || 0));
      const computed = computePosition(fills);
      const closed = !isPositionLive(computed);
      const nextData = {
        ...trade.data,
        _fj: {
          ...fj,
          fills,
          computed,
          status: closed ? "closed" : "open",
          closedAt: closed ? fj.closedAt ?? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        },
      };
      await supabase.from("trades").update({ data: nextData }).eq("id", trade.id);
      return { tradeId: trade.id, data: nextData, deduped: true, tsFixed: true };
    }
    return { tradeId: trade.id, data: trade.data, deduped: true };
  }

  const fill = makeFill({
    side,
    signature,
    quoteMint,
    quoteSymbol,
    quoteAmount,
    tokenAmount,
    priceUsd,
    usdValue,
    wallet,
    ts: executedAt,
  });

  // Persist OHLC around the fill so entry charts survive API history loss
  const ohlcSnapshot = await captureFillOhlcSnapshot({
    mint: tokenMint,
    pairUrl: pairUrl || fj.pairUrl || null,
    aroundTs: fill.ts,
  });
  if (ohlcSnapshot) fill.ohlcSnapshot = ohlcSnapshot;

  const fills = [...(fj.fills ?? []), fill].sort(
    (a, b) => Date.parse(a.ts || 0) - Date.parse(b.ts || 0)
  );
  const computed = computePosition(fills);
  const closed = !isPositionLive(computed);
  const mirrored = mirrorJournalFields({
    symbol: tokenSymbol,
    computed,
    existing: trade.data,
  });

  const nextData = {
    ...trade.data,
    ...mirrored,
    _fj: {
      ...fj,
      tokenMint,
      tokenSymbol,
      tokenName: tokenName || fj.tokenName || tokenSymbol,
      pairUrl: pairUrl || fj.pairUrl || null,
      imageUrl: imageUrl || fj.imageUrl || null,
      fills,
      computed,
      status: closed ? "closed" : "open",
      closedAt: closed ? fj.closedAt ?? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("trades")
    .update({ data: nextData })
    .eq("id", trade.id);

  if (error) throw error;

  const repair = await repairTradeEpisodes(trade.id).catch(() => ({
    repaired: false,
    tradeId: trade.id,
  }));

  if (repair.repaired) {
    const { data: refreshed, error: refreshError } = await supabase
      .from("trades")
      .select("id, data, trade_number")
      .eq("id", repair.tradeId ?? trade.id)
      .single();
    if (!refreshError && refreshed) {
      return {
        tradeId: refreshed.id,
        data: refreshed.data,
        fill,
        computed: refreshed.data?._fj?.computed,
        deduped: false,
        episodesSplit: true,
      };
    }
  }

  return {
    tradeId: repair.tradeId ?? trade.id,
    data: nextData,
    fill,
    computed,
    deduped: false,
    episodesSplit: repair.repaired,
  };
}

/**
 * Journal a true wallet open (0 → buy) as a brand-new position row.
 * Never attaches to an existing live trade for the same mint.
 */
export async function journalOpenFromWallet({
  tokenMint,
  tokenSymbol,
  tokenName,
  pairUrl,
  imageUrl,
  signature,
  quoteMint,
  quoteSymbol,
  quoteAmount,
  tokenAmount,
  priceUsd,
  usdValue,
  wallet,
  ts,
  blockTime,
}) {
  const executedAt =
    ts ??
    (blockTime != null
      ? new Date(blockTime > 1e12 ? blockTime : blockTime * 1000).toISOString()
      : undefined);

  if (signature) {
    const existing = await findTradeWithFillSignature(tokenMint, signature, "buy");
    if (existing) {
      return { tradeId: existing.id, data: existing.data, deduped: true };
    }
  }

  const trade = await insertPositionTrade(
    tradeSeed({
      tokenMint,
      tokenSymbol,
      tokenName,
      pairUrl,
      imageUrl,
      executedAt,
    })
  );

  return appendFillToPosition({
    tradeId: trade.id,
    tokenMint,
    tokenSymbol,
    tokenName,
    pairUrl,
    imageUrl,
    side: "buy",
    signature,
    quoteMint,
    quoteSymbol,
    quoteAmount,
    tokenAmount,
    priceUsd,
    usdValue,
    wallet,
    ts: executedAt,
    blockTime,
  });
}

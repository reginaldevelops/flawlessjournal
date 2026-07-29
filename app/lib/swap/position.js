/**
 * Position fills → avg entry / invested / avg exit / realized PnL.
 *
 * A trade is always about the *position token* (the coin you buy).
 * Quote assets (Fartcoin, SOL, USDC) are payment rails, never the trade.
 */

function n(v) {
  const x = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
}

export function emptyComputed() {
  return {
    tokensBought: 0,
    tokensSold: 0,
    tokensOpen: 0,
    totalInvestedUsd: 0,
    totalProceedsUsd: 0,
    avgEntryUsd: null,
    avgExitUsd: null,
    realizedPnlUsd: 0,
    openCostUsd: 0,
  };
}

export function computePosition(fills = []) {
  let tokensBought = 0;
  let tokensSold = 0;
  let totalInvestedUsd = 0;
  let totalProceedsUsd = 0;
  let costBasisOpen = 0;

  for (const fill of fills) {
    const tokens = n(fill.tokenAmount);
    const usd = n(fill.usdValue);
    if (fill.side === "buy") {
      tokensBought += tokens;
      totalInvestedUsd += usd;
      costBasisOpen += usd;
    } else if (fill.side === "sell") {
      const openBefore = tokensBought - tokensSold;
      const avgEntry = openBefore > 0 ? costBasisOpen / openBefore : 0;
      const sold = Math.min(tokens, openBefore);
      const costOfSold = avgEntry * sold;
      costBasisOpen = Math.max(0, costBasisOpen - costOfSold);
      tokensSold += tokens;
      totalProceedsUsd += usd;
    }
  }

  const tokensOpen = Math.max(0, tokensBought - tokensSold);
  const avgEntryUsd = tokensBought > 0 ? totalInvestedUsd / tokensBought : null;
  const avgExitUsd = tokensSold > 0 ? totalProceedsUsd / tokensSold : null;

  // Realized = proceeds − cost basis of sold tokens (FIFO-avg)
  let realizedPnlUsd = 0;
  if (tokensSold > 0 && avgEntryUsd != null) {
    // Recompute realized via avg of all buys (standard avg-cost method)
    realizedPnlUsd = totalProceedsUsd - avgEntryUsd * tokensSold;
  }

  const openCostUsd = tokensOpen > 0 && avgEntryUsd != null ? avgEntryUsd * tokensOpen : 0;

  return {
    tokensBought,
    tokensSold,
    tokensOpen,
    totalInvestedUsd,
    totalProceedsUsd,
    avgEntryUsd,
    avgExitUsd,
    realizedPnlUsd,
    openCostUsd,
  };
}

/** Unrealized PnL for an open position at a live mark price. */
export function unrealizedPnlUsd(computed, markPriceUsd) {
  const tokens = n(computed?.tokensOpen);
  const openCost = n(computed?.openCostUsd);
  const px = n(markPriceUsd);
  if (tokens <= 0 || !(px > 0)) return null;
  return px * tokens - openCost;
}

export function isPositionLive(computed) {
  return n(computed?.tokensOpen) > 1e-12;
}

/** Sort fills oldest → newest. */
export function sortFillsChrono(fills = []) {
  return [...fills].sort(
    (a, b) => Date.parse(a.ts || 0) - Date.parse(b.ts || 0)
  );
}

/** Split fill history into separate open/close episodes (flat = boundary). */
export function splitFillEpisodes(fills = []) {
  const sorted = sortFillsChrono(fills);
  const episodes = [];
  let episode = [];

  for (const fill of sorted) {
    episode.push(fill);
    const c = computePosition(episode);
    if (c.tokensOpen <= 1e-12) {
      episodes.push(episode);
      episode = [];
    }
  }

  if (episode.length) episodes.push(episode);
  return episodes;
}

/** Timestamp when the current (last) episode started. */
export function currentEpisodeStartTs(fills = []) {
  const episodes = splitFillEpisodes(fills);
  const current = episodes[episodes.length - 1] ?? [];
  const first = current[0];
  return first?.ts ? Date.parse(first.ts) : 0;
}

/** Tokens open using only fills strictly before `beforeTs` (ISO string). */
export function tokensOpenBefore(fills, beforeTs) {
  const t = Date.parse(beforeTs || 0);
  if (!Number.isFinite(t)) return 0;
  const before = (fills ?? []).filter((f) => Date.parse(f.ts || 0) < t - 500);
  return computePosition(before).tokensOpen;
}

/** Mirror computed stats into flat journal keys the rest of FJ already understands. */
export function mirrorJournalFields({ symbol, computed, existing = {} }) {
  const pnlKey =
    Object.keys(existing).find((k) => k.toLowerCase() === "pnl") || "PnL";

  return {
    Coin: symbol,
    Coins: symbol,
    "Avg entry":
      computed.avgEntryUsd != null ? round(computed.avgEntryUsd, 8) : "",
    "Total invested": round(computed.totalInvestedUsd, 2),
    "Avg sell":
      computed.avgExitUsd != null ? round(computed.avgExitUsd, 8) : "",
    "Tokens open": round(computed.tokensOpen, 6),
    [pnlKey]: round(computed.realizedPnlUsd, 2),
  };
}

function round(v, dp) {
  const f = 10 ** dp;
  return Math.round(n(v) * f) / f;
}

export function makeFill({
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
}) {
  const executedAt =
    ts instanceof Date
      ? ts.toISOString()
      : typeof ts === "number"
        ? new Date(ts > 1e12 ? ts : ts * 1000).toISOString()
        : typeof ts === "string" && ts
          ? new Date(ts).toISOString()
          : new Date().toISOString();

  return {
    id: `${signature || Date.now()}-${side}`,
    side,
    ts: Number.isNaN(Date.parse(executedAt)) ? new Date().toISOString() : executedAt,
    signature: signature || null,
    quoteMint,
    quoteSymbol,
    quoteAmount: n(quoteAmount),
    tokenAmount: n(tokenAmount),
    priceUsd: n(priceUsd),
    usdValue: n(usdValue),
    wallet: wallet || null,
  };
}

/**
 * Compact OHLC snapshot attached to a fill so charts survive API history loss.
 */

import {
  fetchPositionChartWindow,
  pairAddressFromUrl,
} from "./fillChart";

const MAX_SNAPSHOT_CANDLES = 120;

/**
 * Fetch ~100 candles around a fill and return a storable snapshot.
 * Never throws — returns null on failure.
 */
export async function captureFillOhlcSnapshot({
  mint,
  pairUrl,
  aroundTs,
  interval,
} = {}) {
  try {
    const around = aroundTs || new Date().toISOString();
    const tf = interval || "5m";

    const window = await fetchPositionChartWindow({
      mint,
      pairUrl,
      fromTs: around,
      toTs: around,
      minCandles: 100,
      interval: tf,
      padMinutes: 0,
    });

    const candles = (window.candles || [])
      .slice(-MAX_SNAPSHOT_CANDLES)
      .map((c) => ({
        t: c.t,
        o: c.o,
        h: c.h,
        l: c.l,
        c: c.c,
        v: c.v,
      }));

    if (candles.length < 2) return null;

    return {
      source: "geckoterminal",
      pairAddress: window.pairAddress || pairAddressFromUrl(pairUrl) || null,
      pairUrl: window.pairUrl || pairUrl || null,
      interval: window.interval || window.timeframe || tf,
      candleSeconds: window.candleSeconds || null,
      aroundTs: around,
      candles,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[ohlc-snapshot]", err?.message || err);
    return null;
  }
}

/** Merge snapshots from fills into one candle series (dedupe by t). */
export function mergeFillSnapshots(fills = []) {
  const byT = new Map();
  let pairUrl = null;
  let pairAddress = null;
  let interval = null;
  let candleSeconds = null;

  for (const f of fills) {
    const snap = f?.ohlcSnapshot;
    if (!snap?.candles?.length) continue;
    if (!pairUrl && snap.pairUrl) pairUrl = snap.pairUrl;
    if (!pairAddress && snap.pairAddress) pairAddress = snap.pairAddress;
    if (!interval && snap.interval) interval = snap.interval;
    if (!candleSeconds && snap.candleSeconds) candleSeconds = snap.candleSeconds;
    for (const c of snap.candles) {
      if (c?.t == null) continue;
      byT.set(c.t, c);
    }
  }

  const candles = [...byT.values()].sort((a, b) => a.t - b.t);
  if (candles.length < 2) return null;
  return {
    source: "snapshot",
    pairUrl,
    pairAddress,
    interval,
    timeframe: interval,
    candleSeconds,
    candles,
    fromTs: candles[0].t,
    toTs: candles[candles.length - 1].t,
    fetchedAt: new Date().toISOString(),
  };
}

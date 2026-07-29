/**
 * Historical OHLCV for Solana positions.
 * Pair discovery: DexScreener. Candles: GeckoTerminal (free, no key).
 */

import { fetchJson } from "../chain/http";
import { DEX_API } from "../scanner/constants";
import {
  CHART_TIMEFRAMES,
  pickTimeframe,
  pickTimeframeForTarget,
  resolveChartTimeframe,
  suggestIntervalFromTradeDuration,
} from "./chartIntervals";

export {
  CHART_TIMEFRAMES,
  pickTimeframe,
  pickTimeframeForTarget,
  resolveChartTimeframe,
  suggestIntervalFromTradeDuration,
} from "./chartIntervals";

export const GECKO_API = "https://api.geckoterminal.com/api/v2";

const NETWORK = "solana";

function num(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function toUnixSeconds(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

/** Extract Solana pair address from a DexScreener URL when present. */
export function pairAddressFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(
    /dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{32,48})/i
  );
  return m?.[1] || null;
}

/**
 * Pick the highest-liquidity Solana pair for a mint.
 */
export async function resolveSolanaPair({ mint, pairAddress, pairUrl } = {}) {
  const fromUrl = pairAddressFromUrl(pairUrl);
  const known = pairAddress || fromUrl;
  if (known) {
    return {
      pairAddress: known,
      pairUrl: pairUrl || `https://dexscreener.com/solana/${known}`,
      dexId: null,
      priceUsd: null,
    };
  }

  if (!mint) return null;

  const data = await fetchJson(
    `${DEX_API}/tokens/v1/${NETWORK}/${encodeURIComponent(mint)}`,
    { label: "dex-pair", timeout: 12_000, retries: 1 }
  );
  const pairs = Array.isArray(data) ? data : [];
  let best = null;
  let bestLiq = -1;
  for (const p of pairs) {
    if (!p?.pairAddress) continue;
    if (p.chainId && String(p.chainId).toLowerCase() !== NETWORK) continue;
    const liq = num(p.liquidity?.usd, 0);
    if (liq > bestLiq) {
      bestLiq = liq;
      best = p;
    }
  }
  if (!best) return null;
  return {
    pairAddress: best.pairAddress,
    pairUrl: best.url || `https://dexscreener.com/solana/${best.pairAddress}`,
    dexId: best.dexId || null,
    priceUsd: num(best.priceUsd, null),
  };
}

function parseCandles(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((row) => {
      const t = num(row?.[0], NaN);
      const o = num(row?.[1], NaN);
      const h = num(row?.[2], NaN);
      const l = num(row?.[3], NaN);
      const c = num(row?.[4], NaN);
      const v = num(row?.[5], 0);
      if (![t, o, h, l, c].every(Number.isFinite)) return null;
      return { t, o, h, l, c, v };
    })
    .filter(Boolean);
}

async function fetchGeckoOhlcv({ pairAddress, timeframe, aggregate, before, limit }) {
  const url =
    `${GECKO_API}/networks/${NETWORK}/pools/${encodeURIComponent(pairAddress)}` +
    `/ohlcv/${timeframe}?aggregate=${aggregate}` +
    `&before_timestamp=${before}&limit=${limit}&currency=usd&token=base`;

  const json = await fetchJson(url, {
    label: "gecko-ohlcv",
    timeout: 15_000,
    retries: 1,
  });
  return parseCandles(json?.data?.attributes?.ohlcv_list);
}

/**
 * Fetch OHLCV candles for [fromTs, toTs] (unix or ISO), with padding.
 * Expands the window so the response has at least `minCandles` bars when possible.
 */
export async function fetchPositionChartWindow({
  mint,
  pairAddress,
  pairUrl,
  fromTs,
  toTs,
  padMinutes,
  minCandles = 100,
  interval = null,
} = {}) {
  let from = toUnixSeconds(fromTs);
  let to = toUnixSeconds(toTs);
  if (!from && !to) throw new Error("from/to timestamp required");
  if (!from) from = to;
  if (!to) to = from;
  if (to < from) [from, to] = [to, from];

  const pair = await resolveSolanaPair({ mint, pairAddress, pairUrl });
  if (!pair?.pairAddress) {
    throw new Error("No Solana pool found for this token");
  }

  const target = Math.max(40, Math.min(300, Number(minCandles) || 100));
  const tradeSpanSeconds = Math.max(60, to - from);
  const suggested = suggestIntervalFromTradeDuration(tradeSpanSeconds);
  const forced = resolveChartTimeframe(interval);

  const spanMin = Math.max(1, tradeSpanSeconds / 60);
  const pad = Math.max(
    30,
    padMinutes != null && Number.isFinite(Number(padMinutes))
      ? Number(padMinutes)
      : Math.max(45, Math.round(spanMin * 0.25))
  );

  const nowSec = Math.floor(Date.now() / 1000);
  let rightEdge = Math.min(nowSec, to + pad * 60);
  let leftEdge = from - pad * 60;
  if (rightEdge - leftEdge < pad * 60) {
    leftEdge = rightEdge - Math.max(pad * 2, 90) * 60;
  }

  let spanSeconds = Math.max(60, rightEdge - leftEdge);
  let tf = forced || pickTimeframeForTarget(spanSeconds, target);

  // Expand window so we still get ~target candles at the chosen TF
  const minSpanSeconds = target * tf.seconds;
  if (spanSeconds < minSpanSeconds) {
    leftEdge = rightEdge - minSpanSeconds;
    spanSeconds = minSpanSeconds;
    if (!forced) {
      tf = pickTimeframeForTarget(spanSeconds, target);
      const adjusted = target * tf.seconds;
      if (rightEdge - leftEdge < adjusted) leftEdge = rightEdge - adjusted;
      spanSeconds = rightEdge - leftEdge;
    }
  }

  const limit = Math.min(
    1000,
    Math.max(target, Math.ceil(spanSeconds / tf.seconds) + 16)
  );

  const raw = await fetchGeckoOhlcv({
    pairAddress: pair.pairAddress,
    timeframe: tf.timeframe,
    aggregate: tf.aggregate,
    before: rightEdge,
    limit,
  });

  const candles = raw
    .filter((c) => c.t >= leftEdge - tf.seconds && c.t <= rightEdge + tf.seconds)
    .sort((a, b) => a.t - b.t);

  return {
    mint: mint || null,
    pairAddress: pair.pairAddress,
    pairUrl: pair.pairUrl,
    fromTs: leftEdge,
    toTs: rightEdge,
    windowMinutes: Math.round((rightEdge - leftEdge) / 60),
    timeframe: tf.label,
    interval: tf.id || tf.label,
    intervalMode: forced ? "manual" : "auto",
    suggestedInterval: suggested,
    candleSeconds: tf.seconds,
    minCandles: target,
    candles,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Live chart window: last N candles from now (terminal / pair view).
 */
export async function fetchLiveChartWindow({
  mint,
  pairAddress,
  pairUrl,
  interval = "5m",
  limit = 300,
} = {}) {
  const pair = await resolveSolanaPair({ mint, pairAddress, pairUrl });
  if (!pair?.pairAddress) {
    throw new Error("No Solana pool found for this token");
  }

  const tf = resolveChartTimeframe(interval) || CHART_TIMEFRAMES[1];
  const target = Math.max(40, Math.min(1000, Number(limit) || 300));
  const nowSec = Math.floor(Date.now() / 1000);

  const raw = await fetchGeckoOhlcv({
    pairAddress: pair.pairAddress,
    timeframe: tf.timeframe,
    aggregate: tf.aggregate,
    before: nowSec,
    limit: target,
  });

  const candles = raw.sort((a, b) => a.t - b.t);
  const leftEdge = candles[0]?.t ?? nowSec - target * tf.seconds;

  return {
    mint: mint || null,
    pairAddress: pair.pairAddress,
    pairUrl: pair.pairUrl,
    dexId: pair.dexId,
    priceUsd: pair.priceUsd,
    fromTs: leftEdge,
    toTs: nowSec,
    timeframe: tf.label,
    interval: tf.id,
    intervalMode: "manual",
    candleSeconds: tf.seconds,
    candles,
    live: true,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Back-compat: single fill centered window.
 */
export async function fetchFillChartWindow({
  mint,
  pairAddress,
  pairUrl,
  aroundTs,
  windowMinutes = 60,
} = {}) {
  const around = toUnixSeconds(aroundTs);
  if (!around) throw new Error("around timestamp required");
  const half = Math.max(10, Math.round(Number(windowMinutes) || 60) / 2);
  return fetchPositionChartWindow({
    mint,
    pairAddress,
    pairUrl,
    fromTs: around - half * 60,
    toTs: around + half * 60,
    padMinutes: 0,
  });
}

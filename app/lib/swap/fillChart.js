/**
 * Historical price snippets around a fill timestamp.
 * Pair discovery: DexScreener. Candles: GeckoTerminal OHLCV (free, no key).
 */

import { fetchJson } from "../chain/http";
import { DEX_API } from "../scanner/constants";

export const GECKO_API = "https://api.geckoterminal.com/api/v2";

const NETWORK = "solana";

function num(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function toUnixSeconds(value) {
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
 * @returns {Promise<{ pairAddress: string, pairUrl: string|null, dexId: string|null, priceUsd: number|null }|null>}
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

/**
 * Choose candle size so a window still has a readable number of points.
 */
export function pickTimeframe(windowMinutes) {
  const w = Math.max(15, Number(windowMinutes) || 60);
  if (w <= 45) return { timeframe: "minute", aggregate: 1, label: "1m", seconds: 60 };
  if (w <= 180) return { timeframe: "minute", aggregate: 5, label: "5m", seconds: 300 };
  if (w <= 720) return { timeframe: "minute", aggregate: 15, label: "15m", seconds: 900 };
  return { timeframe: "hour", aggregate: 1, label: "1h", seconds: 3600 };
}

/**
 * Fetch OHLCV candles centered on `aroundTs`.
 * Gecko only returns candles *before* a timestamp — we request past the right
 * edge, then keep the window around the fill.
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

  const pair = await resolveSolanaPair({ mint, pairAddress, pairUrl });
  if (!pair?.pairAddress) {
    throw new Error("No Solana pool found for this token");
  }

  const half = Math.max(10, Math.round(Number(windowMinutes) || 60) / 2);
  const tf = pickTimeframe(half * 2);
  const nowSec = Math.floor(Date.now() / 1000);
  const rightEdge = Math.min(nowSec, around + Math.round(half * 60));
  const leftEdge = around - Math.round(half * 60);
  // If the fill is near "now", bias the window to the left so we still get history
  const effectiveLeft =
    rightEdge - leftEdge < half * 60
      ? rightEdge - Math.round(half * 2 * 60)
      : leftEdge;
  const spanSeconds = Math.max(tf.seconds * 12, rightEdge - effectiveLeft);
  const limit = Math.min(1000, Math.max(12, Math.ceil(spanSeconds / tf.seconds) + 8));

  const url =
    `${GECKO_API}/networks/${NETWORK}/pools/${encodeURIComponent(pair.pairAddress)}` +
    `/ohlcv/${tf.timeframe}?aggregate=${tf.aggregate}` +
    `&before_timestamp=${rightEdge}&limit=${limit}&currency=usd&token=base`;

  const json = await fetchJson(url, {
    label: "gecko-ohlcv",
    timeout: 15_000,
    retries: 1,
  });

  const raw = json?.data?.attributes?.ohlcv_list;
  const list = Array.isArray(raw) ? raw : [];

  // API returns newest-first: [ts, o, h, l, c, vol]
  const candles = list
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
    .filter(Boolean)
    .filter(
      (c) =>
        c.t >= effectiveLeft - tf.seconds && c.t <= rightEdge + tf.seconds
    )
    .sort((a, b) => a.t - b.t);

  return {
    mint: mint || null,
    pairAddress: pair.pairAddress,
    pairUrl: pair.pairUrl,
    aroundTs: around,
    windowMinutes: Math.round((rightEdge - effectiveLeft) / 60) || half * 2,
    timeframe: tf.label,
    candles,
    fetchedAt: new Date().toISOString(),
  };
}

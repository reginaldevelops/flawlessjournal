/**
 * USD prices and 24h change.
 *
 * Primary source is Jupiter price v3, which answers with
 * `{ "<mint>": { usdPrice, priceChange24h, decimals, liquidity } }` and simply
 * omits `usdPrice` for mints without a tradable route. CoinGecko backs it up for
 * the handful of non-Solana assets (ETH and friends) and for SOL if Jupiter is
 * unreachable.
 */

import { createCache, chunk } from "./cache";
import { fetchJson } from "./http";
import { SOL_MINT } from "./constants";

const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v3";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";
const BATCH_SIZE = 40;

const priceCache = createCache({ ttl: 60_000, name: "prices" });
const geckoCache = createCache({ ttl: 60_000, name: "coingecko" });

const EMPTY = { price: null, change24h: null };

/**
 * @returns {Promise<{ prices: Map<string, {price:number|null, change24h:number|null}>, errors: string[] }>}
 */
export async function getSolanaPrices(mints) {
  const unique = [...new Set(mints.filter(Boolean))];
  const prices = new Map();
  const missing = [];
  const errors = [];

  for (const mint of unique) {
    const cached = priceCache.get(mint);
    if (cached) prices.set(mint, cached);
    else missing.push(mint);
  }

  if (!missing.length) return { prices, errors };

  const batches = chunk(missing, BATCH_SIZE);
  const results = await Promise.allSettled(
    batches.map((batch) =>
      fetchJson(`${JUPITER_PRICE_URL}?ids=${batch.join(",")}`, {
        label: "Jupiter prices",
        timeout: 9000,
      })
    )
  );

  const seen = new Set();
  results.forEach((result) => {
    if (result.status !== "fulfilled") {
      errors.push(result.reason?.message ?? "Jupiter prices failed");
      return;
    }
    for (const [mint, entry] of Object.entries(result.value ?? {})) {
      const value = {
        price: Number.isFinite(entry?.usdPrice) ? entry.usdPrice : null,
        change24h: Number.isFinite(entry?.priceChange24h) ? entry.priceChange24h : null,
      };
      priceCache.set(mint, value);
      prices.set(mint, value);
      seen.add(mint);
    }
  });

  for (const mint of missing) {
    if (seen.has(mint)) continue;
    priceCache.set(mint, EMPTY);
    prices.set(mint, EMPTY);
  }

  return { prices, errors: [...new Set(errors)] };
}

/** CoinGecko simple/price for a list of coin ids, with 24h change. */
export async function getCoinGeckoPrices(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const prices = new Map();
  const missing = [];
  const errors = [];

  for (const id of unique) {
    const cached = geckoCache.get(id);
    if (cached) prices.set(id, cached);
    else missing.push(id);
  }

  if (!missing.length) return { prices, errors };

  try {
    const data = await fetchJson(
      `${COINGECKO_URL}?ids=${missing.join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { label: "CoinGecko prices", timeout: 9000 }
    );
    for (const id of missing) {
      const entry = data?.[id];
      const value = {
        price: Number.isFinite(entry?.usd) ? entry.usd : null,
        change24h: Number.isFinite(entry?.usd_24h_change) ? entry.usd_24h_change : null,
      };
      geckoCache.set(id, value);
      prices.set(id, value);
    }
  } catch (error) {
    errors.push(error?.message ?? "CoinGecko prices failed");
    for (const id of missing) prices.set(id, EMPTY);
  }

  return { prices, errors };
}

/** SOL price with a CoinGecko fallback, used for the native balance. */
export async function getSolPrice() {
  const { prices, errors } = await getSolanaPrices([SOL_MINT]);
  const jupiter = prices.get(SOL_MINT);
  if (jupiter?.price) return { ...jupiter, errors };

  const fallback = await getCoinGeckoPrices(["solana"]);
  const gecko = fallback.prices.get("solana");
  return {
    price: gecko?.price ?? null,
    change24h: gecko?.change24h ?? null,
    errors: [...errors, ...fallback.errors],
  };
}

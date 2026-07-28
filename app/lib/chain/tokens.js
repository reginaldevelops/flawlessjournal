/**
 * SPL token metadata (symbol / name / logo / decimals) resolved through the
 * Jupiter token search API, batched and cached for a day.
 *
 * Verified against https://lite-api.jup.ag/tokens/v2/search?query=<mint>[,<mint>…]
 * which answers with an array of `{ id, name, symbol, icon, decimals, isVerified,
 * usdPrice, tags }` objects.
 */

import { createCache, chunk } from "./cache";
import { fetchJson } from "./http";

const SEARCH_URL = "https://lite-api.jup.ag/tokens/v2/search";
const BATCH_SIZE = 40;
const TTL = 24 * 60 * 60 * 1000;
const MISS_TTL = 30 * 60 * 1000;

const metaCache = createCache({ ttl: TTL, name: "token-meta" });

/** Anything we could not resolve still gets a presentable row. */
export function fallbackMeta(mint, decimals = 0) {
  const id = String(mint ?? "");
  return {
    mint: id,
    symbol: id ? `${id.slice(0, 4)}…${id.slice(-4)}` : "Unknown",
    name: "Unrecognised token",
    logo: null,
    decimals,
    verified: false,
    unknown: true,
    price: null,
  };
}

function normalize(entry) {
  return {
    mint: entry.id,
    symbol: String(entry.symbol ?? "").trim() || fallbackMeta(entry.id).symbol,
    name: String(entry.name ?? "").trim() || "Unnamed token",
    logo: entry.icon ?? null,
    decimals: Number.isFinite(entry.decimals) ? entry.decimals : 0,
    verified: Boolean(entry.isVerified) || (entry.tags ?? []).includes("verified"),
    unknown: false,
    // The search payload carries a price too; handy as a fallback when the
    // dedicated price endpoint has no entry for a mint.
    price: Number.isFinite(entry.usdPrice) ? entry.usdPrice : null,
  };
}

/**
 * Resolves metadata for a list of mints.
 * Returns `{ meta: Map<mint, meta>, errors: string[] }` — a failed batch degrades
 * to fallback metadata instead of failing the caller.
 */
export async function resolveTokenMeta(mints) {
  const unique = [...new Set(mints.filter(Boolean))];
  const meta = new Map();
  const missing = [];
  const errors = [];

  for (const mint of unique) {
    const cached = metaCache.get(mint);
    if (cached) meta.set(mint, cached);
    else missing.push(mint);
  }

  if (!missing.length) return { meta, errors };

  const batches = chunk(missing, BATCH_SIZE);
  const results = await Promise.allSettled(
    batches.map((batch) =>
      fetchJson(`${SEARCH_URL}?query=${batch.join(",")}`, {
        label: "Jupiter token search",
        timeout: 9000,
      })
    )
  );

  const resolved = new Set();
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      errors.push(result.reason?.message ?? "Jupiter token search failed");
      return;
    }
    const list = Array.isArray(result.value) ? result.value : [];
    for (const entry of list) {
      if (!entry?.id || !batches[index].includes(entry.id)) continue;
      const normalized = normalize(entry);
      metaCache.set(entry.id, normalized);
      meta.set(entry.id, normalized);
      resolved.add(entry.id);
    }
  });

  // Mints the API does not know about: remember the miss for a while so a wallet
  // full of junk accounts does not re-query on every refresh.
  for (const mint of missing) {
    if (resolved.has(mint)) continue;
    const placeholder = fallbackMeta(mint);
    metaCache.set(mint, placeholder, MISS_TTL);
    meta.set(mint, placeholder);
  }

  return { meta, errors: [...new Set(errors)] };
}

export function peekTokenMeta(mint) {
  return metaCache.get(mint);
}

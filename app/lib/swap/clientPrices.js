/**
 * Client Jupiter price helper for live mark PnL.
 */

import { JUPITER_PRICE_API } from "./constants";

/**
 * @param {string[]} mints
 * @returns {Promise<Record<string, number|null>>}
 */
export async function fetchUsdPrices(mints) {
  const ids = [...new Set((mints || []).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const res = await fetch(`${JUPITER_PRICE_API}?ids=${ids.join(",")}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = await res.json();
    const out = {};
    for (const mint of ids) {
      const px = data?.[mint]?.usdPrice;
      out[mint] = Number.isFinite(px) ? px : null;
    }
    return out;
  } catch {
    return {};
  }
}

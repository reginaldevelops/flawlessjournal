/**
 * Pure open-sync helpers (no Supabase / browser) — safe for Node unit tests.
 */

/** Wallet held effectively zero of the token before the buy. */
export const OPEN_PRE_EPS = 1e-12;

/** Pure: is this classified swap a true open? Requires on-chain tokenPre. */
export function isTrueOpenSwap(swap) {
  if (!swap || swap.side !== "buy") return false;
  if (!swap.tokenMint || !swap.signature) return false;
  if (swap.tokenPre == null || swap.tokenPre === "") return false;
  const pre = Number(swap.tokenPre);
  if (!Number.isFinite(pre)) return false;
  return pre <= OPEN_PRE_EPS;
}

export function filterOpenSwaps(swaps = []) {
  return (swaps || []).filter(isTrueOpenSwap);
}

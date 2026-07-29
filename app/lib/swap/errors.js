/** Jupiter Swap program: 6001 = SlippageToleranceExceeded (0x1771). */
export function isSlippageRpcError(message) {
  const s = String(message ?? "").toLowerCase();
  return (
    s.includes("0x1771") ||
    s.includes("6001") ||
    s.includes("slippage") ||
    s.includes("exactoutamountnotmatched")
  );
}

export function formatSlippageExceededError(slippageBps = 50) {
  const pct = (Number(slippageBps) / 100).toFixed(1);
  return `Slippage tolerance exceeded (limit ${pct}%). Price moved before the swap landed. Try again — the quote refreshes every few seconds — or raise slippage in Swap settings (e.g. 4% for volatile tokens).`;
}

export function isSimulationRpcError(message) {
  const s = String(message ?? "").toLowerCase();
  return s.includes("simulation failed") || s.includes("preflight");
}

/** Jupiter route / underlying DEX simulation failure (often stale quote or already swapped). */
export function isRouteSimulationError(message) {
  const s = String(message ?? "").toLowerCase();
  return (
    isSimulationRpcError(s) &&
    (s.includes("0x1900") ||
      s.includes("0x1788") ||
      s.includes("0x1771") ||
      s.includes("custom program error"))
  );
}

export function formatSwapExecutionError(err, { slippageBps } = {}) {
  const raw = String(err?.message ?? err ?? "Swap failed");
  if (isSlippageRpcError(raw)) {
    return formatSlippageExceededError(slippageBps ?? 50);
  }
  if (/403|access forbidden|forbidden/i.test(raw)) {
    return "Solana RPC blocked the transaction (403). Retry in a moment — if it persists, add SOLANA_RPC_URL (Helius/QuickNode) in Vercel env.";
  }
  if (/simulation failed/i.test(raw) && /insufficient/i.test(raw)) {
    return "Insufficient balance for this swap amount (include SOL for fees).";
  }
  if (isRouteSimulationError(raw)) {
    return "Swap simulation failed — the quote may be stale, or a previous attempt already went through (check your wallet). Wait for the live quote to refresh before retrying.";
  }
  if (/blockhash|expired|timed out|timeout/i.test(raw)) {
    return "Transaction expired or confirmation timed out — check your wallet before retrying. If tokens moved, do not submit again with the same amount.";
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
}

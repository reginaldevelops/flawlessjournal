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

export function formatSwapExecutionError(err) {
  const raw = String(err?.message ?? err ?? "Swap failed");
  if (isSlippageRpcError(raw)) {
    return "Price moved too fast (slippage exceeded). Try again — we’ll use 4% slippage, or pick 4% in swap settings for volatile tokens.";
  }
  if (/403|access forbidden|forbidden/i.test(raw)) {
    return "Solana RPC blocked the transaction (403). Retry in a moment — if it persists, add SOLANA_RPC_URL (Helius/QuickNode) in Vercel env.";
  }
  if (/simulation failed/i.test(raw) && /insufficient/i.test(raw)) {
    return "Insufficient balance for this swap amount (include SOL for fees).";
  }
  if (/blockhash|expired/i.test(raw)) {
    return "Transaction expired — try the swap again.";
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
}

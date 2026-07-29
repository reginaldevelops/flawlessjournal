/** Server-side Solana JSON-RPC URL (supports private Helius/QuickNode keys). */
export function getServerRpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://solana-rpc.publicnode.com"
  );
}

/** Methods the browser may invoke via /api/solana/rpc. */
export const ALLOWED_RPC_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getRecentPrioritizationFees",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "getVersion",
  "sendTransaction",
  "simulateTransaction",
]);

/** Client Connection endpoint — proxy avoids browser 403 on public RPC. */
export function getClientRpcEndpoint() {
  const explicit = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/solana/rpc`;
  }
  return getServerRpcUrl();
}

export function parseRpcErrorMessage(body, fallback = "RPC request failed") {
  if (!body) return fallback;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return parsed?.error?.message || fallback;
    } catch {
      return body.slice(0, 160) || fallback;
    }
  }
  return body?.error?.message || fallback;
}

/** Server-side Solana JSON-RPC URL (supports private Helius/QuickNode keys). */
export function getServerRpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

/** Ordered RPC endpoints for server-side calls (portfolio, wallet sync, broadcast). */
export function getServerRpcCandidates(preferred) {
  const seen = new Set();
  const out = [];
  for (const url of [preferred, getServerRpcUrl(), "https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function isBlockedRpcError(message = "") {
  return /blocked|forbidden|-32602|HTTP 403/i.test(String(message));
}

/**
 * POST a JSON-RPC call, trying fallbacks when a provider blocks certain methods
 * (e.g. publicnode rejects getTokenAccountsByOwner with programId).
 */
export async function postServerRpc(method, params, { preferredUrl, timeout = 12_000, label } = {}) {
  const { fetchJson } = await import("../chain/http");
  let lastError = null;

  for (const url of getServerRpcCandidates(preferredUrl)) {
    try {
      const json = await fetchJson(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        label: label || `Solana RPC (${method})`,
        timeout,
        retries: 1,
      });
      if (json?.error) {
        const msg = json.error.message || "RPC error";
        if (isBlockedRpcError(msg)) {
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      return json;
    } catch (error) {
      lastError = error;
      if (!isBlockedRpcError(error?.message)) throw error;
    }
  }

  throw lastError ?? new Error("All Solana RPC endpoints failed");
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

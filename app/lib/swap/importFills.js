/**
 * Client helpers: sync state in localStorage + import fills into journal.
 */

import { appendFillToPosition } from "./journal";

const STATE_KEY = "flawless.walletSync.state";
export const AUTO_SYNC_MS = 24 * 60 * 60 * 1000;

export function loadSyncState() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || "{}") ?? {};
  } catch {
    return {};
  }
}

export function getWalletSyncMeta(address) {
  const all = loadSyncState();
  return all[address] ?? null;
}

export function saveWalletSyncMeta(address, patch) {
  if (typeof window === "undefined") return;
  const all = loadSyncState();
  all[address] = { ...(all[address] ?? {}), ...patch, address };
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all[address];
}

export function shouldAutoSync(address) {
  const meta = getWalletSyncMeta(address);
  if (!meta?.lastAt) return true;
  return Date.now() - new Date(meta.lastAt).getTime() >= AUTO_SYNC_MS;
}

/**
 * Fetch classified swaps from the API then journal them.
 */
export async function runWalletSync(address, { limit = 40, quiet = false } = {}) {
  const meta = getWalletSyncMeta(address);
  const res = await fetch("/api/wallet/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      limit,
      untilSignature: meta?.lastSignature || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);

  const imported = [];
  const deduped = [];
  const errors = [];

  // Oldest first so avg entry builds chronologically
  const ordered = [...(data.swaps ?? [])].reverse();

  for (const swap of ordered) {
    try {
      const result = await appendFillToPosition({
        tokenMint: swap.tokenMint,
        tokenSymbol: swap.tokenSymbol,
        tokenName: swap.tokenName,
        imageUrl: swap.imageUrl,
        side: swap.side,
        signature: swap.signature,
        quoteMint: swap.quoteMint,
        quoteSymbol: swap.quoteSymbol,
        quoteAmount: swap.quoteAmount,
        tokenAmount: swap.tokenAmount,
        priceUsd: swap.priceUsd,
        usdValue: swap.usdValue,
        wallet: address,
        blockTime: swap.blockTime,
      });
      if (result.deduped) deduped.push(swap);
      else imported.push({ ...swap, tradeId: result.tradeId });
    } catch (err) {
      errors.push({ signature: swap.signature, message: err.message });
    }
  }

  const newestSig =
    data.newestSignature || data.swaps?.[0]?.signature || meta?.lastSignature || null;
  saveWalletSyncMeta(address, {
    lastAt: new Date().toISOString(),
    lastSignature: newestSig,
    lastImported: imported.length,
    lastScanned: data.scanned,
  });

  return {
    ...data,
    imported,
    deduped,
    errors,
    quiet,
  };
}

/**
 * Client helpers: sync state in localStorage + import fills into journal.
 */

import { appendFillToPosition } from "./journal";
import { SYNC_BATCH_DEFAULT } from "./constants";

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

function formatDays(days) {
  if (days == null || !Number.isFinite(days)) return null;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
}

/** Human label for live sync progress events from the NDJSON stream. */
export function formatSyncProgress(ev) {
  if (!ev || typeof ev !== "object") return "";
  if (ev.type === "phase") return ev.message || "";
  if (ev.type === "start") {
    const days = formatDays(ev.lookbackDays);
    const span = days ? ` spanning ~${days}` : "";
    if (!ev.total) return ev.message || "No new transactions in this batch";
    return `Scanning ${ev.total} tx${ev.total === 1 ? "" : "s"}${span} (batch ≤${ev.batchLimit ?? "?"})`;
  }
  if (ev.type === "progress") {
    const scanned = ev.scanned ?? 0;
    const total = ev.total ?? 0;
    const swaps = ev.swapsFound ?? 0;
    const pct = total > 0 ? Math.round((scanned / total) * 100) : 0;
    return `${scanned}/${total} (${pct}%) · ${swaps} swap${swaps === 1 ? "" : "s"} found`;
  }
  if (ev.type === "done") {
    const days = formatDays(ev.lookbackDays);
    const span = days ? ` · ~${days} lookback` : "";
    return `Done · ${ev.scanned ?? 0}/${ev.total ?? 0} scanned · ${ev.swaps?.length ?? ev.swapsFound ?? 0} swaps${span}`;
  }
  return ev.message || "";
}

async function readSyncStream(res, onProgress) {
  if (!res.body) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);
    return data;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let ev;
      try {
        ev = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (ev.type === "result") {
        result = ev;
        continue;
      }
      if (ev.type === "error") {
        throw new Error(ev.error || "Wallet sync failed");
      }
      onProgress?.(ev);
    }
  }

  if (buf.trim()) {
    try {
      const ev = JSON.parse(buf.trim());
      if (ev.type === "result") result = ev;
      else if (ev.type === "error") throw new Error(ev.error || "Wallet sync failed");
      else onProgress?.(ev);
    } catch (e) {
      if (e instanceof SyntaxError) {
        /* ignore trailing junk */
      } else {
        throw e;
      }
    }
  }

  if (!result) throw new Error("Sync ended without a result");
  return result;
}

/**
 * Fetch classified swaps from the API then journal them.
 * @param {string} address
 * @param {{
 *   limit?: number,
 *   quiet?: boolean,
 *   older?: boolean,
 *   onProgress?: (ev: object) => void,
 * }} [opts]
 */
export async function runWalletSync(address, opts = {}) {
  const {
    limit = SYNC_BATCH_DEFAULT,
    quiet = false,
    older = false,
    onProgress,
  } = opts;

  const meta = getWalletSyncMeta(address);
  const untilSignature = older ? null : meta?.lastSignature || null;
  const before = older ? meta?.oldestSignature || null : null;

  if (older && !before) {
    throw new Error("Nothing older to scan yet — run Sync once first");
  }

  const res = await fetch("/api/wallet/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      limit,
      untilSignature,
      before,
    }),
  });

  if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Sync failed (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`Sync failed (${res.status})`);
  }

  const data = await readSyncStream(res, onProgress);

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

  const patch = {
    lastAt: new Date().toISOString(),
    lastImported: imported.length,
    lastScanned: data.scanned,
    lastTotal: data.total,
    lastLookbackDays: data.lookbackDays ?? null,
  };

  if (older) {
    // Keep newest cursor; walk oldest further back
    if (data.oldestSignature) patch.oldestSignature = data.oldestSignature;
    patch.hasMoreOlder = Boolean(data.hasMoreOlder);
    if (!meta?.lastSignature && data.newestSignature) {
      patch.lastSignature = data.newestSignature;
    }
  } else {
    const newestSig =
      data.newestConfirmedSignature ||
      data.newestSignature ||
      data.swaps?.[0]?.signature ||
      meta?.lastSignature ||
      null;
    if (newestSig) patch.lastSignature = newestSig;
    // Establish oldest cursor once (first sync) so "Older" can page back
    if (!meta?.oldestSignature && data.oldestSignature) {
      patch.oldestSignature = data.oldestSignature;
      patch.hasMoreOlder = Boolean(data.hasMoreOlder);
    } else if (meta?.hasMoreOlder == null) {
      patch.hasMoreOlder = Boolean(data.hasMoreOlder);
    }
  }

  saveWalletSyncMeta(address, patch);

  return {
    ...data,
    imported,
    deduped,
    errors,
    quiet,
    older,
  };
}

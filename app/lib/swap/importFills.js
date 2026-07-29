/**
 * Client helpers: sync state in localStorage + import fills into journal.
 */

import { appendFillToPosition } from "./journal";
import { buildImportPlan } from "./importPlan";
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

/** Drop sync cursors so the next Sync scans from the newest txs again. */
export function clearWalletSyncMeta(address) {
  if (typeof window === "undefined" || !address) return;
  const all = loadSyncState();
  delete all[address];
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function blockTimeToIso(blockTime) {
  const ts = Number(blockTime);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

function blockTimeLabel(blockTime) {
  const ts = Number(blockTime);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatScanRange(newestTime, oldestTime) {
  const oldest = blockTimeLabel(oldestTime);
  const newest = blockTimeLabel(newestTime);
  if (oldest && newest && oldest !== newest) return `${oldest} – ${newest}`;
  return oldest || newest || null;
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
    const range = formatScanRange(ev.newestTime, ev.oldestTime);
    const span = range ? ` · ${range}` : formatDays(ev.lookbackDays) ? ` · ~${formatDays(ev.lookbackDays)} batch span` : "";
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
    const range = formatScanRange(ev.newestTime, ev.oldestTime);
    const span = range ? ` · ${range}` : "";
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
  let lastProgress = null;

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
      if (ev.type === "progress" || ev.type === "done" || ev.type === "start") {
        lastProgress = ev;
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
        /* truncated stream — fall through */
      } else {
        throw e;
      }
    }
  }

  if (!result) {
    if (lastProgress?.scanned != null && lastProgress?.total != null) {
      throw new Error(
        `Sync timed out after ${lastProgress.scanned}/${lastProgress.total} txs — server cut off before finishing. Retry Sync; if it keeps failing, use Older for smaller batches.`
      );
    }
    throw new Error(
      "Sync ended without a result — likely a server timeout. Retry Sync or use Older to scan a smaller batch."
    );
  }
  return result;
}

function buildSyncMetaPatch(data, meta, { older = false, reset = false } = {}) {
  const patch = {
    lastAt: new Date().toISOString(),
    lastScanned: data.scanned,
    lastTotal: data.total,
    lastLookbackDays: data.lookbackDays ?? null,
  };

  const newestAt = blockTimeToIso(data.newestTime);
  const oldestAt = blockTimeToIso(data.oldestTime);
  if (newestAt) patch.newestScannedAt = newestAt;
  if (oldestAt) {
    if (older || reset || !meta?.oldestScannedAt) {
      patch.oldestScannedAt = oldestAt;
    }
  }

  if (older) {
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
    if (reset || !meta?.oldestSignature) {
      if (data.oldestSignature) patch.oldestSignature = data.oldestSignature;
      patch.hasMoreOlder = Boolean(data.hasMoreOlder);
    } else if (meta?.hasMoreOlder == null) {
      patch.hasMoreOlder = Boolean(data.hasMoreOlder);
    }
  }

  return patch;
}

/**
 * Scan wallet for swaps without importing or advancing sync cursor.
 */
export async function scanWalletSync(address, opts = {}) {
  const {
    limit = SYNC_BATCH_DEFAULT,
    older = false,
    resync = false,
    reset = false,
    onProgress,
  } = opts;

  if (reset) clearWalletSyncMeta(address);

  const meta = reset ? null : getWalletSyncMeta(address);
  const untilSignature =
    older || resync || reset ? null : meta?.lastSignature || null;
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

  return {
    ...data,
    meta,
    older,
    resync,
    reset,
    syncMode: { older, resync, reset },
  };
}

/** Import approved fills from a review plan (explicit trade grouping). */
export async function commitImportPlan(plan, walletAddress, scanData, syncOpts = {}) {
  const imported = [];
  const deduped = [];
  const errors = [];

  for (const trade of plan.trades ?? []) {
    const activeFills = trade.fills.filter((f) => f.included && !f.excluded);
    if (!activeFills.length) continue;

    let tradeId = trade.linkTradeId ?? null;

    for (const fill of activeFills) {
      try {
        const result = await appendFillToPosition({
          tradeId: tradeId ?? undefined,
          tokenMint: trade.tokenMint,
          tokenSymbol: trade.tokenSymbol ?? fill.tokenSymbol,
          tokenName: trade.tokenName ?? fill.tokenName,
          imageUrl: trade.imageUrl ?? fill.imageUrl,
          side: fill.side,
          signature: fill.signature,
          quoteMint: fill.quoteMint,
          quoteSymbol: fill.quoteSymbol,
          quoteAmount: fill.quoteAmount,
          tokenAmount: fill.tokenAmount,
          priceUsd: fill.priceUsd,
          usdValue: fill.usdValue,
          wallet: walletAddress,
          blockTime: fill.blockTime,
          ts: fill.executedAt,
        });
        tradeId = result.tradeId;
        if (result.deduped) deduped.push(fill);
        else imported.push({ ...fill, tradeId: result.tradeId });
      } catch (err) {
        errors.push({ signature: fill.signature, message: err.message });
      }
    }
  }

  const meta = syncOpts.reset ? null : getWalletSyncMeta(walletAddress);
  const patch = buildSyncMetaPatch(scanData, meta, syncOpts);
  patch.lastImported = imported.length;
  saveWalletSyncMeta(walletAddress, patch);

  return { imported, deduped, errors };
}

/** Advance sync cursor when scan found no new swaps to import. */
export function finalizeSyncScan(address, scanData, syncOpts = {}) {
  const meta = syncOpts.reset ? null : getWalletSyncMeta(address);
  const patch = buildSyncMetaPatch(scanData, meta, syncOpts);
  patch.lastImported = 0;
  saveWalletSyncMeta(address, patch);
}

/**
 * Fetch classified swaps from the API then journal them (direct import, no review).
 */
export async function runWalletSync(address, opts = {}) {
  const {
    limit = SYNC_BATCH_DEFAULT,
    quiet = false,
    older = false,
    resync = false,
    reset = false,
    onProgress,
  } = opts;

  const scanData = await scanWalletSync(address, {
    limit,
    older,
    resync,
    reset,
    onProgress,
  });

  const mints = [...new Set((scanData.swaps ?? []).map((s) => s.tokenMint).filter(Boolean))];
  const { loadMintImportContext } = await import("./importPlan");
  const mintContext = await loadMintImportContext(mints);
  const plan = buildImportPlan(scanData.swaps ?? [], mintContext);

  const { imported, deduped, errors } = await commitImportPlan(
    plan,
    address,
    scanData,
    { older, resync, reset }
  );

  return {
    ...scanData,
    imported,
    deduped,
    errors,
    quiet,
    older,
    resync,
    reset,
  };
}

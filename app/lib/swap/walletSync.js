/**
 * Free wallet swap sync via public Solana RPC.
 *
 * Strategy (no paid indexer):
 *  1. getSignaturesForAddress
 *  2. getTransaction (jsonParsed)
 *  3. Diff pre/post token (+ native SOL) balances for the wallet
 *  4. Classify buy/sell vs quote mints (Fartcoin / SOL / USDC)
 *
 * Slow + rate-limited by design — fine for a daily Sync button.
 */

import { SOL_MINT, USDC_MINT } from "../chain/constants";
import { fetchJson } from "../chain/http";
import { postServerRpc } from "./rpc";
import {
  DEFAULT_RPC,
  FARTCOIN_MINT,
  JUPITER_PRICE_API,
  JUPITER_TOKEN_API,
  QUOTE_TOKENS,
  SYNC_BATCH_DEFAULT,
  SYNC_BATCH_MAX,
} from "./constants";

const QUOTE_MINTS = new Set(QUOTE_TOKENS.map((t) => t.mint));
const NATIVE_SOL = "__native_sol__";

const QUOTE_META = {
  [FARTCOIN_MINT]: { symbol: "Fartcoin", decimals: 6 },
  [SOL_MINT]: { symbol: "SOL", decimals: 9 },
  [USDC_MINT]: { symbol: "USDC", decimals: 6 },
  [NATIVE_SOL]: { symbol: "SOL", decimals: 9 },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rpc(rpcUrl, method, params) {
  const json = await postServerRpc(method, params, {
    preferredUrl: rpcUrl,
    timeout: 20_000,
    label: `rpc:${method}`,
  });
  return json.result;
}

function uiAmount(entry) {
  if (!entry?.uiTokenAmount) return 0;
  const n = Number(entry.uiTokenAmount.uiAmountString ?? entry.uiTokenAmount.uiAmount);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Net token balance changes for `owner` in one parsed tx.
 * @returns {Map<string, { mint: string, delta: number, decimals: number }>}
 */
export function extractBalanceDeltas(tx, owner) {
  const meta = tx?.meta;
  if (!meta || meta.err) return new Map();

  const map = new Map();

  const touch = (mint, decimals) => {
    if (!map.has(mint)) {
      map.set(mint, { mint, pre: 0, post: 0, decimals: decimals ?? 0 });
    }
    return map.get(mint);
  };

  for (const b of meta.preTokenBalances ?? []) {
    if (b.owner !== owner) continue;
    const row = touch(b.mint, b.uiTokenAmount?.decimals);
    row.pre = uiAmount(b);
  }
  for (const b of meta.postTokenBalances ?? []) {
    if (b.owner !== owner) continue;
    const row = touch(b.mint, b.uiTokenAmount?.decimals);
    row.post = uiAmount(b);
  }

  // Native SOL (fee-adjusted roughly: subtract fee if this wallet paid it)
  const accountKeys = tx.transaction?.message?.accountKeys ?? [];
  const keys = accountKeys.map((k) =>
    typeof k === "string" ? k : k?.pubkey || k?.toString?.()
  );
  const idx = keys.findIndex((k) => k === owner);
  if (idx >= 0 && Array.isArray(meta.preBalances) && Array.isArray(meta.postBalances)) {
    let pre = Number(meta.preBalances[idx]) || 0;
    let post = Number(meta.postBalances[idx]) || 0;
    const fee = Number(meta.fee) || 0;
    // If this account was fee payer (index 0 typically), add fee back so swap delta is cleaner
    if (idx === 0) post += fee;
    const deltaSol = (post - pre) / 1e9;
    if (Math.abs(deltaSol) > 0.00001) {
      map.set(NATIVE_SOL, {
        mint: NATIVE_SOL,
        pre: pre / 1e9,
        post: post / 1e9,
        decimals: 9,
      });
    }
  }

  const deltas = new Map();
  for (const [mint, row] of map) {
    const delta = row.post - row.pre;
    if (Math.abs(delta) < 1e-12) continue;
    deltas.set(mint, {
      mint: mint === NATIVE_SOL ? SOL_MINT : mint,
      rawMint: mint,
      delta,
      decimals: row.decimals,
      isNativeSol: mint === NATIVE_SOL,
    });
  }
  return deltas;
}

function isQuoteMint(mint, rawMint) {
  if (rawMint === NATIVE_SOL) return true;
  return QUOTE_MINTS.has(mint);
}

/**
 * Turn balance deltas into at most one buy/sell swap classification.
 */
export function classifySwap(deltas) {
  const list = [...deltas.values()];
  if (list.length < 2) return null;

  const increases = list.filter((d) => d.delta > 0);
  const decreases = list.filter((d) => d.delta < 0);
  if (!increases.length || !decreases.length) return null;

  // Prefer largest absolute legs
  increases.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  decreases.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const gained = increases[0];
  const spent = decreases[0];

  const gainedIsQuote = isQuoteMint(gained.mint, gained.rawMint);
  const spentIsQuote = isQuoteMint(spent.mint, spent.rawMint);

  // Quote ↔ quote (e.g. SOL ↔ USDC) — not a journal trade
  if (gainedIsQuote && spentIsQuote) return null;

  // Need exactly one position token leg
  if (!gainedIsQuote && spentIsQuote) {
    return {
      side: "buy",
      tokenMint: gained.mint,
      tokenAmount: Math.abs(gained.delta),
      quoteMint: spent.mint,
      quoteAmount: Math.abs(spent.delta),
      quoteSymbol: QUOTE_META[spent.rawMint]?.symbol || QUOTE_META[spent.mint]?.symbol || "QUOTE",
    };
  }
  if (gainedIsQuote && !spentIsQuote) {
    return {
      side: "sell",
      tokenMint: spent.mint,
      tokenAmount: Math.abs(spent.delta),
      quoteMint: gained.mint,
      quoteAmount: Math.abs(gained.delta),
      quoteSymbol: QUOTE_META[gained.rawMint]?.symbol || QUOTE_META[gained.mint]?.symbol || "QUOTE",
    };
  }

  // Token ↔ token (no known quote) — skip
  return null;
}

async function fetchPrices(mints) {
  const ids = [...new Set(mints.filter(Boolean))].join(",");
  if (!ids) return {};
  try {
    const data = await fetchJson(`${JUPITER_PRICE_API}?ids=${ids}`, {
      label: "prices",
      timeout: 10_000,
    });
    const out = {};
    for (const [mint, row] of Object.entries(data ?? {})) {
      out[mint] = Number.isFinite(row?.usdPrice) ? row.usdPrice : null;
    }
    return out;
  } catch {
    return {};
  }
}

async function fetchTokenMeta(mint) {
  try {
    const data = await fetchJson(
      `${JUPITER_TOKEN_API}?query=${encodeURIComponent(mint)}`,
      { label: "token-meta", timeout: 10_000 }
    );
    const list = Array.isArray(data) ? data : [];
    const hit =
      list.find((t) => t.id === mint || t.address === mint) || list[0];
    if (!hit) return { symbol: mint.slice(0, 4), name: mint.slice(0, 8) };
    return {
      symbol: hit.symbol || mint.slice(0, 4),
      name: hit.name || hit.symbol || mint.slice(0, 8),
      imageUrl: hit.icon || hit.logoURI || null,
    };
  } catch {
    return { symbol: mint.slice(0, 4), name: mint.slice(0, 8), imageUrl: null };
  }
}

/**
 * Scan a wallet for recent swaps classifiable against quote mints.
 *
 * Never walks a full million-tx history — one batch of `limit` signatures
 * (newest first, or older via `before`). Pass `onProgress` for live UI.
 *
 * @param {{
 *   address: string,
 *   limit?: number,
 *   untilSignature?: string|null,
 *   before?: string|null,
 *   rpcUrl?: string,
 *   onProgress?: (event: object) => void,
 * }} opts
 */
export async function syncWalletSwaps({
  address,
  limit = SYNC_BATCH_DEFAULT,
  untilSignature = null,
  before = null,
  rpcUrl = DEFAULT_RPC,
  onProgress,
} = {}) {
  if (!address) throw new Error("address required");

  const batchLimit = Math.min(SYNC_BATCH_MAX, Math.max(5, limit));
  const sigParams = { limit: batchLimit };
  if (before) sigParams.before = before;

  const emit = (event) => {
    try {
      onProgress?.(event);
    } catch {
      /* ignore UI errors */
    }
  };

  emit({ type: "phase", phase: "signatures", message: "Fetching signature list…" });

  const signatures = await rpc(rpcUrl, "getSignaturesForAddress", [
    address,
    sigParams,
  ]);

  // Trim to new-only window when we have a cursor
  let list = Array.isArray(signatures) ? [...signatures] : [];
  let stoppedAtCursor = false;
  if (untilSignature) {
    const idx = list.findIndex((r) => r?.signature === untilSignature);
    if (idx >= 0) {
      list = list.slice(0, idx);
      stoppedAtCursor = true;
    }
  }

  const times = list
    .map((r) => r?.blockTime)
    .filter((t) => typeof t === "number" && t > 0);
  const newestTime = times.length ? Math.max(...times) : null;
  const oldestTime = times.length ? Math.min(...times) : null;
  const lookbackDays =
    newestTime && oldestTime
      ? Math.max(0, (newestTime - oldestTime) / 86400)
      : null;

  const total = list.length;
  emit({
    type: "start",
    total,
    batchLimit,
    lookbackDays,
    newestTime,
    oldestTime,
    stoppedAtCursor,
    hasMoreOlder: list.length >= batchLimit,
    newestSignature: list[0]?.signature ?? null,
    oldestSignature: list[list.length - 1]?.signature ?? null,
    message:
      total === 0
        ? "No new transactions in this batch"
        : `Scanning ${total} tx${total === 1 ? "" : "s"}${
            lookbackDays != null ? ` (~${formatDays(lookbackDays)})` : ""
          }`,
  });

  const swaps = [];
  const skipped = [];
  let scanned = 0;
  let newestConfirmedSignature = null;
  let blockedByMissingHead = false;

  for (const row of list) {
    if (!row?.signature) continue;

    if (row.err) {
      skipped.push({ signature: row.signature, reason: "failed_tx" });
      scanned += 1;
      if (!newestConfirmedSignature) newestConfirmedSignature = row.signature;
      emit({
        type: "progress",
        scanned,
        total,
        swapsFound: swaps.length,
        skipped: skipped.length,
        signature: row.signature,
        status: "failed_tx",
      });
      continue;
    }

    await sleep(120);

    let tx;
    try {
      tx = await rpc(rpcUrl, "getTransaction", [
        row.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (!tx) {
        await sleep(1500);
        tx = await rpc(rpcUrl, "getTransaction", [
          row.signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ]);
      }
    } catch (error) {
      skipped.push({ signature: row.signature, reason: error.message });
      scanned += 1;
      emit({
        type: "progress",
        scanned,
        total,
        swapsFound: swaps.length,
        skipped: skipped.length,
        signature: row.signature,
        status: "error",
      });
      continue;
    }

    scanned += 1;

    if (!tx) {
      skipped.push({ signature: row.signature, reason: "missing" });
      if (!newestConfirmedSignature) blockedByMissingHead = true;
      emit({
        type: "progress",
        scanned,
        total,
        swapsFound: swaps.length,
        skipped: skipped.length,
        signature: row.signature,
        status: "missing",
      });
      continue;
    }

    if (!newestConfirmedSignature) newestConfirmedSignature = row.signature;

    const deltas = extractBalanceDeltas(tx, address);
    const classified = classifySwap(deltas);
    if (!classified) {
      skipped.push({ signature: row.signature, reason: "not_swap" });
      emit({
        type: "progress",
        scanned,
        total,
        swapsFound: swaps.length,
        skipped: skipped.length,
        signature: row.signature,
        status: "not_swap",
      });
      continue;
    }

    const swap = {
      ...classified,
      signature: row.signature,
      blockTime: row.blockTime ?? null,
      slot: row.slot ?? null,
    };
    swaps.push(swap);
    emit({
      type: "progress",
      scanned,
      total,
      swapsFound: swaps.length,
      skipped: skipped.length,
      signature: row.signature,
      status: "swap",
      side: swap.side,
      tokenMint: swap.tokenMint,
    });
  }

  emit({
    type: "phase",
    phase: "enrich",
    message: `Enriching ${swaps.length} swap${swaps.length === 1 ? "" : "s"}…`,
  });

  const mints = [
    ...new Set(swaps.flatMap((s) => [s.tokenMint, s.quoteMint])),
  ];
  const prices = await fetchPrices(mints);
  const metaCache = new Map();

  const enriched = [];
  for (const s of swaps) {
    if (!metaCache.has(s.tokenMint)) {
      metaCache.set(s.tokenMint, await fetchTokenMeta(s.tokenMint));
      await sleep(50);
    }
    const meta = metaCache.get(s.tokenMint);
    const quotePx = prices[s.quoteMint];
    const tokenPx = prices[s.tokenMint];
    const usdFromQuote =
      quotePx != null ? Math.abs(s.quoteAmount) * quotePx : null;
    const usdFromToken =
      tokenPx != null ? Math.abs(s.tokenAmount) * tokenPx : null;
    const usdValue = usdFromQuote ?? usdFromToken ?? 0;
    const priceUsd =
      s.tokenAmount > 0 && usdValue > 0 ? usdValue / s.tokenAmount : tokenPx ?? 0;

    enriched.push({
      ...s,
      tokenSymbol: meta.symbol,
      tokenName: meta.name,
      imageUrl: meta.imageUrl,
      usdValue,
      priceUsd,
      source: "wallet_sync",
    });
  }

  const result = {
    address,
    scanned,
    total,
    signatures: (signatures ?? []).length,
    batchLimit,
    lookbackDays,
    newestTime,
    oldestTime,
    newestSignature: list[0]?.signature ?? null,
    newestConfirmedSignature: blockedByMissingHead ? null : newestConfirmedSignature,
    oldestSignature: list[list.length - 1]?.signature ?? null,
    hasMoreOlder: (signatures ?? []).length >= batchLimit,
    stoppedAtCursor,
    swaps: enriched,
    skipped: skipped.length,
    fetchedAt: new Date().toISOString(),
  };

  emit({
    type: "done",
    scanned: result.scanned,
    total: result.total,
    swapsFound: enriched.length,
    skipped: result.skipped,
    batchLimit: result.batchLimit,
    lookbackDays: result.lookbackDays,
    hasMoreOlder: result.hasMoreOlder,
    message: `Done · scanned ${result.scanned}/${result.total} · ${enriched.length} swaps`,
  });
  return result;
}

function formatDays(days) {
  if (days == null || !Number.isFinite(days)) return "?";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
}

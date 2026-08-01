/**
 * Open-only wallet sync.
 *
 * Pipeline:
 *  1. Scan one batch of txs (default 100) via /api/wallet/sync
 *  2. Keep only true opens: buy where on-chain tokenPre ≈ 0
 *  3. Skip signatures already in the journal
 *  4. Journal each open as a new position
 *  5. Advance the sync cursor
 *
 * Adds / reduces / closes / orphans are ignored on purpose.
 */

import { supabase } from "../supabaseClient";
import { POSITION_KIND, SYNC_BATCH_DEFAULT } from "./constants";
import {
  clearWalletSyncMeta,
  finalizeSyncScan,
  formatSyncProgress,
  getWalletSyncMeta,
  scanWalletSync,
} from "./importFills";
import { journalOpenFromWallet } from "./journal";
import { filterOpenSwaps } from "./openSyncCore";

export { filterOpenSwaps, isTrueOpenSwap, OPEN_PRE_EPS } from "./openSyncCore";

/** Collect buy signatures already present in journal for the given mints. */
export async function collectKnownBuySignatures(tokenMints = []) {
  const mints = [...new Set(tokenMints.filter(Boolean))];
  const known = new Set();
  if (!mints.length) return known;

  const mintSet = new Set(mints);
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("trades")
      .select("id, data")
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const fj = row.data?._fj;
      if (fj?.kind !== POSITION_KIND) continue;
      if (!mintSet.has(fj.tokenMint)) continue;
      for (const fill of fj.fills ?? []) {
        if (fill?.signature && fill.side === "buy") {
          known.add(fill.signature);
        }
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return known;
}

async function journalOpens(opens, walletAddress, known) {
  const imported = [];
  const deduped = [];
  const errors = [];

  for (const swap of opens) {
    if (known.has(swap.signature)) {
      deduped.push(swap);
      continue;
    }

    try {
      const result = await journalOpenFromWallet({
        tokenMint: swap.tokenMint,
        tokenSymbol: swap.tokenSymbol,
        tokenName: swap.tokenName,
        imageUrl: swap.imageUrl,
        signature: swap.signature,
        quoteMint: swap.quoteMint,
        quoteSymbol: swap.quoteSymbol,
        quoteAmount: swap.quoteAmount,
        tokenAmount: swap.tokenAmount,
        priceUsd: swap.priceUsd,
        usdValue: swap.usdValue,
        wallet: walletAddress,
        blockTime: swap.blockTime,
      });

      if (result.deduped) {
        deduped.push(swap);
        known.add(swap.signature);
      } else {
        imported.push({ ...swap, tradeId: result.tradeId });
        known.add(swap.signature);
      }
    } catch (err) {
      errors.push({ signature: swap.signature, message: err.message });
    }
  }

  return { imported, deduped, errors };
}

/**
 * Scan one batch and journal only true opens.
 *
 * @param {string} address Solana wallet address
 * @param {{
 *   limit?: number,
 *   older?: boolean,
 *   resync?: boolean,
 *   reset?: boolean,
 *   onProgress?: (ev: object) => void,
 *   signal?: AbortSignal,
 * }} [opts]
 */
export async function syncOpenPositions(address, opts = {}) {
  const {
    limit = SYNC_BATCH_DEFAULT,
    older = false,
    resync = false,
    reset = false,
    onProgress,
    signal,
  } = opts;

  const syncMode = { older, resync, reset };

  const scanData = await scanWalletSync(address, {
    limit,
    older,
    resync,
    reset,
    signal,
    onProgress,
  });

  const swaps = scanData.swaps ?? [];
  const opens = filterOpenSwaps(swaps);

  if (!opens.length) {
    finalizeSyncScan(address, scanData, syncMode, { lastImported: 0 });
    return {
      ...scanData,
      opens: [],
      imported: [],
      deduped: [],
      errors: [],
      skippedSwaps: swaps.length,
      syncMode,
    };
  }

  const known = await collectKnownBuySignatures(opens.map((s) => s.tokenMint));
  const { imported, deduped, errors } = await journalOpens(opens, address, known);

  finalizeSyncScan(address, scanData, syncMode, {
    lastImported: imported.length,
  });

  return {
    ...scanData,
    opens,
    imported,
    deduped,
    errors,
    skippedSwaps: Math.max(0, swaps.length - opens.length),
    syncMode,
  };
}

export {
  clearWalletSyncMeta,
  formatSyncProgress,
  getWalletSyncMeta,
  SYNC_BATCH_DEFAULT,
};

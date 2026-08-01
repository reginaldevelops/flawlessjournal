/**
 * Import plan — re-exports pure core + Supabase journal loader.
 */

export {
  buildImportPlan,
  buildMintContextFromTrades,
  findLinkTradeIdAtTime,
  toggleFillInPlan,
  toggleTradeInPlan,
  planSummary,
  warningLabel,
  skipReasonLabel,
  isAutoImportEligible,
  isTrueOpenFill,
  classifySwapRole,
  deriveSkipReason,
  mergeImportSwaps,
  mergeScanData,
  JOURNAL_POSITION_KIND,
} from "./importPlanCore";

import { supabase } from "../supabaseClient";
import {
  buildMintContextFromTrades,
  JOURNAL_POSITION_KIND,
} from "./importPlanCore";

/** Load live position + known signatures per mint for import context. */
export async function loadMintImportContext(tokenMints = []) {
  const mints = [...new Set(tokenMints.filter(Boolean))];
  if (!mints.length) return {};

  const mintSet = new Set(mints);
  const rows = [];
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
      if (fj?.kind !== JOURNAL_POSITION_KIND) continue;
      if (mintSet.has(fj.tokenMint)) rows.push(row);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return buildMintContextFromTrades(rows, mints);
}

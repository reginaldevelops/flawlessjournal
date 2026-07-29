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
  JOURNAL_POSITION_KIND,
} from "./importPlanCore";

import { supabase } from "../supabaseClient";
import { buildMintContextFromTrades } from "./importPlanCore";

/** Load live position + known signatures per mint for import context. */
export async function loadMintImportContext(tokenMints = []) {
  const mints = [...new Set(tokenMints.filter(Boolean))];
  if (!mints.length) return {};

  const { data, error } = await supabase
    .from("trades")
    .select("id, data")
    .order("id", { ascending: false })
    .limit(400);

  if (error) throw error;
  return buildMintContextFromTrades(data ?? [], mints);
}

/**
 * Schema-tolerant helpers for reading trades from Supabase.
 *
 * Older Flawless databases store the trade index inside `data` (e.g. "Trade number")
 * and may not have a `trades.trade_number` column at all. Selecting that column
 * causes PostgREST to reject the whole query — which is why dashboard/analytics
 * went blank after the overhaul.
 */

import { normalizeTrades, extractTradeNumber } from "./trades";

/**
 * Fetch trades without assuming `trade_number` exists.
 * Falls back to `id, data` (or `*`) and synthesises a stable index.
 */
export async function fetchTrades(supabase, { withVariables = false } = {}) {
  const attempts = [
    () =>
      supabase
        .from("trades")
        .select("id, trade_number, data, created_at")
        .order("trade_number", { ascending: true }),
    () =>
      supabase
        .from("trades")
        .select("id, data, created_at")
        .order("created_at", { ascending: true }),
    () => supabase.from("trades").select("id, data"),
    () => supabase.from("trades").select("*"),
  ];

  let trades = [];
  let tradesError = null;

  for (const attempt of attempts) {
    const { data, error } = await attempt();
    if (!error) {
      trades = data ?? [];
      tradesError = null;
      break;
    }
    tradesError = error;
    const msg = String(error.message ?? error.code ?? "");
    if (!/trade_number|column|schema cache|42703/i.test(msg)) {
      break;
    }
  }

  if (tradesError) {
    return { trades: [], raw: [], variables: [], error: tradesError };
  }

  let variables = [];
  if (withVariables) {
    const varsRes = await supabase
      .from("variables")
      .select("name, varType, phase, options, visible, order");
    if (!varsRes.error) variables = varsRes.data ?? [];
  }

  const enriched = trades.map((row, index) => {
    const number = extractTradeNumber(row) ?? index + 1;
    return {
      ...row,
      trade_number: number,
    };
  });

  return {
    trades: normalizeTrades(enriched, variables),
    raw: enriched,
    variables,
    error: null,
  };
}

/**
 * Detect whether a PostgREST error means "this relation/column doesn't exist".
 * Used so missing `wallets` / `trade_number` degrade gracefully.
 */
export function isMissingSchemaError(error) {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""} ${error.details ?? ""}`;
  return /does not exist|schema cache|Could not find|PGRST205|PGRST204|42P01|42703/i.test(
    msg
  );
}

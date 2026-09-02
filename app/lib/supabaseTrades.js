/**
 * Schema-tolerant helpers for reading trades from Supabase.
 *
 * Older Flawless databases store the trade index inside `data` (e.g. "Trade number")
 * and may not have a `trades.trade_number` column at all. Selecting that column
 * causes PostgREST to reject the whole query — which is why dashboard/analytics
 * went blank after the overhaul.
 */

import { normalizeTrades, extractTradeNumber } from "./trades";
import { ensureSystemVariables } from "./ensureSystemVariables";

/**
 * Fetch trades without assuming `trade_number` exists.
 * Falls back to `id, data` (or `*`) and synthesises a stable index.
 */
async function loadTradeVariables(supabase) {
  try {
    const ensured = await ensureSystemVariables(supabase);
    if (!ensured.error && ensured.variables?.length) {
      return ensured.variables;
    }
  } catch (err) {
    console.warn("[fetchTrades] ensureSystemVariables:", err?.message || err);
  }

  const varsRes = await supabase
    .from("variables")
    .select("id, name, type, varType, phase, options, visible, order, system_key");
  if (varsRes.error && /system_key/i.test(varsRes.error.message ?? "")) {
    const legacy = await supabase
      .from("variables")
      .select("id, name, type, varType, phase, options, visible, order");
    if (!legacy.error) return legacy.data ?? [];
  } else if (!varsRes.error) {
    return varsRes.data ?? [];
  }

  const fallback = await supabase
    .from("variables")
    .select("name, varType, phase, options, visible, order");
  if (!fallback.error) return fallback.data ?? [];
  return [];
}

export async function fetchTrades(supabase, { withVariables = false } = {}) {
  const variablesPromise = withVariables
    ? loadTradeVariables(supabase)
    : Promise.resolve([]);

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
    if (withVariables) {
      try {
        await variablesPromise;
      } catch {
        /* ignore — caller only needs the trades error */
      }
    }
    return { trades: [], raw: [], variables: [], error: tradesError };
  }

  const variables = withVariables ? await variablesPromise : [];

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

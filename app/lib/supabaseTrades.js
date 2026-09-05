/**
 * Schema-tolerant helpers for reading trades from Supabase.
 *
 * Older Flawless databases store the trade index inside `data` (e.g. "Trade number")
 * and may not have a `trades.trade_number` column at all. Selecting that column
 * causes PostgREST to reject the whole query — which is why dashboard/analytics
 * went blank after the overhaul.
 */

import { normalizeTrades, extractTradeNumber } from "./trades";
import {
  ensureSystemVariables,
  markTimestampsUpgraded,
  schemaAlreadyHealthy,
  selectVariables,
  timestampsAlreadyUpgraded,
} from "./ensureSystemVariables";
import { upgradeLegacyTimesInTradeData } from "./systemFields";

const PAGE_SIZE = 1000;
const CACHE_TTL_MS = 20_000;
const MAX_ROWS = 20_000;

let tradesCache = {
  at: 0,
  withVariables: false,
  payload: null,
};

export function invalidateTradesCache() {
  tradesCache = { at: 0, withVariables: false, payload: null };
}

function isColumnError(error) {
  const msg = String(error?.message ?? error?.code ?? "");
  return /trade_number|column|schema cache|42703/i.test(msg);
}

async function fetchTradeRows(supabase) {
  const plans = [
    { select: "id, trade_number, data, created_at", orderCol: "trade_number" },
    { select: "id, data, created_at", orderCol: "created_at" },
    { select: "id, data", orderCol: null },
    { select: "*", orderCol: null },
  ];

  let lastError = null;

  for (const plan of plans) {
    const rows = [];
    let from = 0;
    let planFailed = false;

    while (from < MAX_ROWS) {
      let query = supabase.from("trades").select(plan.select);
      if (plan.orderCol) query = query.order(plan.orderCol, { ascending: true });
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

      if (error) {
        lastError = error;
        if (isColumnError(error)) {
          planFailed = true;
          break;
        }
        return { rows: [], error };
      }

      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) return { rows, error: null };
      from += PAGE_SIZE;
    }

    if (!planFailed) return { rows, error: null };
  }

  return { rows: [], error: lastError };
}

async function persistTimestampFixes(supabase, rows) {
  const updates = [];
  for (const trade of rows) {
    const next = upgradeLegacyTimesInTradeData(trade.data);
    if (next) updates.push({ id: trade.id, data: next });
  }
  if (!updates.length) {
    markTimestampsUpgraded();
    return rows;
  }

  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    const { error } = await supabase.from("trades").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.warn("[fetchTrades] timestamp upgrade failed:", error.message);
      return rows;
    }
  }

  markTimestampsUpgraded();
  const byId = new Map(updates.map((row) => [row.id, row.data]));
  return rows.map((row) => (byId.has(row.id) ? { ...row, data: byId.get(row.id) } : row));
}

/**
 * Fetch trades without assuming `trade_number` exists.
 * Falls back to `id, data` (or `*`) and synthesises a stable index.
 */
export async function fetchTrades(
  supabase,
  { withVariables = false, fresh = false } = {}
) {
  if (fresh) invalidateTradesCache();

  const now = Date.now();
  if (
    tradesCache.payload &&
    now - tradesCache.at < CACHE_TTL_MS &&
    (!withVariables || tradesCache.withVariables)
  ) {
    return tradesCache.payload;
  }

  const [tradeResult, varsResult] = await Promise.all([
    fetchTradeRows(supabase),
    withVariables
      ? selectVariables(supabase)
      : Promise.resolve({ variables: [], supportsSystemKey: true, error: null }),
  ]);

  if (tradeResult.error) {
    return { trades: [], raw: [], variables: [], error: tradeResult.error };
  }

  let trades = tradeResult.rows;
  let variables = varsResult.variables ?? [];

  if (withVariables) {
    if (varsResult.error) {
      try {
        const ensured = await ensureSystemVariables(supabase);
        if (!ensured.error && ensured.variables?.length) variables = ensured.variables;
      } catch (err) {
        console.warn("[fetchTrades] ensureSystemVariables:", err?.message || err);
      }
    } else if (
      !schemaAlreadyHealthy(variables, {
        supportsSystemKey: varsResult.supportsSystemKey !== false,
      })
    ) {
      try {
        const ensured = await ensureSystemVariables(supabase);
        if (!ensured.error && ensured.variables?.length) variables = ensured.variables;
      } catch (err) {
        console.warn("[fetchTrades] ensureSystemVariables:", err?.message || err);
      }
    }

    if (!timestampsAlreadyUpgraded()) {
      try {
        trades = await persistTimestampFixes(supabase, trades);
      } catch (err) {
        console.warn("[fetchTrades] timestamp upgrade:", err?.message || err);
      }
    }
  }

  const enriched = trades.map((row, index) => {
    const number = extractTradeNumber(row) ?? index + 1;
    return {
      ...row,
      trade_number: number,
    };
  });

  const payload = {
    trades: normalizeTrades(enriched, variables),
    raw: enriched,
    variables,
    error: null,
  };

  tradesCache = { at: Date.now(), withVariables, payload };
  return payload;
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

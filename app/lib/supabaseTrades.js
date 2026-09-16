/**
 * Schema-tolerant helpers for reading trades from Supabase.
 *
 * Older Flawless databases store the trade index inside `data` (e.g. "Trade number")
 * and may not have a `trades.trade_number` column at all. Selecting that column
 * causes PostgREST to reject the whole query — which is why dashboard/analytics
 * went blank after the overhaul.
 *
 * List views use a slim projection that drops chart screenshots (data:image…) so
 * /trades, dashboard and analytics do not download megabytes per row. The trade
 * detail page still loads the full JSON for a single id.
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
import { slimTradeRows } from "./slimTradeData";
import { harvestTagsFromRows, rememberTags } from "./tradeTags";

const SLIM_PAGE_SIZE = 1000;
const FAT_PAGE_SIZE = 250;
const CACHE_TTL_MS = 120_000;
const MAX_ROWS = 20_000;
const SESSION_KEY = "flawless.tradesCache.v2";

let tradesCache = {
  at: 0,
  withVariables: false,
  payload: null,
};

function readSessionCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(cache) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        at: cache.at,
        withVariables: cache.withVariables,
        payload: {
          trades: cache.payload.trades,
          raw: cache.payload.raw,
          variables: cache.payload.variables,
          error: null,
        },
      })
    );
  } catch {
    /* quota — in-memory cache still works */
  }
}

function hydrateFromSession() {
  if (tradesCache.payload) return tradesCache;
  const session = readSessionCache();
  if (session?.payload) {
    tradesCache = session;
  }
  return tradesCache;
}

export function peekTradesCache() {
  return hydrateFromSession().payload;
}

export function invalidateTradesCache() {
  tradesCache = { at: 0, withVariables: false, payload: null };
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function isColumnError(error) {
  const msg = String(error?.message ?? error?.code ?? "");
  return /trade_number|column|schema cache|42703/i.test(msg);
}

function isPlanError(error) {
  const msg = String(error?.message ?? error?.code ?? "");
  return (
    isColumnError(error) ||
    /strip_trade_media|could not find.*function|PGRST202|PGRST204/i.test(msg)
  );
}

function buildPayload(rows, variables) {
  const enriched = (rows ?? []).map((row, index) => {
    const number = extractTradeNumber(row) ?? index + 1;
    return {
      ...row,
      trade_number: number,
    };
  });
  return {
    trades: normalizeTrades(enriched, variables),
    raw: enriched,
    variables: variables ?? [],
    error: null,
  };
}

function rememberCache(payload, withVariables) {
  tradesCache = { at: Date.now(), withVariables, payload };
  writeSessionCache(tradesCache);
  try {
    rememberTags(harvestTagsFromRows(payload.raw));
  } catch {
    /* ignore */
  }
}

async function fetchTradeRows(supabase, { onBatch } = {}) {
  const plans = [
    {
      select: "id, trade_number, created_at, data:strip_trade_media",
      orderCol: "trade_number",
      serverSlim: true,
      pageSize: SLIM_PAGE_SIZE,
    },
    {
      select: "id, created_at, data:strip_trade_media",
      orderCol: "created_at",
      serverSlim: true,
      pageSize: SLIM_PAGE_SIZE,
    },
    {
      select: "id, trade_number, data, created_at",
      orderCol: "trade_number",
      serverSlim: false,
      pageSize: FAT_PAGE_SIZE,
    },
    {
      select: "id, data, created_at",
      orderCol: "created_at",
      serverSlim: false,
      pageSize: FAT_PAGE_SIZE,
    },
    {
      select: "id, data",
      orderCol: null,
      serverSlim: false,
      pageSize: FAT_PAGE_SIZE,
    },
  ];

  let lastError = null;

  for (const plan of plans) {
    const rows = [];
    let from = 0;
    let planFailed = false;

    while (from < MAX_ROWS) {
      let query = supabase.from("trades").select(plan.select);
      if (plan.orderCol) query = query.order(plan.orderCol, { ascending: true });
      const { data, error } = await query.range(from, from + plan.pageSize - 1);

      if (error) {
        lastError = error;
        if (isPlanError(error)) {
          planFailed = true;
          break;
        }
        return { rows: [], error, serverSlim: false };
      }

      const batch = data ?? [];
      rows.push(...batch);
      if (rows.length && onBatch) {
        onBatch(plan.serverSlim ? rows : slimTradeRows(rows), {
          serverSlim: plan.serverSlim,
          done: batch.length < plan.pageSize,
        });
      }
      if (batch.length < plan.pageSize) {
        return { rows, error: null, serverSlim: plan.serverSlim };
      }
      from += plan.pageSize;
    }

    if (!planFailed) return { rows, error: null, serverSlim: plan.serverSlim };
  }

  return { rows: [], error: lastError, serverSlim: false };
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
 * Falls back to `id, data` and synthesises a stable index.
 *
 * `onPartial` is called with a usable payload as soon as the first page (and
 * any stale cache) is ready, so /trades can render before every row arrives.
 */
export async function fetchTrades(
  supabase,
  { withVariables = false, fresh = false, onPartial } = {}
) {
  if (fresh) invalidateTradesCache();

  const now = Date.now();
  const cached = hydrateFromSession();
  if (
    cached.payload &&
    now - cached.at < CACHE_TTL_MS &&
    (!withVariables || cached.withVariables)
  ) {
    return cached.payload;
  }

  if (cached.payload && onPartial) {
    onPartial(cached.payload);
  }

  let variables = cached.payload?.variables ?? [];

  const [tradeResult, varsResult] = await Promise.all([
    fetchTradeRows(supabase, {
      onBatch: (rows) => {
        if (onPartial) onPartial(buildPayload(rows, variables));
      },
    }),
    withVariables
      ? selectVariables(supabase)
      : Promise.resolve({ variables: [], supportsSystemKey: true, error: null }),
  ]);

  if (tradeResult.error) {
    if (cached.payload) return cached.payload;
    return { trades: [], raw: [], variables: [], error: tradeResult.error };
  }

  let trades = tradeResult.rows;
  variables = varsResult.variables ?? variables;

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

    // Never write timestamp fixes from a slimmed payload — that would wipe charts.
    if (!tradeResult.serverSlim && !timestampsAlreadyUpgraded()) {
      try {
        trades = await persistTimestampFixes(supabase, trades);
      } catch (err) {
        console.warn("[fetchTrades] timestamp upgrade:", err?.message || err);
      }
    }
  }

  if (!tradeResult.serverSlim) {
    trades = slimTradeRows(trades);
  }

  const payload = buildPayload(trades, variables);
  rememberCache(payload, withVariables);
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

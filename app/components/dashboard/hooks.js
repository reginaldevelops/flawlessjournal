"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../ui";
import { supabase } from "../../lib/supabaseClient";
import {
  compareMetrics,
  computeMetrics,
  dateRangePreset,
  filterTrades,
  normalizeTrades,
  previousRange,
} from "../../lib/trades";

/* ------------------------------------------------------------------ */
/* localStorage-backed state                                           */
/* ------------------------------------------------------------------ */

/**
 * State that survives reloads. The initial render always uses `initial` so the
 * server and client markup match; the stored value is applied right after mount.
 */
export function usePersistentState(key, initial, { parse, serialize } = {}) {
  const [value, setValue] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(parse ? parse(raw) : raw);
    } catch {
      /* storage unavailable — keep the default */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        try {
          window.localStorage.setItem(key, serialize ? serialize(resolved) : String(resolved));
        } catch {
          /* ignore */
        }
        return resolved;
      });
    },
    [key, serialize]
  );

  return [value, update, hydrated];
}

const jsonOptions = {
  parse: (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  serialize: (value) => JSON.stringify(value),
};

export function usePersistentJson(key, initial) {
  const [value, setValue, hydrated] = usePersistentState(key, initial, jsonOptions);
  return [value ?? initial, setValue, hydrated];
}

/* ------------------------------------------------------------------ */
/* Clock                                                              */
/* ------------------------------------------------------------------ */

/** A `Date` that refreshes on an interval, mounted-only to avoid hydration drift. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

/* ------------------------------------------------------------------ */
/* Trades                                                             */
/* ------------------------------------------------------------------ */

/**
 * Loads every trade once and normalises it. The dashboard slices the result in
 * memory so switching periods is instant and never re-queries.
 */
export function useTrades() {
  const [state, setState] = useState({ loading: true, error: null, trades: [], variables: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const [tradesRes, variablesRes] = await Promise.all([
      supabase.from("trades").select("id, trade_number, data").order("trade_number", { ascending: true }),
      supabase.from("variables").select("name, varType, phase, options"),
    ]);

    if (tradesRes.error) {
      setState({
        loading: false,
        error: tradesRes.error.message ?? "Could not load trades",
        trades: [],
        variables: [],
      });
      return;
    }

    const variables = variablesRes.error ? [] : (variablesRes.data ?? []);
    setState({
      loading: false,
      error: null,
      trades: normalizeTrades(tradesRes.data ?? [], variables),
      variables,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/* ------------------------------------------------------------------ */
/* Period slicing                                                     */
/* ------------------------------------------------------------------ */

export const PERIOD_OPTIONS = [
  { value: "today", label: "Today", short: "1D" },
  { value: "week", label: "This week", short: "WTD" },
  { value: "month", label: "This month", short: "MTD" },
  { value: "30d", label: "30 days", short: "30D" },
  { value: "quarter", label: "Quarter", short: "QTD" },
  { value: "ytd", label: "Year", short: "YTD" },
  { value: "all", label: "All time", short: "All" },
];

export const PERIOD_LABELS = Object.fromEntries(PERIOD_OPTIONS.map((p) => [p.value, p.label]));

/**
 * Everything the dashboard needs for one period: the sliced trades, their
 * metrics, the previous window's metrics and the deltas between them.
 */
export function usePeriodMetrics(trades, period, referenceDay) {
  return useMemo(() => {
    const range = dateRangePreset(period, referenceDay ? new Date(referenceDay) : new Date());
    const current = filterTrades(trades, range);
    const metrics = computeMetrics(current);

    const prevRange = range.start && range.end ? previousRange(range.start, range.end) : { start: null, end: null };
    const hasPrevious = Boolean(prevRange.start && prevRange.end);
    const previousTrades = hasPrevious ? filterTrades(trades, prevRange) : [];
    const previousMetrics = hasPrevious && previousTrades.length ? computeMetrics(previousTrades) : null;

    const deltas = previousMetrics ? compareMetrics(metrics, previousMetrics) : {};
    if (previousMetrics && metrics.avgR != null && previousMetrics.avgR != null) {
      deltas.avgR = metrics.avgR - previousMetrics.avgR;
    }

    return { range, prevRange, trades: current, metrics, previousMetrics, deltas };
    // `referenceDay` only exists so the memo can be invalidated at midnight.
  }, [trades, period, referenceDay]);
}

/* ------------------------------------------------------------------ */
/* Economic calendar                                                  */
/* ------------------------------------------------------------------ */

export function useEconomicCalendar(range = "thisweek") {
  const [state, setState] = useState({
    loading: true,
    events: [],
    fetchedAt: null,
    stale: false,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(`/api/economic-calendar?range=${encodeURIComponent(range)}`, {
        cache: "no-store",
      });
      const payload = await res.json();
      setState({
        loading: false,
        events: Array.isArray(payload?.events) ? payload.events : [],
        fetchedAt: payload?.fetchedAt ?? null,
        stale: Boolean(payload?.stale),
        error: payload?.error ?? null,
      });
    } catch (err) {
      setState({
        loading: false,
        events: [],
        fetchedAt: null,
        stale: false,
        error: err?.message ?? "Request failed",
      });
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/* ------------------------------------------------------------------ */
/* Balances                                                           */
/* ------------------------------------------------------------------ */

const toFinite = (value) => {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const WALLET_PALETTE = ["#7c6cff", "#4fd1ff", "#22d38a", "#fab73e", "#ff5c6e", "#a78bfa"];

/**
 * Reads the portfolio endpoint, which owns pricing but not the wallet list —
 * in demo mode the `wallets` table only exists in the browser, so the wallets
 * are read client-side and posted to the API.
 *
 * The endpoint is owned by another part of the app and may lag behind this
 * contract, so every field is treated as optional and the older
 * single-wallet response shape is still understood.
 */
function normalizePortfolio(payload, walletRows) {
  const byId = new Map(walletRows.map((w) => [String(w.id), w]));
  const rawWallets = Array.isArray(payload?.wallets) ? payload.wallets : [];

  let wallets = rawWallets.map((wallet, i) => {
    const source = byId.get(String(wallet?.id));
    return {
      id: String(wallet?.id ?? wallet?.address ?? `wallet-${i}`),
      label: wallet?.label || source?.label || "Wallet",
      chain: wallet?.chain ?? source?.chain ?? null,
      address: wallet?.address ?? source?.address ?? null,
      usdValue: toFinite(wallet?.usdValue) ?? toFinite(wallet?.totalUSD) ?? 0,
      color: wallet?.color || source?.color || WALLET_PALETTE[i % WALLET_PALETTE.length],
      error: wallet?.error ? String(wallet.error) : null,
    };
  });

  // Legacy shape: one flat wallet with no per-wallet breakdown.
  if (!wallets.length && toFinite(payload?.totalUSD) !== null) {
    wallets = walletRows.slice(0, 1).map((row, i) => ({
      id: String(row.id),
      label: row.label || "Wallet",
      chain: row.chain ?? null,
      address: row.address ?? payload?.wallet ?? null,
      usdValue: toFinite(payload.totalUSD) ?? 0,
      color: row.color || WALLET_PALETTE[i % WALLET_PALETTE.length],
      error: null,
    }));
  }

  const assets = (Array.isArray(payload?.assets) ? payload.assets : [])
    .map((asset, i) => ({
      key: `${asset?.symbol ?? "asset"}-${asset?.mint ?? asset?.chain ?? i}`,
      symbol: String(asset?.symbol ?? asset?.name ?? "—").toUpperCase(),
      name: asset?.name ?? null,
      chain: asset?.chain ?? null,
      amount: toFinite(asset?.amount),
      price: toFinite(asset?.price),
      usdValue: toFinite(asset?.usdValue) ?? 0,
      priceChange24h: toFinite(asset?.priceChange24h),
    }))
    .filter((a) => a.usdValue > 0 || a.amount)
    .sort((a, b) => b.usdValue - a.usdValue);

  const walletTotal = wallets.reduce((acc, w) => acc + (w.usdValue ?? 0), 0);
  const totalUSD = toFinite(payload?.totalUSD) ?? (wallets.length ? walletTotal : null);

  const change24hUSD = toFinite(payload?.change24hUSD);
  let change24hPct = toFinite(payload?.change24hPct);
  if (change24hPct == null && change24hUSD != null && totalUSD) {
    const previous = totalUSD - change24hUSD;
    if (previous) change24hPct = (change24hUSD / Math.abs(previous)) * 100;
  }

  const errors = [
    ...(Array.isArray(payload?.errors) ? payload.errors : []),
    ...wallets.map((w) => (w.error ? `${w.label}: ${w.error}` : null)),
  ]
    .filter(Boolean)
    .map(String);

  return {
    wallets: wallets.sort((a, b) => b.usdValue - a.usdValue),
    assets,
    totalUSD,
    change24hUSD,
    change24hPct,
    updatedAt: payload?.updatedAt ?? payload?.fetchedAt ?? payload?.cachedAt ?? null,
    errors: [...new Set(errors)],
  };
}

async function requestPortfolio(wallets, signal) {
  const attempt = async (init) => {
    const res = await fetch("/api/portfolio", { cache: "no-store", signal, ...init });
    const payload = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, payload };
  };

  const posted = await attempt({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallets: wallets.map((w) => ({
        id: w.id,
        label: w.label,
        chain: w.chain,
        address: w.address,
        color: w.color,
      })),
    }),
  });
  if (posted.ok && posted.payload) return posted.payload;

  // Older revisions of the endpoint only expose GET. Fall back rather than fail.
  const got = await attempt({ method: "GET" });
  if (got.ok && got.payload) return got.payload;

  const reason =
    got.payload?.error ??
    posted.payload?.error ??
    `portfolio endpoint returned HTTP ${posted.status === 405 ? got.status : posted.status}`;
  throw new Error(String(reason));
}

export function usePortfolio() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    hasWallets: null,
    wallets: [],
    assets: [],
    totalUSD: null,
    change24hUSD: null,
    change24hPct: null,
    updatedAt: null,
    errors: [],
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const { data, error } = await supabase
      .from("wallets")
      .select("id, label, chain, address, color, include_in_balance")
      .order("created_at", { ascending: true });

    if (error) {
      setState((s) => ({
        ...s,
        loading: false,
        hasWallets: null,
        error: error.message ?? "Could not read your wallet list",
      }));
      return;
    }

    const rows = (data ?? []).filter((w) => w?.include_in_balance !== false);
    if (!rows.length) {
      setState({
        loading: false,
        error: null,
        hasWallets: false,
        wallets: [],
        assets: [],
        totalUSD: null,
        change24hUSD: null,
        change24hPct: null,
        updatedAt: null,
        errors: [],
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const payload = await requestPortfolio(rows, controller.signal);
      setState({
        loading: false,
        error: null,
        hasWallets: true,
        ...normalizePortfolio(payload, rows),
      });
    } catch (err) {
      setState({
        loading: false,
        error: err?.name === "AbortError" ? "The portfolio request timed out" : (err?.message ?? "Request failed"),
        hasWallets: true,
        wallets: [],
        assets: [],
        totalUSD: null,
        change24hUSD: null,
        change24hPct: null,
        updatedAt: null,
        errors: [],
      });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/**
 * Dashboard-facing view of the portfolio: groups wallets into "venues" with
 * optional holdings chips so BalancesCard can stay presentation-only.
 */
export function useBalances() {
  const portfolio = usePortfolio();

  const venues = useMemo(() => {
    return (portfolio.wallets ?? []).map((wallet) => {
      const holdings = (portfolio.assets ?? [])
        .filter((asset) => {
          if (!asset) return false;
          if (wallet.chain && asset.chain && asset.chain !== wallet.chain) return false;
          return (asset.usdValue ?? 0) > 0;
        })
        .slice(0, 4)
        .map((asset) => ({
          symbol: asset.symbol,
          valueUSD: asset.usdValue ?? 0,
        }));

      return {
        id: wallet.id,
        label: wallet.label,
        chain: wallet.chain,
        address: wallet.address,
        color: wallet.color,
        totalUSD: wallet.usdValue ?? 0,
        detail: wallet.chain ? String(wallet.chain).toUpperCase() : null,
        holdings,
        error: wallet.error ?? null,
      };
    });
  }, [portfolio.wallets, portfolio.assets]);

  return {
    loading: portfolio.loading,
    error: portfolio.error,
    hasWallets: portfolio.hasWallets,
    venues,
    totalUSD: portfolio.totalUSD,
    change24hUSD: portfolio.change24hUSD,
    change24hPct: portfolio.change24hPct,
    fetchedAt: portfolio.updatedAt,
    errors: portfolio.errors ?? [],
    reload: portfolio.reload,
  };
}

/* ------------------------------------------------------------------ */
/* Notes table (goals + scratchpad share one table)                   */
/* ------------------------------------------------------------------ */

const NOTE_TYPE = "note";

/** Debounced autosave against the single `notes` row of type "note". */
export function useScratchpad() {
  const [value, setValue] = useState("");
  const [rowId, setRowId] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | idle | saving | saved | error
  const [savedAt, setSavedAt] = useState(null);
  const dirty = useRef(false);
  const timer = useRef(null);
  const toast = useToast();
  // Only the first failure in a run gets a toast, so a broken connection cannot
  // stack one notification per keystroke.
  const warned = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, content, updated_at")
        .eq("type", NOTE_TYPE)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (cancelled) return;
      if (error) {
        setStatus("error");
        return;
      }
      const row = data?.[0];
      if (row) {
        setRowId(row.id);
        setValue(row.content ?? "");
        setSavedAt(row.updated_at ?? null);
      }
      setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fail = useCallback(
    (message) => {
      setStatus("error");
      if (warned.current) return;
      warned.current = true;
      toast.error("Your scratchpad could not be saved", {
        description: message ?? "The last change is still in the editor — try again in a moment.",
      });
    },
    [toast]
  );

  const persist = useCallback(
    async (next) => {
      setStatus("saving");
      const updated_at = new Date().toISOString();

      if (rowId) {
        const { error } = await supabase
          .from("notes")
          .update({ content: next, updated_at })
          .eq("id", rowId);
        if (error) {
          fail(error.message);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("notes")
          .insert({ content: next, type: NOTE_TYPE, updated_at })
          .select();
        if (error) {
          fail(error.message);
          return;
        }
        if (data?.[0]?.id) setRowId(data[0].id);
      }

      dirty.current = false;
      warned.current = false;
      setSavedAt(updated_at);
      setStatus("saved");
    },
    [rowId, fail]
  );

  const change = useCallback(
    (next) => {
      setValue(next);
      dirty.current = true;
      setStatus("idle");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(next), 700);
    },
    [persist]
  );

  const flush = useCallback(() => {
    if (!dirty.current) return;
    clearTimeout(timer.current);
    persist(value);
  }, [persist, value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { value, change, flush, status, savedAt };
}

/**
 * The account-equity target lives in the same `notes` table as the goals, as a
 * row of type "goal" whose content is `@target <amount>`. Keeping it there
 * means it is persisted per account with no schema change and no extra table,
 * and the sentinel prefix makes it trivially separable from the free-text
 * goals, which are shown as written. It is hidden from the goal list and
 * rendered as the account-target progress bar instead.
 */
const TARGET_PREFIX = "@target";
const TARGET_RE = /^@target\s+(-?[\d.]+)\s*$/i;

export const DEFAULT_ACCOUNT_TARGET = 10_000;

function parseTargetRow(row) {
  const match = TARGET_RE.exec(String(row?.content ?? "").trim());
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** CRUD for the `notes` rows of type "goal", with optimistic local updates. */
export function useGoals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("notes")
      .select("id, content, updated_at")
      .eq("type", "goal")
      .order("updated_at", { ascending: false });

    if (err) {
      setError(err.message ?? "Could not load goals");
      setLoading(false);
      return;
    }
    setError(null);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Applies `next` immediately, then persists; rolls back and warns on failure. */
  const optimistic = useCallback(
    async (next, persist, failureMessage) => {
      const snapshot = rows;
      setRows(next);
      try {
        const { error: err } = (await persist()) ?? {};
        if (err) throw new Error(err.message ?? "Request failed");
        return true;
      } catch (err) {
        setRows(snapshot);
        toast.error(failureMessage, { description: err?.message });
        return false;
      }
    },
    [rows, toast]
  );

  const add = useCallback(
    async (content) => {
      const trimmed = String(content ?? "").trim();
      if (!trimmed) return;
      const updated_at = new Date().toISOString();
      const tempId = `pending-${Math.random().toString(36).slice(2)}`;

      const ok = await optimistic(
        [{ id: tempId, content: trimmed, updated_at }, ...rows],
        () => supabase.from("notes").insert({ content: trimmed, type: "goal", updated_at }),
        "Could not save that goal"
      );
      if (ok) {
        toast.success("Goal added");
        await load();
      }
    },
    [rows, optimistic, toast, load]
  );

  const update = useCallback(
    async (id, content) => {
      const trimmed = String(content ?? "").trim();
      if (!trimmed) return;
      const current = rows.find((r) => r.id === id);
      if (!current || current.content === trimmed) return;
      const updated_at = new Date().toISOString();

      const ok = await optimistic(
        rows.map((r) => (r.id === id ? { ...r, content: trimmed, updated_at } : r)),
        () => supabase.from("notes").update({ content: trimmed, updated_at }).eq("id", id),
        "Could not update that goal"
      );
      if (ok) toast.success("Goal updated");
    },
    [rows, optimistic, toast]
  );

  const remove = useCallback(
    async (id) => {
      const removed = rows.find((r) => r.id === id);
      const ok = await optimistic(
        rows.filter((r) => r.id !== id),
        () => supabase.from("notes").delete().eq("id", id),
        "Could not delete that goal"
      );
      if (ok) {
        toast.success("Goal deleted", {
          description: removed?.content ? `“${removed.content}” was removed.` : undefined,
        });
      }
    },
    [rows, optimistic, toast]
  );

  const targetRow = useMemo(() => rows.find((r) => parseTargetRow(r) != null) ?? null, [rows]);
  const target = targetRow ? parseTargetRow(targetRow) : null;

  const setTarget = useCallback(
    async (value) => {
      const amount = Number.parseFloat(value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const content = `${TARGET_PREFIX} ${Math.round(amount)}`;
      const updated_at = new Date().toISOString();

      if (targetRow) {
        const ok = await optimistic(
          rows.map((r) => (r.id === targetRow.id ? { ...r, content, updated_at } : r)),
          () => supabase.from("notes").update({ content, updated_at }).eq("id", targetRow.id),
          "Could not save your account target"
        );
        if (ok) toast.success("Account target updated");
        return;
      }

      const ok = await optimistic(
        [...rows, { id: `pending-target`, content, updated_at }],
        () => supabase.from("notes").insert({ content, type: "goal", updated_at }),
        "Could not save your account target"
      );
      if (ok) {
        toast.success("Account target set");
        await load();
      }
    },
    [rows, targetRow, optimistic, toast, load]
  );

  const goals = useMemo(() => rows.filter((r) => parseTargetRow(r) == null), [rows]);

  return { goals, target, loading, error, add, update, remove, setTarget, reload: load };
}

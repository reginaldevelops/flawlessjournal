"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { groupByDay, normalizeTrades } from "../../lib/trades";
import { keyOf } from "./helpers";

/* ------------------------------------------------------------------ */
/* Entries + trades                                                    */
/* ------------------------------------------------------------------ */

/**
 * The whole journal is loaded once and sliced in memory: a personal trading
 * journal is a few hundred rows at most, and holding it locally makes day
 * switching, month heatmaps and cross-day search instant.
 */
const ENTRY_LIMIT = 2000;

export function useJournal() {
  const [entries, setEntries] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [entriesRes, tradesRes, variablesRes] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("id, created_at, content")
        .order("created_at", { ascending: false })
        .limit(ENTRY_LIMIT),
      supabase.from("trades").select("id, trade_number, data"),
      supabase.from("variables").select("name, varType, phase, options"),
    ]);

    if (entriesRes.error) {
      setError(entriesRes.error.message ?? "Could not load your journal entries");
      setEntries([]);
      setLoading(false);
      return;
    }

    setError(null);
    setEntries(entriesRes.data ?? []);
    setTrades(
      tradesRes.error
        ? []
        : normalizeTrades(tradesRes.data ?? [], variablesRes.error ? [] : (variablesRes.data ?? []))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dayStats = useMemo(() => groupByDay(trades.filter((t) => t.hasResult)), [trades]);

  const entryCountByDay = useMemo(() => {
    const out = {};
    for (const entry of entries) {
      const key = keyOf(new Date(entry.created_at));
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }, [entries]);

  return {
    entries,
    setEntries,
    trades,
    dayStats,
    entryCountByDay,
    loading,
    error,
    reload: load,
  };
}

/* ------------------------------------------------------------------ */
/* Debounce                                                            */
/* ------------------------------------------------------------------ */

export function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/* ------------------------------------------------------------------ */
/* Per-day draft                                                       */
/* ------------------------------------------------------------------ */

const DRAFT_PREFIX = "flawless.journal.draft.";
const EMPTY_DRAFT = { text: "", mood: null, tags: [] };

const hasContent = (draft) =>
  Boolean(draft && (draft.text?.trim() || draft.mood || draft.tags?.length));

/**
 * Keeps one unsaved draft per day in localStorage so navigating between days —
 * or reloading the page mid-thought — never loses what was typed.
 */
export function useDayDraft(day) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let next = EMPTY_DRAFT;
    try {
      const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${day}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        next = {
          text: typeof parsed?.text === "string" ? parsed.text : "",
          mood: typeof parsed?.mood === "string" ? parsed.mood : null,
          tags: Array.isArray(parsed?.tags) ? parsed.tags.map(String) : [],
        };
      }
    } catch {
      /* unreadable draft — start clean */
    }
    setDraft(next);
    setRestored(hasContent(next));
  }, [day]);

  const write = useCallback(
    (next) => {
      try {
        if (hasContent(next)) {
          window.localStorage.setItem(`${DRAFT_PREFIX}${day}`, JSON.stringify(next));
        } else {
          window.localStorage.removeItem(`${DRAFT_PREFIX}${day}`);
        }
      } catch {
        /* storage full or unavailable — the in-memory draft still works */
      }
    },
    [day]
  );

  const update = useCallback(
    (patch) => {
      setRestored(false);
      setDraft((prev) => {
        const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
        write(next);
        return next;
      });
    },
    [write]
  );

  const clear = useCallback(() => {
    setRestored(false);
    setDraft(EMPTY_DRAFT);
    try {
      window.localStorage.removeItem(`${DRAFT_PREFIX}${day}`);
    } catch {
      /* ignore */
    }
  }, [day]);

  return { draft, update, clear, restored, dismissRestored: () => setRestored(false) };
}

/* ------------------------------------------------------------------ */
/* Textarea autosizing                                                 */
/* ------------------------------------------------------------------ */

/**
 * Grows a textarea to fit its content between `min` and `max` pixels.
 * Returns a ref to attach to the element.
 */
export function useAutosize(value, { min = 120, max = 560 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(max, Math.max(min, el.scrollHeight + 2));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, min, max]);

  return ref;
}

/* ------------------------------------------------------------------ */
/* Mounted flag (portals / date inputs)                                */
/* ------------------------------------------------------------------ */

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

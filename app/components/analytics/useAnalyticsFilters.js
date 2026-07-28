"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dateRangePreset, previousRange } from "../../lib/trades";
import { dataBounds } from "./metrics-extra";

const STORAGE_KEY = "flawless.analytics.filters.v1";

export const DEFAULT_FILTERS = {
  preset: "all",
  start: null,
  end: null,
  compare: false,
  search: "",
  custom: {},
  quick: { winners: false, losers: false, mistakes: false, oversized: false },
};

function sanitize(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_FILTERS;
  return {
    preset: typeof raw.preset === "string" ? raw.preset : DEFAULT_FILTERS.preset,
    start: typeof raw.start === "string" ? raw.start : null,
    end: typeof raw.end === "string" ? raw.end : null,
    compare: Boolean(raw.compare),
    search: typeof raw.search === "string" ? raw.search : "",
    custom:
      raw.custom && typeof raw.custom === "object"
        ? Object.fromEntries(
            Object.entries(raw.custom)
              .filter(([, v]) => Array.isArray(v) && v.length)
              .map(([k, v]) => [k, v.map(String)])
          )
        : {},
    quick: { ...DEFAULT_FILTERS.quick, ...(raw.quick ?? {}) },
  };
}

/** Filter state for the analytics workspace, persisted across sessions. */
export function useAnalyticsFilters() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setFilters(sanitize(JSON.parse(raw)));
    } catch {
      /* ignore corrupt state */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* storage full or unavailable */
    }
  }, [filters, hydrated]);

  const patch = useCallback((next) => {
    setFilters((f) => ({ ...f, ...(typeof next === "function" ? next(f) : next) }));
  }, []);

  const setDimension = useCallback((field, values) => {
    setFilters((f) => {
      const custom = { ...f.custom };
      if (!values?.length) delete custom[field];
      else custom[field] = values;
      return { ...f, custom };
    });
  }, []);

  const toggleDimensionValue = useCallback((field, value) => {
    setFilters((f) => {
      const current = f.custom[field] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const custom = { ...f.custom };
      if (next.length) custom[field] = next;
      else delete custom[field];
      return { ...f, custom };
    });
  }, []);

  const toggleQuick = useCallback((id) => {
    setFilters((f) => {
      const quick = { ...f.quick, [id]: !f.quick[id] };
      if (id === "winners" && quick.winners) quick.losers = false;
      if (id === "losers" && quick.losers) quick.winners = false;
      return { ...f, quick };
    });
  }, []);

  const clearAll = useCallback(() => {
    setFilters((f) => ({ ...DEFAULT_FILTERS, compare: f.compare }));
  }, []);

  return { filters, setFilters, patch, setDimension, toggleDimensionValue, toggleQuick, clearAll, hydrated };
}

/**
 * Resolves the filter state into concrete date windows.
 * "All time" falls back to the dataset bounds so comparison and labels still work.
 */
export function useDateWindow(filters, trades) {
  return useMemo(() => {
    const bounds = dataBounds(trades);
    let start = null;
    let end = null;

    if (filters.preset === "custom") {
      start = filters.start ?? null;
      end = filters.end ?? null;
    } else {
      const range = dateRangePreset(filters.preset);
      start = range.start;
      end = range.end;
    }

    const effectiveStart = start ?? bounds.start;
    const effectiveEnd = end ?? bounds.end;
    const previous =
      effectiveStart && effectiveEnd ? previousRange(effectiveStart, effectiveEnd) : { start: null, end: null };

    return { start, end, effectiveStart, effectiveEnd, previous, bounds };
  }, [filters.preset, filters.start, filters.end, trades]);
}

export function activeFilterCount(filters) {
  let n = 0;
  for (const values of Object.values(filters.custom ?? {})) if (values?.length) n += values.length;
  for (const on of Object.values(filters.quick ?? {})) if (on) n += 1;
  if (filters.search?.trim()) n += 1;
  return n;
}

"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Check, ListFilter, X } from "lucide-react";
import {
  Badge,
  Button,
  Popover,
  SearchInput,
  Select,
  Switch,
  Tooltip,
  cn,
} from "../ui";
import { formatDate, formatNumber } from "../../lib/format";
import { RANGE_PRESETS } from "../../lib/trades";
import { QUICK_FILTERS } from "./metrics-extra";
import { activeFilterCount } from "./useAnalyticsFilters";

/* ------------------------------------------------------------------ */
/* Dimension multi-select                                             */
/* ------------------------------------------------------------------ */

function DimensionSection({ dim, facet, selected, onToggle, onClear, query }) {
  const values = useMemo(() => {
    if (!query) return facet;
    const q = query.toLowerCase();
    return facet.filter((v) => String(v.value).toLowerCase().includes(q));
  }, [facet, query]);

  if (!values.length) return null;

  return (
    <div className="border-b border-line-subtle py-2 last:border-0">
      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
          {dim.label}
        </p>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onClear(dim.field)}
            className="text-2xs text-content-subtle transition hover:text-loss"
          >
            Clear
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {values.map((v) => {
          const isOn = selected.includes(v.value);
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => onToggle(dim.field, v.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
                isOn ? "bg-brand-soft text-content" : "text-content-muted hover:bg-surface-hover hover:text-content"
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                  isOn ? "border-brand bg-brand text-brand-fg" : "border-line-strong"
                )}
                aria-hidden
              >
                {isOn && <Check size={10} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {dim.id === "__tags" ? `#${v.value}` : v.value}
              </span>
              <span className="shrink-0 font-mono text-2xs tnum text-content-subtle">{v.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DimensionFilterPopover({ dims, facets, filters, onToggle, onClear }) {
  const [query, setQuery] = useState("");
  const filterable = dims.filter((d) => d.filterable);
  const activeDims = filterable.filter((d) => filters.custom[d.field]?.length);

  return (
    <Popover
      align="start"
      width="w-[min(21rem,calc(100vw-2rem))]"
      contentClassName="p-0"
      trigger={
        <Button variant="secondary" size="sm" icon={ListFilter}>
          Dimensions
          {activeDims.length > 0 && (
            <Badge tone="brand" size="xs" className="ml-0.5">
              {activeDims.length}
            </Badge>
          )}
        </Button>
      }
    >
      <div className="flex max-h-[24rem] flex-col">
        <div className="border-b border-line p-2">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search values…"
            className="[&_input]:h-8 [&_input]:text-xs"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-1 thin-scrollbar">
          {filterable.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-content-subtle">
              No dropdown variables in this journal yet.
            </p>
          )}
          {filterable.map((dim) => (
            <DimensionSection
              key={dim.id}
              dim={dim}
              facet={facets[dim.id] ?? []}
              selected={filters.custom[dim.field] ?? []}
              onToggle={onToggle}
              onClear={onClear}
              query={query}
            />
          ))}
        </div>
      </div>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                            */
/* ------------------------------------------------------------------ */

export function FilterBar({
  filters,
  patch,
  dims,
  facets,
  onToggleDimension,
  onClearDimension,
  onToggleQuick,
  onClearAll,
  window: dateWindow,
  matched,
  total,
  comparable,
  actions,
}) {
  const activeCount = activeFilterCount(filters);
  const isCustom = filters.preset === "custom";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2">
        <Select
          size="sm"
          value={filters.preset}
          onChange={(e) => patch({ preset: e.target.value })}
          aria-label="Date range"
          className="w-[9.5rem]"
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom range…</option>
        </Select>

        {isCustom ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.start ?? ""}
              max={filters.end ?? undefined}
              onChange={(e) => patch({ start: e.target.value || null })}
              aria-label="Start date"
              className="h-8 rounded-lg border border-line bg-surface-raised px-2 font-mono text-xs tnum text-content hover:border-line-strong focus:border-brand focus:outline-none"
            />
            <span className="text-xs text-content-subtle">→</span>
            <input
              type="date"
              value={filters.end ?? ""}
              min={filters.start ?? undefined}
              onChange={(e) => patch({ end: e.target.value || null })}
              aria-label="End date"
              className="h-8 rounded-lg border border-line bg-surface-raised px-2 font-mono text-xs tnum text-content hover:border-line-strong focus:border-brand focus:outline-none"
            />
          </div>
        ) : (
          <span className="hidden items-center gap-1.5 text-2xs text-content-subtle sm:flex">
            <CalendarRange size={12} aria-hidden />
            <span className="font-mono tnum">
              {dateWindow.effectiveStart ? formatDate(dateWindow.effectiveStart, "short") : "—"} →{" "}
              {dateWindow.effectiveEnd ? formatDate(dateWindow.effectiveEnd, "short") : "—"}
            </span>
          </span>
        )}

        <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" aria-hidden />

        <Tooltip
          content={
            comparable
              ? `Compare against ${formatDate(dateWindow.previous.start, "short")} → ${formatDate(dateWindow.previous.end, "short")}`
              : "No complete previous period exists for this range"
          }
        >
          <span className="flex items-center gap-2">
            <Switch
              size="sm"
              checked={filters.compare}
              onChange={(v) => patch({ compare: v })}
              label="Compare with previous period"
            />
            <span className="whitespace-nowrap text-xs text-content-muted">vs previous</span>
          </span>
        </Tooltip>

        <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" aria-hidden />

        <DimensionFilterPopover
          dims={dims}
          facets={facets}
          filters={filters}
          onToggle={onToggleDimension}
          onClear={onClearDimension}
        />

        <div className="flex items-center gap-1">
          {QUICK_FILTERS.map((q) => {
            const on = Boolean(filters.quick[q.id]);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onToggleQuick(q.id)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors",
                  on
                    ? "border-brand/40 bg-brand-soft text-brand"
                    : "border-line text-content-subtle hover:border-line-strong hover:text-content-muted"
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchInput
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            onClear={() => patch({ search: "" })}
            placeholder="Search trades…"
            className="w-full min-w-[10rem] sm:w-40 [&_input]:h-8 [&_input]:text-xs"
          />
          {actions}
        </div>
      </div>

      <FilterChips
        filters={filters}
        dims={dims}
        onToggleDimension={onToggleDimension}
        onToggleQuick={onToggleQuick}
        onClearAll={onClearAll}
        patch={patch}
        matched={matched}
        total={total}
        activeCount={activeCount}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Active filter chips                                                */
/* ------------------------------------------------------------------ */

function Chip({ label, value, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised py-1 pl-2.5 pr-1 text-2xs text-content">
      <span className="text-content-subtle">{label}</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label} ${value}`}
        className="rounded-full p-0.5 text-content-subtle transition hover:bg-loss-soft hover:text-loss"
      >
        <X size={11} />
      </button>
    </span>
  );
}

export function FilterChips({
  filters,
  dims,
  onToggleDimension,
  onToggleQuick,
  onClearAll,
  patch,
  matched,
  total,
  activeCount,
}) {
  const labelFor = (field) => dims.find((d) => d.field === field)?.label ?? field;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 whitespace-nowrap font-mono text-2xs tnum text-content-muted">
        {formatNumber(matched, { decimals: 0 })} of {formatNumber(total, { decimals: 0 })} trades
      </span>

      {Object.entries(filters.custom ?? {}).map(([field, values]) =>
        values.map((v) => (
          <Chip
            key={`${field}-${v}`}
            label={labelFor(field)}
            value={field === "__tags" ? `#${v}` : v}
            onRemove={() => onToggleDimension(field, v)}
          />
        ))
      )}

      {QUICK_FILTERS.filter((q) => filters.quick[q.id]).map((q) => (
        <Chip key={q.id} label="Filter" value={q.label} onRemove={() => onToggleQuick(q.id)} />
      ))}

      {filters.search?.trim() && (
        <Chip label="Search" value={filters.search.trim()} onRemove={() => patch({ search: "" })} />
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-2xs font-medium text-brand transition hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

export default FilterBar;

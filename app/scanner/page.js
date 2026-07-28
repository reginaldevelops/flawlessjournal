"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Filter,
  Radar,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageBody,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  cn,
} from "../components/ui";
import {
  DEFAULT_FILTERS,
  FILTER_STORAGE_KEY,
  SCANNER_CHAINS,
  SORT_OPTIONS,
  VOLUME_WINDOWS,
} from "../lib/scanner/constants";
import {
  formatCurrency,
  formatPercent,
  formatRelative,
  toneTextClass,
  truncateMiddle,
} from "../lib/format";

const REFRESH_MS = 30_000;

function loadFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FILTERS };
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  params.set("chains", (filters.chains ?? []).join(","));
  params.set("volumeWindow", filters.volumeWindow);
  params.set("minVolume", String(filters.minVolume ?? 0));
  params.set("minLiquidity", String(filters.minLiquidity ?? 0));
  params.set("minMcap", String(filters.minMcap ?? 0));
  params.set("maxMcap", String(filters.maxMcap ?? 0));
  params.set("maxAgeHours", String(filters.maxAgeHours ?? 0));
  params.set("minAgeHours", String(filters.minAgeHours ?? 0));
  params.set("mode", filters.mode);
  params.set("spikePct", String(filters.spikePct ?? 50));
  params.set("sort", filters.sort);
  params.set("limit", String(filters.limit ?? 60));
  return params.toString();
}

function formatAge(hours) {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const d = hours / 24;
  return `${d.toFixed(d < 10 ? 1 : 0)}d`;
}

function chainLabel(id) {
  return SCANNER_CHAINS.find((c) => c.id === id)?.short ?? id;
}

function Money({ value, compact = true }) {
  return (
    <span className="font-mono tnum text-content">
      {formatCurrency(value, { compact, decimals: compact ? undefined : 2, fallback: "—" })}
    </span>
  );
}

export default function ScannerPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hits, setHits] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const abortRef = useRef(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = loadFilters();
    setFilters(saved);
    setDraft(saved);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const fetchScan = useCallback(
    async ({ silent = false } = {}) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/scanner?${buildQuery(filters)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.meta?.error || `HTTP ${res.status}`);
        setHits(Array.isArray(data.hits) ? data.hits : []);
        setMeta(data.meta ?? null);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setError(err?.message ?? "Scanner failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    if (!hydrated.current) return;
    fetchScan();
  }, [fetchScan]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => fetchScan({ silent: true }), REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fetchScan]);

  const applyDraft = () => setFilters({ ...draft });
  const resetFilters = () => {
    setDraft({ ...DEFAULT_FILTERS });
    setFilters({ ...DEFAULT_FILTERS });
  };

  const toggleChain = (id) => {
    setDraft((prev) => {
      const has = prev.chains.includes(id);
      const chains = has
        ? prev.chains.filter((c) => c !== id)
        : [...prev.chains, id];
      return { ...prev, chains: chains.length ? chains : [id] };
    });
  };

  const windowMeta = useMemo(
    () => VOLUME_WINDOWS.find((w) => w.id === filters.volumeWindow) ?? VOLUME_WINDOWS[0],
    [filters.volumeWindow]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.minVolume > 0) n += 1;
    if (filters.minLiquidity > 0) n += 1;
    if (filters.minMcap > 0 || filters.maxMcap > 0) n += 1;
    if (filters.maxAgeHours > 0 || filters.minAgeHours > 0) n += 1;
    if (filters.mode === "spike") n += 1;
    if (filters.chains.length !== DEFAULT_FILTERS.chains.length) n += 1;
    return n;
  }, [filters]);

  return (
    <>
      <PageHeader
        title="Scanner"
        description="Live DexScreener feed — pairs that clear your volume threshold inside the selected window. Filters for chain, liquidity, market cap and pair age."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "subtle" : "ghost"}
              size="sm"
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? "Live · 30s" : "Paused"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Filter}
              onClick={() => setFiltersOpen((o) => !o)}
            >
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => fetchScan({ silent: true })}
            >
              Refresh
            </Button>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3 text-xs text-content-muted">
            <span className="inline-flex items-center gap-1.5">
              <Radar size={13} className="text-brand" />
              Window <strong className="text-content">{windowMeta.label}</strong>
            </span>
            <span className="text-line-strong">·</span>
            <span>
              Min vol{" "}
              <strong className="font-mono tnum text-content">
                {formatCurrency(filters.minVolume, { compact: true })}
              </strong>
            </span>
            {meta?.fetchedAt && (
              <>
                <span className="text-line-strong">·</span>
                <span>Updated {formatRelative(meta.fetchedAt)}</span>
              </>
            )}
            {meta && (
              <>
                <span className="text-line-strong">·</span>
                <span className="font-mono tnum">
                  {meta.matched ?? 0}/{meta.pairsScanned ?? 0} matched
                </span>
              </>
            )}
          </div>
        }
      />

      <PageBody className="space-y-5">
        {filtersOpen && (
          <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5 animate-fade-in">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-content">Scan filters</h2>
                <p className="mt-0.5 text-xs text-content-muted">
                  DexScreener has no native 4h bucket — use <span className="text-content">6h</span> as
                  the closest window. Spike mode flags pairs whose volume jumped since the last poll.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
                <Button variant="primary" size="sm" onClick={applyDraft}>
                  Apply filters
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-4">
                <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                  Chains
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SCANNER_CHAINS.map((c) => {
                    const on = draft.chains.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleChain(c.id)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                          on
                            ? "border-brand/40 bg-brand-soft text-brand"
                            : "border-line bg-surface-raised text-content-muted hover:border-line-strong hover:text-content"
                        )}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <Field label="Volume window" hint={VOLUME_WINDOWS.find((w) => w.id === draft.volumeWindow)?.hint}>
                  {() => (
                    <Segmented
                      value={draft.volumeWindow}
                      onChange={(volumeWindow) => setDraft((p) => ({ ...p, volumeWindow }))}
                      options={VOLUME_WINDOWS.map((w) => ({ value: w.id, label: w.label }))}
                    />
                  )}
                </Field>

                <Field label="Mode">
                  {() => (
                    <Segmented
                      value={draft.mode}
                      onChange={(mode) => setDraft((p) => ({ ...p, mode }))}
                      options={[
                        { value: "threshold", label: "Threshold" },
                        { value: "spike", label: "Spike" },
                      ]}
                    />
                  )}
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
                <Field label="Min volume (USD)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={1000}
                      value={draft.minVolume}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, minVolume: Number(e.target.value) || 0 }))
                      }
                    />
                  )}
                </Field>
                <Field label="Min liquidity (USD)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={1000}
                      value={draft.minLiquidity}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, minLiquidity: Number(e.target.value) || 0 }))
                      }
                    />
                  )}
                </Field>
                <Field label="Min market cap">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={1000}
                      value={draft.minMcap}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, minMcap: Number(e.target.value) || 0 }))
                      }
                    />
                  )}
                </Field>
                <Field label="Max market cap" hint="0 = no max">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={1000}
                      value={draft.maxMcap}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, maxMcap: Number(e.target.value) || 0 }))
                      }
                    />
                  )}
                </Field>
                <Field label="Max pair age (hours)" hint="0 = no max">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={1}
                      value={draft.maxAgeHours}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, maxAgeHours: Number(e.target.value) || 0 }))
                      }
                    />
                  )}
                </Field>
                <Field label="Min pair age (hours)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={1}
                      value={draft.minAgeHours}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, minAgeHours: Number(e.target.value) || 0 }))
                      }
                    />
                  )}
                </Field>
              </div>

              <div className="space-y-3 lg:col-span-3">
                <Field
                  label="Spike lift %"
                  hint="Only used in spike mode — % volume increase vs last poll"
                >
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={1}
                      step={5}
                      value={draft.spikePct}
                      disabled={draft.mode !== "spike"}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, spikePct: Number(e.target.value) || 50 }))
                      }
                    />
                  )}
                </Field>
                <Field label="Sort by">
                  {(id) => (
                    <Select
                      id={id}
                      value={draft.sort}
                      onChange={(e) => setDraft((p) => ({ ...p, sort: e.target.value }))}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            </div>
          </section>
        )}

        {error && !loading && (
          <ErrorState
            title="Scanner unavailable"
            description={error}
            onRetry={() => fetchScan()}
          />
        )}

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && !error && hits.length === 0 && (
          <EmptyState
            icon={Radar}
            title="No pairs matched"
            description="Loosen volume, liquidity or age filters — or wait for the next boost/meta wave on DexScreener."
            action={
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        )}

        {!loading && hits.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto thin-scrollbar">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-sunken/80">
                    {[
                      "Token",
                      "Chain",
                      "Price",
                      `${windowMeta.label} vol`,
                      "Liq",
                      "Mcap",
                      "Age",
                      `${windowMeta.label} Δ`,
                      "Txns",
                      "",
                    ].map((h) => (
                      <th
                        key={h || "link"}
                        className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle first:pl-4 last:pr-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hits.map((hit, idx) => (
                    <tr
                      key={hit.id}
                      className={cn(
                        "border-b border-line/70 transition-colors hover:bg-surface-hover/60",
                        idx === 0 && "animate-fade-in"
                      )}
                    >
                      <td className="px-3 py-3 first:pl-4">
                        <div className="flex items-center gap-2.5">
                          {hit.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={hit.imageUrl}
                              alt=""
                              className="h-8 w-8 rounded-full bg-surface-sunken object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-2xs font-bold text-brand">
                              {(hit.baseToken.symbol || "?").slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-semibold text-content">
                                {hit.baseToken.symbol}
                              </span>
                              {hit.spike?.isSpike && (
                                <Badge tone="brand" size="sm" className="gap-0.5">
                                  <Zap size={10} />
                                  Spike
                                  {hit.spike.liftPct != null
                                    ? ` ${Math.round(hit.spike.liftPct)}%`
                                    : ""}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-2xs text-content-subtle">
                              {hit.baseToken.name}
                              <span className="mx-1 text-line-strong">·</span>
                              {truncateMiddle(hit.baseToken.address, 4, 4)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone="neutral" size="sm">
                          {chainLabel(hit.chainId)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-mono tnum text-xs text-content">
                        {hit.priceUsd != null
                          ? formatCurrency(hit.priceUsd, {
                              compact: hit.priceUsd < 0.01,
                              decimals: hit.priceUsd < 0.01 ? 6 : 4,
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Money value={hit.volumeActive} />
                        <div className="mt-0.5 flex gap-2 text-2xs text-content-subtle font-mono tnum">
                          <span>1h {formatCurrency(hit.volume.h1, { compact: true, fallback: "—" })}</span>
                          <span>6h {formatCurrency(hit.volume.h6, { compact: true, fallback: "—" })}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Money value={hit.liquidityUsd} />
                      </td>
                      <td className="px-3 py-3">
                        <Money value={hit.marketCap} />
                      </td>
                      <td className="px-3 py-3 font-mono tnum text-xs text-content-muted">
                        {formatAge(hit.ageHours)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 font-mono tnum text-xs font-medium",
                          toneTextClass(hit.changeActive)
                        )}
                      >
                        {formatPercent(hit.changeActive, { signed: true })}
                      </td>
                      <td className="px-3 py-3 font-mono tnum text-2xs text-content-muted">
                        <span className="text-profit">{hit.buys}</span>
                        <span className="mx-0.5 text-content-subtle">/</span>
                        <span className="text-loss">{hit.sells}</span>
                      </td>
                      <td className="px-3 py-3 last:pr-4">
                        {hit.url && (
                          <a
                            href={hit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover"
                          >
                            Dex
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

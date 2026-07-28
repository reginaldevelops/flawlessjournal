"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Flame,
  Globe2,
  RefreshCw,
  Snowflake,
  Waves,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBody,
  PageHeader,
  Segmented,
  SkeletonCard,
  StatCard,
  cn,
} from "../components/ui";
import ChainHistoryChart from "../components/chain/ChainHistoryChart";
import { formatCurrency, formatNumber, formatPercent, toneTextClass } from "../lib/format";

const CHAIN_OPTIONS = [
  { value: "solana", label: "Solana" },
  { value: "hyperliquid", label: "Hyperliquid" },
];

const METRIC_OPTIONS = [
  { value: "dexVolume", label: "DEX volume" },
  { value: "fees", label: "Fees" },
  { value: "revenue", label: "Revenue" },
  { value: "tvl", label: "TVL" },
];

const RANGE_OPTIONS = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "365d", label: "365D" },
];

const HEAT_COPY = {
  Hot: "Volume is running hot — good window to be online.",
  Warm: "Activity is elevated. Stay selective, not sleepy.",
  Neutral: "Neither a frenzy nor a ghost town.",
  Cooling: "Momentum is fading — fewer forced sessions.",
  Cold: "Quiet tape. Fine time for rest / systems work.",
};

function deltaTone(v) {
  if (v == null || !Number.isFinite(Number(v))) return "neutral";
  if (v > 0) return "profit";
  if (v < 0) return "loss";
  return "neutral";
}

function HeatBanner({ heat }) {
  if (!heat) return null;
  const Icon =
    heat.label === "Hot" || heat.label === "Warm"
      ? Flame
      : heat.label === "Cold"
        ? Snowflake
        : heat.label === "Cooling"
          ? Waves
          : Activity;

  const iconToneClass =
    heat.tone === "profit"
      ? "text-profit"
      : heat.tone === "brand"
        ? "text-brand"
        : heat.tone === "warn"
          ? "text-warn"
          : heat.tone === "loss"
            ? "text-loss"
            : "text-content-muted";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5",
        heat.tone === "profit" && "border-profit/35 bg-profit-soft/50",
        heat.tone === "brand" && "border-brand/35 bg-brand-soft/50",
        heat.tone === "warn" && "border-warn/35 bg-warn-soft/50",
        heat.tone === "loss" && "border-loss/35 bg-loss-soft/50",
        heat.tone === "neutral" && "border-line bg-surface"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon size={22} className={cn("mt-0.5 shrink-0", iconToneClass)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-base font-semibold tracking-tight text-content">{heat.label}</p>
            <Badge tone={heat.tone === "brand" ? "brand" : heat.tone} size="sm">
              Market heat
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-snug text-content-muted">
            {HEAT_COPY[heat.label] || HEAT_COPY.Neutral}
          </p>
          <p className="mt-1.5 font-mono text-2xs tnum text-content-subtle">
            Score {heat.score > 0 ? "+" : ""}
            {heat.score}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlatformTable({ title, rows, valueLabel = "24h" }) {
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`${rows?.length || 0} protocols`}
      />
      <CardBody className="p-0">
        {!rows?.length ? (
          <p className="px-4 py-6 text-center text-xs text-content-subtle">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                    Platform
                  </th>
                  <th className="px-4 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                    {valueLabel}
                  </th>
                  <th className="px-4 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                    1D
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.slug || row.name} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        {row.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.logo}
                            alt=""
                            className="h-5 w-5 rounded-full bg-surface-sunken"
                          />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-sunken text-2xs text-content-subtle">
                            #
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-content">{row.name}</p>
                          {row.category ? (
                            <p className="truncate text-2xs text-content-subtle">{row.category}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tnum text-content">
                      {formatCurrency(row.total24h, { compact: true })}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-mono text-xs tnum",
                        toneTextClass(row.change1d)
                      )}
                    >
                      {row.change1d == null
                        ? "—"
                        : formatPercent(row.change1d, { signed: true, decimals: 1 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function CompareCards({ rows, active, onSelect }) {
  if (!rows?.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => {
        const selected = row.id === active;
        const DeltaIcon =
          (row.dexVolumeChange1d ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition",
              selected
                ? "border-brand/40 bg-brand-soft/30"
                : "border-line bg-surface hover:border-line-strong"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-content">{row.label}</p>
              {row.heat ? (
                <Badge tone={row.heat.tone === "brand" ? "brand" : row.heat.tone} size="xs">
                  {row.heat.label}
                </Badge>
              ) : null}
            </div>
            {row.error ? (
              <p className="mt-2 text-xs text-loss">{row.error}</p>
            ) : (
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-2xs text-content-subtle">DEX vol 24h</p>
                  <p className="font-mono text-sm tnum font-semibold text-content">
                    {formatCurrency(row.dexVolume24h, { compact: true })}
                  </p>
                  {row.tvl != null ? (
                    <p className="mt-0.5 text-2xs text-content-subtle">
                      TVL {formatCurrency(row.tvl, { compact: true })}
                    </p>
                  ) : null}
                </div>
                {row.dexVolumeChange1d != null ? (
                  <p
                    className={cn(
                      "inline-flex items-center gap-0.5 font-mono text-xs tnum font-medium",
                      toneTextClass(row.dexVolumeChange1d)
                    )}
                  >
                    <DeltaIcon size={12} />
                    {formatPercent(row.dexVolumeChange1d, {
                      signed: true,
                      decimals: 1,
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ChainAnalysisPage() {
  const [chain, setChain] = useState("solana");
  const [metric, setMetric] = useState("dexVolume");
  const [range, setRange] = useState("30d");
  const [platformsOpen, setPlatformsOpen] = useState(false);
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  });

  const load = useCallback(async (nextChain = chain) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/chain-analysis?chain=${encodeURIComponent(nextChain)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setState({ loading: false, error: null, data: json });
    } catch (err) {
      setState({
        loading: false,
        error: err?.message || "Failed to load chain analysis",
        data: null,
      });
    }
  }, [chain]);

  useEffect(() => {
    load(chain);
  }, [chain, load]);

  const chartPoints = useMemo(() => {
    const charts = state.data?.charts?.[metric];
    return charts?.[range] || [];
  }, [state.data, metric, range]);

  const avg =
    chartPoints.length > 0
      ? chartPoints.reduce((s, p) => s + (p.v || 0), 0) / chartPoints.length
      : null;
  const last = chartPoints.at(-1)?.v ?? null;
  const vsAvg =
    avg > 0 && last != null ? ((last - avg) / avg) * 100 : null;

  const stats = state.data?.stats;
  const pump = state.data?.pump;

  return (
    <>
      <PageHeader
        eyebrow="Research"
        title="Chain analysis"
        description="On-chain volume, TVL and platform fees — so you can tell when Solana (or HL) is hot enough to sit at the desk, or quiet enough to take the week off."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => load(chain)}
            disabled={state.loading}
          >
            Refresh
          </Button>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={chain}
              onChange={setChain}
              options={CHAIN_OPTIONS}
            />
            <span className="hidden text-2xs text-content-subtle sm:inline">
              Data via DefiLlama{chain === "solana" ? " · launches via pump.fun estimate" : ""}
            </span>
          </div>
        }
      />

      <PageBody className="space-y-4">
        {state.loading && !state.data ? (
          <div className="space-y-4">
            <LoadingState label="Pulling chain heat…" compact />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} height="h-24" />
              ))}
            </div>
            <SkeletonCard height="h-72" />
          </div>
        ) : null}

        {state.error && !state.data ? (
          <ErrorState
            title="Couldn’t load chain data"
            description={state.error}
            onRetry={() => load(chain)}
          />
        ) : null}

        {state.data ? (
          <>
            <CompareCards
              rows={state.data.compare}
              active={chain}
              onSelect={setChain}
            />

            <HeatBanner heat={state.data.heat} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <StatCard
                label="TVL"
                icon={Globe2}
                value={formatCurrency(stats.tvl, { compact: true })}
                delta={stats.tvlChange1d}
                deltaLabel="vs yesterday"
                tone={deltaTone(stats.tvlChange1d)}
                hint="Total value locked on this chain (DefiLlama)."
              />
              <StatCard
                label="DEX volume 24h"
                icon={Activity}
                value={formatCurrency(stats.dexVolume24h, { compact: true })}
                delta={stats.dexVolumeChange1d}
                deltaLabel={
                  stats.dexVolumeChange7d != null
                    ? `7D ${formatPercent(stats.dexVolumeChange7d, { signed: true, decimals: 1 })}`
                    : "vs prior day"
                }
                tone={deltaTone(stats.dexVolumeChange1d)}
                hint="Aggregated spot DEX volume."
              />
              <StatCard
                label="Fees 24h"
                value={formatCurrency(stats.fees24h, { compact: true })}
                delta={stats.feesChange1d}
                tone={deltaTone(stats.feesChange1d)}
                hint="Protocol fees collected across the chain."
              />
              <StatCard
                label="Revenue 24h"
                value={formatCurrency(stats.revenue24h, { compact: true })}
                delta={stats.revenueChange1d}
                tone={deltaTone(stats.revenueChange1d)}
                hint="Protocol revenue (fees kept by protocols)."
              />
              {chain === "solana" ? (
                <>
                  <StatCard
                    label="Tokens launched 24h"
                    value={
                      pump?.launches24h != null
                        ? `~${formatNumber(pump.launches24h, { decimals: 0 })}`
                        : "—"
                    }
                    sublabel="pump.fun rate × 24h"
                    hint={pump?.note || "Estimated pump.fun create rate × 24h."}
                  />
                  <StatCard
                    label="Tokens migrated 24h"
                    value={
                      pump?.migrations24h != null
                        ? `~${formatNumber(pump.migrations24h, { decimals: 0 })}`
                        : "—"
                    }
                    sublabel="graduated rate × 24h"
                    hint="Estimated completed/graduated pump.fun coins (rate × 24h)."
                  />
                </>
              ) : (
                <StatCard
                  label="Focus"
                  value={state.data.chain?.focus || "Venue scale"}
                  sublabel="HL for perps / spot heat"
                  hint="Hyperliquid is included for venue-scale activity next to Solana DEX heat."
                />
              )}
            </div>

            <section className="rounded-2xl border border-line bg-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setPlatformsOpen((o) => !o)}
                aria-expanded={platformsOpen}
                aria-label={platformsOpen ? "Hide platform breakdown" : "Show platform breakdown"}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface-hover/50"
              >
                <div>
                  <p className="text-sm font-semibold text-content">Platform breakdown</p>
                  <p className="mt-0.5 text-xs text-content-muted">
                    DEX volume, fees, revenue{chain === "solana" ? " & launchpads" : ""}
                  </p>
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    "shrink-0 text-content-subtle transition-transform",
                    platformsOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {platformsOpen ? (
                <div className="grid gap-3 border-t border-line p-3 lg:grid-cols-2">
                  <PlatformTable title="Top DEX platforms" rows={state.data.topDexs} valueLabel="Vol 24h" />
                  <PlatformTable title="Top fees" rows={state.data.topFees} valueLabel="Fees 24h" />
                  <PlatformTable
                    title="Top revenue"
                    rows={state.data.topRevenue}
                    valueLabel="Rev 24h"
                  />
                  {chain === "solana" ? (
                    <PlatformTable
                      title="Launchpads & meme rails"
                      rows={state.data.launchpads}
                      valueLabel="Rev 24h"
                    />
                  ) : (
                    <Card>
                      <CardHeader
                        title="How to use this"
                        subtitle="Vacation vs desk time"
                      />
                      <CardBody className="space-y-2 text-xs leading-relaxed text-content-muted">
                        <p>
                          Rising 24h/7d DEX volume and fees usually means more flow and better
                          opportunity density. Falling volume is your cue to reduce screen time.
                        </p>
                        <p>
                          Compare Solana DEX heat with Hyperliquid when you care about overall
                          crypto risk-on — HL often leads on perps scale even when SOL memes cool off.
                        </p>
                      </CardBody>
                    </Card>
                  )}
                </div>
              ) : null}
            </section>

            <Card>
              <CardHeader
                title="History"
                subtitle={
                  vsAvg != null
                    ? `Latest day is ${formatPercent(vsAvg, { signed: true, decimals: 1 })} vs ${range} average`
                    : "Switch metric and window to research regimes"
                }
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                      size="sm"
                      value={metric}
                      onChange={setMetric}
                      options={METRIC_OPTIONS}
                    />
                    <Segmented
                      size="sm"
                      value={range}
                      onChange={setRange}
                      options={RANGE_OPTIONS}
                    />
                  </div>
                }
              />
              <CardBody>
                <ChainHistoryChart
                  points={chartPoints}
                  range={range}
                  height={300}
                  colorToken={
                    metric === "fees" || metric === "revenue"
                      ? "warn"
                      : metric === "tvl"
                        ? "info"
                        : "brand"
                  }
                />
                {state.loading ? (
                  <p className="mt-2 text-2xs text-content-subtle">Refreshing…</p>
                ) : null}
              </CardBody>
            </Card>

            {!state.data.topDexs?.length && !stats?.dexVolume24h ? (
              <EmptyState
                icon={Globe2}
                title="No chain activity returned"
                description="DefiLlama may be rate-limiting. Try refresh in a minute."
              />
            ) : null}

            <p className="text-center text-2xs text-content-subtle">
              Updated {state.data.fetchedAt ? new Date(state.data.fetchedAt).toLocaleString() : "—"}
              {" · "}
              Not financial advice — regime context for your own journal.
            </p>
          </>
        ) : null}
      </PageBody>
    </>
  );
}

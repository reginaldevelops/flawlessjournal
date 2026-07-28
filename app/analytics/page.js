"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  FileText,
  GitCompareArrows,
  Layers,
  RefreshCw,
  Rocket,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBody,
  PageHeader,
  SkeletonCard,
  Tabs,
} from "../components/ui";
import { FilterBar } from "../components/analytics/FilterBar";
import { OverviewTab } from "../components/analytics/OverviewTab";
import { CalendarTab } from "../components/analytics/CalendarTab";
import { BreakdownTab } from "../components/analytics/BreakdownTab";
import { TimeTab } from "../components/analytics/TimeTab";
import { CompareTab } from "../components/analytics/CompareTab";
import { ReportTab } from "../components/analytics/ReportTab";
import {
  buildDimensions,
  applyFilters,
  cumulativeR,
  dailyEquity,
  dimensionValues,
  equityWithDrawdown,
  headlineDeltas,
  plannedRiskOf,
  rollingSeries,
} from "../components/analytics/metrics-extra";
import { useAnalyticsFilters, useDateWindow } from "../components/analytics/useAnalyticsFilters";
import { supabase } from "../lib/supabaseClient";
import { computeMetrics, normalizeTrades } from "../lib/trades";
import { formatCurrency, formatDate, pluralize } from "../lib/format";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "breakdown", label: "Breakdown", icon: Layers },
  { id: "time", label: "Time", icon: Clock3 },
  { id: "compare", label: "Compare", icon: GitCompareArrows },
  { id: "report", label: "Report", icon: FileText },
];

function LoadingShell() {
  return (
    <div className="space-y-4">
      <LoadingState label="Building your analytics workspace…" compact />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} height="h-20" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonCard className="xl:col-span-2" height="h-72" />
        <SkeletonCard height="h-72" />
      </div>
    </div>
  );
}

function useAnalyticsData() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    trades: [],
    variables: [],
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const [tradesRes, variablesRes] = await Promise.all([
      supabase.from("trades").select("id, trade_number, data").order("trade_number", { ascending: true }),
      supabase.from("variables").select("name, varType, phase, options, visible, order"),
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
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { ...state, reload: load };
}

function resolvedFilterState(filters, dateWindow) {
  return {
    ...filters,
    start: dateWindow.start,
    end: dateWindow.end,
  };
}

function previousFilterState(filters, dateWindow) {
  return {
    ...filters,
    start: dateWindow.previous.start,
    end: dateWindow.previous.end,
  };
}

export default function AnalyticsPage() {
  const { trades, variables, loading, error, reload } = useAnalyticsData();
  const {
    filters,
    patch,
    setDimension,
    toggleDimensionValue,
    toggleQuick,
    clearAll,
  } = useAnalyticsFilters();
  const [activeTab, setActiveTab] = useState("overview");

  const dateWindow = useDateWindow(filters, trades);

  const plannedRisk = useMemo(() => plannedRiskOf(trades), [trades]);
  const dims = useMemo(
    () => buildDimensions(variables, trades, { plannedRisk }),
    [variables, trades, plannedRisk]
  );

  const currentFilters = useMemo(
    () => resolvedFilterState(filters, dateWindow),
    [filters, dateWindow]
  );

  const filteredTrades = useMemo(
    () => applyFilters(trades, currentFilters, { plannedRisk }),
    [trades, currentFilters, plannedRisk]
  );

  const metrics = useMemo(() => computeMetrics(filteredTrades), [filteredTrades]);

  const previousFilters = useMemo(
    () => previousFilterState(filters, dateWindow),
    [filters, dateWindow]
  );

  const previousTrades = useMemo(
    () =>
      dateWindow.previous.start && dateWindow.previous.end
        ? applyFilters(trades, previousFilters, { plannedRisk })
        : [],
    [trades, previousFilters, plannedRisk, dateWindow.previous.start, dateWindow.previous.end]
  );

  const previousMetrics = useMemo(
    () => (previousTrades.length ? computeMetrics(previousTrades) : null),
    [previousTrades]
  );

  const comparable = Boolean(
    dateWindow.previous.start &&
      dateWindow.previous.end &&
      dateWindow.bounds.start &&
      dateWindow.previous.end >= dateWindow.bounds.start
  );
  const comparing = Boolean(filters.compare && comparable && previousMetrics?.totalTrades);

  const deltas = useMemo(
    () => (comparing ? headlineDeltas(metrics, previousMetrics) : {}),
    [comparing, metrics, previousMetrics]
  );

  const facetBaseFilters = useMemo(
    () => ({
      ...currentFilters,
      custom: {},
    }),
    [currentFilters]
  );
  const facetBaseTrades = useMemo(
    () => applyFilters(trades, facetBaseFilters, { plannedRisk }),
    [trades, facetBaseFilters, plannedRisk]
  );
  const facets = useMemo(() => {
    const entries = dims
      .filter((d) => d.filterable)
      .map((dim) => [dim.id, dimensionValues(facetBaseTrades, dim)]);
    return Object.fromEntries(entries);
  }, [dims, facetBaseTrades]);

  const tradeSeries = useMemo(() => equityWithDrawdown(metrics), [metrics]);
  const daySeries = useMemo(() => dailyEquity(metrics.days), [metrics.days]);
  const rSeries = useMemo(() => cumulativeR(filteredTrades), [filteredTrades]);
  const rolling = useMemo(() => rollingSeries(filteredTrades), [filteredTrades]);
  const hasR = metrics.rTradeCount > 0;

  const totalClosed = useMemo(
    () => trades.filter((t) => t.hasResult).length,
    [trades]
  );
  const noTrades = !loading && !error && trades.length === 0;
  const noFilteredTrades = !loading && !error && trades.length > 0 && metrics.totalTrades === 0;

  const rangeLabel = dateWindow.effectiveStart
    ? `${formatDate(dateWindow.effectiveStart, "short")} → ${formatDate(dateWindow.effectiveEnd, "short")}`
    : "No dated trades";

  const toolbar =
    !loading && !error ? (
      <FilterBar
        filters={filters}
        patch={patch}
        dims={dims}
        facets={facets}
        onToggleDimension={toggleDimensionValue}
        onClearDimension={(field) => setDimension(field, [])}
        onToggleQuick={toggleQuick}
        onClearAll={clearAll}
        window={dateWindow}
        matched={metrics.totalTrades}
        total={totalClosed}
        comparable={comparable}
      />
    ) : null;

  const tabContent = {
    overview: (
      <OverviewTab
        metrics={metrics}
        deltas={deltas}
        comparing={comparing}
        tradeSeries={tradeSeries}
        daySeries={daySeries}
        rSeries={rSeries}
        rolling={rolling}
        hasR={hasR}
        trades={filteredTrades}
      />
    ),
    calendar: <CalendarTab metrics={metrics} bounds={dateWindow.bounds} />,
    breakdown: (
      <BreakdownTab
        dims={dims}
        trades={filteredTrades}
        onDrillDown={toggleDimensionValue}
      />
    ),
    time: <TimeTab trades={filteredTrades} dims={dims} />,
    compare: <CompareTab dims={dims} trades={filteredTrades} plannedRisk={plannedRisk} />,
    report: (
      <ReportTab
        metrics={metrics}
        trades={filteredTrades}
        dims={dims}
        plannedRisk={plannedRisk}
        variables={variables}
        window={dateWindow}
      />
    ),
  };

  return (
    <>
      <PageHeader
        title="Analytics"
        description="A professional-grade trading review desk: performance, risk, timing, breakdowns, comparisons and an exportable edge report."
        actions={
          <>
            <Badge tone="outline" size="sm" className="hidden sm:inline-flex">
              {rangeLabel}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={reload}
              className={loading ? "pointer-events-none opacity-60" : undefined}
            >
              Refresh
            </Button>
          </>
        }
        toolbar={toolbar}
      />

      <PageBody className="space-y-4">
        {error && (
          <ErrorState
            title="Could not load analytics"
            description={error}
            onRetry={reload}
          />
        )}

        {loading ? (
          <LoadingShell />
        ) : noTrades ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={Rocket}
                title="Analytics is ready for your first trade"
                description="Log closed trades with a date and P&L to unlock the equity curve, calendars, risk diagnostics, dimension breakdowns and comparison reports."
                action={
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button as={Link} href="/trades" variant="primary" size="sm">
                      Log a trade
                    </Button>
                    <Button as={Link} href="/onboarding" variant="secondary" size="sm">
                      Configure journal fields
                    </Button>
                  </div>
                }
              />
            </CardBody>
          </Card>
        ) : noFilteredTrades ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={BarChart3}
                title="No closed trades match this view"
                description="Clear a dimension, quick filter or search term, or widen the date range to bring trades back into the analytics workspace."
                action={
                  <Button variant="secondary" size="sm" onClick={clearAll} className="mt-4">
                    Clear filters
                  </Button>
                }
              >
                <p className="mt-3 text-2xs text-content-subtle">
                  {pluralize(trades.length, "logged trade")} loaded ·{" "}
                  {formatCurrency(computeMetrics(trades).netPnl, { decimals: 0, signed: true })} all-time net
                </p>
              </EmptyState>
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-content-muted">
                  {pluralize(metrics.totalTrades, "closed trade")} in view ·{" "}
                  {formatCurrency(metrics.netPnl, { decimals: 0, signed: true })} net ·{" "}
                  {pluralize(metrics.tradingDays, "session")}
                </p>
                {comparing && (
                  <p className="mt-0.5 text-2xs text-content-subtle">
                    Compared with {formatDate(dateWindow.previous.start, "short")} →{" "}
                    {formatDate(dateWindow.previous.end, "short")} ({pluralize(previousMetrics.totalTrades, "trade")}).
                  </p>
                )}
              </div>
              <Badge tone={hasR ? "brand" : "neutral"} size="sm">
                {hasR ? `${metrics.rTradeCount} R-tracked` : "P&L mode"}
              </Badge>
            </div>

            <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

            <section>{tabContent[activeTab] ?? tabContent.overview}</section>
          </>
        )}
      </PageBody>
    </>
  );
}

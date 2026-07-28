"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, RefreshCw, Rocket } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  PageBody,
  PageHeader,
  Toolbar,
  ToolbarDivider,
} from "../components/ui";
import {
  BalancesCard,
  EconomicCalendarCard,
  EquityCurveCard,
  GoalsCard,
  HeroMetrics,
  InsightsCard,
  NotesCard,
  PeriodSelector,
  PnlCalendarCard,
  RecentTradesCard,
  TodayPanel,
} from "../components/dashboard";
import {
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  useBalances,
  useEconomicCalendar,
  useGoals,
  useNow,
  usePeriodMetrics,
  usePersistentJson,
  usePersistentState,
  useScratchpad,
  useTrades,
} from "../components/dashboard/hooks";
import {
  cleanSessionStreak,
  eventTimestamp,
  matchSessionKey,
  MARKET_SESSIONS,
} from "../components/dashboard/helpers";
import { closedTrades, computeMetrics, generateInsights, groupByDay, groupStats } from "../lib/trades";
import { dateKey, formatDate, pluralize } from "../lib/format";

const PERIOD_KEY = "flawless.dashboard.period";
const LIMIT_KEY = "flawless.dashboard.dailyLossLimit";
const VALID_PERIODS = new Set(PERIOD_OPTIONS.map((p) => p.value));

/** A sane default daily loss limit: three average risk units. */
function suggestLossLimit(closed) {
  const risks = closed
    .slice(-40)
    .map((t) => t.risk)
    .filter((r) => r != null && r > 0);
  if (!risks.length) return 500;
  const sorted = [...risks].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const typical = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.max(50, Math.round((typical * 3) / 50) * 50);
}

export default function DashboardPage() {
  const { trades, loading, error, reload } = useTrades();
  const [storedPeriod, setPeriod] = usePersistentState(PERIOD_KEY, "month");
  const period = VALID_PERIODS.has(storedPeriod) ? storedPeriod : "month";

  const now = useNow(60_000);
  const todayKey = useMemo(() => (now ? dateKey(now) : null), [now]);

  const { range, prevRange, trades: rangeTrades, metrics, previousMetrics, deltas } = usePeriodMetrics(
    trades,
    period,
    todayKey
  );

  const allClosed = useMemo(() => closedTrades(trades), [trades]);
  const allTimeMetrics = useMemo(() => computeMetrics(trades), [trades]);
  const allDays = useMemo(() => groupByDay(allClosed), [allClosed]);

  const insights = useMemo(() => generateInsights(rangeTrades, metrics), [rangeTrades, metrics]);

  const recentTrades = useMemo(
    () =>
      [...trades].sort(
        (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || (b.tradeNumber ?? 0) - (a.tradeNumber ?? 0)
      ),
    [trades]
  );

  const sessionEdge = useMemo(() => {
    const groups = groupStats(allClosed, "session", { minCount: 1 });
    const out = {};
    for (const session of MARKET_SESSIONS) {
      const matched = groups.filter((group) => matchSessionKey(group.key, session));
      if (!matched.length) continue;
      const count = matched.reduce((sum, g) => sum + g.count, 0);
      const wins = matched.reduce((sum, g) => sum + g.wins, 0);
      out[session.name] = {
        count,
        pnl: matched.reduce((sum, g) => sum + g.pnl, 0),
        winRate: count ? (wins / count) * 100 : 0,
      };
    }
    return out;
  }, [allClosed]);

  const today = todayKey ? allDays[todayKey] : null;

  const [week, setWeek] = useState("this");
  const calendar = useEconomicCalendar(week);
  const balances = useBalances();
  const goals = useGoals();
  const scratchpad = useScratchpad();

  const upcomingEvents = useMemo(() => {
    if (!now) return [];
    const from = now.getTime();
    return calendar.events
      .filter((event) => {
        if (!["high", "medium"].includes(event.impact)) return false;
        const ts = eventTimestamp(event);
        return ts != null && ts >= from;
      })
      .sort((a, b) => eventTimestamp(a) - eventTimestamp(b))
      .slice(0, 3);
  }, [calendar.events, now]);

  const limitSuggestion = useMemo(() => suggestLossLimit(allClosed), [allClosed]);
  const [storedLimit, setStoredLimit] = usePersistentJson(LIMIT_KEY, null);
  const lossLimit = storedLimit ?? limitSuggestion;

  const goalContext = useMemo(
    () => ({
      netPnl: allTimeMetrics.netPnl,
      equity: balances.totalUSD,
      maxDrawdownPct: allTimeMetrics.maxDrawdownPct,
      cleanStreakDays: cleanSessionStreak(allDays),
    }),
    [allTimeMetrics, balances.totalUSD, allDays]
  );

  const periodLabel = PERIOD_LABELS[period] ?? "This month";
  const rangeLabel = range.start
    ? `${formatDate(range.start, "short")} – ${formatDate(range.end, "short")}`
    : allClosed.length
      ? `${formatDate(allClosed[0].dateKey, "short")} – ${formatDate(allClosed[allClosed.length - 1].dateKey, "short")}`
      : "No trades yet";
  const comparisonLabel = prevRange.start
    ? `${formatDate(prevRange.start, "short")} – ${formatDate(prevRange.end, "short")}`
    : "the preceding period";

  const noTrades = !loading && !error && trades.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Performance, market context, and the highest-value thing to fix next."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              iconOnly
              aria-label="Refresh"
              aria-busy={loading}
              onClick={reload}
              className={loading ? "pointer-events-none opacity-60" : undefined}
            />
            <Button as={Link} href="/analytics" variant="secondary" size="sm" icon={BarChart3}>
              Analytics
            </Button>
          </>
        }
        toolbar={
          <Toolbar>
            <PeriodSelector value={period} onChange={setPeriod} />
            <ToolbarDivider />
            <span className="hidden max-w-[11rem] truncate font-mono text-2xs tnum text-content-subtle md:inline">
              {rangeLabel}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Badge tone="outline" size="sm">
                {pluralize(metrics.totalTrades, "closed trade")}
              </Badge>
              {metrics.openTrades > 0 && (
                <Badge tone="info" size="sm" dot>
                  {pluralize(metrics.openTrades, "open")}
                </Badge>
              )}
            </div>
          </Toolbar>
        }
      />

      <PageBody className="space-y-4">
        {error && (
          <ErrorState
            title="Could not load your trades"
            description={error}
            onRetry={reload}
          />
        )}

        {noTrades ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={Rocket}
                title="Your dashboard is ready and waiting"
                description="Log your first trade to unlock the equity curve, the daily P&L calendar, streaks, expectancy and automatic insights about what is working."
                action={
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button as={Link} href="/trades" variant="primary" size="sm">
                      Log your first trade
                    </Button>
                    <Button as={Link} href="/onboarding" variant="secondary" size="sm">
                      Set up your journal
                    </Button>
                  </div>
                }
              />
            </CardBody>
          </Card>
        ) : (
          <>
            <HeroMetrics
              metrics={metrics}
              previousMetrics={previousMetrics}
              deltas={deltas}
              periodLabel={periodLabel}
              comparisonLabel={comparisonLabel}
              loading={loading}
            />

            <section className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <EquityCurveCard metrics={metrics} loading={loading} periodLabel={periodLabel} />
              </div>
              <TodayPanel
                now={now}
                todayPnl={today?.pnl ?? 0}
                todayCount={today?.count ?? 0}
                sessionEdge={sessionEdge}
                limit={lossLimit}
                onChangeLimit={setStoredLimit}
                limitSuggestion={limitSuggestion}
                upcomingEvents={upcomingEvents}
                eventsLoading={calendar.loading}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <PnlCalendarCard days={allDays} loading={loading} />
              </div>
              <InsightsCard insights={insights} loading={loading} tradeCount={metrics.totalTrades} />
            </section>
          </>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <EconomicCalendarCard calendar={calendar} week={week} onWeekChange={setWeek} now={now} />
          {noTrades ? (
            <NotesCard
              value={scratchpad.value}
              onChange={scratchpad.change}
              onBlur={scratchpad.flush}
              status={scratchpad.status}
              savedAt={scratchpad.savedAt}
            />
          ) : (
            <RecentTradesCard trades={recentTrades} loading={loading} />
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <BalancesCard balances={balances} />
          <GoalsCard
            goals={goals.goals}
            loading={goals.loading}
            context={goalContext}
            onAdd={goals.add}
            onUpdate={goals.update}
            onDelete={goals.remove}
          />
          {!noTrades && (
            <NotesCard
              value={scratchpad.value}
              onChange={scratchpad.change}
              onBlur={scratchpad.flush}
              status={scratchpad.status}
              savedAt={scratchpad.savedAt}
            />
          )}
        </section>
      </PageBody>
    </>
  );
}

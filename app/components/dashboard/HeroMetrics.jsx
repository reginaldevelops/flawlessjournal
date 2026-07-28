"use client";

import { useMemo } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Gauge,
  Minus,
  Percent,
  Scale,
  Snowflake,
  TrendingDown,
} from "lucide-react";
import {
  AnimatedNumber,
  Skeleton,
  Sparkline,
  StatCard,
  Tooltip,
  cn,
} from "../ui";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio,
  pluralize,
} from "../../lib/format";

/** Daily cumulative P&L for the period — smoother than a per-trade sparkline. */
function dailySeries(metrics) {
  const days = Object.values(metrics.days ?? {}).sort((a, b) => a.date.localeCompare(b.date));
  let acc = 0;
  return days.map((day) => {
    acc += day.pnl;
    return { date: day.date, value: acc };
  });
}

function DeltaChip({ value, suffix = "%", invert = false, title }) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutralish-soft px-2 py-0.5 text-2xs font-medium text-content-subtle">
        <Minus size={10} />
        no comparison
      </span>
    );
  }
  const positive = value > 0;
  const good = invert ? !positive : positive;
  const Icon = positive ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-2xs font-semibold tnum",
        value === 0
          ? "bg-neutralish-soft text-content-subtle"
          : good
            ? "bg-profit-soft text-profit-fg"
            : "bg-loss-soft text-loss-fg"
      )}
      title={title}
    >
      <Icon size={10} />
      {Math.abs(value) >= 1000
        ? `${Math.round(Math.abs(value)).toLocaleString("en-US")}${suffix}`
        : `${Math.abs(value).toFixed(1)}${suffix}`}
    </span>
  );
}

function OutcomeMeter({ metrics }) {
  const total = metrics.totalTrades;
  if (!total) return null;
  const pct = (n) => (n / total) * 100;

  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <span className="bg-profit" style={{ width: `${pct(metrics.wins)}%` }} />
        <span className="bg-neutralish/60" style={{ width: `${pct(metrics.scratches)}%` }} />
        <span className="bg-loss" style={{ width: `${pct(metrics.losses)}%` }} />
      </div>
      <div className="mt-2 flex items-center gap-3 text-2xs text-content-subtle">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-profit" />
          <span className="font-mono tnum text-content-muted">{metrics.wins}</span> won
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-loss" />
          <span className="font-mono tnum text-content-muted">{metrics.losses}</span> lost
        </span>
        {metrics.scratches > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-neutralish/60" />
            <span className="font-mono tnum text-content-muted">{metrics.scratches}</span> flat
          </span>
        )}
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-4 h-10 w-48" />
      <Skeleton className="mt-4 h-1.5 w-full" />
      <Skeleton className="mt-5 h-14 w-full" />
    </div>
  );
}

export default function HeroMetrics({
  metrics,
  previousMetrics,
  deltas,
  periodLabel,
  comparisonLabel,
  loading,
}) {
  const series = useMemo(() => (metrics ? dailySeries(metrics) : []), [metrics]);

  if (loading || !metrics) {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <HeroSkeleton />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCard key={i} label="—" value="" loading />
          ))}
        </div>
      </section>
    );
  }

  const net = metrics.netPnl;
  const netTone = net > 0 ? "profit" : net < 0 ? "loss" : "neutral";
  const streakTone =
    metrics.currentStreakType === "win" ? "profit" : metrics.currentStreakType === "loss" ? "loss" : "neutral";

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-sm">
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-px",
            netTone === "profit" ? "bg-profit/60" : netTone === "loss" ? "bg-loss/60" : "bg-line-strong"
          )}
          aria-hidden
        />
        <div
          className={cn(
            "pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl",
            netTone === "profit" ? "bg-profit/10" : netTone === "loss" ? "bg-loss/10" : "bg-brand/10"
          )}
          aria-hidden
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-content-subtle">
            Net P&amp;L · {periodLabel}
          </p>
          <Tooltip content={`Compared with ${comparisonLabel}`}>
            <span>
              <DeltaChip value={deltas?.netPnl} />
            </span>
          </Tooltip>
        </div>

        <p className={cn("mt-2.5 stat-number text-stat-lg", netTone === "profit" ? "text-profit" : netTone === "loss" ? "text-loss" : "text-content")}>
          <AnimatedNumber
            value={net}
            format={(v) => formatCurrency(v, { decimals: 0, signed: true })}
          />
        </p>

        <p className="mt-1 text-2xs text-content-subtle">
          {metrics.totalTrades
            ? `${pluralize(metrics.totalTrades, "closed trade")} across ${pluralize(metrics.tradingDays, "session")}`
            : "No closed trades in this period"}
          {previousMetrics
            ? ` · ${formatCurrency(previousMetrics.netPnl, { decimals: 0, signed: true })} previously`
            : ""}
        </p>

        <div className="mt-4">
          <OutcomeMeter metrics={metrics} />
        </div>

        <div className="mt-auto -mx-1 pt-4">
          {series.length > 1 ? (
            <Sparkline data={series} height={56} tone={netTone === "neutral" ? "brand" : netTone} />
          ) : (
            <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-line text-2xs text-content-subtle">
              Not enough sessions to plot a trend
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Win rate"
          icon={Percent}
          value={formatPercent(metrics.winRate, { decimals: 1 })}
          sublabel={`${metrics.wins}W / ${metrics.losses}L`}
          delta={deltas?.winRate}
          deltaSuffix="pp"
          tone={metrics.winRate >= 50 ? "profit" : "neutral"}
          hint="Share of closed trades that finished green."
        />
        <StatCard
          label="Profit factor"
          icon={Gauge}
          value={formatRatio(metrics.profitFactor)}
          sublabel={`${formatCurrency(metrics.grossProfit, { decimals: 0, compact: true })} / ${formatCurrency(
            metrics.grossLoss,
            { decimals: 0, compact: true }
          )}`}
          delta={deltas?.profitFactor}
          tone={metrics.profitFactor >= 1.5 ? "profit" : metrics.profitFactor >= 1 ? "warn" : "loss"}
          hint="Gross profit divided by gross loss. Above 1.5 is a healthy edge."
        />
        <StatCard
          label="Expectancy"
          icon={Scale}
          value={formatCurrency(metrics.expectancy, { decimals: 0, signed: true })}
          sublabel="Per trade"
          delta={deltas?.expectancy}
          tone={metrics.expectancy > 0 ? "profit" : metrics.expectancy < 0 ? "loss" : "neutral"}
          hint="Average result you can expect from the next trade at this win rate and payoff."
        />
        <StatCard
          label="Average R"
          icon={Activity}
          value={metrics.avgR == null ? "—" : formatNumber(metrics.avgR, { decimals: 2, signed: true })}
          sublabel={
            metrics.avgR == null
              ? "No R logged"
              : `${formatNumber(metrics.totalR ?? 0, { decimals: 1, signed: true })}R total`
          }
          delta={deltas?.avgR}
          deltaSuffix="R"
          tone={(metrics.avgR ?? 0) > 0 ? "profit" : (metrics.avgR ?? 0) < 0 ? "loss" : "neutral"}
          hint="Mean risk multiple per trade — the cleanest measure of edge."
        />
        <StatCard
          label="Current streak"
          icon={metrics.currentStreakType === "loss" ? Snowflake : Flame}
          value={
            metrics.currentStreak
              ? `${metrics.currentStreak}${metrics.currentStreakType === "win" ? "W" : "L"}`
              : "—"
          }
          sublabel={`Best run ${metrics.longestWinStreak}W · worst ${metrics.longestLossStreak}L`}
          tone={streakTone}
          hint="Consecutive wins or losses at the end of this period."
        />
        <StatCard
          label="Max drawdown"
          icon={TrendingDown}
          value={formatCurrency(metrics.maxDrawdown, { decimals: 0 })}
          sublabel={
            metrics.maxDrawdownPct > 0
              ? `${formatPercent(metrics.maxDrawdownPct, { decimals: 1 })} from peak`
              : "No drawdown recorded"
          }
          tone={metrics.maxDrawdown > 0 ? "warn" : "neutral"}
          hint="Largest peak-to-trough fall in period P&L."
        />
      </div>
    </section>
  );
}

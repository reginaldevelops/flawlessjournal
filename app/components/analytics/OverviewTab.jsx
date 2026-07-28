"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Coins,
  Gauge,
  Percent,
  Scale,
  Sigma,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Sparkline, StatCard } from "../ui";
import { generateInsights } from "../../lib/trades";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatR,
  formatRatio,
} from "../../lib/format";
import { Callout } from "./shared";
import { EquityCard } from "./EquityCard";
import { DistributionCard, WinLossCard } from "./DistributionCard";
import { TrendCard } from "./TrendCard";
import { RiskPanel } from "./RiskPanel";

const INSIGHT_ICON = { profit: TrendingUp, loss: TrendingDown, warn: AlertTriangle };

export function OverviewTab({
  metrics,
  deltas = {},
  comparing,
  tradeSeries,
  daySeries,
  rSeries,
  rolling,
  hasR,
  trades,
}) {
  const insights = useMemo(
    () => generateInsights(metrics?.closed ?? [], metrics).slice(0, 3),
    [metrics]
  );

  const spark = useMemo(
    () => (daySeries.length > 1 ? daySeries.map((d) => ({ value: d.equity })) : []),
    [daySeries]
  );

  const cards = [
    {
      label: "Net P&L",
      value: formatCurrency(metrics.netPnl, { decimals: 0, signed: true }),
      tone: metrics.netPnl >= 0 ? "profit" : "loss",
      icon: Wallet,
      delta: deltas.netPnl,
      sublabel: `${formatCurrency(metrics.grossProfit, { decimals: 0 })} gross profit · ${formatCurrency(metrics.grossLoss, { decimals: 0 })} gross loss`,
      hint: "Sum of every closed trade in the current filter, after nothing else. This is the only number the market pays you.",
      sparkline: spark.length ? (
        <Sparkline data={spark} tone={metrics.netPnl >= 0 ? "profit" : "loss"} height={36} />
      ) : null,
    },
    {
      label: "Win rate",
      value: formatPercent(metrics.winRate, { decimals: 1 }),
      tone: "neutral",
      icon: Percent,
      delta: deltas.winRate,
      deltaSuffix: "pp",
      sublabel: `${metrics.wins}W / ${metrics.losses}L${metrics.scratches ? ` / ${metrics.scratches} scratch` : ""}`,
      hint: "Share of closed trades that made money. On its own it says nothing — pair it with the payoff ratio below.",
    },
    {
      label: "Profit factor",
      value: formatRatio(metrics.profitFactor),
      tone: metrics.profitFactor >= 1.5 ? "profit" : metrics.profitFactor >= 1 ? "warn" : "loss",
      icon: Scale,
      delta: deltas.profitFactor,
      sublabel: "Gross profit ÷ gross loss",
      hint: "How many dollars you make per dollar lost. Below 1 you are losing; 1.3–1.5 is a working edge; above 2 is rare over a large sample.",
    },
    {
      label: "Expectancy",
      value: formatCurrency(metrics.expectancy, { decimals: 0, signed: true }),
      tone: metrics.expectancy >= 0 ? "profit" : "loss",
      icon: Sigma,
      delta: deltas.expectancy,
      sublabel: `per trade · ${formatCurrency(metrics.avgDailyPnl, { decimals: 0, signed: true })} per session`,
      hint: "The average value of taking one more trade. Multiply by expected volume to plan a month.",
    },
    {
      label: "Payoff ratio",
      value: formatRatio(metrics.payoffRatio),
      tone: metrics.payoffRatio >= 1.3 ? "profit" : metrics.payoffRatio >= 1 ? "warn" : "loss",
      icon: Gauge,
      delta: deltas.payoffRatio,
      sublabel: `${formatCurrency(metrics.avgWin, { decimals: 0 })} avg win vs ${formatCurrency(metrics.avgLoss, { decimals: 0 })} avg loss`,
      hint: "Average win divided by average loss. Required payoff to break even = (100 − win rate) ÷ win rate.",
    },
    {
      label: "Max drawdown",
      value: formatCurrency(metrics.maxDrawdown, { decimals: 0 }),
      tone: "loss",
      icon: TrendingDown,
      delta: deltas.maxDrawdown,
      invertDelta: true,
      sublabel: `${formatPercent(metrics.maxDrawdownPct, { decimals: 1 })} of peak · recovery factor ${formatRatio(metrics.recoveryFactor)}`,
      hint: "Deepest peak-to-trough fall. Size your risk so twice this figure would not end your account or your confidence.",
    },
    {
      label: "Total R",
      value: metrics.totalR === null ? "—" : formatR(metrics.totalR),
      tone: (metrics.totalR ?? 0) >= 0 ? "profit" : "loss",
      icon: Coins,
      delta: deltas.avgR,
      sublabel:
        metrics.avgR === null
          ? "No R-multiples recorded"
          : `${formatR(metrics.avgR)} average across ${metrics.rTradeCount} trades`,
      hint: "Total risk units earned. Because it is size-independent it is the fairest way to compare periods where your account grew.",
    },
    {
      label: "Trades",
      value: formatNumber(metrics.totalTrades, { decimals: 0 }),
      tone: "neutral",
      icon: Sigma,
      delta: deltas.totalTrades,
      sublabel: `${formatNumber(metrics.avgTradesPerDay, { decimals: 1 })} per session across ${metrics.tradingDays} sessions`,
      hint: "Closed trades in the current filter. Open trades are excluded from every performance metric.",
    },
  ];

  return (
    <div className="space-y-4">
      {insights.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {insights.map((insight) => (
            <Callout
              key={insight.id}
              tone={insight.tone}
              icon={INSIGHT_ICON[insight.tone] ?? TrendingUp}
              eyebrow={insight.tone === "profit" ? "What is working" : "Priority leak"}
              title={insight.title}
              description={insight.detail}
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            {...card}
            delta={comparing ? card.delta : undefined}
            deltaLabel={comparing ? undefined : card.deltaLabel}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <EquityCard
            tradeSeries={tradeSeries}
            daySeries={daySeries}
            maxDrawdown={metrics.maxDrawdown}
          />
        </div>
        <WinLossCard metrics={metrics} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DistributionCard trades={metrics.closed} hasR={hasR} />
        </div>
        <TrendCard rSeries={rSeries} rolling={rolling} hasR={hasR} />
      </div>

      <RiskPanel metrics={metrics} />
    </div>
  );
}

export default OverviewTab;

"use client";

import { Card, CardBody, CardHeader, StatRow } from "../ui";
import { ShieldAlert } from "lucide-react";
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
  formatR,
  formatRatio,
} from "../../lib/format";

/**
 * The metrics that decide whether an edge survives. Every row carries a
 * one-sentence explanation — knowing what SQN means is half the value.
 */
export function RiskPanel({ metrics }) {
  if (!metrics) return null;

  const streakLabel =
    metrics.currentStreak > 0
      ? `${metrics.currentStreak} ${metrics.currentStreakType === "win" ? "wins" : "losses"}`
      : "Flat";

  const groups = [
    {
      title: "Drawdown & recovery",
      rows: [
        {
          label: "Max drawdown",
          value: formatCurrency(metrics.maxDrawdown, { decimals: 0 }),
          tone: metrics.maxDrawdown > 0 ? "loss" : "neutral",
          hint: "Largest peak-to-trough fall in your equity curve. This is the loss you must be able to sit through without changing your process.",
        },
        {
          label: "Max drawdown %",
          value: formatPercent(metrics.maxDrawdownPct, { decimals: 1 }),
          tone: metrics.maxDrawdownPct > 25 ? "loss" : "neutral",
          hint: "The same drawdown expressed against the equity peak it started from.",
        },
        {
          label: "Max run-up",
          value: formatCurrency(metrics.maxRunup, { decimals: 0 }),
          tone: "profit",
          hint: "Largest trough-to-peak gain. Compare it with the drawdown: a healthy curve runs up further than it falls.",
        },
        {
          label: "Recovery factor",
          value: formatRatio(metrics.recoveryFactor),
          tone: metrics.recoveryFactor >= 2 ? "profit" : metrics.recoveryFactor < 1 ? "loss" : "neutral",
          hint: "Net profit divided by max drawdown. Above 2 means you earn back your worst stretch twice over; below 1 means the drawdown owns you.",
        },
        {
          label: "Ulcer index",
          value: formatNumber(metrics.ulcerIndex, { decimals: 2 }),
          tone: metrics.ulcerIndex > 15 ? "loss" : "neutral",
          hint: "Depth and duration of drawdowns combined — a stress score. Lower is calmer; two curves with the same return can differ wildly here.",
        },
      ],
    },
    {
      title: "Quality of edge",
      rows: [
        {
          label: "Expectancy / trade",
          value: formatCurrency(metrics.expectancy, { decimals: 0, signed: true }),
          tone: metrics.expectancy > 0 ? "profit" : "loss",
          hint: "What the average trade is worth: (win rate × average win) − (loss rate × average loss). Multiply by your trade count to forecast the period.",
        },
        {
          label: "SQN",
          value: formatNumber(metrics.sqn, { decimals: 2 }),
          tone: metrics.sqn >= 2 ? "profit" : metrics.sqn < 1 ? "loss" : "warn",
          hint: "System Quality Number: expectancy divided by its own volatility, scaled by sample size. Under 1.6 is weak, 2–3 is good, above 3 is excellent.",
        },
        {
          label: "Sharpe (per trade)",
          value: formatNumber(metrics.sharpe, { decimals: 2 }),
          tone: metrics.sharpe > 1 ? "profit" : "neutral",
          hint: "Return per unit of total volatility. Useful for comparing two strategies, not as an absolute score.",
        },
        {
          label: "Sortino",
          value: formatNumber(metrics.sortino, { decimals: 2 }),
          tone: metrics.sortino > 1 ? "profit" : "neutral",
          hint: "Like Sharpe but only punishes downside volatility, which is the only volatility a trader actually cares about.",
        },
        {
          label: "Standard deviation",
          value: formatCurrency(metrics.stdDev, { decimals: 0 }),
          hint: "Typical distance of a single trade from your average trade. Big numbers mean your results are lumpy and need a larger sample to trust.",
        },
        {
          label: "Kelly fraction",
          value: formatPercent(metrics.kelly, { decimals: 1 }),
          tone: metrics.kelly > 0 ? "profit" : "loss",
          hint: "The theoretically growth-optimal risk per trade given your win rate and payoff. Most traders use a quarter of it; a negative value means no size is correct.",
        },
      ],
    },
    {
      title: "Streaks & rhythm",
      rows: [
        {
          label: "Current streak",
          value: streakLabel,
          tone: metrics.currentStreakType === "win" ? "profit" : metrics.currentStreak ? "loss" : "neutral",
          hint: "Your live run of consecutive wins or losses.",
        },
        {
          label: "Longest win streak",
          value: formatNumber(metrics.longestWinStreak, { decimals: 0 }),
          tone: "profit",
          hint: "Best consecutive run in this period.",
        },
        {
          label: "Longest loss streak",
          value: formatNumber(metrics.longestLossStreak, { decimals: 0 }),
          tone: "loss",
          hint: "Worst consecutive run. Plan your risk so this streak twice over is survivable.",
        },
        {
          label: "Payoff ratio",
          value: formatRatio(metrics.payoffRatio),
          tone: metrics.payoffRatio >= 1 ? "profit" : "warn",
          hint: "Average win divided by average loss. With a 45% win rate you need roughly 1.25 to break even.",
        },
        {
          label: "Average R",
          value: metrics.avgR === null ? "—" : formatR(metrics.avgR),
          tone: (metrics.avgR ?? 0) > 0 ? "profit" : "loss",
          hint: "Mean outcome measured in units of risk. It is the only performance number that stays comparable when your position size changes.",
        },
        {
          label: "Average hold time",
          value: metrics.avgDurationMin === null ? "—" : formatDuration(metrics.avgDurationMin),
          hint: "Mean time in trade. Compare winners and losers: holding losers longer than winners is the classic disposition effect.",
        },
      ],
    },
  ];

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader
        title="Risk & consistency"
        subtitle="Hover any metric for a plain-English explanation"
        icon={ShieldAlert}
      />
      <CardBody className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              {group.title}
            </p>
            {group.rows.map((row) => (
              <StatRow
                key={row.label}
                label={row.label}
                value={row.value}
                tone={row.tone}
                hint={row.hint}
              />
            ))}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export default RiskPanel;

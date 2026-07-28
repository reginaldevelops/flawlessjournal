"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { ChartTooltip, Segmented, axisProps, gridProps, useChartColors } from "../ui";
import { distribution } from "../../lib/trades";
import { formatCurrency, formatNumber, pluralize } from "../../lib/format";
import { ChartCard, moneyTick } from "./shared";

/** Outcome histogram — the shape of the edge, not just its average. */
export function DistributionCard({ trades = [], hasR = false }) {
  const colors = useChartColors();
  const [key, setKey] = useState("pnl");

  const usingR = key === "rMultiple" && hasR;
  const bins = useMemo(
    () => distribution(trades, { bins: 17, key: usingR ? "rMultiple" : "pnl" }),
    [trades, usingR]
  );

  const label = (b) =>
    usingR
      ? `${b.from.toFixed(2)}R → ${b.to.toFixed(2)}R`
      : `${formatCurrency(b.from, { decimals: 0 })} → ${formatCurrency(b.to, { decimals: 0 })}`;

  return (
    <ChartCard
      title="Outcome distribution"
      subtitle="How your results cluster — fat left tails are the leak to fix"
      icon={BarChart3}
      height={240}
      actions={
        hasR ? (
          <Segmented
            size="sm"
            value={key}
            onChange={setKey}
            options={[
              { value: "pnl", label: "P&L" },
              { value: "rMultiple", label: "R" },
            ]}
          />
        ) : null
      }
      empty={bins.length < 2 ? "Not enough closed trades to build a histogram" : null}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis
            dataKey="mid"
            {...axisProps(colors)}
            minTickGap={14}
            tickFormatter={(v) => (usingR ? `${Number(v).toFixed(1)}R` : moneyTick(v))}
          />
          <YAxis {...axisProps(colors)} width={30} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgb(var(--content) / 0.05)" }}
            content={
              <ChartTooltip
                labelFormatter={(_, payload) => (payload?.[0] ? label(payload[0].payload) : "")}
                nameFormatter={() => "Trades"}
                valueFormatter={(v) => formatNumber(v, { decimals: 0 })}
              />
            }
          />
          <Bar dataKey="count" name="Trades" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {bins.map((b) => (
              <Cell key={`${b.from}`} fill={b.isPositive ? colors.profit : colors.loss} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Wins vs losses at a glance, with the payoff asymmetry made physical. */
export function WinLossCard({ metrics }) {
  const { wins = 0, losses = 0, scratches = 0, avgWin = 0, avgLoss = 0, totalTrades = 0 } = metrics ?? {};
  const max = Math.max(avgWin, avgLoss, 1);
  const total = Math.max(1, wins + losses + scratches);

  const segments = [
    { id: "wins", label: "Wins", value: wins, className: "bg-profit" },
    { id: "losses", label: "Losses", value: losses, className: "bg-loss" },
    { id: "scratches", label: "Scratch", value: scratches, className: "bg-neutralish" },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm print:break-inside-avoid">
      <div>
        <p className="text-sm font-semibold tracking-tight text-content">Win / loss profile</p>
        <p className="mt-0.5 text-xs text-content-subtle">
          {pluralize(totalTrades, "closed trade")} in view
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Donut wins={wins} losses={losses} scratches={scratches} />
        <div className="min-w-0 flex-1 space-y-1.5">
          {segments.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.className}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-content-muted">{s.label}</span>
              <span className="font-mono tnum text-content">{s.value}</span>
              <span className="w-10 text-right font-mono tnum text-content-subtle">
                {((s.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 border-t border-line-subtle pt-3">
        <PayoffBar label="Average win" value={avgWin} max={max} tone="profit" />
        <PayoffBar label="Average loss" value={-avgLoss} max={max} tone="loss" />
      </div>
    </div>
  );
}

function PayoffBar({ label, value, max, tone }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-content-muted">{label}</span>
        <span className={`font-mono text-xs font-semibold tnum ${tone === "profit" ? "text-profit" : "text-loss"}`}>
          {formatCurrency(value, { decimals: 0, signed: true })}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={`h-full rounded-full ${tone === "profit" ? "bg-profit" : "bg-loss"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Donut({ wins, losses, scratches }) {
  const total = wins + losses + scratches;
  const size = 104;
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const winRate = total ? (wins / total) * 100 : 0;

  let offset = 0;
  const arcs = [
    { value: wins, color: "rgb(var(--profit))" },
    { value: losses, color: "rgb(var(--loss))" },
    { value: scratches, color: "rgb(var(--neutralish))" },
  ].filter((a) => a.value > 0);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--surface-sunken))"
          strokeWidth={stroke}
        />
        {arcs.map((a, i) => {
          const length = total ? (a.value / total) * circumference : 0;
          const dash = `${length} ${circumference - length}`;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += length;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="stat-number text-lg text-content">{winRate.toFixed(1)}%</span>
        <span className="text-2xs text-content-subtle">win rate</span>
      </div>
    </div>
  );
}

export default DistributionCard;

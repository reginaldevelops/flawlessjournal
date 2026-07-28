"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ChartTooltip,
  EmptyState,
  Segmented,
  Skeleton,
  axisProps,
  gridProps,
  useChartColors,
} from "../ui";
import { compactNumber, formatCurrency, formatDate, formatNumber } from "../../lib/format";

const MODES = [
  { value: "money", label: "$" },
  { value: "r", label: "R" },
];

export default function EquityCurveCard({ metrics, loading, periodLabel }) {
  const colors = useChartColors();
  const [mode, setMode] = useState("money");

  const hasR = (metrics?.rTradeCount ?? 0) > 0;
  const effectiveMode = mode === "r" && !hasR ? "money" : mode;

  const series = useMemo(() => {
    const closed = metrics?.closed ?? [];
    let acc = 0;
    let peak = 0;
    return closed.map((trade, i) => {
      const delta = effectiveMode === "r" ? (trade.rMultiple ?? 0) : (trade.pnl ?? 0);
      acc += delta;
      peak = Math.max(peak, acc);
      return {
        index: i + 1,
        date: trade.dateKey,
        value: acc,
        drawdown: -(peak - acc),
        delta,
      };
    });
  }, [metrics, effectiveMode]);

  const isMoney = effectiveMode === "money";
  const formatValue = (value) =>
    isMoney ? formatCurrency(value, { decimals: 0, signed: true }) : `${formatNumber(value, { decimals: 2, signed: true })}R`;
  const formatAxis = (value) =>
    isMoney
      ? `${value < 0 ? "-" : ""}$${compactNumber(Math.abs(value))}`
      : `${formatNumber(value, { decimals: 0 })}R`;

  const last = series.length ? series[series.length - 1] : null;
  const worstDrawdown = series.length ? Math.min(...series.map((p) => p.drawdown)) : 0;

  const tooltip = (
    <RechartsTooltip
      cursor={{ stroke: colors["line-strong"], strokeWidth: 1, strokeDasharray: "4 4" }}
      content={
        <ChartTooltip
          labelFormatter={(label, payload) => {
            const point = payload?.[0]?.payload;
            return point?.date ? `${formatDate(point.date, "medium")} · trade #${point.index}` : `Trade #${label}`;
          }}
          nameFormatter={(entry) => (entry.dataKey === "drawdown" ? "Drawdown" : "Cumulative")}
          valueFormatter={(value) => formatValue(value)}
        />
      }
    />
  );

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={LineChart}
        title="Equity curve"
        subtitle={
          last
            ? `${periodLabel} · ${formatValue(last.value)} cumulative · ${formatValue(worstDrawdown)} deepest drawdown`
            : periodLabel
        }
        actions={
          hasR ? (
            <Segmented options={MODES} value={effectiveMode} onChange={setMode} size="sm" />
          ) : null
        }
      />

      <CardBody className="flex flex-1 flex-col p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[13.5rem] w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : series.length < 2 ? (
          <EmptyState
            icon={TrendingUp}
            title="Not enough trades to plot a curve"
            description="Log at least two closed trades in this period and the equity curve, drawdown and streaks appear here automatically."
            compact
            action={
              <Button as={Link} href="/trades" variant="secondary" size="sm" className="mt-4">
                Go to trades
              </Button>
            }
          />
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} syncId="equity" margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.brand} stopOpacity={0.35} />
                      <stop offset="55%" stopColor={colors.brand} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps(colors)} />
                  <XAxis
                    {...axisProps(colors)}
                    dataKey="index"
                    minTickGap={44}
                    tickMargin={8}
                    tickFormatter={(value) => {
                      const point = series[value - 1];
                      return point?.date ? formatDate(point.date, "short") : "";
                    }}
                  />
                  <YAxis
                    {...axisProps(colors)}
                    width={54}
                    tickFormatter={formatAxis}
                    tickMargin={4}
                  />
                  <ReferenceLine y={0} stroke={colors["line-strong"]} strokeWidth={1} />
                  {tooltip}
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Cumulative"
                    stroke={colors.brand}
                    strokeWidth={2}
                    fill="url(#equity-fill)"
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 2, stroke: colors.surface, fill: colors.brand }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 border-t border-line-subtle pt-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-2xs font-medium uppercase tracking-wider text-content-subtle">Underwater</p>
                <p className="font-mono text-2xs tnum text-content-subtle">
                  deepest {formatValue(worstDrawdown)}
                </p>
              </div>
              <div className="h-16 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} syncId="equity" margin={{ top: 2, right: 6, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="drawdown-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.loss} stopOpacity={0.05} />
                        <stop offset="100%" stopColor={colors.loss} stopOpacity={0.32} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="index" hide />
                    <YAxis width={54} hide domain={[worstDrawdown * 1.08 || -1, 0]} />
                    {tooltip}
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      name="Drawdown"
                      stroke={colors.loss}
                      strokeWidth={1.4}
                      fill="url(#drawdown-fill)"
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 2, stroke: colors.surface, fill: colors.loss }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

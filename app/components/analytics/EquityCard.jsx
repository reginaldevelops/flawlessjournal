"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { ChartTooltip, Segmented, axisProps, gridProps, useChartColors } from "../ui";
import { formatCurrency, formatDate } from "../../lib/format";
import { ChartCard, moneyTick } from "./shared";

/**
 * Equity curve with the drawdown painted underneath on its own scale, so a
 * recovering account and a bleeding one are distinguishable at a glance.
 */
export function EquityCard({ tradeSeries = [], daySeries = [], maxDrawdown = 0 }) {
  const colors = useChartColors();
  const [mode, setMode] = useState("day");

  const data = mode === "day" ? daySeries : tradeSeries;
  const ddFloor = useMemo(() => {
    const min = Math.min(0, ...data.map((d) => d.drawdown ?? 0));
    return min === 0 ? -1 : min * 3.4;
  }, [data]);

  const tickLabel = (value) => {
    if (mode === "day") return formatDate(value, "short");
    return `#${value}`;
  };

  return (
    <ChartCard
      title="Equity curve"
      subtitle={
        maxDrawdown > 0
          ? `Peak-to-trough drawdown of ${formatCurrency(maxDrawdown, { decimals: 0 })} shaded below the curve`
          : "Cumulative net P&L over the selected period"
      }
      icon={TrendingUp}
      height={300}
      actions={
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "day", label: "By session" },
            { value: "trade", label: "By trade" },
          ]}
        />
      }
      empty={data.length < 2 ? "Not enough closed trades to plot a curve yet" : null}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.brand} stopOpacity={0.34} />
              <stop offset="100%" stopColor={colors.brand} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.loss} stopOpacity={0.05} />
              <stop offset="100%" stopColor={colors.loss} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis
            dataKey={mode === "day" ? "date" : "index"}
            {...axisProps(colors)}
            minTickGap={28}
            tickFormatter={tickLabel}
          />
          <YAxis
            yAxisId="eq"
            {...axisProps(colors)}
            width={54}
            tickFormatter={moneyTick}
          />
          <YAxis yAxisId="dd" hide domain={[ddFloor, 0]} />
          <ReferenceLine yAxisId="eq" y={0} stroke={colors["line-strong"]} strokeDasharray="4 4" />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(label) =>
                  mode === "day" ? formatDate(label, "medium") : `Trade #${label}`
                }
                valueFormatter={(v) => formatCurrency(v, { decimals: 0, signed: true })}
              />
            }
          />
          <Area
            yAxisId="dd"
            type="monotone"
            dataKey="drawdown"
            name="Drawdown"
            stroke="none"
            fill="url(#dd-fill)"
            isAnimationActive={false}
          />
          <Area
            yAxisId="eq"
            type="monotone"
            dataKey="equity"
            name="Equity"
            stroke={colors.brand}
            strokeWidth={2}
            fill="url(#eq-fill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: colors.brand }}
          />
          <Line
            yAxisId="eq"
            type="stepAfter"
            dataKey="peak"
            name="Peak"
            stroke={colors["content-subtle"]}
            strokeWidth={1}
            strokeDasharray="3 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default EquityCard;

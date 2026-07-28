"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { ChartTooltip, Segmented, axisProps, gridProps, useChartColors } from "../ui";
import { formatDate, formatNumber, formatPercent, formatR } from "../../lib/format";
import { ChartCard, percentTick, rTick } from "./shared";

const MODES = {
  r: {
    label: "Cumulative R",
    dataKey: "r",
    tick: rTick,
    format: (v) => formatR(v),
    subtitle: "Profit measured in units of risk — immune to changes in position size",
    reference: 0,
  },
  winRate: {
    label: "Rolling win rate",
    dataKey: "winRate",
    tick: percentTick,
    format: (v) => formatPercent(v, { decimals: 1 }),
    subtitle: "30-trade rolling win rate — is the edge still there, or did it fade?",
  },
  profitFactor: {
    label: "Rolling profit factor",
    dataKey: "profitFactor",
    tick: (v) => formatNumber(v, { decimals: 1 }),
    format: (v) => (v >= 5 ? "5.00+" : formatNumber(v, { decimals: 2 })),
    subtitle: "30-trade rolling profit factor, capped at 5 so outliers stay readable",
    reference: 1,
  },
};

/** Cumulative R plus the two rolling series that reveal regime changes. */
export function TrendCard({ rSeries = [], rolling = [], hasR = false }) {
  const colors = useChartColors();
  const [mode, setMode] = useState(hasR ? "r" : "winRate");

  const config = MODES[mode] ?? MODES.winRate;
  const data = mode === "r" ? rSeries : rolling;

  const options = useMemo(
    () =>
      [
        hasR ? { value: "r", label: "R" } : null,
        { value: "winRate", label: "Win %" },
        { value: "profitFactor", label: "PF" },
      ].filter(Boolean),
    [hasR]
  );

  const average = useMemo(() => {
    if (mode === "r" || !data.length) return null;
    return data.reduce((a, d) => a + (d[config.dataKey] ?? 0), 0) / data.length;
  }, [data, mode, config.dataKey]);

  return (
    <ChartCard
      title={config.label}
      subtitle={config.subtitle}
      icon={Activity}
      height={240}
      actions={<Segmented size="sm" value={mode} onChange={setMode} options={options} />}
      empty={
        data.length < 2
          ? mode === "r"
            ? "No R-multiples recorded in this period"
            : "Needs at least 30 closed trades for a rolling window"
          : null
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors["brand-accent"]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors["brand-accent"]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis
            dataKey="index"
            {...axisProps(colors)}
            minTickGap={30}
            tickFormatter={(v) => `#${v}`}
          />
          <YAxis {...axisProps(colors)} width={44} tickFormatter={config.tick} />
          {config.reference != null && (
            <ReferenceLine y={config.reference} stroke={colors["line-strong"]} strokeDasharray="4 4" />
          )}
          {average != null && (
            <ReferenceLine
              y={average}
              stroke={colors.warn}
              strokeDasharray="3 3"
              label={{
                value: `avg ${config.format(average)}`,
                position: "insideTopRight",
                fill: colors.warn,
                fontSize: 10,
              }}
            />
          )}
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(label, payload) => {
                  const date = payload?.[0]?.payload?.date;
                  return date ? `Trade #${label} · ${formatDate(date, "short")}` : `Trade #${label}`;
                }}
                valueFormatter={(v) => config.format(v)}
              />
            }
          />
          <Area
            type="monotone"
            dataKey={config.dataKey}
            name={config.label}
            stroke={colors["brand-accent"]}
            strokeWidth={2}
            fill="url(#trend-fill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default TrendCard;

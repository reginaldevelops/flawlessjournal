"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, axisProps, gridProps, useChartColors } from "../ui/charts";
import { formatCurrency } from "../../lib/format";

function formatAxisUsd(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(abs >= 10e9 ? 0 : 1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 10e6 ? 0 : 1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatTick(ts, range) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  if (range === "365d") {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Daily USD bar chart for chain volume / fees / TVL history.
 */
export default function ChainHistoryChart({
  points = [],
  range = "30d",
  height = 280,
  colorToken = "brand",
}) {
  const colors = useChartColors();
  const data = useMemo(
    () =>
      (points || []).map((p) => ({
        t: p.t,
        v: p.v,
        label: new Date(p.t * 1000).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })),
    [points]
  );

  const fill = colors[colorToken] || colors.brand;

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-xs text-content-subtle"
        style={{ height }}
      >
        No history for this window.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => formatTick(v, range)}
            minTickGap={range === "365d" ? 40 : 28}
            {...axisProps(colors)}
          />
          <YAxis
            width={52}
            tickFormatter={formatAxisUsd}
            {...axisProps(colors)}
          />
          <Tooltip
            cursor={{ fill: colors.alpha?.("brand", 0.08) || "rgba(124,108,255,0.08)" }}
            content={
              <ChartTooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label}
                valueFormatter={(v) => formatCurrency(v, { compact: true })}
                nameFormatter={() => "USD"}
              />
            }
          />
          <Bar dataKey="v" name="USD" fill={fill} radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "./cn";

/**
 * Recharts needs concrete color strings, so CSS variables are resolved at
 * runtime. Re-resolves whenever the theme attribute flips.
 */
export function useChartColors() {
  const [colors, setColors] = useState(() => FALLBACK);

  useEffect(() => {
    const read = () => setColors(resolveColors());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

const TOKENS = [
  "brand",
  "brand-accent",
  "profit",
  "loss",
  "warn",
  "info",
  "content",
  "content-muted",
  "content-subtle",
  "line",
  "line-strong",
  "surface",
  "surface-raised",
  "surface-sunken",
  "canvas",
];

const FALLBACK = {
  brand: "#7c6cff",
  "brand-accent": "#4fd1ff",
  profit: "#22d38a",
  loss: "#ff5c6e",
  warn: "#fab73e",
  info: "#60a5fa",
  content: "#ecedf4",
  "content-muted": "#979ead",
  "content-subtle": "#6a7181",
  line: "#21242e",
  "line-strong": "#303441",
  surface: "#111218",
  "surface-raised": "#171920",
  "surface-sunken": "#0d0e13",
  canvas: "#090a0e",
  palette: ["#7c6cff", "#4fd1ff", "#22d38a", "#fab73e", "#ff5c6e", "#a78bfa", "#34d399", "#f472b6"],
};

function resolveColors() {
  if (typeof window === "undefined") return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const out = {};
  for (const t of TOKENS) {
    const raw = style.getPropertyValue(`--${t}`).trim();
    out[t] = raw ? `rgb(${raw})` : FALLBACK[t];
  }
  out.palette = [
    out.brand,
    out["brand-accent"],
    out.profit,
    out.warn,
    out.loss,
    "#a78bfa",
    "#34d399",
    "#f472b6",
  ];
  out.alpha = (token, a) => {
    const raw = style.getPropertyValue(`--${token}`).trim();
    return raw ? `rgba(${raw.split(" ").join(",")},${a})` : FALLBACK[token];
  };
  return out;
}

/** Shared axis props so every chart in the app lines up. */
export function axisProps(colors, extra = {}) {
  return {
    stroke: colors.line,
    tick: { fill: colors["content-subtle"], fontSize: 11 },
    tickLine: false,
    axisLine: false,
    ...extra,
  };
}

export const gridProps = (colors) => ({
  stroke: colors.line,
  strokeDasharray: "3 3",
  vertical: false,
});

/** Themed tooltip container — pass `rows` for full control. */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  nameFormatter,
  hideLabel = false,
  extra,
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="pointer-events-none min-w-[9rem] rounded-lg border border-line bg-surface-overlay px-3 py-2 shadow-lg">
      {!hideLabel && (
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={`${entry.dataKey}-${i}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-content-muted">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: entry.color ?? entry.fill }}
              />
              {nameFormatter ? nameFormatter(entry) : (entry.name ?? entry.dataKey)}
            </span>
            <span className="font-mono text-xs font-semibold tnum text-content">
              {valueFormatter ? valueFormatter(entry.value, entry) : entry.value}
            </span>
          </div>
        ))}
      </div>
      {extra && <div className="mt-1.5 border-t border-line pt-1.5">{extra}</div>}
    </div>
  );
}

/** Tiny inline trend chart for stat cards and table rows. */
export function Sparkline({
  data = [],
  dataKey = "value",
  tone,
  height = 36,
  showArea = true,
  className,
  strokeWidth = 1.6,
}) {
  const colors = useChartColors();
  if (!data.length) {
    return <div className={cn("h-full w-full", className)} />;
  }

  const first = data[0]?.[dataKey] ?? 0;
  const last = data[data.length - 1]?.[dataKey] ?? 0;
  const resolvedTone = tone ?? (last >= first ? "profit" : "loss");
  const color =
    resolvedTone === "profit"
      ? colors.profit
      : resolvedTone === "loss"
        ? colors.loss
        : resolvedTone === "brand"
          ? colors.brand
          : colors["content-muted"];
  const gradientId = `spark-${dataKey}-${resolvedTone}-${data.length}`;

  return (
    <div className={cn("h-full w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {showArea ? (
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={strokeWidth}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bar used inside tables to compare magnitudes. */
export function MiniBar({ value, max, tone = "brand", className }) {
  const pct = max ? Math.min(100, (Math.abs(value) / Math.abs(max)) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out-expo",
          tone === "profit" && "bg-profit",
          tone === "loss" && "bg-loss",
          tone === "brand" && "bg-brand",
          tone === "warn" && "bg-warn"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Diverging bar that grows left for negative and right for positive values. */
export function DivergingBar({ value, max, className, height = 6 }) {
  const pct = max ? Math.min(100, (Math.abs(value) / Math.abs(max)) * 100) : 0;
  const positive = value >= 0;
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-full bg-surface-sunken", className)}
      style={{ height }}
    >
      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden />
      <div
        className={cn(
          "absolute inset-y-0 rounded-full transition-all duration-500 ease-out-expo",
          positive ? "left-1/2 bg-profit" : "right-1/2 bg-loss"
        )}
        style={{ width: `${pct / 2}%` }}
      />
    </div>
  );
}

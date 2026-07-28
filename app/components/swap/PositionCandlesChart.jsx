"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Customized,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { cn, useChartColors } from "../ui";
import { formatCurrency } from "../../lib/format";

/**
 * Single candlestick chart for a Solana position with all fills marked.
 */
export default function PositionCandlesChart({
  mint,
  pairUrl,
  fills = [],
  symbol,
  className,
}) {
  const colors = useChartColors();
  const [state, setState] = useState({ status: "idle", data: null, error: null });

  const fillMarks = useMemo(() => {
    return (fills || [])
      .map((f) => {
        const ms = toMs(f.ts);
        if (ms == null) return null;
        const price = Number(f.priceUsd);
        return {
          id: f.id,
          side: f.side === "sell" ? "sell" : "buy",
          t: ms,
          price: Number.isFinite(price) && price > 0 ? price : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
  }, [fills]);

  const range = useMemo(() => {
    if (!fillMarks.length) return null;
    return {
      from: fillMarks[0].t,
      to: fillMarks[fillMarks.length - 1].t,
    };
  }, [fillMarks]);

  useEffect(() => {
    if (!range || (!mint && !pairUrl)) return;
    let cancelled = false;
    const ctrl = new AbortController();

    (async () => {
      setState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams({
          from: new Date(range.from).toISOString(),
          to: new Date(range.to).toISOString(),
          minCandles: "100",
        });
        if (mint) params.set("mint", mint);
        if (pairUrl) params.set("pairUrl", pairUrl);

        const res = await fetch(`/api/trade/chart?${params}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Chart failed (${res.status})`);
        if (!cancelled) setState({ status: "ready", data: json, error: null });
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setState({
          status: "error",
          data: null,
          error: err?.message || "Chart unavailable",
        });
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [mint, pairUrl, range?.from, range?.to]);

  const chartData = useMemo(() => {
    const candles = state.data?.candles ?? [];
    return candles.map((c) => ({
      t: c.t * 1000,
      o: c.o,
      h: c.h,
      l: c.l,
      c: c.c,
      v: c.v,
      up: c.c >= c.o,
      // invisible series so Tooltip / axes have a numeric y
      mid: (c.h + c.l) / 2,
    }));
  }, [state.data]);

  const yDomain = useMemo(() => {
    const prices = [];
    for (const c of chartData) prices.push(c.l, c.h);
    for (const f of fillMarks) {
      if (f.price != null) prices.push(f.price);
    }
    if (!prices.length) return ["auto", "auto"];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (!(max > min)) return [min * 0.98, max * 1.02 || 1];
    const pad = (max - min) * 0.08;
    return [min - pad, max + pad];
  }, [chartData, fillMarks]);

  const pairLink = state.data?.pairUrl || pairUrl || null;

  return (
    <div className={cn("border-b border-line", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            Price chart
            {state.data?.timeframe ? ` · ${state.data.timeframe}` : ""}
            {fillMarks.length
              ? ` · ${fillMarks.length} fill${fillMarks.length === 1 ? "" : "s"}`
              : ""}
          </p>
          <div className="mt-1 flex items-center gap-3 text-2xs text-content-subtle">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-profit" aria-hidden /> Buy
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-loss" aria-hidden /> Sell
            </span>
          </div>
        </div>
        {pairLink && (
          <a
            href={pairLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-brand hover:text-brand-hover"
          >
            DexScreener <ExternalLink size={10} aria-hidden />
          </a>
        )}
      </div>

      <div className="relative h-[22rem] w-full px-1 pb-2 sm:h-[28rem]">
        {state.status === "loading" || state.status === "idle" ? (
          <div className="absolute inset-3 animate-pulse rounded-lg bg-surface-raised" />
        ) : state.status === "error" ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-2xs text-content-subtle">
            {state.error}
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-2xs text-content-subtle">
            Not enough candle data for this position window
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 14, right: 10, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                stroke={colors.line}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatTickTime}
                tick={{ fill: colors["content-subtle"], fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={36}
              />
              <YAxis
                domain={yDomain}
                width={56}
                tickFormatter={formatAxisPrice}
                tick={{ fill: colors["content-subtle"], fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: colors["line-strong"], strokeDasharray: "3 3" }}
                content={<CandleTooltip symbol={symbol} fillMarks={fillMarks} />}
              />

              {/* Invisible series so hover/tooltip still works over candles */}
              <Line
                type="monotone"
                dataKey="mid"
                stroke="transparent"
                dot={false}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
              />

              <Customized
                component={() => (
                  <CandlesLayer
                    candles={chartData}
                    yDomain={yDomain}
                    upColor={colors.profit}
                    downColor={colors.loss}
                  />
                )}
              />

              {fillMarks.map((f) => (
                <ReferenceLine
                  key={`line-${f.id}`}
                  x={f.t}
                  stroke={f.side === "sell" ? colors.loss : colors.profit}
                  strokeDasharray="3 3"
                  strokeOpacity={0.45}
                />
              ))}

              {fillMarks
                .filter((f) => f.price != null)
                .map((f) => (
                  <ReferenceDot
                    key={`dot-${f.id}`}
                    x={f.t}
                    y={f.price}
                    isFront
                    shape={(dotProps) => (
                      <FillMarkerShape
                        {...dotProps}
                        side={f.side}
                        fill={f.side === "sell" ? colors.loss : colors.profit}
                        stroke={colors.surface}
                      />
                    )}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/** Draw OHLC candles using the plot area (Recharts 3.1 has usePlotArea, not useXAxis). */
function CandlesLayer({ candles, yDomain, upColor, downColor }) {
  const plot = usePlotArea();
  if (
    !plot ||
    !Array.isArray(candles) ||
    candles.length < 2 ||
    !Array.isArray(yDomain) ||
    !Number.isFinite(yDomain[0]) ||
    !Number.isFinite(yDomain[1]) ||
    !(yDomain[1] > yDomain[0])
  ) {
    return null;
  }

  const xMin = candles[0].t;
  const xMax = candles[candles.length - 1].t;
  const xSpan = xMax - xMin || 1;
  const yMin = yDomain[0];
  const yMax = yDomain[1];
  const ySpan = yMax - yMin || 1;

  const xScale = (t) => plot.x + ((t - xMin) / xSpan) * plot.width;
  const yScale = (p) => plot.y + ((yMax - p) / ySpan) * plot.height;

  const band =
    candles.length > 1
      ? Math.abs(xScale(candles[1].t) - xScale(candles[0].t))
      : 8;
  const bodyW = Math.max(2.5, Math.min(band * 0.65, 16));

  return (
    <g className="recharts-candles">
      {candles.map((row) => {
        const { t, o, h, l, c, up } = row;
        if (![t, o, h, l, c].every(Number.isFinite)) return null;
        const cx = xScale(t);
        const yHigh = yScale(h);
        const yLow = yScale(l);
        const yOpen = yScale(o);
        const yClose = yScale(c);
        if (![cx, yHigh, yLow, yOpen, yClose].every(Number.isFinite)) return null;
        const color = up ? upColor : downColor;
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
        return (
          <g key={t}>
            <line
              x1={cx}
              x2={cx}
              y1={yHigh}
              y2={yLow}
              stroke={color}
              strokeWidth={1.2}
            />
            <rect
              x={cx - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyH}
              fill={color}
              stroke={color}
            />
          </g>
        );
      })}
    </g>
  );
}

function FillMarkerShape({ cx, cy, side, fill, stroke }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const buy = side === "buy";
  const size = 7;
  const points = buy
    ? `${cx},${cy - size} ${cx - size},${cy + size * 0.55} ${cx + size},${cy + size * 0.55}`
    : `${cx},${cy + size} ${cx - size},${cy - size * 0.55} ${cx + size},${cy - size * 0.55}`;
  return (
    <polygon
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.25}
    />
  );
}

function CandleTooltip({ active, payload, label, symbol, fillMarks }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const nearby = (fillMarks || []).filter(
    (f) => Math.abs(f.t - row.t) <= 15 * 60 * 1000
  );

  return (
    <div className="min-w-[9.5rem] rounded-lg border border-line bg-surface-overlay px-2.5 py-1.5 shadow-lg">
      <p className="mb-1 text-2xs text-content-subtle">
        {row.t ? new Date(row.t).toLocaleString() : label ? new Date(label).toLocaleString() : ""}
        {symbol ? ` · ${symbol}` : ""}
      </p>
      <div className="space-y-0.5 font-mono text-2xs tnum text-content-muted">
        <OhclRow label="O" value={row.o} />
        <OhclRow label="H" value={row.h} />
        <OhclRow label="L" value={row.l} />
        <OhclRow label="C" value={row.c} tone={row.up ? "profit" : "loss"} />
      </div>
      {nearby.length > 0 && (
        <div className="mt-1.5 border-t border-line pt-1.5 space-y-0.5">
          {nearby.map((f) => (
            <p key={f.id} className="text-2xs text-content-muted">
              <span className={f.side === "sell" ? "text-loss-fg" : "text-profit-fg"}>
                {f.side.toUpperCase()}
              </span>
              {f.price != null && (
                <span className="ml-1.5 font-mono tnum">
                  {formatCurrency(f.price, {
                    compact: f.price < 0.01,
                    decimals: f.price < 0.01 ? 6 : 4,
                  })}
                </span>
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function OhclRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-content-subtle">{label}</span>
      <span
        className={cn(
          "font-semibold text-content",
          tone === "profit" && "text-profit-fg",
          tone === "loss" && "text-loss-fg"
        )}
      >
        {formatCurrency(value, {
          compact: (value ?? 0) < 0.01,
          decimals: (value ?? 0) < 0.01 ? 6 : 4,
        })}
      </span>
    </div>
  );
}

function toMs(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function formatTickTime(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAxisPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

"use client";

import { usePlotArea } from "recharts";
import { cn } from "../ui";
import { formatCurrency } from "../../lib/format";

export function normalizeCandle(c) {
  const tSec = Number(c?.t ?? c?.ts ?? 0);
  if (!tSec) return null;
  const o = Number(c?.o ?? c?.open);
  const h = Number(c?.h ?? c?.high);
  const l = Number(c?.l ?? c?.low);
  const close = Number(c?.c ?? c?.close);
  if (![o, h, l, close].every(Number.isFinite)) return null;
  return { t: tSec, o, h, l, c: close, v: c?.v };
}

/** Draw OHLC candles using the plot area (Recharts 3.1 has usePlotArea). */
export function CandlesLayer({ candles, yDomain, upColor, downColor }) {
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

export function FillMarkerShape({ cx, cy, side, fill, stroke }) {
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

export function CandleTooltip({ active, payload, label, symbol, fillMarks }) {
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

export function formatTickTime(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAxisPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { cn, useChartColors } from "../ui";
import { formatCurrency } from "../../lib/format";

/**
 * Mini price chart centered on a fill timestamp.
 */
export default function FillChartSnippet({
  mint,
  pairUrl,
  aroundTs,
  side,
  priceUsd,
  symbol,
  windowMinutes = 60,
  className,
}) {
  const colors = useChartColors();
  const gradientId = useId().replace(/:/g, "");
  const [state, setState] = useState({ status: "idle", data: null, error: null });

  useEffect(() => {
    if (!aroundTs || (!mint && !pairUrl)) return;
    let cancelled = false;
    const ctrl = new AbortController();

    (async () => {
      setState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams({
          around: String(aroundTs),
          window: String(windowMinutes),
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
  }, [mint, pairUrl, aroundTs, windowMinutes]);

  const chartData = useMemo(() => {
    const candles = state.data?.candles ?? [];
    return candles.map((c) => ({
      t: c.t * 1000,
      price: c.c,
      open: c.o,
      high: c.h,
      low: c.l,
    }));
  }, [state.data]);

  const markerMs = useMemo(() => {
    const raw = aroundTs;
    if (raw == null) return null;
    if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
    const ms = Date.parse(String(raw));
    return Number.isFinite(ms) ? ms : null;
  }, [aroundTs]);

  const tone = side === "sell" ? "loss" : "profit";
  const stroke = tone === "loss" ? colors.loss : colors.profit;
  const fillPrice =
    priceUsd != null && Number.isFinite(Number(priceUsd)) && Number(priceUsd) > 0
      ? Number(priceUsd)
      : null;

  const yDomain = useMemo(() => {
    if (!chartData.length) return ["auto", "auto"];
    const prices = chartData.map((d) => d.price);
    if (fillPrice != null) prices.push(fillPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (!(max > min)) return [min * 0.98, max * 1.02 || 1];
    const pad = (max - min) * 0.12;
    return [min - pad, max + pad];
  }, [chartData, fillPrice]);

  const pairLink = state.data?.pairUrl || pairUrl || null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-line/70 bg-surface-sunken/60",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
          Chart around {side === "sell" ? "sell" : "buy"}
          {state.data?.timeframe ? ` · ${state.data.timeframe}` : ""}
          {state.data?.windowMinutes
            ? ` · ±${Math.round(state.data.windowMinutes / 2)}m`
            : ""}
        </p>
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

      <div className="relative h-36 w-full px-1 pb-1">
        {state.status === "loading" || state.status === "idle" ? (
          <div className="absolute inset-3 animate-pulse rounded-lg bg-surface-raised" />
        ) : state.status === "error" ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-2xs text-content-subtle">
            {state.error}
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-2xs text-content-subtle">
            Not enough candle data around this fill
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
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
                minTickGap={28}
              />
              <YAxis
                domain={yDomain}
                width={52}
                tickFormatter={(v) => formatAxisPrice(v)}
                tick={{ fill: colors["content-subtle"], fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: colors["line-strong"], strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border border-line bg-surface-overlay px-2.5 py-1.5 shadow-lg">
                      <p className="text-2xs text-content-subtle">
                        {row?.t ? new Date(row.t).toLocaleString() : ""}
                      </p>
                      <p className="font-mono text-xs font-semibold tnum text-content">
                        {formatCurrency(row?.price, {
                          compact: (row?.price ?? 0) < 0.01,
                          decimals: (row?.price ?? 0) < 0.01 ? 6 : 4,
                        })}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={stroke}
                strokeWidth={1.7}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
                name={symbol || "Price"}
              />
              {markerMs != null && (
                <ReferenceLine
                  x={markerMs}
                  stroke={stroke}
                  strokeDasharray="4 3"
                  strokeOpacity={0.85}
                />
              )}
              {markerMs != null && fillPrice != null && (
                <ReferenceDot
                  x={markerMs}
                  y={fillPrice}
                  r={4}
                  fill={stroke}
                  stroke={colors.surface}
                  strokeWidth={1.5}
                  isFront
                />
              )}
              {fillPrice != null && (
                <ReferenceLine
                  y={fillPrice}
                  stroke={colors["content-subtle"]}
                  strokeDasharray="2 4"
                  strokeOpacity={0.55}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {fillPrice != null && state.status === "ready" && (
        <p className="border-t border-line/50 px-3 py-1.5 text-2xs text-content-subtle">
          Fill @{" "}
          <span className="font-mono tnum text-content-muted">
            {formatCurrency(fillPrice, {
              compact: fillPrice < 0.01,
              decimals: fillPrice < 0.01 ? 6 : 4,
            })}
          </span>
        </p>
      )}
    </div>
  );
}

function formatTickTime(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAxisPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

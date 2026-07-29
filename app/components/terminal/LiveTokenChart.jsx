"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "recharts";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Segmented, cn, useChartColors } from "../ui";
import { formatCurrency } from "../../lib/format";
import { CHART_TIMEFRAMES } from "../../lib/swap/chartIntervals";
import {
  CandlesLayer,
  CandleTooltip,
  FillMarkerShape,
  formatAxisPrice,
  formatTickTime,
  normalizeCandle,
} from "../swap/candleChartCore";

const INTERVAL_OPTIONS = CHART_TIMEFRAMES.map((t) => ({
  value: t.id,
  label: t.id === "1d" ? "D" : t.label,
}));

const REFRESH_MS = 30_000;

/**
 * DexScreener-style live candlestick chart for a Solana token mint.
 * Session entry marks overlay buy/sell fills from the current terminal session.
 */
export default function LiveTokenChart({
  mint,
  pairUrl,
  symbol,
  entryMarks = [],
  className,
  defaultInterval = "5m",
}) {
  const colors = useChartColors();
  const [interval, setInterval] = useState(defaultInterval);
  const [state, setState] = useState({ status: "idle", data: null, error: null });
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadChart = useCallback(
    async (signal) => {
      if (!mint && !pairUrl) return;
      setState((prev) => ({ status: "loading", data: prev.data, error: null }));
      try {
        const params = new URLSearchParams({
          live: "1",
          interval,
          limit: "300",
        });
        if (mint) params.set("mint", mint);
        if (pairUrl) params.set("pairUrl", pairUrl);

        const res = await fetch(`/api/trade/chart?${params}`, { signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Chart failed (${res.status})`);

        const candles = (json.candles || []).map(normalizeCandle).filter(Boolean);
        setState({ status: "ready", data: { ...json, candles }, error: null });
        setLastRefresh(Date.now());
      } catch (err) {
        if (err?.name === "AbortError") return;
        setState((prev) => ({
          status: "error",
          data: prev.data,
          error: err?.message || "Chart unavailable",
        }));
      }
    },
    [mint, pairUrl, interval]
  );

  useEffect(() => {
    if (!mint && !pairUrl) {
      setState({ status: "idle", data: null, error: null });
      return undefined;
    }
    const ctrl = new AbortController();
    loadChart(ctrl.signal);
    const id = setInterval(() => loadChart(ctrl.signal), REFRESH_MS);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, [mint, pairUrl, interval, loadChart]);

  const marks = useMemo(() => {
    return (entryMarks || [])
      .map((f, i) => {
        const ms = toMs(f.t ?? f.ts);
        if (ms == null) return null;
        const price = Number(f.priceUsd ?? f.price);
        return {
          id: f.id || f.signature || `mark-${i}`,
          side: f.side === "sell" ? "sell" : "buy",
          t: ms,
          price: Number.isFinite(price) && price > 0 ? price : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
  }, [entryMarks]);

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
      mid: (c.h + c.l) / 2,
    }));
  }, [state.data]);

  const yDomain = useMemo(() => {
    const prices = [];
    for (const c of chartData) prices.push(c.l, c.h);
    for (const f of marks) {
      if (f.price != null) prices.push(f.price);
    }
    if (!prices.length) return ["auto", "auto"];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (!(max > min)) return [min * 0.98, max * 1.02 || 1];
    const pad = (max - min) * 0.08;
    return [min - pad, max + pad];
  }, [chartData, marks]);

  const pairLink = state.data?.pairUrl || pairUrl || null;
  const activeTf = state.data?.timeframe || state.data?.interval || interval;
  const priceUsd = state.data?.priceUsd;

  const showLoading = state.status === "loading" && chartData.length < 2;
  const showError = state.status === "error" && chartData.length < 2;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-semibold text-content">
              {symbol || "Token"}
              {activeTf ? (
                <span className="ml-2 text-2xs font-normal text-content-subtle">
                  · {activeTf}
                </span>
              ) : null}
            </p>
            {priceUsd != null && Number.isFinite(priceUsd) ? (
              <p className="font-mono text-sm tnum text-content">
                {formatCurrency(priceUsd, {
                  compact: priceUsd < 0.01,
                  decimals: priceUsd < 0.01 ? 6 : 4,
                })}
              </p>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-2xs text-content-subtle">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-profit" aria-hidden /> Buy
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-loss" aria-hidden /> Sell
            </span>
            {marks.length > 0 ? (
              <span className="text-content-muted">
                {marks.length} session {marks.length === 1 ? "fill" : "fills"}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2 overflow-x-auto">
          <Segmented
            size="sm"
            value={interval}
            onChange={setInterval}
            options={INTERVAL_OPTIONS}
          />
          <button
            type="button"
            onClick={() => loadChart(undefined)}
            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-2xs text-content-subtle hover:text-content"
            title="Refresh chart"
          >
            <RefreshCw size={10} aria-hidden />
            {lastRefresh
              ? new Date(lastRefresh).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Refresh"}
          </button>
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
      </div>

      <div className="relative min-h-[20rem] flex-1 w-full px-1 py-2 sm:min-h-[28rem]">
        {showLoading ? (
          <div className="absolute inset-3 animate-pulse rounded-lg bg-surface-raised" />
        ) : showError ? (
          <div className="flex h-full min-h-[16rem] items-center justify-center px-4 text-center text-2xs text-content-subtle">
            {state.error}
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex h-full min-h-[16rem] items-center justify-center px-4 text-center text-2xs text-content-subtle">
            Paste a contract address to load the chart
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
                content={<CandleTooltip symbol={symbol} fillMarks={marks} />}
              />

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

              {marks.map((f) => (
                <ReferenceLine
                  key={`line-${f.id}`}
                  x={f.t}
                  stroke={f.side === "sell" ? colors.loss : colors.profit}
                  strokeDasharray="3 3"
                  strokeOpacity={0.45}
                />
              ))}

              {marks
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
      {state.status === "loading" && chartData.length >= 2 ? (
        <p className="px-4 pb-2 text-2xs text-content-subtle">Refreshing candles…</p>
      ) : null}
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

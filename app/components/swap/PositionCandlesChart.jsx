"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Scatter,
  Customized,
  usePlotArea,
} from "recharts";
import { Segmented, Spin, Typography, theme } from "antd";
import {
  CHART_INTERVAL_OPTIONS,
  suggestIntervalFromTradeDuration,
} from "@/app/lib/swap/chartIntervals";

const { Text } = Typography;

function fillUnix(fill) {
  const raw = fill?.ts;
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") {
    return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
  }
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function normalizeCandle(c) {
  const ts = Number(c?.ts ?? c?.t ?? 0);
  if (!ts) return null;
  const open = Number(c?.open ?? c?.o);
  const high = Number(c?.high ?? c?.h);
  const low = Number(c?.low ?? c?.l);
  const close = Number(c?.close ?? c?.c);
  if (![open, high, low, close].every(Number.isFinite)) return null;
  return { ts, open, high, low, close };
}

function mergeFillSnapshots(fills = []) {
  const byTs = new Map();
  let interval = null;
  let pairAddress = null;
  let pairUrl = null;
  let source = null;
  for (const fill of fills) {
    const snap = fill?.ohlcSnapshot;
    if (!snap?.candles?.length) continue;
    if (!interval && snap.interval) interval = snap.interval;
    if (!pairAddress && snap.pairAddress) pairAddress = snap.pairAddress;
    if (!pairUrl && snap.pairUrl) pairUrl = snap.pairUrl;
    if (!source && snap.source) source = snap.source;
    for (const raw of snap.candles) {
      const c = normalizeCandle(raw);
      if (!c) continue;
      if (!byTs.has(c.ts)) byTs.set(c.ts, c);
    }
  }
  if (!byTs.size) return null;
  const candles = [...byTs.values()].sort((a, b) => a.ts - b.ts);
  return {
    source: source || "snapshot",
    pairAddress,
    pairUrl,
    interval: interval || "auto",
    candles,
    fromSnapshot: true,
  };
}

function CandlestickLayer({ data, colors }) {
  const plotArea = usePlotArea();
  if (!plotArea || !data?.length) return null;
  const { x, y, width, height } = plotArea;
  const n = data.length;
  const slot = width / Math.max(n, 1);
  const bodyW = Math.max(3, Math.min(14, slot * 0.55));
  const xs = data.map((_, i) => x + slot * i + slot / 2);
  const ys = data.map((d) => {
    const vals = [d.high, d.low, d.open, d.close].filter((v) => Number.isFinite(v));
    return { min: Math.min(...vals), max: Math.max(...vals) };
  });
  const ymin = Math.min(...ys.map((v) => v.min));
  const ymax = Math.max(...ys.map((v) => v.max));
  const span = ymax - ymin || 1;
  const yOf = (v) => y + height - ((v - ymin) / span) * height;

  return (
    <g>
      {data.map((d, i) => {
        const up = d.close >= d.open;
        const color = up ? colors.up : colors.down;
        const xMid = xs[i];
        const yHigh = yOf(d.high);
        const yLow = yOf(d.low);
        const yOpen = yOf(d.open);
        const yClose = yOf(d.close);
        const top = Math.min(yOpen, yClose);
        const bodyH = Math.max(1, Math.abs(yClose - yOpen));
        return (
          <g key={`${d.ts}-${i}`}>
            <line x1={xMid} x2={xMid} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.25} />
            <rect
              x={xMid - bodyW / 2}
              y={top}
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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      style={{
        background: "rgba(15,15,18,0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      <div style={{ opacity: 0.7, marginBottom: 4 }}>{row.label}</div>
      {row.open != null ? (
        <>
          <div>O {Number(row.open).toPrecision(6)}</div>
          <div>H {Number(row.high).toPrecision(6)}</div>
          <div>L {Number(row.low).toPrecision(6)}</div>
          <div>C {Number(row.close).toPrecision(6)}</div>
        </>
      ) : null}
      {row.side ? (
        <div style={{ marginTop: 4 }}>
          {String(row.side).toUpperCase()} @ {Number(row.priceUsd).toPrecision(6)}
        </div>
      ) : null}
    </div>
  );
}

export default function PositionCandlesChart({ mint, fills = [], height = 320 }) {
  const { token } = theme.useToken();
  const [interval, setInterval] = useState("auto");
  const [live, setLive] = useState({ loading: false, data: null, error: null });

  const snapshot = useMemo(() => mergeFillSnapshots(fills), [fills]);

  const fromTs = useMemo(() => {
    const times = fills.map(fillUnix).filter(Boolean);
    return times.length ? Math.min(...times) : null;
  }, [fills]);
  const toTs = useMemo(() => {
    const times = fills.map(fillUnix).filter(Boolean);
    return times.length ? Math.max(...times) : null;
  }, [fills]);

  const autoInterval = useMemo(() => {
    if (!fromTs || !toTs) return "5m";
    return suggestIntervalFromTradeDuration(Math.max(0, toTs - fromTs));
  }, [fromTs, toTs]);

  const effectiveInterval = interval === "auto" ? autoInterval : interval;

  useEffect(() => {
    if (!mint || !fromTs || !toTs) {
      setLive({ loading: false, data: null, error: null });
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      setLive((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const qs = new URLSearchParams({
          mint: String(mint),
          from: String(fromTs),
          to: String(toTs),
          minCandles: "100",
          interval: String(effectiveInterval || "5m"),
        });
        const res = await fetch(`/api/trade/chart?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLive({
            loading: false,
            data: null,
            error: json?.error || `HTTP ${res.status}`,
          });
          return;
        }
        const candles = (json.candles || []).map(normalizeCandle).filter(Boolean);
        setLive({
          loading: false,
          data: { ...json, candles },
          error: null,
        });
      } catch (e) {
        if (!cancelled) {
          setLive({
            loading: false,
            data: null,
            error: e?.message || "Chart failed",
          });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mint, fromTs, toTs, effectiveInterval]);

  const chartPayload = live.data?.candles?.length ? live.data : snapshot;
  const usingSnapshot = Boolean(snapshot?.candles?.length) && !live.data?.candles?.length;

  const candleRows = useMemo(() => {
    const candles = chartPayload?.candles || [];
    return candles.map((c) => ({
      ...c,
      mid: (c.open + c.close) / 2,
      label: new Date(c.ts * 1000).toLocaleString(),
    }));
  }, [chartPayload]);

  const markers = useMemo(() => {
    if (!candleRows.length) return { buys: [], sells: [] };
    const t0 = candleRows[0].ts;
    const t1 = candleRows[candleRows.length - 1].ts;
    const span = Math.max(1, t1 - t0);
    const nearest = (ts) => {
      let best = candleRows[0];
      let bestDist = Math.abs(best.ts - ts);
      for (const row of candleRows) {
        const d = Math.abs(row.ts - ts);
        if (d < bestDist) {
          best = row;
          bestDist = d;
        }
      }
      return best;
    };

    const buys = [];
    const sells = [];
    for (const fill of fills) {
      const ts = fillUnix(fill);
      if (!ts) continue;
      const price = Number(fill?.priceUsd);
      if (!(price > 0)) continue;
      const row = nearest(ts);
      const point = {
        ts: row.ts,
        priceUsd: price,
        mid: price,
        side: fill.side,
        label: new Date(ts * 1000).toLocaleString(),
        xRatio: (row.ts - t0) / span,
      };
      if (fill.side === "buy") buys.push(point);
      else if (fill.side === "sell") sells.push(point);
    }
    return { buys, sells };
  }, [fills, candleRows]);

  const colors = {
    up: token.colorSuccess || "#3fbf7f",
    down: token.colorError || "#ef5b5b",
    buy: "#3b82f6",
    sell: "#f59e0b",
  };

  if (!mint) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        No mint for chart.
      </Text>
    );
  }

  return (
    <div style={{ width: "100%", padding: "0 16px 12px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Entry on chart
          </Text>
          {chartPayload?.pairUrl ? (
            <a href={chartPayload.pairUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              DexScreener ↗
            </a>
          ) : null}
          {usingSnapshot ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Snapshot
            </Text>
          ) : live.data?.interval ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {String(live.data.interval).toUpperCase()}
              {interval === "auto" ? " · auto" : ""}
            </Text>
          ) : null}
        </div>
        <div style={{ maxWidth: "100%", overflowX: "auto" }}>
          <Segmented
            size="small"
            value={interval}
            onChange={setInterval}
            options={CHART_INTERVAL_OPTIONS.map((o) => ({
              ...o,
              label: o.value === "auto" ? `Auto (${String(autoInterval).toUpperCase()})` : o.label,
            }))}
          />
        </div>
      </div>

      {live.loading && !candleRows.length ? (
        <div style={{ display: "grid", placeItems: "center", height: Math.min(height, 260) }}>
          <Spin />
        </div>
      ) : !candleRows.length ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {live.error || "No candle data for this window."}
        </Text>
      ) : (
        <div style={{ width: "100%", height: Math.min(height, 420), minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candleRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) =>
                  new Date(v * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v) => {
                  const n = Number(v);
                  if (!(n > 0)) return "";
                  if (n >= 1) return n.toFixed(2);
                  return n.toPrecision(3);
                }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Customized component={<CandlestickLayer data={candleRows} colors={colors} />} />
              <Scatter
                data={markers.buys}
                dataKey="mid"
                fill={colors.buy}
                shape={(props) => {
                  const { cx, cy } = props;
                  if (cx == null || cy == null) return null;
                  return <circle cx={cx} cy={cy} r={5} fill={colors.buy} stroke="#fff" strokeWidth={1} />;
                }}
                name="Buy"
              />
              <Scatter
                data={markers.sells}
                dataKey="mid"
                fill={colors.sell}
                shape={(props) => {
                  const { cx, cy } = props;
                  if (cx == null || cy == null) return null;
                  return (
                    <rect
                      x={cx - 4}
                      y={cy - 4}
                      width={8}
                      height={8}
                      fill={colors.sell}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  );
                }}
                name="Sell"
              />
            </ComposedChart>
          </ResponsiveContainer>
          {live.loading ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Refreshing live candles…
            </Text>
          ) : null}
        </div>
      )}
    </div>
  );
}

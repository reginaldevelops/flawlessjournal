"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GitCompareArrows, Plus, Split, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChartTooltip,
  Segmented,
  Select,
  axisProps,
  cn,
  gridProps,
  useChartColors,
} from "../ui";
import { computeMetrics } from "../../lib/trades";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio,
  pluralize,
} from "../../lib/format";
import { ChartCard, DataTable, NumCell, formatMetric, moneyTick } from "./shared";
import {
  COMPARE_METRICS,
  QUICK_FILTERS,
  applyFilters,
  cumulativeFor,
  dimensionValues,
  mergeCumulative,
} from "./metrics-extra";

export function CompareTab({ dims, trades, plannedRisk }) {
  const [mode, setMode] = useState("values");

  return (
    <div className="space-y-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "values", label: "Compare values", icon: GitCompareArrows },
          { value: "ab", label: "A / B filter sets", icon: Split },
        ]}
      />
      {mode === "values" ? (
        <ValueCompare dims={dims} trades={trades} />
      ) : (
        <AbCompare dims={dims} trades={trades} plannedRisk={plannedRisk} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compare the values of one dimension                                */
/* ------------------------------------------------------------------ */

function ValueCompare({ dims, trades }) {
  const colors = useChartColors();
  const [dimId, setDimId] = useState(() => dims[0]?.id ?? "");
  const dim = dims.find((d) => d.id === dimId) ?? dims[0];

  const values = useMemo(() => (dim ? dimensionValues(trades, dim) : []), [trades, dim]);
  const [selected, setSelected] = useState([]);

  // Default to the five most-traded values whenever the dimension changes.
  useEffect(() => {
    setSelected(
      [...values]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((v) => v.value)
    );
  }, [dimId, values.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const series = useMemo(() => {
    if (!dim) return [];
    return selected.map((value, i) => {
      const subset = trades.filter((t) => dim.accessor(t) === value);
      return {
        id: `s${i}`,
        label: value,
        color: colors.palette[i % colors.palette.length],
        trades: subset,
        metrics: computeMetrics(subset),
        points: cumulativeFor(subset),
      };
    });
  }, [dim, selected, trades, colors]);

  const merged = useMemo(() => mergeCumulative(series), [series]);

  const barData = useMemo(
    () =>
      series.map((s) => ({
        key: s.label,
        color: s.color,
        winRate: s.metrics.winRate,
        profitFactor: Number.isFinite(s.metrics.profitFactor)
          ? Math.min(5, s.metrics.profitFactor)
          : 5,
        profitFactorRaw: s.metrics.profitFactor,
        expectancy: s.metrics.expectancy,
        count: s.metrics.totalTrades,
        pnl: s.metrics.netPnl,
        best: s.metrics.largestWin,
        worst: s.metrics.largestLoss,
        median: s.metrics.closed.length
          ? median(s.metrics.closed.map((t) => t.pnl))
          : 0,
      })),
    [series]
  );

  const spreadMax = useMemo(
    () => Math.max(1, ...barData.flatMap((d) => [Math.abs(d.best), Math.abs(d.worst)])),
    [barData]
  );

  if (!dim) {
    return (
      <Card>
        <div className="px-4 py-12 text-center text-sm text-content-muted">
          No groupable fields available to compare.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          value={dimId}
          onChange={(e) => setDimId(e.target.value)}
          aria-label="Dimension to compare"
          className="w-48"
        >
          {dims.map((d) => (
            <option key={d.id} value={d.id}>
              Compare {d.label.toLowerCase()}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-1.5">
          {values.map((v) => {
            const on = selected.includes(v.value);
            const idx = selected.indexOf(v.value);
            return (
              <button
                key={v.value}
                type="button"
                onClick={() =>
                  setSelected((s) =>
                    s.includes(v.value) ? s.filter((x) => x !== v.value) : [...s, v.value]
                  )
                }
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors",
                  on
                    ? "border-line-strong bg-surface-raised text-content"
                    : "border-line text-content-subtle hover:text-content-muted"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: on ? colors.palette[idx % colors.palette.length] : "rgb(var(--line-strong))",
                  }}
                  aria-hidden
                />
                {v.value}
                <span className="font-mono tnum text-content-subtle">{v.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {series.length === 0 ? (
        <Card>
          <div className="px-4 py-12 text-center text-sm text-content-muted">
            Select at least one {dim.label.toLowerCase()} value to compare.
          </div>
        </Card>
      ) : (
        <>
          <ChartCard
            title={`Cumulative P&L per ${dim.label.toLowerCase()}`}
            subtitle="Each line starts at zero on its own first trade, so slopes are directly comparable"
            height={300}
            actions={<SeriesLegend series={series} />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps(colors)} />
                <XAxis
                  dataKey="index"
                  {...axisProps(colors)}
                  minTickGap={30}
                  tickFormatter={(v) => `#${v}`}
                />
                <YAxis {...axisProps(colors)} width={54} tickFormatter={moneyTick} />
                <ReferenceLine y={0} stroke={colors["line-strong"]} strokeDasharray="4 4" />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(label) => `Trade #${label} of that bucket`}
                      valueFormatter={(v) => formatCurrency(v, { decimals: 0, signed: true })}
                    />
                  }
                />
                {series.map((s) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid gap-4 xl:grid-cols-3">
            <MetricBars
              title="Win rate"
              data={barData}
              dataKey="winRate"
              tick={(v) => `${Math.round(v)}%`}
              format={(v) => formatPercent(v, { decimals: 1 })}
            />
            <MetricBars
              title="Profit factor"
              data={barData}
              dataKey="profitFactor"
              tick={(v) => formatNumber(v, { decimals: 1 })}
              format={(v, row) => formatRatio(row?.profitFactorRaw ?? v)}
              baseline={1}
            />
            <MetricBars
              title="Expectancy per trade"
              data={barData}
              dataKey="expectancy"
              tick={moneyTick}
              format={(v) => formatCurrency(v, { decimals: 0, signed: true })}
              diverging
            />
          </div>

          <Card className="overflow-hidden print:break-inside-avoid">
            <CardHeader
              title="Outcome spread"
              subtitle="Worst trade, median and best trade inside each bucket"
            />
            <CardBody className="space-y-3 p-4">
              {barData.map((row) => (
                <SpreadRow key={row.key} row={row} max={spreadMax} />
              ))}
            </CardBody>
          </Card>

          <Card className="overflow-hidden print:break-inside-avoid">
            <CardHeader
              title="Side-by-side metrics"
              subtitle="The best value in each row is highlighted"
            />
            <MetricMatrix series={series} />
          </Card>
        </>
      )}
    </div>
  );
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function SeriesLegend({ series }) {
  return (
    <div className="flex max-w-[22rem] flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {series.map((s) => (
        <span key={s.id} className="flex items-center gap-1.5 text-2xs text-content-muted">
          <span className="h-1.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden />
          <span className="truncate">{s.label}</span>
          <span
            className={cn(
              "font-mono tnum",
              s.metrics.netPnl >= 0 ? "text-profit" : "text-loss"
            )}
          >
            {formatCurrency(s.metrics.netPnl, { decimals: 0, signed: true, compact: true })}
          </span>
        </span>
      ))}
    </div>
  );
}

function MetricBars({ title, data, dataKey, tick, format, baseline, diverging }) {
  const colors = useChartColors();
  return (
    <ChartCard title={title} height={Math.max(160, data.length * 34 + 30)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps(colors)} vertical horizontal={false} />
          <XAxis type="number" {...axisProps(colors)} tickFormatter={tick} />
          <YAxis
            type="category"
            dataKey="key"
            {...axisProps(colors)}
            width={96}
            tick={{ fill: colors["content-muted"], fontSize: 11 }}
            interval={0}
          />
          {baseline != null && (
            <ReferenceLine x={baseline} stroke={colors["line-strong"]} strokeDasharray="4 4" />
          )}
          {diverging && <ReferenceLine x={0} stroke={colors["line-strong"]} />}
          <Tooltip
            cursor={{ fill: "rgb(var(--content) / 0.05)" }}
            content={
              <ChartTooltip
                nameFormatter={() => title}
                valueFormatter={(v, entry) => format(v, entry?.payload)}
              />
            }
          />
          <Bar dataKey={dataKey} name={title} radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function SpreadRow({ row, max }) {
  const toPct = (v) => 50 + (v / max) * 50;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 truncate">
          <span className="h-2 w-2 rounded-full" style={{ background: row.color }} aria-hidden />
          <span className="truncate font-medium text-content">{row.key}</span>
        </span>
        <span className="shrink-0 font-mono text-2xs tnum text-content-subtle">
          {formatCurrency(row.worst, { decimals: 0 })} · med{" "}
          {formatCurrency(row.median, { decimals: 0, signed: true })} ·{" "}
          {formatCurrency(row.best, { decimals: 0, signed: true })}
        </span>
      </div>
      <div className="relative h-4 w-full rounded-full bg-surface-sunken">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden />
        <span
          className="absolute inset-y-1 rounded-full"
          style={{
            left: `${toPct(row.worst)}%`,
            width: `${Math.max(1, toPct(row.best) - toPct(row.worst))}%`,
            background: `linear-gradient(90deg, rgb(var(--loss) / 0.55), rgb(var(--profit) / 0.55))`,
          }}
          aria-hidden
        />
        <span
          className="absolute inset-y-0 w-[3px] rounded-full bg-content"
          style={{ left: `calc(${toPct(row.median)}% - 1.5px)` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function MetricMatrix({ series }) {
  const rows = COMPARE_METRICS.map((m) => {
    const values = series.map((s) => s.metrics[m.id] ?? null);
    let bestIndex = -1;
    if (m.higherIsBetter !== null) {
      let bestValue = null;
      values.forEach((v, i) => {
        if (v === null || v === undefined) return;
        const num = Number.isFinite(v) ? v : Number.MAX_SAFE_INTEGER;
        if (bestValue === null || (m.higherIsBetter ? num > bestValue : num < bestValue)) {
          bestValue = num;
          bestIndex = i;
        }
      });
    }
    return { metric: m, values, bestIndex };
  });

  return (
    <div className="w-full overflow-x-auto thin-scrollbar">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <thead className="bg-surface-sunken">
          <tr>
            <th className="border-b border-line px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              Metric
            </th>
            {series.map((s) => (
              <th
                key={s.id}
                className="border-b border-line px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-content-subtle"
              >
                <span className="flex items-center justify-end gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="truncate">{s.label}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ metric, values, bestIndex }) => (
            <tr key={metric.id} className="border-b border-line-subtle last:border-0">
              <td className="px-3 py-2 text-xs text-content-muted">{metric.label}</td>
              {values.map((v, i) => (
                <td
                  key={`${metric.id}-${i}`}
                  className={cn(
                    "px-3 py-2 text-right font-mono text-xs tnum",
                    i === bestIndex ? "font-semibold text-content" : "text-content-muted"
                  )}
                >
                  <span
                    className={cn(
                      i === bestIndex && "rounded-md bg-brand-soft px-1.5 py-0.5 text-brand"
                    )}
                  >
                    {formatMetric(metric.kind, v)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A / B filter sets                                                  */
/* ------------------------------------------------------------------ */

const EMPTY_SET = { custom: {}, quick: {} };

function AbCompare({ dims, trades, plannedRisk }) {
  const colors = useChartColors();
  const filterable = dims.filter((d) => d.filterable);
  const [setA, setSetA] = useState(EMPTY_SET);
  const [setB, setSetB] = useState(EMPTY_SET);

  const tradesA = useMemo(() => applyFilters(trades, setA, { plannedRisk }), [trades, setA, plannedRisk]);
  const tradesB = useMemo(() => applyFilters(trades, setB, { plannedRisk }), [trades, setB, plannedRisk]);
  const metricsA = useMemo(() => computeMetrics(tradesA), [tradesA]);
  const metricsB = useMemo(() => computeMetrics(tradesB), [tradesB]);

  const merged = useMemo(
    () =>
      mergeCumulative([
        { id: "a", points: cumulativeFor(tradesA) },
        { id: "b", points: cumulativeFor(tradesB) },
      ]),
    [tradesA, tradesB]
  );

  const rows = COMPARE_METRICS.map((m) => {
    const a = metricsA[m.id] ?? null;
    const b = metricsB[m.id] ?? null;
    let delta = null;
    if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b)) delta = a - b;
    let tone = "neutral";
    if (delta !== null && m.higherIsBetter !== null && Math.abs(delta) > 1e-9) {
      const aBetter = m.higherIsBetter ? delta > 0 : delta < 0;
      tone = aBetter ? "profit" : "loss";
    }
    return { key: m.id, metric: m, a, b, delta, tone };
  });

  const columns = [
    { id: "metric", label: "Metric", sortable: false, render: (r) => <span className="text-content-muted">{r.metric.label}</span> },
    {
      id: "a",
      label: "Set A",
      align: "right",
      sortable: false,
      render: (r) => <span className="font-mono text-xs tnum text-content">{formatMetric(r.metric.kind, r.a)}</span>,
    },
    {
      id: "b",
      label: "Set B",
      align: "right",
      sortable: false,
      render: (r) => <span className="font-mono text-xs tnum text-content">{formatMetric(r.metric.kind, r.b)}</span>,
    },
    {
      id: "delta",
      label: "A − B",
      align: "right",
      sortable: false,
      render: (r) => (
        <span
          className={cn(
            "font-mono text-xs font-semibold tnum",
            r.tone === "profit" ? "text-profit" : r.tone === "loss" ? "text-loss" : "text-content-subtle"
          )}
        >
          {r.delta === null
            ? "—"
            : `${r.delta > 0 ? "+" : ""}${formatMetric(r.metric.kind, r.delta)}`}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <FilterSetEditor
          label="Set A"
          tone="brand"
          color={colors.brand}
          dims={filterable}
          trades={trades}
          value={setA}
          onChange={setSetA}
          count={tradesA.length}
          metrics={metricsA}
        />
        <FilterSetEditor
          label="Set B"
          tone="info"
          color={colors["brand-accent"]}
          dims={filterable}
          trades={trades}
          value={setB}
          onChange={setSetB}
          count={tradesB.length}
          metrics={metricsB}
        />
      </div>

      <ChartCard
        title="Cumulative P&L — A vs B"
        subtitle="Both sets start at zero so the slope difference is the whole story"
        height={280}
        empty={merged.length < 2 ? "Define at least one set with two or more trades" : null}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps(colors)} />
            <XAxis dataKey="index" {...axisProps(colors)} minTickGap={30} tickFormatter={(v) => `#${v}`} />
            <YAxis {...axisProps(colors)} width={54} tickFormatter={moneyTick} />
            <ReferenceLine y={0} stroke={colors["line-strong"]} strokeDasharray="4 4" />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(label) => `Trade #${label}`}
                  valueFormatter={(v) => formatCurrency(v, { decimals: 0, signed: true })}
                />
              }
            />
            <Line type="monotone" dataKey="a" name="Set A" stroke={colors.brand} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="b" name="Set B" stroke={colors["brand-accent"]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card className="overflow-hidden print:break-inside-avoid">
        <CardHeader
          title="Diff table"
          subtitle="Green means Set A is the better side of that metric"
        />
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} />
      </Card>
    </div>
  );
}

function FilterSetEditor({ label, tone, color, dims, trades, value, onChange, count, metrics }) {
  const [dimId, setDimId] = useState(dims[0]?.id ?? "");
  const dim = dims.find((d) => d.id === dimId) ?? dims[0];
  const options = useMemo(() => (dim ? dimensionValues(trades, dim) : []), [dim, trades]);
  const [pending, setPending] = useState("");

  useEffect(() => setPending(""), [dimId]);

  const add = () => {
    if (!dim || !pending) return;
    const current = value.custom[dim.field] ?? [];
    if (current.includes(pending)) return;
    onChange({ ...value, custom: { ...value.custom, [dim.field]: [...current, pending] } });
    setPending("");
  };

  const remove = (field, v) => {
    const next = (value.custom[field] ?? []).filter((x) => x !== v);
    const custom = { ...value.custom };
    if (next.length) custom[field] = next;
    else delete custom[field];
    onChange({ ...value, custom });
  };

  const toggleQuick = (id) => {
    const quick = { ...value.quick, [id]: !value.quick[id] };
    if (id === "winners" && quick.winners) quick.losers = false;
    if (id === "losers" && quick.losers) quick.winners = false;
    onChange({ ...value, quick });
  };

  const chips = Object.entries(value.custom ?? {}).flatMap(([field, values]) =>
    values.map((v) => ({ field, value: v }))
  );

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
            {label}
          </span>
        }
        subtitle={`${pluralize(count, "trade")} · ${formatCurrency(metrics.netPnl, { decimals: 0, signed: true })} net · ${formatPercent(metrics.winRate, { decimals: 0 })} win rate`}
        actions={
          chips.length || Object.values(value.quick ?? {}).some(Boolean) ? (
            <Button variant="ghost" size="xs" onClick={() => onChange(EMPTY_SET)}>
              Reset
            </Button>
          ) : (
            <Badge tone={tone} size="xs">
              All trades
            </Badge>
          )
        }
      />
      <CardBody className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select size="sm" value={dimId} onChange={(e) => setDimId(e.target.value)} className="w-32" aria-label={`${label} dimension`}>
            {dims.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
          <Select
            size="sm"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            className="w-36"
            aria-label={`${label} value`}
          >
            <option value="">Choose value…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" icon={Plus} onClick={add} disabled={!pending}>
            Add
          </Button>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={`${c.field}-${c.value}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised py-1 pl-2.5 pr-1 text-2xs text-content"
              >
                <span className="text-content-subtle">{c.field}</span>
                {c.value}
                <button
                  type="button"
                  onClick={() => remove(c.field, c.value)}
                  aria-label={`Remove ${c.value}`}
                  className="rounded-full p-0.5 text-content-subtle transition hover:bg-loss-soft hover:text-loss"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1">
          {QUICK_FILTERS.map((q) => {
            const on = Boolean(value.quick?.[q.id]);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => toggleQuick(q.id)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors",
                  on
                    ? "border-brand/40 bg-brand-soft text-brand"
                    : "border-line text-content-subtle hover:text-content-muted"
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

export default CompareTab;

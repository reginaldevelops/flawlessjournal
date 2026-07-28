"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Layers, TrendingDown, TrendingUp } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  ChartTooltip,
  DivergingBar,
  MiniBar,
  Segmented,
  Select,
  axisProps,
  gridProps,
  useChartColors,
} from "../ui";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatR,
  formatRatio,
  pluralize,
} from "../../lib/format";
import { Callout, DataTable, NumCell, moneyTick } from "./shared";
import { dimensionStats, downloadCsv, toCsv } from "./metrics-extra";

const METRICS = [
  { id: "pnl", label: "Net P&L", format: (v) => formatCurrency(v, { decimals: 0, signed: true }), tick: moneyTick, diverging: true },
  { id: "expectancy", label: "Expectancy / trade", format: (v) => formatCurrency(v, { decimals: 0, signed: true }), tick: moneyTick, diverging: true },
  { id: "winRate", label: "Win rate", format: (v) => formatPercent(v, { decimals: 1 }), tick: (v) => `${Math.round(v)}%`, diverging: false },
  { id: "profitFactor", label: "Profit factor", format: (v) => formatRatio(v), tick: (v) => formatNumber(v, { decimals: 1 }), diverging: false, cap: 5, baseline: 1 },
  { id: "count", label: "Trade count", format: (v) => formatNumber(v, { decimals: 0 }), tick: (v) => formatNumber(v, { decimals: 0 }), diverging: false },
  { id: "avgR", label: "Average R", format: (v) => (v === null ? "—" : formatR(v)), tick: (v) => `${Number(v).toFixed(1)}R`, diverging: true },
];

export function BreakdownTab({ dims, trades, onDrillDown }) {
  const colors = useChartColors();
  const [dimId, setDimId] = useState(() => dims[0]?.id ?? "");
  const [metricId, setMetricId] = useState("pnl");
  const [minCount, setMinCount] = useState(3);

  const dim = dims.find((d) => d.id === dimId) ?? dims[0];
  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];

  const rows = useMemo(
    () => (dim ? dimensionStats(trades, dim, { minCount }) : []),
    [trades, dim, minCount]
  );

  const chartData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[metric.id] ?? 0;
      const bv = b[metric.id] ?? 0;
      return (Number.isFinite(bv) ? bv : metric.cap ?? 0) - (Number.isFinite(av) ? av : metric.cap ?? 0);
    });
    return sorted.map((r) => {
      const raw = r[metric.id];
      const value = raw === null || raw === undefined ? 0 : Number.isFinite(raw) ? raw : (metric.cap ?? 0);
      return {
        key: r.key,
        value: metric.cap ? Math.min(metric.cap, value) : value,
        raw,
        count: r.count,
        pnl: r.pnl,
      };
    });
  }, [rows, metric]);

  const best = useMemo(() => [...rows].sort((a, b) => b.pnl - a.pnl)[0], [rows]);
  const worst = useMemo(() => [...rows].sort((a, b) => a.pnl - b.pnl)[0], [rows]);
  const maxAbsPnl = useMemo(() => Math.max(1, ...rows.map((r) => Math.abs(r.pnl))), [rows]);
  const maxCount = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows]);

  const exportCsv = () => {
    const csv = toCsv(
      [
        { id: "key", label: dim?.label ?? "Bucket" },
        { id: "count", label: "Trades" },
        { id: "pnl", label: "Net P&L" },
        { id: "winRate", label: "Win rate %" },
        { id: "profitFactor", label: "Profit factor", value: (r) => (Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "Inf") },
        { id: "expectancy", label: "Expectancy" },
        { id: "avgR", label: "Average R" },
        { id: "best", label: "Best trade" },
        { id: "worst", label: "Worst trade" },
      ],
      rows.map((r) => ({
        ...r,
        pnl: r.pnl.toFixed(2),
        winRate: r.winRate.toFixed(1),
        expectancy: r.expectancy.toFixed(2),
        avgR: r.avgR === null ? "" : r.avgR.toFixed(2),
        best: r.best.toFixed(2),
        worst: r.worst.toFixed(2),
      }))
    );
    downloadCsv(`breakdown-${(dim?.label ?? "dimension").toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
  };

  const columns = [
    {
      id: "key",
      label: dim?.label ?? "Bucket",
      sortValue: (r) => r.key,
      defaultDir: "asc",
      width: "18%",
      render: (r) => (
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: r.pnl >= 0 ? "rgb(var(--profit))" : "rgb(var(--loss))" }}
            aria-hidden
          />
          <span className="truncate font-medium text-content">{r.key}</span>
        </span>
      ),
    },
    {
      id: "count",
      label: "Trades",
      align: "right",
      width: "12%",
      render: (r) => (
        <span className="flex items-center justify-end gap-2">
          <span className="hidden w-14 sm:block">
            <MiniBar value={r.count} max={maxCount} tone="brand" />
          </span>
          <NumCell value={r.count} format={(v) => formatNumber(v, { decimals: 0 })} muted />
        </span>
      ),
    },
    {
      id: "pnl",
      label: "Net P&L",
      align: "right",
      width: "18%",
      render: (r) => (
        <span className="flex items-center justify-end gap-2">
          <span className="hidden w-20 sm:block">
            <DivergingBar value={r.pnl} max={maxAbsPnl} />
          </span>
          <NumCell value={r.pnl} format={(v) => formatCurrency(v, { decimals: 0, signed: true })} tone="auto" />
        </span>
      ),
    },
    {
      id: "winRate",
      label: "Win rate",
      align: "right",
      width: "13%",
      render: (r) => (
        <span className="flex items-center justify-end gap-2">
          <span className="hidden w-12 sm:block">
            <MiniBar value={r.winRate} max={100} tone={r.winRate >= 50 ? "profit" : "warn"} />
          </span>
          <NumCell value={r.winRate} format={(v) => formatPercent(v, { decimals: 1 })} />
        </span>
      ),
    },
    {
      id: "profitFactor",
      label: "PF",
      align: "right",
      hint: "Profit factor: gross profit divided by gross loss inside this bucket.",
      render: (r) => (
        <NumCell
          value={r.profitFactor}
          format={formatRatio}
          tone={r.profitFactor >= 1 ? "profit" : "loss"}
        />
      ),
    },
    {
      id: "expectancy",
      label: "Expectancy",
      align: "right",
      hint: "Average P&L per trade in this bucket.",
      render: (r) => (
        <NumCell value={r.expectancy} format={(v) => formatCurrency(v, { decimals: 0, signed: true })} tone="auto" />
      ),
    },
    {
      id: "avgR",
      label: "Avg R",
      align: "right",
      render: (r) => (
        <NumCell value={r.avgR} format={(v) => (v === null ? "—" : formatR(v))} tone="auto" />
      ),
    },
    {
      id: "best",
      label: "Best",
      align: "right",
      render: (r) => <NumCell value={r.best} format={(v) => formatCurrency(v, { decimals: 0 })} tone="profit" />,
    },
    {
      id: "worst",
      label: "Worst",
      align: "right",
      render: (r) => <NumCell value={r.worst} format={(v) => formatCurrency(v, { decimals: 0 })} tone="loss" />,
    },
  ];

  if (!dims.length) {
    return (
      <Card>
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-content-muted">
            No groupable fields found. Add a dropdown variable to your journal to unlock breakdowns.
          </p>
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
          aria-label="Group by"
          className="w-44"
        >
          {dims.map((d) => (
            <option key={d.id} value={d.id}>
              Group by {d.label.toLowerCase()}
            </option>
          ))}
        </Select>
        <Select
          size="sm"
          value={metricId}
          onChange={(e) => setMetricId(e.target.value)}
          aria-label="Metric"
          className="w-48"
        >
          {METRICS.map((m) => (
            <option key={m.id} value={m.id}>
              Plot {m.label.toLowerCase()}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-content-subtle">Min sample</span>
          <Segmented
            size="sm"
            value={String(minCount)}
            onChange={(v) => setMinCount(Number(v))}
            options={[
              { value: "1", label: "1" },
              { value: "3", label: "3" },
              { value: "10", label: "10" },
              { value: "25", label: "25" },
            ]}
          />
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} className="ml-auto">
          Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-content-muted">
              No bucket of {dim.label.toLowerCase()} has at least {pluralize(minCount, "trade")} in this
              selection.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {best && best.pnl > 0 && (
              <Callout
                tone="profit"
                icon={TrendingUp}
                eyebrow={`Strongest ${dim.label.toLowerCase()}`}
                title={`${best.key} produced ${formatCurrency(best.pnl, { decimals: 0, signed: true })}`}
                description={`${pluralize(best.count, "trade")} · ${formatPercent(best.winRate, { decimals: 0 })} win rate · ${formatRatio(best.profitFactor)} profit factor · ${formatCurrency(best.expectancy, { decimals: 0, signed: true })} per trade. Do more of this.`}
                value={formatCurrency(best.pnl, { decimals: 0, signed: true })}
                valueLabel="net"
              />
            )}
            {worst && worst.pnl < 0 && (
              <Callout
                tone="loss"
                icon={TrendingDown}
                eyebrow={`Bleeding ${dim.label.toLowerCase()}`}
                title={`${worst.key} cost you ${formatCurrency(Math.abs(worst.pnl), { decimals: 0 })}`}
                description={`${pluralize(worst.count, "trade")} · ${formatPercent(worst.winRate, { decimals: 0 })} win rate · ${formatCurrency(worst.expectancy, { decimals: 0, signed: true })} per trade. Removing it alone lifts your net result.`}
                value={formatCurrency(worst.pnl, { decimals: 0, signed: true })}
                valueLabel="net"
              />
            )}
          </div>

          <Card className="overflow-hidden print:break-inside-avoid">
            <CardHeader
              title={`${metric.label} by ${dim.label.toLowerCase()}`}
              subtitle={`${rows.length} buckets with at least ${pluralize(minCount, "trade")}`}
              icon={Layers}
            />
            <div className="p-4">
              <div style={{ height: Math.max(180, chartData.length * 30 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                  >
                    <CartesianGrid {...gridProps(colors)} vertical horizontal={false} />
                    <XAxis type="number" {...axisProps(colors)} tickFormatter={metric.tick} />
                    <YAxis
                      type="category"
                      dataKey="key"
                      {...axisProps(colors)}
                      width={112}
                      tick={{ fill: colors["content-muted"], fontSize: 11 }}
                      interval={0}
                    />
                    {metric.baseline != null && (
                      <ReferenceLine x={metric.baseline} stroke={colors["line-strong"]} strokeDasharray="4 4" />
                    )}
                    {metric.diverging && <ReferenceLine x={0} stroke={colors["line-strong"]} />}
                    <Tooltip
                      cursor={{ fill: "rgb(var(--content) / 0.05)" }}
                      content={
                        <ChartTooltip
                          nameFormatter={() => metric.label}
                          valueFormatter={(v, entry) => metric.format(entry?.payload?.raw ?? v)}
                          extra={null}
                        />
                      }
                    />
                    <Bar dataKey="value" name={metric.label} radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={18}>
                      {chartData.map((d) => (
                        <Cell
                          key={d.key}
                          fill={
                            metric.diverging
                              ? d.value >= 0
                                ? colors.profit
                                : colors.loss
                              : metric.id === "profitFactor"
                                ? d.value >= 1
                                  ? colors.profit
                                  : colors.loss
                                : d.pnl >= 0
                                  ? colors.brand
                                  : colors.loss
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden print:break-inside-avoid">
            <CardHeader
              title={`${dim.label} table`}
              subtitle={
                dim.filterable
                  ? "Click any row to filter the entire workspace by that value"
                  : "Sort any column to find the outlier"
              }
            />
            <DataTable
              columns={columns}
              rows={rows}
              initialSort={{ id: metric.id === "count" ? "count" : "pnl", dir: "desc" }}
              rowKey={(r) => r.key}
              onRowClick={dim.filterable && onDrillDown ? (r) => onDrillDown(dim.field, r.key) : undefined}
              emptyLabel="No buckets match"
            />
          </Card>
        </>
      )}
    </div>
  );
}

export default BreakdownTab;

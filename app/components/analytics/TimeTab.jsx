"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Clock, Hourglass, Timer, TrendingDown, TrendingUp } from "lucide-react";
import {
  Card,
  CardHeader,
  ChartTooltip,
  DivergingBar,
  axisProps,
  gridProps,
  useChartColors,
} from "../ui";
import { byHour, byWeekday } from "../../lib/trades";
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRatio,
  pluralize,
} from "../../lib/format";
import { Callout, DataTable, NumCell, moneyTick } from "./shared";
import { WeekdayHourHeatmap } from "./Heatmap";
import { dimensionStats, monthlyStats, weekdayHourMatrix } from "./metrics-extra";

/** Bars of net P&L with a secondary series (win rate or volume) on the right axis. */
function BucketChart({
  data,
  xKey = "key",
  secondary = "winRate",
  height = 240,
  labelFormatter,
  angle = 0,
}) {
  const colors = useChartColors();
  const secondaryConfig =
    secondary === "winRate"
      ? { name: "Win rate", format: (v) => formatPercent(v, { decimals: 1 }), tick: (v) => `${Math.round(v)}%`, domain: [0, 100], color: colors.warn }
      : secondary === "cumulative"
        ? { name: "Cumulative", format: (v) => formatCurrency(v, { decimals: 0, signed: true }), tick: moneyTick, domain: ["auto", "auto"], color: colors["brand-accent"] }
        : { name: "Trades", format: (v) => formatNumber(v, { decimals: 0 }), tick: (v) => formatNumber(v, { decimals: 0 }), domain: [0, "auto"], color: colors.brand };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: angle ? 18 : 0, left: 0 }}>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis
            dataKey={xKey}
            {...axisProps(colors)}
            interval={0}
            minTickGap={0}
            angle={angle}
            textAnchor={angle ? "end" : "middle"}
            height={angle ? 44 : 30}
            tickFormatter={labelFormatter}
          />
          <YAxis yAxisId="pnl" {...axisProps(colors)} width={52} tickFormatter={moneyTick} />
          <YAxis
            yAxisId="secondary"
            orientation="right"
            {...axisProps(colors)}
            width={40}
            domain={secondaryConfig.domain}
            tickFormatter={secondaryConfig.tick}
          />
          <ReferenceLine yAxisId="pnl" y={0} stroke={colors["line-strong"]} />
          <Tooltip
            cursor={{ fill: "rgb(var(--content) / 0.05)" }}
            content={
              <ChartTooltip
                valueFormatter={(v, entry) =>
                  entry?.dataKey === "pnl"
                    ? formatCurrency(v, { decimals: 0, signed: true })
                    : secondaryConfig.format(v)
                }
              />
            }
          />
          <Bar yAxisId="pnl" dataKey="pnl" name="Net P&L" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={`${d[xKey]}-${i}`} fill={d.pnl >= 0 ? colors.profit : colors.loss} />
            ))}
          </Bar>
          <Line
            yAxisId="secondary"
            type="monotone"
            dataKey={secondary === "cumulative" ? "cumulative" : secondary}
            name={secondaryConfig.name}
            stroke={secondaryConfig.color}
            strokeWidth={1.8}
            dot={secondary === "cumulative" ? false : { r: 2, strokeWidth: 0, fill: secondaryConfig.color }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimeTab({ trades, dims }) {
  const weekdays = useMemo(() => byWeekday(trades).filter((d) => d.count > 0), [trades]);
  const hours = useMemo(() => {
    const all = byHour(trades);
    const active = all.filter((h) => h.count > 0);
    if (!active.length) return [];
    const min = Math.min(...active.map((h) => h.hour));
    const max = Math.max(...active.map((h) => h.hour));
    return all.slice(min, max + 1);
  }, [trades]);
  const months = useMemo(() => monthlyStats(trades), [trades]);
  const matrix = useMemo(() => weekdayHourMatrix(trades), [trades]);

  const durationDim = dims.find((d) => d.id === "__duration");
  const sessionDim = dims.find((d) => /session/i.test(d.label));
  const blockDim = dims.find((d) => d.id === "__hourblock");

  const durations = useMemo(
    () => (durationDim ? dimensionStats(trades, durationDim, { minCount: 1 }) : []),
    [trades, durationDim]
  );
  const sessions = useMemo(
    () => (sessionDim ? dimensionStats(trades, sessionDim, { minCount: 1 }) : []),
    [trades, sessionDim]
  );
  const blocks = useMemo(
    () => (blockDim ? dimensionStats(trades, blockDim, { minCount: 1 }) : []),
    [trades, blockDim]
  );

  const worstDay = useMemo(() => [...weekdays].sort((a, b) => a.pnl - b.pnl)[0], [weekdays]);
  const bestDay = useMemo(() => [...weekdays].sort((a, b) => b.pnl - a.pnl)[0], [weekdays]);
  const worstHour = useMemo(
    () => [...hours].filter((h) => h.count >= 3).sort((a, b) => a.pnl - b.pnl)[0],
    [hours]
  );
  const maxAbsWeekday = useMemo(
    () => Math.max(1, ...weekdays.map((d) => Math.abs(d.pnl))),
    [weekdays]
  );

  if (!trades.length) return null;

  const weekdayColumns = [
    { id: "key", label: "Day", sortValue: (r) => r.weekday, defaultDir: "asc", render: (r) => <span className="font-medium text-content">{r.key}</span> },
    { id: "count", label: "Trades", align: "right", render: (r) => <NumCell value={r.count} format={(v) => formatNumber(v, { decimals: 0 })} muted /> },
    {
      id: "pnl",
      label: "Net P&L",
      align: "right",
      render: (r) => (
        <span className="flex items-center justify-end gap-2">
          <span className="hidden w-16 sm:block">
            <DivergingBar value={r.pnl} max={maxAbsWeekday} />
          </span>
          <NumCell value={r.pnl} format={(v) => formatCurrency(v, { decimals: 0, signed: true })} tone="auto" />
        </span>
      ),
    },
    { id: "winRate", label: "Win rate", align: "right", render: (r) => <NumCell value={r.winRate} format={(v) => formatPercent(v, { decimals: 1 })} /> },
    {
      id: "expectancy",
      label: "Per trade",
      align: "right",
      sortValue: (r) => (r.count ? r.pnl / r.count : 0),
      render: (r) => (
        <NumCell
          value={r.count ? r.pnl / r.count : 0}
          format={(v) => formatCurrency(v, { decimals: 0, signed: true })}
          tone="auto"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {worstDay && worstDay.pnl < 0 && (
          <Callout
            tone="loss"
            icon={TrendingDown}
            eyebrow="Worst day of the week"
            title={`${worstDay.key} costs you ${formatCurrency(Math.abs(worstDay.pnl), { decimals: 0 })}`}
            description={`${pluralize(worstDay.count, "trade")} at a ${formatPercent(worstDay.winRate, { decimals: 0 })} win rate, ${formatCurrency(worstDay.pnl / worstDay.count, { decimals: 0, signed: true })} per trade. Closing the platform on ${worstDay.key} is the single cheapest change available to you.`}
            value={formatCurrency(worstDay.pnl, { decimals: 0, signed: true, compact: true })}
            valueLabel={`${worstDay.key} net`}
          />
        )}
        {bestDay && bestDay.pnl > 0 && (
          <Callout
            tone="profit"
            icon={TrendingUp}
            eyebrow="Best day of the week"
            title={`${bestDay.key} carries the account`}
            description={`${pluralize(bestDay.count, "trade")} · ${formatPercent(bestDay.winRate, { decimals: 0 })} win rate · ${formatCurrency(bestDay.pnl / bestDay.count, { decimals: 0, signed: true })} per trade.`}
            value={formatCurrency(bestDay.pnl, { decimals: 0, signed: true, compact: true })}
            valueLabel={`${bestDay.key} net`}
          />
        )}
      </div>

      <Card className="overflow-hidden print:break-inside-avoid">
        <CardHeader
          title="Day of week"
          subtitle="Bars are net P&L, the amber line is win rate"
          icon={CalendarDays}
        />
        <div className="p-4 pb-0">
          <BucketChart data={weekdays} secondary="winRate" height={220} />
        </div>
        <DataTable
          columns={weekdayColumns}
          rows={weekdays}
          rowKey={(r) => r.key}
          initialSort={{ id: "pnl", dir: "asc" }}
          className="border-t border-line"
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden print:break-inside-avoid">
          <CardHeader
            title="Hour of day"
            subtitle={
              worstHour
                ? `Entries at ${worstHour.key} are your weakest slot (${formatCurrency(worstHour.pnl, { decimals: 0, signed: true })})`
                : "Net P&L by entry hour, with trade volume overlaid"
            }
            icon={Clock}
          />
          <div className="p-4">
            <BucketChart data={hours} secondary="count" height={230} />
          </div>
        </Card>

        <Card className="overflow-hidden print:break-inside-avoid">
          <CardHeader
            title="Month by month"
            subtitle="Bars are monthly net P&L, the line is the running total"
            icon={CalendarDays}
          />
          <div className="p-4">
            <BucketChart
              data={months}
              xKey="label"
              secondary="cumulative"
              height={230}
              angle={months.length > 8 ? -35 : 0}
            />
          </div>
        </Card>
      </div>

      <WeekdayHourHeatmap matrix={matrix} />

      <div className="grid gap-4 xl:grid-cols-2">
        {durations.length > 0 && (
          <Card className="overflow-hidden print:break-inside-avoid">
            <CardHeader
              title="Hold time"
              subtitle="Are you cutting winners early or letting losers run?"
              icon={Hourglass}
            />
            <div className="p-4">
              <BucketChart data={durations} secondary="winRate" height={230} angle={-25} />
            </div>
            <DataTable
              columns={bucketColumns("Hold time")}
              rows={durations}
              rowKey={(r) => r.key}
              className="border-t border-line"
            />
          </Card>
        )}

        {(sessions.length > 0 ? sessions : blocks).length > 0 && (
          <Card className="overflow-hidden print:break-inside-avoid">
            <CardHeader
              title={sessions.length > 0 ? "Session" : "Time of day"}
              subtitle={
                sessions.length > 0
                  ? "Where your edge actually lives"
                  : "Four-hour blocks by entry time"
              }
              icon={Timer}
            />
            <div className="p-4">
              <BucketChart
                data={sessions.length > 0 ? sessions : blocks}
                secondary="winRate"
                height={230}
                angle={-20}
              />
            </div>
            <DataTable
              columns={bucketColumns(sessions.length > 0 ? "Session" : "Block")}
              rows={sessions.length > 0 ? sessions : blocks}
              rowKey={(r) => r.key}
              className="border-t border-line"
            />
          </Card>
        )}
      </div>

      <AverageHoldStrip trades={trades} />
    </div>
  );
}

function bucketColumns(label) {
  return [
    { id: "key", label, render: (r) => <span className="font-medium text-content">{r.key}</span> },
    { id: "count", label: "Trades", align: "right", render: (r) => <NumCell value={r.count} format={(v) => formatNumber(v, { decimals: 0 })} muted /> },
    { id: "pnl", label: "Net P&L", align: "right", render: (r) => <NumCell value={r.pnl} format={(v) => formatCurrency(v, { decimals: 0, signed: true })} tone="auto" /> },
    { id: "winRate", label: "Win rate", align: "right", render: (r) => <NumCell value={r.winRate} format={(v) => formatPercent(v, { decimals: 0 })} /> },
    { id: "profitFactor", label: "PF", align: "right", render: (r) => <NumCell value={r.profitFactor} format={formatRatio} tone={r.profitFactor >= 1 ? "profit" : "loss"} /> },
  ];
}

/** Winners held longer than losers is the sign of a trader who follows the plan. */
function AverageHoldStrip({ trades }) {
  const stats = useMemo(() => {
    const durations = (list) => list.map((t) => t.durationMin).filter((d) => d !== null && d >= 0);
    const winners = durations(trades.filter((t) => t.isWin));
    const losers = durations(trades.filter((t) => t.isLoss));
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    return { win: avg(winners), loss: avg(losers) };
  }, [trades]);

  if (stats.win === null && stats.loss === null) return null;
  const holdingLosersLonger = stats.win !== null && stats.loss !== null && stats.loss > stats.win;

  return (
    <Callout
      tone={holdingLosersLonger ? "warn" : "info"}
      icon={Hourglass}
      eyebrow="Hold-time asymmetry"
      title={
        holdingLosersLonger
          ? `You hold losers ${formatRatio(stats.loss / stats.win)}× longer than winners`
          : "You hold winners longer than losers — as intended"
      }
      description={`Average winner ${formatDuration(stats.win)} versus average loser ${formatDuration(stats.loss)}. ${
        holdingLosersLonger
          ? "That is the disposition effect: hope on the losers, fear on the winners."
          : "Keep it that way; it is what turns a modest win rate into a positive expectancy."
      }`}
    />
  );
}

export default TimeTab;

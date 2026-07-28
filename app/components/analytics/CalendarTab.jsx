"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, Tooltip, cn } from "../ui";
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  formatR,
  formatTime,
  pluralize,
} from "../../lib/format";
import { MiniStat } from "./shared";
import { calendarMonthGrid, monthTitle, shiftMonth, yearHeatmap } from "./metrics-extra";

const WEEK_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayTint(pnl, maxAbs) {
  if (!pnl || !maxAbs) return undefined;
  const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
  const alpha = 0.12 + intensity ** 0.65 * 0.5;
  return `rgb(var(--${pnl > 0 ? "profit" : "loss"}) / ${alpha.toFixed(3)})`;
}

export function CalendarTab({ metrics, bounds }) {
  const days = metrics.days ?? {};
  const monthKeys = useMemo(() => {
    const keys = new Set();
    for (const key of Object.keys(days)) keys.add(key.slice(0, 7));
    return [...keys].sort();
  }, [days]);

  const latestMonth = monthKeys[monthKeys.length - 1] ?? new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(latestMonth);
  const [selectedDay, setSelectedDay] = useState(null);

  // Keep the visible month inside the filtered dataset.
  useEffect(() => {
    if (!monthKeys.length) return;
    if (!monthKeys.includes(month)) setMonth(monthKeys[monthKeys.length - 1]);
  }, [monthKeys, month]);

  useEffect(() => {
    setSelectedDay(null);
  }, [month]);

  const grid = useMemo(() => calendarMonthGrid(month, days), [month, days]);
  const years = useMemo(() => [...new Set(monthKeys.map((m) => Number(m.slice(0, 4))))].sort(), [monthKeys]);
  const [year, setYear] = useState(Number(latestMonth.slice(0, 4)));
  useEffect(() => {
    setYear(Number(month.slice(0, 4)));
  }, [month]);

  const heat = useMemo(() => yearHeatmap(year, days), [year, days]);
  const selected = selectedDay ? days[selectedDay] : null;

  const monthIndex = monthKeys.indexOf(month);
  const canPrev = monthIndex > 0 || monthKeys.length === 0;
  const canNext = monthIndex >= 0 && monthIndex < monthKeys.length - 1;

  const dayStats = [
    {
      label: "Green-day rate",
      value: formatPercent(metrics.winningDayRate, { decimals: 0 }),
      tone: metrics.winningDayRate >= 50 ? "profit" : "warn",
      hint: "Share of sessions that finished in profit.",
    },
    {
      label: "Avg winning day",
      value: formatCurrency(metrics.avgWinningDay, { decimals: 0, signed: true }),
      tone: "profit",
      hint: "Mean P&L of your green sessions.",
    },
    {
      label: "Avg losing day",
      value: formatCurrency(metrics.avgLosingDay, { decimals: 0, signed: true }),
      tone: "loss",
      hint: "Mean P&L of your red sessions. If it exceeds the average winning day you are risk-managing days, not trades.",
    },
    {
      label: "Best day",
      value: formatCurrency(metrics.bestDay, { decimals: 0, signed: true }),
      tone: "profit",
    },
    {
      label: "Worst day",
      value: formatCurrency(metrics.worstDay, { decimals: 0, signed: true }),
      tone: "loss",
    },
    {
      label: "Trades / day",
      value: formatNumber(metrics.avgTradesPerDay, { decimals: 1 }),
      hint: "Average trades per active session. Sharp jumps in this number usually mark overtrading.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {dayStats.map((s) => (
          <MiniStat key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden print:break-inside-avoid">
          <CardHeader
            title={monthTitle(month)}
            subtitle={
              grid.tradingDays
                ? `${formatCurrency(grid.pnl, { decimals: 0, signed: true })} across ${pluralize(grid.tradingDays, "session")} · ${pluralize(grid.count, "trade")}`
                : "No trades recorded this month"
            }
            icon={CalendarDays}
            actions={
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={ChevronLeft}
                  aria-label="Previous month"
                  disabled={!canPrev}
                  onClick={() => setMonth((m) => shiftMonth(m, -1))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={ChevronRight}
                  aria-label="Next month"
                  disabled={!canNext}
                  onClick={() => setMonth((m) => shiftMonth(m, 1))}
                />
                {monthKeys.length > 0 && month !== latestMonth && (
                  <Button variant="subtle" size="xs" onClick={() => setMonth(latestMonth)}>
                    Latest
                  </Button>
                )}
              </div>
            }
          />
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:grid-cols-8">
              {WEEK_HEADERS.map((h) => (
                <span
                  key={h}
                  className="pb-1 text-center text-2xs font-semibold uppercase tracking-wider text-content-subtle"
                >
                  {h}
                </span>
              ))}
              <span className="hidden pb-1 text-center text-2xs font-semibold uppercase tracking-wider text-content-subtle sm:block">
                Week
              </span>

              {grid.weeks.map((week) => (
                <WeekRow
                  key={week.key}
                  week={week}
                  maxAbs={grid.maxAbs}
                  selectedDay={selectedDay}
                  onSelect={setSelectedDay}
                />
              ))}
            </div>
          </div>
        </Card>

        <DayPanel
          dayKey={selectedDay}
          day={selected}
          onClose={() => setSelectedDay(null)}
          monthLabel={monthTitle(month)}
        />
      </div>

      <Card className="overflow-hidden print:break-inside-avoid">
        <CardHeader
          title={`${year} at a glance`}
          subtitle="Every session in the year, coloured by net P&L"
          actions={
            <div className="flex items-center gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={cn(
                    "rounded-md px-2 py-1 font-mono text-2xs tnum transition-colors",
                    y === year
                      ? "bg-brand-soft text-brand"
                      : "text-content-subtle hover:bg-surface-hover hover:text-content"
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          }
        />
        <div className="overflow-x-auto p-4 thin-scrollbar">
          <div className="inline-flex flex-col gap-1">
            <div className="flex gap-1">
              {heat.weeks.map((week) => (
                <div key={week.key} className="flex flex-col gap-1">
                  {week.cells.map((cell) => (
                    <YearCell key={cell.key} cell={cell} maxAbs={heat.maxAbs} onSelect={setSelectedDay} />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex gap-1 pt-0.5">
              {heat.weeks.map((week, i) => {
                const showLabel =
                  i === 0 ? week.cells[0].month === 0 : week.month !== heat.weeks[i - 1].month;
                return (
                  <span
                    key={`label-${week.key}`}
                    className="w-2.5 shrink-0 text-2xs text-content-subtle"
                  >
                    {showLabel && week.cells[0].inYear
                      ? new Date(year, week.month, 1).toLocaleDateString("en-GB", { month: "narrow" })
                      : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {bounds?.start && (
        <p className="text-2xs text-content-subtle">
          Dataset spans {formatDate(bounds.start, "medium")} → {formatDate(bounds.end, "medium")}.
        </p>
      )}
    </div>
  );
}

function WeekRow({ week, maxAbs, selectedDay, onSelect }) {
  return (
    <>
      {week.cells.map((cell) =>
        cell.blank ? (
          <span
            key={cell.key}
            className="h-[62px] rounded-lg border border-dashed border-line-subtle sm:h-[76px]"
            aria-hidden
          />
        ) : (
          <button
            key={cell.key}
            type="button"
            onClick={() => onSelect(cell.hasTrades ? cell.key : null)}
            aria-label={`${formatDate(cell.key, "long")}${cell.hasTrades ? `, ${formatCurrency(cell.pnl, { decimals: 0, signed: true })}` : ", no trades"}`}
            className={cn(
              "flex h-[62px] flex-col items-start justify-between rounded-lg border p-1.5 text-left transition-all duration-150 sm:h-[76px] sm:p-2",
              cell.hasTrades
                ? "border-line hover:border-line-strong hover:shadow-sm"
                : "cursor-default border-line-subtle bg-surface-sunken/50",
              selectedDay === cell.key && "ring-2 ring-brand ring-offset-1 ring-offset-canvas"
            )}
            style={{ background: dayTint(cell.pnl, maxAbs) }}
          >
            <span
              className={cn(
                "font-mono text-2xs tnum",
                cell.hasTrades ? "text-content-muted" : "text-content-subtle"
              )}
            >
              {cell.dayOfMonth}
            </span>
            {cell.hasTrades && (
              <span className="w-full">
                <span
                  className={cn(
                    "block truncate font-mono text-2xs font-semibold tnum sm:text-xs",
                    cell.pnl > 0 ? "text-profit" : cell.pnl < 0 ? "text-loss" : "text-content-muted"
                  )}
                >
                  {formatCurrency(cell.pnl, { decimals: 0, signed: true, compact: true })}
                </span>
                <span className="hidden truncate text-2xs text-content-subtle sm:block">
                  {cell.count}t · {Math.round(cell.winRate ?? 0)}%
                </span>
              </span>
            )}
          </button>
        )
      )}
      <span
        className={cn(
          "hidden h-[76px] flex-col items-end justify-between rounded-lg border border-line bg-surface-sunken p-2 sm:flex",
          week.count === 0 && "opacity-40"
        )}
      >
        <span className="text-2xs text-content-subtle">
          {week.days ? pluralize(week.days, "day") : "—"}
        </span>
        <span
          className={cn(
            "font-mono text-2xs font-semibold tnum",
            week.pnl > 0 ? "text-profit" : week.pnl < 0 ? "text-loss" : "text-content-muted"
          )}
        >
          {week.count ? formatCurrency(week.pnl, { decimals: 0, signed: true, compact: true }) : ""}
        </span>
      </span>
    </>
  );
}

function YearCell({ cell, maxAbs, onSelect }) {
  const style = cell.hasTrades ? { background: dayTint(cell.pnl, maxAbs) } : undefined;
  const base = "h-2.5 w-2.5 shrink-0 rounded-[3px] border border-line-subtle";

  if (!cell.inYear) return <span className={`${base} opacity-0`} aria-hidden />;
  if (!cell.hasTrades) return <span className={`${base} bg-surface-sunken`} aria-hidden />;

  return (
    <Tooltip
      content={
        <span className="font-mono tnum">
          {formatDate(cell.key, "medium")} · {formatCurrency(cell.pnl, { decimals: 0, signed: true })} ·{" "}
          {pluralize(cell.count, "trade")}
        </span>
      }
    >
      <button
        type="button"
        onClick={() => onSelect(cell.key)}
        aria-label={formatDate(cell.key, "medium")}
        className={`${base} cursor-pointer transition-transform hover:scale-125`}
        style={style}
      />
    </Tooltip>
  );
}

function DayPanel({ dayKey, day, onClose, monthLabel }) {
  if (!day) {
    return (
      <Card inset className="flex flex-col items-center justify-center p-6 text-center">
        <CalendarDays size={20} className="mb-3 text-content-subtle" aria-hidden />
        <p className="text-sm font-semibold text-content">Pick a session</p>
        <p className="mt-1 text-xs leading-relaxed text-content-muted">
          Click any coloured day in {monthLabel} — or a cell in the year strip — to see every trade
          you took that session.
        </p>
      </Card>
    );
  }

  const trades = [...(day.trades ?? [])].sort(
    (a, b) => (a.entryMinutes ?? 0) - (b.entryMinutes ?? 0)
  );

  return (
    <Card className="flex flex-col overflow-hidden print:break-inside-avoid">
      <CardHeader
        title={formatDate(dayKey, "long")}
        subtitle={`${pluralize(day.count, "trade")} · ${formatPercent(day.winRate, { decimals: 0 })} win rate`}
        actions={
          <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={onClose} />
        }
      />
      <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-xs text-content-muted">Session P&L</span>
        <span
          className={cn(
            "stat-number text-xl",
            day.pnl > 0 ? "text-profit" : day.pnl < 0 ? "text-loss" : "text-content"
          )}
        >
          {formatCurrency(day.pnl, { decimals: 0, signed: true })}
        </span>
      </div>
      <div className="max-h-[26rem] divide-y divide-line-subtle overflow-y-auto thin-scrollbar">
        {trades.map((t) => (
          <div key={t.id ?? t.tradeNumber} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-xs font-medium text-content">
                  {t.symbol ?? `Trade #${t.tradeNumber}`}
                </span>
                {t.side && (
                  <Badge tone={t.side === "long" ? "profit" : "loss"} size="xs">
                    {t.side}
                  </Badge>
                )}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs font-semibold tnum",
                  t.pnl > 0 ? "text-profit" : t.pnl < 0 ? "text-loss" : "text-content-muted"
                )}
              >
                {formatCurrency(t.pnl, { decimals: 0, signed: true })}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-content-subtle">
              {t.entryTime && <span className="font-mono tnum">{formatTime(t.entryTime)}</span>}
              {t.setup && <span className="truncate">{t.setup}</span>}
              {t.rMultiple !== null && <span className="font-mono tnum">{formatR(t.rMultiple)}</span>}
              {t.durationMin !== null && <span>{formatDuration(t.durationMin)}</span>}
              {t.grade && <span>Grade {t.grade}</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default CalendarTab;

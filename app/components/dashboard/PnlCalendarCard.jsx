"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Sheet,
  Skeleton,
  Tooltip,
  cn,
} from "../ui";
import { compactNumber, formatCurrency, formatDate, formatPercent, pluralize } from "../../lib/format";
import { heatTint } from "./helpers";
import { useNow } from "./hooks";
import TradeRow from "./TradeRow";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 85th percentile of |P&L| so a single outlier day doesn't flatten the scale. */
function tintScale(values) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.85 * (sorted.length - 1));
  return Math.max(sorted[idx], 1);
}

function buildMonth(cursor, days) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const weekCount = Math.ceil((leading + daysInMonth) / 7);

  const weeks = [];
  const monthValues = [];

  for (let w = 0; w < weekCount; w += 1) {
    const cells = [];
    let weekPnl = 0;
    let weekTrades = 0;
    let weekDays = 0;

    for (let d = 0; d < 7; d += 1) {
      const date = new Date(year, month, 1 - leading + w * 7 + d);
      const key = keyOf(date);
      const day = days[key];
      const inMonth = date.getMonth() === month;

      if (inMonth && day) {
        monthValues.push(Math.abs(day.pnl));
        weekPnl += day.pnl;
        weekTrades += day.count;
        weekDays += 1;
      }

      cells.push({ key, date, day: day ?? null, inMonth });
    }

    weeks.push({ cells, pnl: weekPnl, trades: weekTrades, tradingDays: weekDays });
  }

  const monthDays = weeks.flatMap((w) => w.cells).filter((c) => c.inMonth && c.day);
  const summary = monthDays.reduce(
    (acc, cell) => {
      acc.pnl += cell.day.pnl;
      acc.trades += cell.day.count;
      acc.wins += cell.day.wins;
      acc.losses += cell.day.losses;
      acc.green += cell.day.pnl > 0 ? 1 : 0;
      acc.red += cell.day.pnl < 0 ? 1 : 0;
      if (cell.day.pnl > acc.best.pnl) acc.best = { pnl: cell.day.pnl, key: cell.key };
      if (cell.day.pnl < acc.worst.pnl) acc.worst = { pnl: cell.day.pnl, key: cell.key };
      return acc;
    },
    {
      pnl: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      green: 0,
      red: 0,
      days: monthDays.length,
      best: { pnl: 0, key: null },
      worst: { pnl: 0, key: null },
    }
  );

  return { weeks, scale: tintScale(monthValues), summary };
}

function DayCell({ cell, scale, today, onSelect }) {
  const { day, date, inMonth, key } = cell;
  const dayNumber = date.getDate();
  const isToday = key === today;

  if (!inMonth) {
    return (
      <div
        className="min-h-[3rem] rounded-lg border border-transparent px-1.5 py-1 sm:min-h-[4.25rem]"
        aria-hidden
      >
        <span className="font-mono text-2xs tnum text-content-subtle/40">{dayNumber}</span>
      </div>
    );
  }

  if (!day) {
    return (
      <div
        className={cn(
          "min-h-[3rem] rounded-lg border border-line-subtle bg-surface-sunken/60 px-1.5 py-1 sm:min-h-[4.25rem]",
          isToday && "ring-1 ring-brand/60"
        )}
      >
        <span className={cn("font-mono text-2xs tnum", isToday ? "text-brand" : "text-content-subtle")}>
          {dayNumber}
        </span>
      </div>
    );
  }

  const positive = day.pnl > 0;
  const flat = day.pnl === 0;

  return (
    <Tooltip
      content={
        <span className="block">
          <span className="block font-medium">{formatDate(key, "long")}</span>
          <span className="mt-0.5 block text-content-muted">
            {formatCurrency(day.pnl, { decimals: 0, signed: true })} · {pluralize(day.count, "trade")} ·{" "}
            {formatPercent(day.winRate, { decimals: 0 })} win rate
          </span>
        </span>
      }
    >
      <button
        type="button"
        onClick={() => onSelect(cell)}
        className={cn(
          "group flex min-h-[3rem] w-full flex-col justify-between rounded-lg border px-1.5 py-1 text-left transition-all duration-150 ease-out-expo sm:min-h-[4.25rem] sm:px-2 sm:py-1.5",
          heatTint(day.pnl, scale),
          positive ? "border-profit/25" : flat ? "border-line" : "border-loss/25",
          "hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60",
          isToday && "ring-1 ring-brand/70"
        )}
      >
        <span className="flex w-full items-center justify-between gap-1">
          <span className={cn("font-mono text-2xs tnum", isToday ? "text-brand" : "text-content-subtle")}>
            {dayNumber}
          </span>
          <span
            className={cn(
              "hidden font-mono text-2xs tnum text-content-subtle sm:inline",
              day.count > 0 && "opacity-80"
            )}
          >
            {day.count}
          </span>
        </span>

        <span className="w-full">
          <span
            className={cn(
              "block truncate font-mono text-2xs font-semibold tnum sm:text-xs",
              positive ? "text-profit" : flat ? "text-content-muted" : "text-loss"
            )}
          >
            {positive ? "+" : day.pnl < 0 ? "-" : ""}
            {compactNumber(Math.abs(day.pnl))}
          </span>
          <span className="hidden text-2xs text-content-subtle sm:block">
            {formatPercent(day.winRate, { decimals: 0 })}
          </span>
        </span>
      </button>
    </Tooltip>
  );
}

export default function PnlCalendarCard({ days = {}, loading }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(null);

  const now = useNow(60_000);
  const today = useMemo(() => keyOf(now ?? new Date()), [now]);
  const { weeks, scale, summary } = useMemo(() => buildMonth(cursor, days), [cursor, days]);

  const shift = (delta) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const isCurrentMonth = cursor.getFullYear() === new Date().getFullYear() && cursor.getMonth() === new Date().getMonth();
  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const selectedTrades = selected?.day?.trades ?? [];

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={CalendarDays}
        title="Daily P&L"
        subtitle={monthLabel}
        actions={
          <div className="flex items-center gap-1">
            {!isCurrentMonth && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              >
                Today
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={ChevronLeft}
              aria-label="Previous month"
              onClick={() => shift(-1)}
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={ChevronRight}
              aria-label="Next month"
              onClick={() => shift(1)}
            />
          </div>
        }
      />

      <CardBody className="flex-1 p-3 sm:p-4">
        {loading ? (
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: 40 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[3rem] sm:min-h-[4.25rem]" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-8 gap-1.5">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="text-center text-2xs font-semibold uppercase tracking-wider text-content-subtle"
                >
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{label[0]}</span>
                </div>
              ))}
              <div className="text-center text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                <span className="hidden sm:inline">Week</span>
                <span className="sm:hidden">W</span>
              </div>
            </div>

            <div className="space-y-1.5">
              {weeks.map((week, i) => (
                <div key={i} className="grid grid-cols-8 gap-1.5">
                  {week.cells.map((cell) => (
                    <DayCell
                      key={cell.key}
                      cell={cell}
                      scale={scale}
                      today={today}
                      onSelect={setSelected}
                    />
                  ))}
                  <div
                    className={cn(
                      "flex min-h-[3rem] flex-col justify-center rounded-lg border border-line bg-surface-raised px-1.5 py-1 text-center sm:min-h-[4.25rem]",
                      !week.tradingDays && "opacity-45"
                    )}
                  >
                    <span
                      className={cn(
                        "block truncate font-mono text-2xs font-semibold tnum sm:text-xs",
                        week.pnl > 0 ? "text-profit" : week.pnl < 0 ? "text-loss" : "text-content-subtle"
                      )}
                    >
                      {week.tradingDays
                        ? `${week.pnl > 0 ? "+" : week.pnl < 0 ? "-" : ""}${compactNumber(Math.abs(week.pnl))}`
                        : "—"}
                    </span>
                    <span className="mt-0.5 hidden text-2xs text-content-subtle sm:block">
                      {week.tradingDays ? pluralize(week.tradingDays, "day") : "no trades"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>

      <CardFooter className="flex-wrap gap-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-content-subtle">
          <span>
            Month{" "}
            <span
              className={cn(
                "font-mono font-semibold tnum",
                summary.pnl > 0 ? "text-profit" : summary.pnl < 0 ? "text-loss" : "text-content-muted"
              )}
            >
              {formatCurrency(summary.pnl, { decimals: 0, signed: true })}
            </span>
          </span>
          <span className="hidden sm:inline">
            {pluralize(summary.trades, "trade")} · {pluralize(summary.days, "session")}
          </span>
          <span>
            <span className="font-mono tnum text-profit">{summary.green}</span> green ·{" "}
            <span className="font-mono tnum text-loss">{summary.red}</span> red
          </span>
        </div>

        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="text-2xs text-content-subtle">Loss</span>
          <span className="h-2.5 w-4 rounded-sm bg-loss/30" />
          <span className="h-2.5 w-4 rounded-sm bg-loss/[0.14]" />
          <span className="h-2.5 w-4 rounded-sm bg-surface-sunken ring-1 ring-inset ring-line" />
          <span className="h-2.5 w-4 rounded-sm bg-profit/[0.14]" />
          <span className="h-2.5 w-4 rounded-sm bg-profit/30" />
          <span className="text-2xs text-content-subtle">Profit</span>
        </div>
      </CardFooter>

      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? formatDate(selected.key, "long") : ""}
        description={
          selected?.day
            ? `${formatCurrency(selected.day.pnl, { decimals: 0, signed: true })} · ${pluralize(
                selected.day.count,
                "trade"
              )} · ${formatPercent(selected.day.winRate, { decimals: 0 })} win rate`
            : ""
        }
        footer={
          <Button as={Link} href="/trades" variant="secondary" size="sm">
            Open trade log
          </Button>
        }
      >
        {selected?.day && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                { label: "Net", value: formatCurrency(selected.day.pnl, { decimals: 0, signed: true }) },
                { label: "Wins", value: `${selected.day.wins}/${selected.day.count}` },
                {
                  label: "R total",
                  value: selected.day.rTotal
                    ? `${selected.day.rTotal > 0 ? "+" : ""}${selected.day.rTotal.toFixed(2)}R`
                    : "—",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-line bg-surface-sunken px-3 py-2">
                  <p className="text-2xs text-content-subtle">{item.label}</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tnum text-content">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="-mx-2.5 space-y-0.5">
              {[...selectedTrades]
                .sort((a, b) => (a.entryMinutes ?? 0) - (b.entryMinutes ?? 0))
                .map((trade) => (
                  <TradeRow key={trade.id ?? trade.tradeNumber} trade={trade} showDate={false} />
                ))}
            </div>

            {selected.day.count > 0 && (
              <p className="mt-4 flex items-center gap-2 text-2xs text-content-subtle">
                <Badge tone={selected.day.pnl >= 0 ? "profit" : "loss"} size="xs">
                  {selected.day.pnl >= 0 ? "Green day" : "Red day"}
                </Badge>
                Click any trade to open its full journal entry.
              </p>
            )}
          </>
        )}
      </Sheet>
    </Card>
  );
}

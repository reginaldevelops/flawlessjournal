"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CalendarCheck,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  Input,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Popover,
  Skeleton,
  Tooltip,
  cn,
} from "../ui";
import { formatCurrency, formatDate, formatPercent, parseDate, pluralize } from "../../lib/format";
import {
  WEEKDAY_LABELS,
  compactSigned,
  heatStyle,
  monthMatrix,
  shiftKey,
  tintScale,
} from "./helpers";

const GRID = "grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-[3px]";

function DayCell({ cell, stats, entryCount, isSelected, isToday, scale, onSelect, register, onKeyDown }) {
  const pnl = stats?.pnl ?? null;
  const tint = cell.inMonth ? heatStyle(pnl, scale) : undefined;

  const tooltip = (
    <span className="block">
      <span className="block font-medium">{formatDate(cell.key, "long")}</span>
      <span className="mt-0.5 block text-content-muted">
        {stats
          ? `${formatCurrency(stats.pnl, { decimals: 0, signed: true })} · ${pluralize(
              stats.count,
              "trade"
            )} · ${formatPercent(stats.winRate, { decimals: 0 })} win rate`
          : "No trades"}
      </span>
      <span className="mt-0.5 block text-content-subtle">
        {entryCount ? pluralize(entryCount, "journal entry", "journal entries") : "No journal entry"}
      </span>
    </span>
  );

  return (
    <Tooltip content={tooltip} delay={180}>
      <button
        type="button"
        ref={(el) => register(cell.key, el)}
        role="gridcell"
        aria-selected={isSelected}
        aria-current={isToday ? "date" : undefined}
        aria-label={`${formatDate(cell.key, "long")}, ${
          entryCount ? pluralize(entryCount, "entry", "entries") : "no entries"
        }${stats ? `, ${formatCurrency(stats.pnl, { decimals: 0, signed: true })}` : ""}`}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => onSelect(cell.key)}
        onKeyDown={onKeyDown}
        style={tint}
        className={cn(
          "group relative flex h-11 flex-col justify-between rounded-md border px-1 py-[3px] text-left",
          "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out-expo",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70",
          cell.inMonth
            ? "border-line-subtle hover:border-line-strong hover:shadow-sm"
            : "border-transparent opacity-35",
          cell.inMonth && !tint && (cell.isWeekend ? "bg-surface-sunken/70" : "bg-surface-raised"),
          isSelected && "ring-2 ring-brand ring-offset-1 ring-offset-surface"
        )}
      >
        <span className="flex items-start justify-between gap-0.5">
          <span
            className={cn(
              "font-mono text-2xs tnum leading-none",
              isToday
                ? "font-bold text-brand"
                : cell.isWeekend
                  ? "text-content-subtle"
                  : "text-content-muted"
            )}
          >
            {cell.day}
          </span>
          {entryCount > 0 && (
            <span className="flex h-[13px] min-w-[13px] items-center justify-center rounded-[4px] bg-brand/85 px-[3px] font-mono text-[9px] font-bold leading-none tnum text-white">
              {entryCount}
            </span>
          )}
        </span>

        <span
          className={cn(
            "block truncate font-mono text-[10px] font-semibold leading-none tnum",
            !stats
              ? "text-content-subtle/45"
              : stats.pnl > 0
                ? "text-profit"
                : stats.pnl < 0
                  ? "text-loss"
                  : "text-content-muted"
          )}
        >
          {stats ? compactSigned(stats.pnl) : "·"}
        </span>

        {isToday && (
          <span
            className="pointer-events-none absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-brand"
            aria-hidden
          />
        )}
      </button>
    </Tooltip>
  );
}

export default function JournalCalendar({
  year,
  month,
  onMonthChange,
  selected,
  onSelect,
  today,
  entryCountByDay = {},
  dayStats = {},
  lastSessionKey,
  loading = false,
}) {
  const cellRefs = useRef(new Map());
  const wantFocus = useRef(false);

  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);

  const scale = useMemo(() => {
    const values = weeks
      .flatMap((w) => w.cells)
      .filter((c) => c.inMonth)
      .map((c) => dayStats[c.key]?.pnl)
      .filter((v) => v != null);
    return tintScale(values);
  }, [weeks, dayStats]);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    cellRefs.current.get(selected)?.focus();
  }, [selected, year, month]);

  const register = (key, el) => {
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  const move = (days) => {
    wantFocus.current = true;
    onSelect(shiftKey(selected, days));
  };

  const onKeyDown = (event) => {
    const weekdayIndex = ((parseDate(selected)?.getDay() ?? 1) + 6) % 7;
    const handlers = {
      ArrowLeft: () => move(-1),
      ArrowRight: () => move(1),
      ArrowUp: () => move(-7),
      ArrowDown: () => move(7),
      Home: () => move(-weekdayIndex),
      End: () => move(6 - weekdayIndex),
      PageUp: () => onMonthChange(month === 0 ? year - 1 : year, (month + 11) % 12),
      PageDown: () => onMonthChange(month === 11 ? year + 1 : year, (month + 1) % 12),
    };
    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const monthSummary = useMemo(() => {
    let pnl = 0;
    let entries = 0;
    let sessions = 0;
    for (const cell of weeks.flatMap((w) => w.cells)) {
      if (!cell.inMonth) continue;
      const stats = dayStats[cell.key];
      if (stats) {
        pnl += stats.pnl;
        sessions += 1;
      }
      entries += entryCountByDay[cell.key] ?? 0;
    }
    return { pnl, entries, sessions };
  }, [weeks, dayStats, entryCountByDay]);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        compact
        title={monthLabel}
        subtitle={`${pluralize(monthSummary.entries, "entry", "entries")} · ${pluralize(
          monthSummary.sessions,
          "session"
        )}`}
        className="pr-2.5"
        actions={
          <div className="flex items-center gap-0.5">
            <Popover
              align="end"
              width="w-60"
              trigger={
                <Button
                  variant="ghost"
                  size="xs"
                  iconOnly
                  icon={CalendarSearch}
                  aria-label="Jump to a date"
                />
              }
            >
              {(close) => (
                <div className="space-y-1 p-1">
                  <MenuLabel>Jump to</MenuLabel>
                  <div className="px-1.5 pb-1">
                    <Field label="Pick a date">
                      {(id) => (
                        <Input
                          id={id}
                          type="date"
                          size="sm"
                          value={selected}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            onSelect(e.target.value);
                            close();
                          }}
                        />
                      )}
                    </Field>
                  </div>
                  <MenuSeparator />
                  <MenuItem
                    icon={CalendarCheck}
                    onClick={() => {
                      onSelect(today);
                      close();
                    }}
                  >
                    Today
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      onSelect(shiftKey(today, -1));
                      close();
                    }}
                  >
                    Yesterday
                  </MenuItem>
                  <MenuItem
                    disabled={!lastSessionKey}
                    onClick={() => {
                      if (lastSessionKey) onSelect(lastSessionKey);
                      close();
                    }}
                  >
                    {lastSessionKey ? `Last session · ${formatDate(lastSessionKey, "short")}` : "Last session"}
                  </MenuItem>
                </div>
              )}
            </Popover>
            {!isCurrentMonth && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onMonthChange(now.getFullYear(), now.getMonth())}
              >
                Today
              </Button>
            )}
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              icon={ChevronLeft}
              aria-label="Previous month"
              onClick={() => onMonthChange(month === 0 ? year - 1 : year, (month + 11) % 12)}
            />
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              icon={ChevronRight}
              aria-label="Next month"
              onClick={() => onMonthChange(month === 11 ? year + 1 : year, (month + 1) % 12)}
            />
          </div>
        }
      />

      <CardBody className="p-3">
        <div className={cn(GRID, "mb-1.5")} aria-hidden>
          <span className="text-center text-[9px] font-semibold uppercase tracking-wider text-content-subtle/70">
            Wk
          </span>
          {WEEKDAY_LABELS.map((label, i) => (
            <span
              key={label}
              className={cn(
                "text-center text-2xs font-semibold uppercase tracking-wider",
                i >= 5 ? "text-content-subtle/60" : "text-content-subtle"
              )}
            >
              {label.slice(0, 2)}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="space-y-[3px]">
            {Array.from({ length: 6 }).map((_, w) => (
              <div key={w} className={GRID}>
                <Skeleton className="h-11 rounded-md opacity-50" />
                {Array.from({ length: 7 }).map((__, d) => (
                  <Skeleton key={d} className="h-11 rounded-md" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div role="grid" aria-label={`Journal calendar, ${monthLabel}`} className="space-y-[3px]">
            {weeks.map((week) => (
              <div key={`${week.week}-${week.cells[0].key}`} role="row" className={GRID}>
                <span
                  role="rowheader"
                  className="flex items-center justify-center font-mono text-[9px] tnum text-content-subtle/60"
                >
                  {week.week}
                </span>
                {week.cells.map((cell) => (
                  <DayCell
                    key={cell.key}
                    cell={cell}
                    stats={dayStats[cell.key] ?? null}
                    entryCount={entryCountByDay[cell.key] ?? 0}
                    isSelected={cell.key === selected}
                    isToday={cell.key === today}
                    scale={scale}
                    onSelect={onSelect}
                    register={register}
                    onKeyDown={onKeyDown}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </CardBody>

      <CardFooter className="flex-col items-stretch gap-2 bg-surface-sunken/40 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-2xs text-content-subtle">
            <span className="flex h-[13px] min-w-[13px] items-center justify-center rounded-[4px] bg-brand/85 px-[3px] font-mono text-[9px] font-bold leading-none text-white">
              2
            </span>
            entries
          </span>
          <span className="flex items-center gap-1.5" aria-hidden>
            <span className="text-2xs text-content-subtle">Loss</span>
            <span className="h-2.5 w-3.5 rounded-sm" style={{ backgroundColor: "rgb(var(--loss) / 0.34)" }} />
            <span className="h-2.5 w-3.5 rounded-sm" style={{ backgroundColor: "rgb(var(--loss) / 0.14)" }} />
            <span className="h-2.5 w-3.5 rounded-sm bg-surface-raised ring-1 ring-inset ring-line" />
            <span className="h-2.5 w-3.5 rounded-sm" style={{ backgroundColor: "rgb(var(--profit) / 0.14)" }} />
            <span className="h-2.5 w-3.5 rounded-sm" style={{ backgroundColor: "rgb(var(--profit) / 0.34)" }} />
            <span className="text-2xs text-content-subtle">Profit</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-2xs text-content-subtle">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-sm bg-surface-raised ring-2 ring-brand" aria-hidden />
              selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-sm bg-surface-raised" aria-hidden>
                <span className="block h-full w-full rounded-sm border-b-2 border-brand" />
              </span>
              today
            </span>
          </span>
          <span>
            Month{" "}
            <span
              className={cn(
                "font-mono font-semibold tnum",
                monthSummary.pnl > 0
                  ? "text-profit"
                  : monthSummary.pnl < 0
                    ? "text-loss"
                    : "text-content-muted"
              )}
            >
              {formatCurrency(monthSummary.pnl, { decimals: 0, signed: true, compact: true })}
            </span>
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}

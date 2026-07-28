"use client";

import { useMemo } from "react";
import { CalendarRange, CloudOff, Filter, RefreshCw, SlidersHorizontal } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  EmptyState,
  Popover,
  Segmented,
  Skeleton,
  cn,
} from "../ui";
import { formatDate, formatRelative } from "../../lib/format";
import { usePersistentJson } from "./hooks";
import { eventLocalDateKey, eventLocalTime, eventTimestamp, IMPACT_META, MAJOR_CURRENCIES } from "./helpers";

const IMPACT_ORDER = ["high", "medium", "low", "holiday"];
const DEFAULT_CURRENCIES = ["USD", "EUR", "GBP", "JPY"];
const DEFAULT_IMPACTS = ["high", "medium"];

const WEEK_OPTIONS = [
  { value: "this", label: "This week" },
  { value: "next", label: "Next week" },
];

function ValueChip({ label, value }) {
  if (!value) return null;
  return (
    <span className="whitespace-nowrap rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-2xs tnum text-content-muted">
      {label} {value}
    </span>
  );
}

function EventRow({ event, past }) {
  const meta = IMPACT_META[event.impact] ?? IMPACT_META.low;
  const time = eventLocalTime(event);

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-hover",
        past && "opacity-55"
      )}
    >
      <span className="w-9 shrink-0 pt-0.5 font-mono text-2xs tnum text-content-muted">
        {time ?? "—"}
      </span>
      <span
        className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)}
        title={`${meta.label} impact`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Badge tone="outline" size="xs" className="shrink-0 font-mono">
            {event.currency}
          </Badge>
          <span className="truncate text-xs text-content">{event.title}</span>
        </span>
        {(event.actual || event.forecast || event.previous) && (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <ValueChip label="A" value={event.actual} />
            <ValueChip label="F" value={event.forecast} />
            <ValueChip label="P" value={event.previous} />
          </span>
        )}
      </span>
      {event.impact === "high" && (
        <Badge tone="loss" size="xs" className="mt-0.5 shrink-0">
          High
        </Badge>
      )}
    </li>
  );
}

export default function EconomicCalendarCard({ calendar, week, onWeekChange, now }) {
  const [currencies, setCurrencies] = usePersistentJson(
    "flawless.dashboard.calendar.currencies",
    DEFAULT_CURRENCIES
  );
  const [impacts, setImpacts] = usePersistentJson("flawless.dashboard.calendar.impacts", DEFAULT_IMPACTS);

  const todayKey = useMemo(() => {
    if (!now) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, [now]);

  const groups = useMemo(() => {
    const filtered = calendar.events.filter(
      (event) => currencies.includes(event.currency) && impacts.includes(event.impact)
    );
    const byDay = new Map();
    for (const event of filtered) {
      const key = eventLocalDateKey(event) ?? "unscheduled";
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(event);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, events]) => ({
        key,
        events: events.sort((a, b) => (eventTimestamp(a) ?? 0) - (eventTimestamp(b) ?? 0)),
      }));
  }, [calendar.events, currencies, impacts]);

  const filtersActive =
    currencies.length !== DEFAULT_CURRENCIES.length ||
    impacts.length !== DEFAULT_IMPACTS.length ||
    !DEFAULT_CURRENCIES.every((c) => currencies.includes(c)) ||
    !DEFAULT_IMPACTS.every((i) => impacts.includes(i));

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const offline = calendar.source === "unavailable";
  const totalShown = groups.reduce((sum, g) => sum + g.events.length, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={CalendarRange}
        title="Economic calendar"
        subtitle={
          calendar.loading
            ? "Loading releases…"
            : offline
              ? "Feed unavailable"
              : `${totalShown} release${totalShown === 1 ? "" : "s"} · ForexFactory${
                  calendar.fetchedAt ? ` · updated ${formatRelative(calendar.fetchedAt)}` : ""
                }`
        }
        actions={
          <div className="flex items-center gap-1.5">
            <Popover
              align="end"
              width="w-60"
              trigger={
                <Button
                  variant={filtersActive ? "secondary" : "ghost"}
                  size="sm"
                  iconOnly
                  icon={SlidersHorizontal}
                  aria-label="Calendar filters"
                />
              }
            >
              <div className="p-2">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                  Impact
                </p>
                <div className="mb-3 grid grid-cols-2 gap-1">
                  {IMPACT_ORDER.map((impact) => (
                    <label
                      key={impact}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-content-muted hover:bg-surface-hover"
                    >
                      <Checkbox
                        checked={impacts.includes(impact)}
                        onChange={() => toggle(impacts, setImpacts, impact)}
                      />
                      <span className={cn("h-1.5 w-1.5 rounded-full", IMPACT_META[impact].dot)} aria-hidden />
                      {IMPACT_META[impact].label}
                    </label>
                  ))}
                </div>

                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                    Currencies
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrencies(currencies.length === MAJOR_CURRENCIES.length ? [] : [...MAJOR_CURRENCIES])
                    }
                    className="text-2xs font-medium text-brand hover:underline"
                  >
                    {currencies.length === MAJOR_CURRENCIES.length ? "Clear" : "All"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MAJOR_CURRENCIES.map((code) => (
                    <label
                      key={code}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 font-mono text-2xs text-content-muted hover:bg-surface-hover"
                    >
                      <Checkbox
                        checked={currencies.includes(code)}
                        onChange={() => toggle(currencies, setCurrencies, code)}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </div>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={RefreshCw}
              aria-label="Refresh calendar"
              onClick={calendar.reload}
              className={calendar.loading ? "pointer-events-none opacity-60" : undefined}
            />
          </div>
        }
      />

      <div className="border-b border-line px-4 py-2.5 sm:px-5">
        <Segmented options={WEEK_OPTIONS} value={week} onChange={onWeekChange} size="sm" />
      </div>

      <CardBody className="flex-1 p-3 sm:p-4">
        {calendar.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : offline ? (
          <EmptyState
            icon={CloudOff}
            title="Calendar feed is offline"
            description={
              week === "next"
                ? "Next week's schedule has not been published yet. It usually appears late in the current week."
                : "The release schedule could not be reached. Your trades and stats are unaffected — try again in a moment."
            }
            compact
            action={
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={calendar.reload} className="mt-4">
                Try again
              </Button>
            }
          />
        ) : !groups.length ? (
          <EmptyState
            icon={Filter}
            title="No releases match your filters"
            description="Widen the impact or currency selection to see more of the week."
            compact
            action={
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setCurrencies([...DEFAULT_CURRENCIES]);
                  setImpacts([...DEFAULT_IMPACTS]);
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1 thin-scrollbar">
            {groups.map((group) => {
              const isToday = group.key === todayKey;
              return (
                <section key={group.key}>
                  <div className="mb-1 flex items-center gap-2 px-2">
                    <h4
                      className={cn(
                        "text-2xs font-semibold uppercase tracking-wider",
                        isToday ? "text-brand" : "text-content-subtle"
                      )}
                    >
                      {isToday ? "Today" : formatDate(group.key, "long")}
                    </h4>
                    <span className="h-px flex-1 bg-line" aria-hidden />
                    <span className="font-mono text-2xs tnum text-content-subtle">{group.events.length}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {group.events.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        past={Boolean(now && eventTimestamp(event) && eventTimestamp(event) < now.getTime())}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </CardBody>

      <CardFooter className="px-4 py-2.5">
        <p className="text-2xs text-content-subtle">
          {offline
            ? "Times will show in your local timezone once the feed returns."
            : "Times shown in your local timezone."}
        </p>
        {calendar.stale && (
          <Badge tone="warn" size="xs">
            Cached
          </Badge>
        )}
      </CardFooter>
    </Card>
  );
}

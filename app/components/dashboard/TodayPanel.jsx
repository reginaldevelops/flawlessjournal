"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Clock, Pencil, ShieldAlert } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Popover,
  Skeleton,
  Tooltip,
  cn,
} from "../ui";
import { formatCurrency, formatDate, formatPercent, pluralize } from "../../lib/format";
import {
  eventLocalTime,
  minutesToClock,
  sessionTimeline,
  shortDuration,
  IMPACT_META,
  MARKET_SESSIONS,
} from "./helpers";

const ROW_H = 22;
const ROW_GAP = 6;

const BAR_TONES = {
  info: { open: "bg-info/35 border-info/50 text-info-fg", closed: "bg-info/[0.12] border-info/25 text-content-muted" },
  brand: { open: "bg-brand/35 border-brand/50 text-content", closed: "bg-brand/[0.12] border-brand/25 text-content-muted" },
  profit: { open: "bg-profit/30 border-profit/50 text-profit-fg", closed: "bg-profit/[0.1] border-profit/25 text-content-muted" },
  warn: { open: "bg-warn/30 border-warn/50 text-warn-fg", closed: "bg-warn/[0.1] border-warn/25 text-content-muted" },
};

function SessionTimeline({ now, sessionEdge }) {
  const timeline = useMemo(() => sessionTimeline(now), [now]);
  const height = MARKET_SESSIONS.length * ROW_H + (MARKET_SESSIONS.length - 1) * ROW_GAP;
  const nowPct = (timeline.nowMinutes / (24 * 60)) * 100;

  const openSessions = timeline.sessions.filter((s) => s.open);
  const nextSession = [...timeline.sessions]
    .filter((s) => !s.open)
    .sort((a, b) => a.opensInMin - b.opensInMin)[0];
  const activeOverlap = timeline.overlaps.find((o) => o.active);

  return (
    <div>
      <div className="relative" style={{ height }}>
        {timeline.overlaps.map((overlap, i) => (
          <span
            key={`${overlap.label}-${i}`}
            className={cn(
              "absolute inset-y-0 rounded-sm border-x",
              overlap.active ? "border-brand/40 bg-brand/[0.14]" : "border-line-strong/50 bg-content/[0.03]"
            )}
            style={{
              left: `${(overlap.from / (24 * 60)) * 100}%`,
              width: `${((overlap.to - overlap.from) / (24 * 60)) * 100}%`,
            }}
            aria-hidden
          />
        ))}

        {timeline.sessions.map((session, rowIndex) =>
          session.segments.map((segment, segIndex) => {
            const width = ((segment.to - segment.from) / (24 * 60)) * 100;
            const tones = BAR_TONES[session.tone] ?? BAR_TONES.brand;
            return (
              <Tooltip
                key={`${session.name}-${segIndex}`}
                content={
                  <span className="block">
                    <span className="block font-medium">
                      {session.name} · {minutesToClock(session.localStart)}–{minutesToClock(session.localEnd)} local
                    </span>
                    <span className="mt-0.5 block text-content-muted">
                      {session.open
                        ? `Open · closes in ${shortDuration(session.closesInMin)}`
                        : `Closed · opens in ${shortDuration(session.opensInMin)}`}
                    </span>
                  </span>
                }
              >
                <div
                  className={cn(
                    "absolute flex items-center overflow-hidden rounded-md border px-1.5 transition-colors",
                    session.open ? tones.open : tones.closed
                  )}
                  style={{
                    top: rowIndex * (ROW_H + ROW_GAP),
                    height: ROW_H,
                    left: `${(segment.from / (24 * 60)) * 100}%`,
                    width: `${width}%`,
                  }}
                >
                  {width > 12 && (
                    <span className="truncate text-2xs font-medium leading-none">{session.name}</span>
                  )}
                </div>
              </Tooltip>
            );
          })
        )}

        <span
          className="absolute -top-1 bottom-0 z-10 w-px bg-warn"
          style={{ left: `${nowPct}%` }}
          aria-hidden
        >
          <span className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-warn shadow-sm" />
        </span>
      </div>

      <div className="relative mt-1.5 h-3">
        {[0, 6, 12, 18, 24].map((hour) => (
          <span
            key={hour}
            className="absolute font-mono text-2xs tnum text-content-subtle"
            style={{
              left: `${(hour / 24) * 100}%`,
              transform: hour === 0 ? "none" : hour === 24 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {String(hour % 24).padStart(2, "0")}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {openSessions.length ? (
          openSessions.map((session) => {
            const edge = sessionEdge?.[session.name];
            return (
              <Badge key={session.name} tone="profit" size="sm" dot>
                {session.name} open · {shortDuration(session.closesInMin)} left
                {edge ? ` · ${formatCurrency(edge.pnl, { decimals: 0, signed: true, compact: true })}` : ""}
              </Badge>
            );
          })
        ) : (
          <Badge tone="neutral" size="sm" dot>
            All sessions closed
          </Badge>
        )}
        {nextSession && (
          <Badge tone="outline" size="sm">
            {nextSession.name} in {shortDuration(nextSession.opensInMin)}
          </Badge>
        )}
        {activeOverlap && (
          <Badge tone="brand" size="sm">
            {activeOverlap.label} overlap
          </Badge>
        )}
      </div>

      {openSessions.some((s) => sessionEdge?.[s.name]) && (
        <p className="mt-2 text-2xs leading-relaxed text-content-subtle">
          {openSessions
            .filter((s) => sessionEdge?.[s.name])
            .map((s) => {
              const edge = sessionEdge[s.name];
              return `${s.name}: ${formatCurrency(edge.pnl, { decimals: 0, signed: true })} over ${pluralize(
                edge.count,
                "trade"
              )} at ${formatPercent(edge.winRate, { decimals: 0 })}`;
            })
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function RiskLimitBlock({ todayPnl, todayCount, limit, onChangeLimit, suggestion }) {
  const [draft, setDraft] = useState(String(limit));
  const used = limit > 0 ? Math.min(1, Math.max(0, -todayPnl) / limit) : 0;
  const breached = limit > 0 && -todayPnl >= limit;
  const tone = todayPnl > 0 ? "profit" : breached ? "loss" : used > 0.5 ? "warn" : "neutral";

  return (
    <div className="rounded-xl border border-line bg-surface-sunken p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-wider text-content-subtle">Realised today</p>
          <p
            className={cn(
              "mt-1 stat-number text-xl",
              todayPnl > 0 ? "text-profit" : todayPnl < 0 ? "text-loss" : "text-content"
            )}
          >
            {formatCurrency(todayPnl, { decimals: 0, signed: true })}
          </p>
          <p className="mt-0.5 text-2xs text-content-subtle">
            {todayCount ? pluralize(todayCount, "closed trade") : "No trades closed yet"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <p className="text-2xs font-medium uppercase tracking-wider text-content-subtle">Loss limit</p>
            <Popover
              align="end"
              width="w-56"
              trigger={
                <Button variant="ghost" size="xs" iconOnly icon={Pencil} aria-label="Edit daily loss limit" />
              }
            >
              {(close) => (
                <div className="p-2">
                  <p className="mb-2 text-2xs text-content-muted">
                    Maximum you allow yourself to lose in one session.
                  </p>
                  <Input
                    size="sm"
                    type="number"
                    min={0}
                    step={50}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Daily loss limit"
                  />
                  <div className="mt-2 flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="xs"
                      className="flex-1"
                      onClick={() => {
                        const next = Number.parseFloat(draft);
                        if (Number.isFinite(next) && next >= 0) onChangeLimit(Math.round(next));
                        close();
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setDraft(String(suggestion));
                        onChangeLimit(suggestion);
                        close();
                      }}
                    >
                      Suggested
                    </Button>
                  </div>
                </div>
              )}
            </Popover>
          </div>
          <p className="mt-1 font-mono text-sm font-semibold tnum text-content-muted">
            {formatCurrency(limit, { decimals: 0 })}
          </p>
          <p className="mt-0.5 text-2xs text-content-subtle">
            {todayPnl >= 0
              ? "Full headroom"
              : breached
                ? "Limit reached"
                : `${formatCurrency(limit + todayPnl, { decimals: 0 })} left`}
          </p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out-expo",
            tone === "loss" ? "bg-loss" : tone === "warn" ? "bg-warn" : tone === "profit" ? "bg-profit" : "bg-neutralish/60"
          )}
          style={{ width: `${todayPnl > 0 ? 100 : Math.max(used * 100, 2)}%` }}
        />
      </div>

      {breached && (
        <p className="mt-2 flex items-center gap-1.5 text-2xs font-medium text-loss">
          <ShieldAlert size={12} />
          Daily loss limit hit — stop trading and review.
        </p>
      )}
    </div>
  );
}

function NextEvents({ events, loading }) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-2xs text-content-subtle">
        No further high-impact releases scheduled today.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {events.map((event) => {
        const meta = IMPACT_META[event.impact] ?? IMPACT_META.low;
        return (
          <li key={event.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
            <span className="font-mono text-2xs tnum text-content-muted">
              {eventLocalTime(event) ?? "All day"}
            </span>
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} aria-hidden />
            <span className="truncate text-2xs text-content">{event.title}</span>
            <Badge tone="outline" size="xs" className="ml-auto shrink-0">
              {event.currency}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

export default function TodayPanel({
  now,
  todayPnl = 0,
  todayCount = 0,
  sessionEdge,
  limit,
  onChangeLimit,
  limitSuggestion,
  upcomingEvents = [],
  eventsLoading,
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Clock}
        title="Today"
        subtitle={now ? formatDate(now, "long") : "—"}
        actions={
          now ? (
            <span className="font-mono text-xs tnum text-content-muted">
              {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
            </span>
          ) : null
        }
      />

      <CardBody className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <RiskLimitBlock
          todayPnl={todayPnl}
          todayCount={todayCount}
          limit={limit}
          onChangeLimit={onChangeLimit}
          suggestion={limitSuggestion}
        />

        <div>
          <p className="mb-2.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            Market sessions · your local time
          </p>
          {now ? (
            <SessionTimeline now={now} sessionEdge={sessionEdge} />
          ) : (
            <Skeleton className="h-28 w-full" />
          )}
        </div>

        <div className="mt-auto">
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            <CalendarClock size={12} />
            Next releases
          </p>
          <NextEvents events={upcomingEvents} loading={eventsLoading} />
        </div>
      </CardBody>
    </Card>
  );
}

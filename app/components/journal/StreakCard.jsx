"use client";

import { useState } from "react";
import { ChevronDown, Flame } from "lucide-react";
import { Card, CardBody, CardHeader, Progress, Skeleton, Tooltip, cn } from "../ui";
import { formatDate, pluralize } from "../../lib/format";

function Stat({ label, value, hint, tone = "neutral" }) {
  return (
    <div className="rounded-lg border border-line bg-surface-sunken px-2.5 py-2">
      <p className="truncate text-2xs uppercase tracking-wider text-content-subtle">{label}</p>
      <p
        className={cn(
          "mt-1 stat-number text-lg",
          tone === "brand" ? "text-brand" : tone === "profit" ? "text-profit" : "text-content"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-2xs text-content-subtle">{hint}</p>}
    </div>
  );
}

export default function StreakCard({ coverage, monthEntries, totalEntries, loading = false }) {
  const [expanded, setExpanded] = useState(false);
  const { sessions = [], total = 0, journalled = 0, streak = 0, best = 0 } = coverage ?? {};
  const pct = total ? (journalled / total) * 100 : 0;

  const headline = total
    ? `Journalled ${journalled} of the last ${pluralize(total, "session")}`
    : "No trading sessions logged yet";
  const compactSummary =
    streak > 0
      ? `${streak} streak · ${Math.round(pct)}% coverage`
      : `${Math.round(pct)}% session coverage`;

  return (
    <Card>
      <CardHeader
        compact
        icon={Flame}
        title="Consistency"
        actions={
          <div className="flex items-center gap-1">
            <Tooltip content="A session is a day you took at least one trade — the days a written review actually matters.">
              <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line text-[9px] font-semibold text-content-subtle">
                ?
              </span>
            </Tooltip>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse consistency panel" : "Expand consistency panel"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-content-subtle transition hover:bg-surface-hover hover:text-content lg:hidden"
            >
              <ChevronDown size={15} className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
            </button>
          </div>
        }
      />
      {!expanded && !loading && (
        <p className="border-b border-line px-4 py-2 text-xs text-content-muted lg:hidden">{compactSummary}</p>
      )}
      {!expanded && loading && (
        <div className="border-b border-line px-4 py-2 lg:hidden">
          <Skeleton className="h-4 w-32" />
        </div>
      )}
      <CardBody className={cn("space-y-3 p-3.5", !expanded && !loading && "hidden lg:block")}>
        {loading ? (
          <>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-7 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-content text-pretty">{headline}</p>
              <div className="mt-2 flex items-center gap-2">
                <Progress
                  value={pct}
                  tone={pct >= 70 ? "profit" : pct >= 40 ? "brand" : "warn"}
                  className="flex-1"
                />
                <span className="shrink-0 font-mono text-2xs font-semibold tnum text-content-muted">
                  {Math.round(pct)}%
                </span>
              </div>
            </div>

            {sessions.length > 0 && (
              <div
                className="flex items-end gap-[3px]"
                role="img"
                aria-label={`Journalling coverage: ${journalled} of the last ${total} trading sessions have an entry. Oldest on the left, ${formatDate(
                  sessions[0].key,
                  "medium"
                )} to ${formatDate(sessions[sessions.length - 1].key, "medium")}.`}
              >
                {sessions.map((session) => (
                  <span
                    key={session.key}
                    className={cn(
                      "h-5 flex-1 rounded-[3px] transition-colors duration-200",
                      session.journalled
                        ? "bg-brand/80"
                        : "bg-surface-sunken ring-1 ring-inset ring-line-strong/60"
                    )}
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Streak"
                value={streak}
                hint={streak === 1 ? "session" : "sessions"}
                tone={streak > 0 ? "brand" : "neutral"}
              />
              <Stat label="Best" value={best} hint="in window" />
              <Stat
                label="Month"
                value={monthEntries}
                hint={totalEntries ? `${totalEntries} all time` : "entries"}
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

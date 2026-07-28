"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  RotateCcw,
  SearchX,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  SearchInput,
  Skeleton,
} from "../ui";
import { formatCurrency, formatDate, pluralize } from "../../lib/format";
import { keyOf, shiftKey } from "./helpers";
import { parseEntry } from "./frontmatter";
import { useDayDraft, useDebouncedValue } from "./hooks";
import { moodOf } from "./templates";
import EntryEditor from "./EntryEditor";
import EntryCard from "./EntryCard";

function dayLabel(dayKey, todayKey) {
  if (dayKey === todayKey) return "Today";
  if (dayKey === shiftKey(todayKey, -1)) return "Yesterday";
  if (dayKey === shiftKey(todayKey, 1)) return "Tomorrow";
  return formatDate(dayKey, "weekday");
}

function matchesQuery(entry, query) {
  const { body, tags, mood } = parseEntry(entry.content);
  const haystack = [body, tags.join(" "), moodOf(mood)?.label ?? ""].join(" ").toLowerCase();
  return haystack.includes(query);
}

export default function DayJournal({
  dayKey,
  todayKey,
  entries,
  dayStat,
  onSelectDay,
  onCreate,
  onUpdate,
  onDelete,
  loading = false,
}) {
  const { draft, update, clear, restored, dismissRestored } = useDayDraft(dayKey);
  const [creating, setCreating] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const query = useDebouncedValue(rawQuery.trim().toLowerCase(), 180);
  const searching = query.length > 0;

  const dayEntries = useMemo(
    () =>
      entries
        .filter((e) => keyOf(new Date(e.created_at)) === dayKey)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [entries, dayKey]
  );

  const searchResults = useMemo(() => {
    if (!searching) return [];
    return entries
      .filter((e) => matchesQuery(e, query))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [entries, query, searching]);

  const handleCreate = async () => {
    if (!draft.text.trim() || creating) return;
    setCreating(true);
    const ok = await onCreate(dayKey, draft);
    setCreating(false);
    if (ok !== false) clear();
  };

  const listShown = searching ? searchResults : dayEntries;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          className="items-center"
          title={
            <span className="flex items-center gap-2">
              {formatDate(dayKey, "long")}
              <Badge tone="brand" size="sm">
                {dayLabel(dayKey, todayKey)}
              </Badge>
            </span>
          }
          subtitle={
            dayStat
              ? `${pluralize(dayStat.count, "trade")} · ${formatCurrency(dayStat.pnl, {
                  decimals: 0,
                  signed: true,
                })} · ${Math.round(dayStat.winRate)}% win rate`
              : "No trades logged this day"
          }
          actions={
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                icon={ChevronLeft}
                aria-label="Previous day"
                onClick={() => onSelectDay(shiftKey(dayKey, -1))}
              />
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                icon={ChevronRight}
                aria-label="Next day"
                onClick={() => onSelectDay(shiftKey(dayKey, 1))}
              />
              {dayKey !== todayKey && (
                <Button
                  variant="ghost"
                  size="xs"
                  icon={CalendarDays}
                  onClick={() => onSelectDay(todayKey)}
                >
                  Today
                </Button>
              )}
            </div>
          }
        />
        <CardBody className="p-4">
          {restored && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-brand/25 bg-brand-soft/50 px-3 py-2">
              <span className="flex items-center gap-2 text-xs text-content-muted">
                <RotateCcw size={13} className="text-brand" aria-hidden />
                Restored an unsaved draft for this day.
              </span>
              <button
                type="button"
                onClick={dismissRestored}
                className="text-2xs font-medium text-brand hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
          <EntryEditor
            value={draft}
            onChange={update}
            onSubmit={handleCreate}
            submitLabel="Add entry"
            submitting={creating}
            showTemplates
            placeholder={`What happened on ${formatDate(dayKey, "medium")}? Plan, execution, emotion, lessons…`}
          />
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-content">
          {searching ? "Search results" : "Entries"}
          <Badge tone="neutral" size="sm">
            {searching
              ? pluralize(searchResults.length, "match", "matches")
              : pluralize(dayEntries.length, "entry", "entries")}
          </Badge>
        </h2>
        <div className="w-full sm:w-64">
          <SearchInput
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            onClear={() => setRawQuery("")}
            placeholder="Search all entries…"
            aria-label="Search journal entries"
          />
        </div>
      </div>

      {loading && !searching && dayEntries.length === 0 ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-3.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : listShown.length === 0 ? (
        searching ? (
          <Card inset>
            <EmptyState
              compact
              icon={SearchX}
              title="No entries match your search"
              description={`Nothing found for “${rawQuery.trim()}”. Try a different keyword, mood or tag.`}
              action={
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setRawQuery("")}>
                  Clear search
                </Button>
              }
            />
          </Card>
        ) : (
          <Card inset>
            <EmptyState
              compact
              icon={NotebookPen}
              title={dayKey === todayKey ? "Nothing logged yet today" : "No entry for this day"}
              description="Capture your plan before the open or review after the close — the box above is ready when you are."
            />
          </Card>
        )
      ) : (
        <ul key={searching ? "search" : dayKey} className="flex animate-fade-in flex-col gap-2.5">
          {listShown.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              query={searching ? rawQuery.trim() : ""}
              showDate={searching}
              onSave={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarCheck, Flame, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  Badge,
  Button,
  ErrorState,
  PageBody,
  PageHeader,
  Toolbar,
  ToolbarDivider,
  useToast,
} from "../components/ui";
import { parseDate, pluralize } from "../lib/format";
import JournalCalendar from "../components/journal/JournalCalendar";
import StreakCard from "../components/journal/StreakCard";
import DayJournal from "../components/journal/DayJournal";
import { useJournal, useMounted } from "../components/journal/hooks";
import { journalCoverage, keyOf, monthOf } from "../components/journal/helpers";
import { serializeEntry } from "../components/journal/frontmatter";

/** A saved entry inherits the selected day but keeps the current wall-clock time. */
function timestampForDay(dayKey) {
  const now = new Date();
  const base = parseDate(dayKey) ?? now;
  base.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return base.toISOString();
}

export default function JournalPage() {
  const mounted = useMounted();
  const toast = useToast();
  const { entries, setEntries, dayStats, entryCountByDay, loading, error, reload } = useJournal();

  const todayKey = useMemo(() => keyOf(new Date()), []);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const selectDay = (key) => {
    setSelectedKey(key);
    const d = parseDate(key);
    if (d && (d.getFullYear() !== view.year || d.getMonth() !== view.month)) {
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  };

  const lastSessionKey = useMemo(() => {
    const keys = Object.keys(dayStats).sort();
    return keys.length ? keys[keys.length - 1] : null;
  }, [dayStats]);

  const coverage = useMemo(
    () => journalCoverage(dayStats, entryCountByDay, 20),
    [dayStats, entryCountByDay]
  );

  const monthEntries = useMemo(() => {
    const prefix = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;
    return Object.entries(entryCountByDay).reduce(
      (sum, [key, count]) => (monthOf(key) === prefix ? sum + count : sum),
      0
    );
  }, [entryCountByDay, view]);

  const createEntry = async (dayKey, draft) => {
    const content = serializeEntry({ mood: draft.mood, tags: draft.tags, body: draft.text });
    if (!content.trim()) return false;

    const created_at = timestampForDay(dayKey);
    const tempId = `temp-${Date.now()}`;
    const snapshot = entries;

    setEntries((prev) => [{ id: tempId, created_at, content }, ...prev]);

    const { data, error: insertError } = await supabase
      .from("journal_entries")
      .insert([{ content, created_at }])
      .select();

    if (insertError || !data?.length) {
      setEntries(snapshot);
      toast.error("Could not save entry", { description: insertError?.message });
      return false;
    }

    setEntries((prev) => prev.map((e) => (e.id === tempId ? data[0] : e)));
    toast.success("Entry saved");
    return true;
  };

  const updateEntry = async (id, content) => {
    const snapshot = entries;
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, content } : e)));

    const { error: updateError } = await supabase
      .from("journal_entries")
      .update({ content })
      .eq("id", id);

    if (updateError) {
      setEntries(snapshot);
      toast.error("Could not update entry", { description: updateError.message });
      return false;
    }
    toast.success("Entry updated");
    return true;
  };

  const deleteEntry = async (id) => {
    const snapshot = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));

    const { error: deleteError } = await supabase.from("journal_entries").delete().eq("id", id);

    if (deleteError) {
      setEntries(snapshot);
      toast.error("Could not delete entry", { description: deleteError.message });
      return;
    }
    toast.success("Entry deleted");
  };

  return (
    <>
      <PageHeader
        eyebrow="Journal"
        title="Daily journal"
        description="Plan before the open, review after the close, and build the written record that turns experience into an edge."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={reload}
              className={loading ? "pointer-events-none opacity-60" : undefined}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={CalendarCheck}
              onClick={() => selectDay(todayKey)}
              disabled={selectedKey === todayKey}
            >
              Today
            </Button>
          </>
        }
        toolbar={
          <Toolbar>
            <Badge tone="outline" size="sm" icon={BookOpen}>
              {pluralize(entries.length, "entry", "entries")} all time
            </Badge>
            <ToolbarDivider />
            <Badge tone={coverage.streak > 0 ? "brand" : "neutral"} size="sm" icon={Flame}>
              {pluralize(coverage.streak, "session")} streak
            </Badge>
            <div className="ml-auto font-mono text-2xs tnum text-content-subtle">
              {pluralize(monthEntries, "entry", "entries")} this month
            </div>
          </Toolbar>
        }
      />

      <PageBody className="space-y-4">
        {error && (
          <ErrorState title="Could not load your journal" description={error} onRetry={reload} />
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(300px,340px)_1fr] xl:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <JournalCalendar
              year={view.year}
              month={view.month}
              onMonthChange={(year, month) => setView({ year, month })}
              selected={selectedKey}
              onSelect={selectDay}
              today={todayKey}
              entryCountByDay={entryCountByDay}
              dayStats={dayStats}
              lastSessionKey={lastSessionKey}
              loading={loading && !mounted}
            />
            <StreakCard
              coverage={coverage}
              monthEntries={monthEntries}
              totalEntries={entries.length}
              loading={loading && entries.length === 0}
            />
          </div>

          <DayJournal
            dayKey={selectedKey}
            todayKey={todayKey}
            entries={entries}
            dayStat={dayStats[selectedKey] ?? null}
            onSelectDay={selectDay}
            onCreate={createEntry}
            onUpdate={updateEntry}
            onDelete={deleteEntry}
            loading={loading}
          />
        </div>
      </PageBody>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Clock, Pencil, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, cn } from "../ui";
import { formatDate, formatTime } from "../../lib/format";
import { parseEntry, serializeEntry } from "./frontmatter";
import { highlightParts } from "./helpers";
import { MoodBadge } from "./MoodPicker";
import EntryEditor from "./EntryEditor";

const COLLAPSE_AT = 520;

function Highlighted({ text, query }) {
  if (!query) return text;
  return highlightParts(text, query).map((part, i) =>
    part.match ? (
      <mark key={i} className="rounded-[3px] bg-warn/30 px-0.5 text-content">
        {part.text}
      </mark>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}

export default function EntryCard({
  entry,
  query = "",
  showDate = false,
  onSave,
  onDelete,
}) {
  const parsed = useMemo(() => parseEntry(entry.content), [entry.content]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isLong = (parsed.body?.length ?? 0) > COLLAPSE_AT;

  const startEdit = () => {
    setDraft({ text: parsed.body, mood: parsed.mood, tags: parsed.tags });
    setEditing(true);
  };

  const saveEdit = async () => {
    const content = serializeEntry(draft);
    if (!content.trim()) return;
    setSaving(true);
    const ok = await onSave(entry.id, content);
    setSaving(false);
    if (ok !== false) setEditing(false);
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-brand/40 bg-surface-raised p-3 shadow-sm ring-1 ring-inset ring-brand/10">
        <EntryEditor
          value={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
          submitLabel="Save changes"
          submitting={saving}
          autoFocus
          minRows={120}
        />
      </li>
    );
  }

  return (
    <li className="group relative rounded-xl border border-line bg-surface transition-colors duration-150 hover:border-line-strong">
      <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-2xs tnum text-content-muted">
            <Clock size={12} className="text-content-subtle" aria-hidden />
            {showDate ? `${formatDate(entry.created_at, "medium")} · ` : ""}
            {formatTime(entry.created_at)}
          </span>
          {parsed.mood && <MoodBadge moodId={parsed.mood} />}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={Pencil}
            aria-label="Edit entry"
            onClick={startEdit}
          />
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={Trash2}
            aria-label="Delete entry"
            className="text-content-subtle hover:text-loss"
            onClick={() => setConfirmOpen(true)}
          />
        </div>
      </div>

      <div className="px-3.5 pb-3 pt-2">
        <p
          className={cn(
            "whitespace-pre-wrap break-words text-sm leading-relaxed text-content/90",
            isLong && !expanded && "line-clamp-[10]"
          )}
        >
          <Highlighted text={parsed.body} query={query} />
        </p>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-xs font-medium text-brand transition hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {parsed.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {parsed.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-content-subtle"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => onDelete(entry.id)}
        title="Delete this entry?"
        description="This journal note will be permanently removed."
        confirmLabel="Delete"
      />
    </li>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Badge, Button, cn } from "../ui";

function normalizeTag(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^#+/, "")
    .slice(0, 32);
}

function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(normalizeTag).filter(Boolean);
  return String(value)
    .split(/[,;|]/)
    .map(normalizeTag)
    .filter(Boolean);
}

/**
 * Compact tag chips editor. Persists via onChange(string[]).
 */
export default function TradeTagsEditor({
  value,
  onChange,
  suggestions = [],
  className,
  compact = false,
}) {
  const tags = useMemo(() => parseTags(value), [value]);
  const [draft, setDraft] = useState("");

  const commit = (next) => {
    const unique = [...new Set(next.map(normalizeTag).filter(Boolean))];
    onChange?.(unique);
  };

  const add = (raw) => {
    const t = normalizeTag(raw);
    if (!t) return;
    if (tags.includes(t)) {
      setDraft("");
      return;
    }
    commit([...tags, t]);
    setDraft("");
  };

  const remove = (tag) => commit(tags.filter((t) => t !== tag));

  const unusedSuggestions = suggestions
    .map(normalizeTag)
    .filter((s) => s && !tags.includes(s))
    .slice(0, 8);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} tone="brand" size="xs" className="gap-1 pr-1">
            #{tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="rounded-sm p-0.5 hover:bg-brand/20"
              aria-label={`Remove ${tag}`}
            >
              <X size={10} />
            </button>
          </Badge>
        ))}
        {!tags.length && (
          <span className="text-2xs text-content-subtle">No tags yet</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Add tag…"
          className={cn(
            "min-w-[7rem] flex-1 rounded-md border border-line bg-surface-sunken px-2 text-xs text-content",
            "placeholder:text-content-subtle focus:border-brand focus:outline-none",
            compact ? "h-7" : "h-8"
          )}
        />
        <Button
          variant="subtle"
          size="xs"
          icon={Plus}
          onClick={() => add(draft)}
          disabled={!normalizeTag(draft)}
        >
          Add
        </Button>
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-1.5 py-0.5 text-2xs text-content-subtle transition hover:border-brand hover:text-content"
            >
              <Check size={10} aria-hidden />
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { parseTags, normalizeTag };

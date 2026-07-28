"use client";

import { useMemo, useRef, useState } from "react";
import { Tag, X } from "lucide-react";
import { cn } from "../ui";

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

const TAG_PALETTE = [
  "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "bg-lime-500/15 text-lime-300 border-lime-500/30",
];

function tagTone(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i += 1) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

/**
 * Inline header tags: colored chips + "Add tag".
 */
export default function TradeTagsEditor({ value, onChange, className }) {
  const tags = useMemo(() => parseTags(value), [value]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const commit = (next) => {
    onChange?.([...new Set(next.map(normalizeTag).filter(Boolean))]);
  };

  const add = (raw) => {
    const t = normalizeTag(raw);
    if (!t) {
      setOpen(false);
      setDraft("");
      return;
    }
    if (!tags.includes(t)) commit([...tags, t]);
    setDraft("");
    setOpen(false);
  };

  const remove = (tag) => commit(tags.filter((t) => t !== tag));

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium",
            tagTone(tag)
          )}
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="opacity-60 transition hover:opacity-100"
            aria-label={`Remove ${tag}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {open ? (
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (normalizeTag(draft)) add(draft);
            else {
              setOpen(false);
              setDraft("");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
            if (e.key === "Escape") {
              setOpen(false);
              setDraft("");
            }
          }}
          placeholder="tag…"
          className="h-6 w-24 rounded-md border border-line bg-surface-sunken px-1.5 text-2xs text-content placeholder:text-content-subtle focus:border-brand focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-line px-1.5 text-2xs text-content-subtle transition hover:border-line-strong hover:text-content"
        >
          <Tag size={11} aria-hidden />
          Add tag
        </button>
      )}
    </div>
  );
}

export { parseTags, normalizeTag };

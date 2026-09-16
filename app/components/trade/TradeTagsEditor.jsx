"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tag, X } from "lucide-react";
import { cn } from "../ui";

const CATALOG_KEY = "flawless.trade.tags.v1";

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

function uniqueTags(list) {
  return [...new Set((list || []).map(normalizeTag).filter(Boolean))];
}

function readCatalog() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CATALOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? uniqueTags(parsed) : [];
  } catch {
    return [];
  }
}

function writeCatalog(tags) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CATALOG_KEY, JSON.stringify(uniqueTags(tags)));
  } catch {
    /* ignore quota / private mode */
  }
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
 * Tag picker for a trade:
 *  - Row 1: "Add tag" + available (reusable) tags
 *  - Row 2: active tags on this trade
 *
 * Creating a tag adds it to the shared catalog (localStorage).
 * Clicking an available tag activates it on the trade.
 */
export default function TradeTagsEditor({ value, onChange, suggestions = [], className }) {
  const active = useMemo(() => parseTags(value), [value]);
  const suggestionList = useMemo(() => parseTags(suggestions), [suggestions]);
  const [catalog, setCatalog] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  // Hydrate catalog once; merge storage + suggestions + current active.
  useEffect(() => {
    const next = uniqueTags([...readCatalog(), ...suggestionList, ...active]);
    setCatalog(next);
    writeCatalog(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on mount + when suggestion set changes
  }, [suggestionList.join("|")]);

  // Keep catalog in sync when active tags arrive/change from the trade.
  useEffect(() => {
    if (!active.length) return;
    setCatalog((prev) => {
      const next = uniqueTags([...prev, ...active]);
      if (next.length === prev.length && next.every((t, i) => t === prev[i])) return prev;
      writeCatalog(next);
      return next;
    });
  }, [active]);

  const available = useMemo(
    () => catalog.filter((t) => !active.includes(t)),
    [catalog, active]
  );

  const commitActive = (next) => {
    onChange?.(uniqueTags(next));
  };

  const remember = (tag) => {
    setCatalog((prev) => {
      if (prev.includes(tag)) return prev;
      const next = [...prev, tag];
      writeCatalog(next);
      return next;
    });
  };

  /** Create a new tag in the available pool (does not auto-activate). */
  const createTag = (raw) => {
    const t = normalizeTag(raw);
    if (!t) {
      setOpen(false);
      setDraft("");
      return;
    }
    remember(t);
    setDraft("");
    setOpen(false);
  };

  const activate = (tag) => {
    const t = normalizeTag(tag);
    if (!t) return;
    remember(t);
    if (!active.includes(t)) commitActive([...active, t]);
  };

  const deactivate = (tag) => commitActive(active.filter((t) => t !== tag));

  const removeFromCatalog = (tag) => {
    setCatalog((prev) => {
      const next = prev.filter((t) => t !== tag);
      writeCatalog(next);
      return next;
    });
    if (active.includes(tag)) deactivate(tag);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Available pool */}
      <div className="flex flex-wrap items-center gap-1.5">
        {open ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (normalizeTag(draft)) createTag(draft);
              else {
                setOpen(false);
                setDraft("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                createTag(draft);
              }
              if (e.key === "Escape") {
                setOpen(false);
                setDraft("");
              }
            }}
            placeholder="new tag…"
            className="h-6 w-28 rounded-md border border-line bg-surface-sunken px-1.5 text-2xs text-content placeholder:text-content-subtle focus:border-brand focus:outline-none"
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

        {available.map((tag) => (
          <span
            key={tag}
            className={cn(
              "group inline-flex items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 text-2xs font-medium",
              tagTone(tag)
            )}
          >
            <button
              type="button"
              onClick={() => activate(tag)}
              title="Activate on this trade"
              className="transition hover:opacity-80"
            >
              {tag}
            </button>
            <button
              type="button"
              onClick={() => removeFromCatalog(tag)}
              className="opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
              aria-label={`Remove ${tag} from available`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      {/* Active on this trade */}
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-subtle">
            Active
          </span>
          {active.map((tag) => (
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
                onClick={() => deactivate(tag)}
                className="opacity-60 transition hover:opacity-100"
                aria-label={`Remove ${tag}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export { parseTags, normalizeTag, CATALOG_KEY };

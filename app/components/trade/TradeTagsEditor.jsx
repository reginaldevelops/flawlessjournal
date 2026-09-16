"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { cn } from "../ui";
import { supabase } from "../../lib/supabaseClient";
import {
  loadTagCatalog,
  normalizeTag,
  parseTags,
  rememberAndPersist,
  tagTone,
} from "../../lib/tradeTags";

/**
 * Inline header tags: colored chips + a picker of tags you already created.
 * New tags are saved to the catalog so they show up on every other trade.
 */
export default function TradeTagsEditor({ value, onChange, className }) {
  const assigned = useMemo(() => parseTags(value), [value]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [catalog, setCatalog] = useState([]);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadTagCatalog(supabase, { extra: assigned }).then((next) => {
      if (!cancelled) setCatalog(next);
    });
    return () => {
      cancelled = true;
    };
    // assigned is only a seed for first load / harvest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
        setDraft("");
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setDraft("");
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commitAssigned = (next) => {
    onChange?.([...new Set(next.map(normalizeTag).filter(Boolean))]);
  };

  const persistCatalog = async (names) => {
    const next = await rememberAndPersist(supabase, names);
    setCatalog(next);
  };

  const hasTag = (list, tag) =>
    list.some((item) => item.toLowerCase() === String(tag).toLowerCase());

  const add = async (raw) => {
    const t = normalizeTag(raw);
    if (!t) {
      setDraft("");
      return;
    }
    if (!hasTag(assigned, t)) commitAssigned([...assigned, t]);
    await persistCatalog([...catalog, t]);
    setDraft("");
    setOpen(false);
  };

  const remove = (tag) => commitAssigned(assigned.filter((t) => t !== tag));

  const query = normalizeTag(draft).toLowerCase();
  const unused = catalog.filter((tag) => !hasTag(assigned, tag));
  const visible = query
    ? unused.filter((tag) => tag.toLowerCase().includes(query))
    : unused;
  const canCreate =
    Boolean(normalizeTag(draft)) &&
    !hasTag(catalog, normalizeTag(draft)) &&
    !hasTag(assigned, normalizeTag(draft));

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {assigned.map((tag) => (
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

      <div ref={panelRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setDraft("");
          }}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-line px-1.5 text-2xs text-content-subtle transition hover:border-line-strong hover:text-content"
        >
          <Tag size={11} aria-hidden />
          Add tag
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-[calc(100%+6px)] z-popover w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface-overlay p-2 shadow-lg animate-fade-in-scale"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  if (visible.length === 1 && !canCreate) add(visible[0]);
                  else add(draft);
                }
              }}
              placeholder="Search or create…"
              className="h-8 w-full rounded-md border border-line bg-surface-sunken px-2 text-xs text-content placeholder:text-content-subtle focus:border-brand focus:outline-none"
            />

            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto thin-scrollbar">
              {visible.length > 0 && (
                <div>
                  <p className="px-0.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                    Your tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {visible.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => add(tag)}
                        className={cn(
                          "inline-flex items-center rounded-md border px-1.5 py-0.5 text-2xs font-medium transition hover:brightness-125",
                          tagTone(tag)
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canCreate && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(draft)}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs text-content hover:bg-surface-hover"
                >
                  <Plus size={12} className="text-content-subtle" aria-hidden />
                  Create “{normalizeTag(draft)}”
                </button>
              )}

              {!canCreate && visible.length === 0 && (
                <p className="px-1 py-1.5 text-2xs text-content-subtle">
                  {catalog.length === 0
                    ? "Type a name and press Enter to create your first tag."
                    : query
                      ? "No matching tags."
                      : "All tags are already on this trade."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { parseTags, normalizeTag } from "../../lib/tradeTags";

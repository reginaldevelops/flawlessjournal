"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { cn } from "../ui";
import { supabase } from "../../lib/supabaseClient";
import { invalidateTradesCache } from "../../lib/supabaseTrades";
import {
  forgetAndPersist,
  loadTagCatalog,
  normalizeTag,
  parseTags,
  rememberAndPersist,
  sameTag,
  tagTone,
} from "../../lib/tradeTags";

/**
 * Inline header tags: colored chips + a picker of tags you already created.
 * New tags are saved to the catalog so they show up on every other trade.
 * × in the picker deletes a tag from the library (and this trade).
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

  const hasTag = (list, tag) => list.some((item) => sameTag(item, tag));

  const add = async (raw, { close = true } = {}) => {
    const t = normalizeTag(raw);
    if (!t) {
      setDraft("");
      return;
    }
    if (!hasTag(assigned, t)) commitAssigned([...assigned, t]);
    await persistCatalog([...catalog, t]);
    setDraft("");
    if (close) setOpen(false);
  };

  const toggle = async (tag) => {
    if (hasTag(assigned, tag)) {
      commitAssigned(assigned.filter((item) => !sameTag(item, tag)));
      return;
    }
    await add(tag, { close: false });
  };

  const removeFromTrade = (tag) =>
    commitAssigned(assigned.filter((item) => !sameTag(item, tag)));

  const deleteFromLibrary = async (tag) => {
    removeFromTrade(tag);
    const next = await forgetAndPersist(supabase, [tag]);
    setCatalog(next);
    invalidateTradesCache();
    setDraft("");
  };

  const query = normalizeTag(draft).toLowerCase();
  const visible = query
    ? catalog.filter((tag) => tag.toLowerCase().includes(query))
    : catalog;
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
            onClick={() => removeFromTrade(tag)}
            className="opacity-60 transition hover:opacity-100"
            aria-label={`Remove ${tag} from this trade`}
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
                  if (visible.length === 1 && !canCreate) toggle(visible[0]);
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
                  <p className="px-0.5 pb-1.5 text-2xs text-content-subtle">
                    Click to assign · × deletes everywhere
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {visible.map((tag) => {
                      const onTrade = hasTag(assigned, tag);
                      return (
                        <span
                          key={tag}
                          className={cn(
                            "inline-flex items-center gap-0.5 rounded-md border text-2xs font-medium",
                            tagTone(tag),
                            onTrade && "ring-1 ring-brand/50"
                          )}
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggle(tag)}
                            className="px-1.5 py-0.5"
                          >
                            {tag}
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => deleteFromLibrary(tag)}
                            className="pr-1 opacity-60 transition hover:opacity-100"
                            aria-label={`Delete tag ${tag}`}
                            title="Delete tag"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
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
                    : "No matching tags."}
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

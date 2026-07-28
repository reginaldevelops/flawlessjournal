"use client";

import { FileText, Plus, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button, cn } from "../ui";

function relativeTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return formatDistanceToNow(date, { addSuffix: true });
}

function noteKey(note) {
  return note?.id ?? note?.clientId;
}

export default function NotesSidebar({
  selectedTag,
  posts,
  selectedPost,
  search,
  loading,
  onSearch,
  onNew,
  onSelect,
}) {
  const query = search.trim().toLowerCase();
  const filtered = query
    ? posts.filter((post) => (post.title || "Untitled").toLowerCase().includes(query))
    : posts;

  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-surface-sunken/45">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content">
            {selectedTag?.name || "Notes"}
          </p>
          <p className="mt-0.5 text-2xs text-content-subtle">
            {posts.length} {posts.length === 1 ? "note" : "notes"}
          </p>
        </div>
        <Button
          variant="primary"
          size="xs"
          icon={Plus}
          onClick={onNew}
          disabled={!selectedTag}
        >
          New note
        </Button>
      </div>

      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="h-8 w-full rounded-lg border border-line bg-surface-raised pl-8 pr-8 text-xs text-content outline-none transition placeholder:text-content-subtle hover:border-line-strong focus:border-brand focus:ring-[3px] focus:ring-brand/15"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-content-subtle hover:bg-surface-hover hover:text-content"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scrollbar">
        {loading ? (
          <div className="space-y-1.5 p-1">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="skeleton h-[68px] rounded-xl" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="space-y-1">
            {filtered.map((post) => {
              const active = noteKey(selectedPost) === noteKey(post);
              return (
                <button
                  key={noteKey(post)}
                  type="button"
                  onClick={() => onSelect(post)}
                  className={cn(
                    "group relative w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                    active
                      ? "border-brand/35 bg-brand-soft shadow-xs"
                      : "border-transparent hover:border-line hover:bg-surface-hover/65"
                  )}
                >
                  {active ? (
                    <span
                      className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-r-full bg-brand"
                      aria-hidden
                    />
                  ) : null}
                  <div className="flex items-start gap-2.5">
                    <FileText
                      size={14}
                      className={cn(
                        "mt-0.5 shrink-0",
                        active ? "text-brand" : "text-content-subtle"
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-5 text-content">
                        {post.title?.trim() || "Untitled"}
                      </p>
                      <p className="mt-1 truncate text-2xs text-content-subtle">
                        {relativeTime(post.updated_at || post.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-44 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-raised text-content-subtle">
              {query ? <Search size={16} /> : <FileText size={16} />}
            </div>
            <p className="mt-3 text-xs font-medium text-content">
              {query ? "No matching notes" : "No notes yet"}
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-content-subtle">
              {query ? "Try a different search." : "Create a note to start writing."}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

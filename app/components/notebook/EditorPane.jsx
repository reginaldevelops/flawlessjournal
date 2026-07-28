"use client";

import { EditorContent } from "@tiptap/react";
import { Check, CloudOff, FilePenLine, LoaderCircle, Tag, Trash2 } from "lucide-react";
import { Button, Tooltip, cn } from "../ui";
import NotebookToolbar from "./NotebookToolbar";

function SaveStatus({ status }) {
  const saving = status === "saving";
  const error = status === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-2xs font-medium",
        error ? "text-loss" : "text-content-subtle"
      )}
    >
      {saving ? (
        <LoaderCircle size={13} className="animate-spin" aria-hidden />
      ) : error ? (
        <CloudOff size={13} aria-hidden />
      ) : (
        <Check size={13} className="text-profit" aria-hidden />
      )}
      <span>{saving ? "Saving…" : error ? "Offline error" : "Saved"}</span>
    </div>
  );
}

export default function EditorPane({
  editor,
  post,
  tags,
  saveStatus,
  onTitleChange,
  onTagChange,
  onBlur,
  onDelete,
}) {
  if (!post) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center bg-canvas">
        <div className="max-w-xs px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-sunken text-content-subtle shadow-sm">
            <FilePenLine size={22} strokeWidth={1.7} aria-hidden />
          </div>
          <h2 className="mt-4 text-base font-semibold text-content">Your thinking space</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-content-muted">
            Select a note or create a new one. Every change is saved automatically.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas/90 px-4">
        <input
          value={post.title || ""}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={onBlur}
          placeholder="Untitled"
          aria-label="Note title"
          className="min-w-0 flex-1 border-0 bg-transparent px-0 text-base font-semibold tracking-tight text-content outline-none placeholder:text-content-subtle focus:ring-0"
        />

        <div className="relative hidden shrink-0 sm:block">
          <Tag
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-subtle"
            aria-hidden
          />
          <select
            value={post.tag_id ?? ""}
            onChange={(event) => {
              const tag = tags.find((item) => String(item.id) === event.target.value);
              if (tag) onTagChange(tag.id);
            }}
            onBlur={onBlur}
            aria-label="Note tag"
            className="h-7 max-w-40 appearance-none rounded-md border border-line bg-surface-sunken py-0 pl-7 pr-6 text-2xs font-medium text-content-muted outline-none transition hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15"
          >
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-content-subtle"
            aria-hidden
          >
            ▼
          </span>
        </div>

        <SaveStatus status={saveStatus} />

        <Tooltip content="Delete note">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={Trash2}
            aria-label="Delete note"
            className="text-content-subtle hover:text-loss"
            onClick={onDelete}
          />
        </Tooltip>
      </div>

      <NotebookToolbar editor={editor} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken/35 px-4 py-5 thin-scrollbar sm:px-6 sm:py-7">
        <div className="mx-auto min-h-full w-full max-w-[860px] rounded-xl border border-line bg-surface px-7 py-8 shadow-sm sm:px-12 sm:py-11">
          <EditorContent
            editor={editor}
            onBlur={onBlur}
            className="prose prose-sm min-h-[calc(100vh-15rem)] max-w-none text-content [&_.tiptap]:min-h-[calc(100vh-15rem)]"
          />
        </div>
      </div>
    </section>
  );
}

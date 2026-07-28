"use client";

import { Folder, FolderOpen, LockKeyhole, MoreHorizontal, Plus } from "lucide-react";
import { Button, MenuItem, Popover, Tooltip, cn } from "../ui";

export default function TagsSidebar({
  tags,
  selectedTag,
  loading,
  onAdd,
  onSelect,
  onRename,
  onDelete,
}) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-canvas-inset">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-content-subtle">
            Tags
          </p>
          <p className="mt-0.5 text-2xs text-content-subtle">
            {tags.length} {tags.length === 1 ? "collection" : "collections"}
          </p>
        </div>
        <Tooltip content="Add tag">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={Plus}
            aria-label="Add tag"
            onClick={onAdd}
          />
        </Tooltip>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2 thin-scrollbar" aria-label="Notebook tags">
        {loading ? (
          <div className="space-y-1.5 p-1">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton h-9 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {tags.map((tag) => {
              const active = selectedTag?.id === tag.id;
              const Icon = active ? FolderOpen : Folder;

              return (
                <div
                  key={tag.id}
                  className={cn(
                    "group relative flex items-center rounded-lg transition-colors",
                    active ? "bg-brand-soft text-content" : "text-content-muted hover:bg-surface-hover"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(tag)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm"
                  >
                    <Icon
                      size={15}
                      className={cn("shrink-0", active ? "text-brand" : "text-content-subtle")}
                      aria-hidden
                    />
                    <span className="truncate font-medium">{tag.name}</span>
                  </button>

                  {tag.fixed ? (
                    <Tooltip content="Protected tag">
                      <span className="mr-2 inline-flex text-content-subtle" aria-label="Protected tag">
                        <LockKeyhole size={12} aria-hidden />
                      </span>
                    </Tooltip>
                  ) : (
                    <Popover
                      width="w-36"
                      trigger={
                        <button
                          type="button"
                          aria-label={`Options for ${tag.name}`}
                          className="mr-1 flex h-7 w-7 items-center justify-center rounded-md text-content-subtle opacity-0 transition hover:bg-surface-raised hover:text-content group-hover:opacity-100 focus:opacity-100"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      }
                    >
                      {(close) => (
                        <>
                          <MenuItem
                            onClick={() => {
                              close();
                              onRename(tag);
                            }}
                          >
                            Rename
                          </MenuItem>
                          <MenuItem
                            tone="danger"
                            onClick={() => {
                              close();
                              onDelete(tag);
                            }}
                          >
                            Delete
                          </MenuItem>
                        </>
                      )}
                    </Popover>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}

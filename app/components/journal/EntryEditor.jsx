"use client";

import { useState } from "react";
import { ChevronDown, Hash, Sparkles, X } from "lucide-react";
import {
  Button,
  Kbd,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Popover,
  cn,
} from "../ui";
import { cleanTags } from "./frontmatter";
import { countWords } from "./helpers";
import { TEMPLATES } from "./templates";
import MoodPicker from "./MoodPicker";
import { useAutosize } from "./hooks";

/**
 * The single writing surface used for both composing a new entry and editing an
 * existing one: an autosizing textarea plus mood, tags and optional templates.
 * Cmd/Ctrl+Enter submits, Escape cancels.
 */
export default function EntryEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Save entry",
  submitting = false,
  autoFocus = false,
  placeholder = "Write what you saw, what you did and why…",
  showTemplates = false,
  minRows = 140,
}) {
  const [tagDraft, setTagDraft] = useState("");
  const textareaRef = useAutosize(value.text, { min: minRows, max: 620 });

  const canSubmit = value.text.trim().length > 0 && !submitting;

  const commitTag = () => {
    const next = cleanTags([...(value.tags ?? []), tagDraft]);
    if (next.length !== (value.tags ?? []).length) onChange({ tags: next });
    setTagDraft("");
  };

  const removeTag = (tag) =>
    onChange({ tags: (value.tags ?? []).filter((t) => t !== tag) });

  const applyTemplate = (template) =>
    onChange({
      text: value.text.trim() ? `${value.text.trim()}\n\n${template.body}` : template.body,
      mood: template.mood ?? value.mood,
      tags: cleanTags([...(value.tags ?? []), ...(template.tags ?? [])]),
    });

  const onTextKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit) onSubmit();
    } else if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  const words = countWords(value.text);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <MoodPicker value={value.mood} onChange={(mood) => onChange({ mood })} />

        {showTemplates && (
          <Popover
            align="end"
            width="w-64"
            trigger={
              <Button variant="subtle" size="xs" icon={Sparkles} iconRight={ChevronDown}>
                Templates
              </Button>
            }
          >
            {(close) => (
              <div className="space-y-0.5 p-1">
                <MenuLabel>Start from a prompt</MenuLabel>
                <MenuSeparator />
                {TEMPLATES.map((template) => (
                  <MenuItem
                    key={template.id}
                    icon={template.icon}
                    onClick={() => {
                      applyTemplate(template);
                      close();
                    }}
                    className="!items-start !py-2"
                  >
                    <span className="block">
                      <span className="block font-medium text-content">{template.label}</span>
                      <span className="mt-0.5 block text-2xs text-content-subtle">
                        {template.description}
                      </span>
                    </span>
                  </MenuItem>
                ))}
              </div>
            )}
          </Popover>
        )}
      </div>

      <textarea
        ref={textareaRef}
        value={value.text}
        autoFocus={autoFocus}
        placeholder={placeholder}
        spellCheck
        onChange={(e) => onChange({ text: e.target.value })}
        onKeyDown={onTextKeyDown}
        className={cn(
          "w-full resize-none rounded-lg border border-line bg-surface-raised px-3.5 py-3 text-sm leading-relaxed text-content thin-scrollbar",
          "transition-[border-color,box-shadow] duration-150 placeholder:text-content-subtle",
          "hover:border-line-strong focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/18"
        )}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Hash size={13} className="text-content-subtle" aria-hidden />
        {(value.tags ?? []).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken py-0.5 pl-2 pr-1 text-2xs font-medium text-content-muted"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-content-subtle transition hover:bg-surface-hover hover:text-content"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitTag();
            } else if (e.key === "Backspace" && !tagDraft && (value.tags ?? []).length) {
              removeTag(value.tags[value.tags.length - 1]);
            }
          }}
          onBlur={() => tagDraft.trim() && commitTag()}
          placeholder={(value.tags ?? []).length ? "Add tag" : "Add tags…"}
          className="h-6 min-w-[80px] flex-1 bg-transparent text-2xs text-content outline-none placeholder:text-content-subtle"
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <span className="font-mono text-2xs tnum text-content-subtle">
          {words} {words === 1 ? "word" : "words"}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={!canSubmit}
            loading={submitting}
          >
            {submitLabel}
            <span className="ml-1.5 hidden items-center gap-0.5 opacity-70 sm:inline-flex">
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

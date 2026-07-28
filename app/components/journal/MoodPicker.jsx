"use client";

import { Tooltip, cn } from "../ui";
import { MOODS, moodOf } from "./templates";

/**
 * Colour treatment per mood tone. Kept as full class strings so Tailwind can
 * see them at build time (no runtime string interpolation into class names).
 */
const SELECTED_TONE = {
  profit: "bg-profit-soft text-profit-fg ring-1 ring-inset ring-profit/40",
  brand: "bg-brand-soft text-brand ring-1 ring-inset ring-brand/40",
  info: "bg-info-soft text-info-fg ring-1 ring-inset ring-info/40",
  neutral: "bg-surface-sunken text-content ring-1 ring-inset ring-line-strong",
  warn: "bg-warn-soft text-warn-fg ring-1 ring-inset ring-warn/40",
  loss: "bg-loss-soft text-loss-fg ring-1 ring-inset ring-loss/40",
};

/** Row of mood toggles. Selecting the active mood clears it. */
export default function MoodPicker({ value, onChange, size = "md", className }) {
  const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const icon = size === "sm" ? 13 : 15;

  return (
    <div
      role="radiogroup"
      aria-label="Mood"
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {MOODS.map((mood) => {
        const Icon = mood.icon;
        const active = value === mood.id;
        return (
          <Tooltip key={mood.id} content={mood.label} delay={150}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={mood.label}
              onClick={() => onChange(active ? null : mood.id)}
              className={cn(
                "flex items-center justify-center rounded-lg transition-[background-color,color,box-shadow,transform] duration-150 ease-out-expo",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 active:scale-95",
                dim,
                active
                  ? SELECTED_TONE[mood.tone] ?? SELECTED_TONE.neutral
                  : "text-content-subtle hover:bg-surface-hover hover:text-content"
              )}
            >
              <Icon size={icon} aria-hidden />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Compact read-only mood chip for a saved entry. */
export function MoodBadge({ moodId, size = "sm" }) {
  const mood = moodOf(moodId);
  if (!mood) return null;
  const Icon = mood.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-2xs font-medium leading-none",
        SELECTED_TONE[mood.tone] ?? SELECTED_TONE.neutral,
        "border-transparent"
      )}
    >
      <Icon size={size === "sm" ? 11 : 13} aria-hidden />
      {mood.label}
    </span>
  );
}

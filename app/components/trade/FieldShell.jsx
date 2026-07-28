"use client";

import { cn } from "../ui";

/**
 * Subtle missing-field chrome around a journal control.
 * Shows a light warn ring + optional Skip (check done) on the label row.
 */
export default function FieldShell({
  label,
  missing = false,
  onSkip,
  className,
  children,
  stacked = false,
}) {
  return (
    <div
      className={cn(
        stacked ? "flex flex-col gap-1 py-0.5" : "grid grid-cols-1 gap-1 py-0.5 sm:grid-cols-[minmax(5rem,7rem),1fr] sm:items-center sm:gap-2",
        missing && "rounded-md bg-warn-soft/25 ring-1 ring-warn/35 px-1.5 -mx-0.5",
        className
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span
          className={cn(
            "truncate text-xs",
            missing ? "font-medium text-warn-fg" : "text-content-subtle"
          )}
        >
          {missing ? (
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-warn align-middle" aria-hidden />
          ) : null}
          {label}
        </span>
        {missing && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 text-2xs text-content-subtle underline-offset-2 hover:text-content hover:underline"
            title="Leave empty on purpose"
          >
            Skip
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

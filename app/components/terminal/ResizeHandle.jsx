"use client";

import { cn } from "../ui";

/**
 * @param {"col"|"row"} axis — col = drag left/right (vertical bar), row = drag up/down
 */
export default function ResizeHandle({ axis, onDragStart, className }) {
  return (
    <div
      role="separator"
      aria-orientation={axis === "col" ? "vertical" : "horizontal"}
      onMouseDown={(e) => {
        e.preventDefault();
        onDragStart?.(e.clientX, e.clientY);
      }}
      className={cn(
        "shrink-0 touch-none select-none bg-line/40 transition-colors hover:bg-brand/40 active:bg-brand/60",
        axis === "col" ? "w-1 cursor-col-resize" : "h-1.5 cursor-row-resize",
        className
      )}
    />
  );
}

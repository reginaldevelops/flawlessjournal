"use client";

import { cn } from "./cn";

const TONES = {
  neutral: "bg-neutralish-soft text-content-muted border-line",
  brand: "bg-brand-soft text-brand border-brand/25",
  profit: "bg-profit-soft text-profit-fg border-profit/25",
  loss: "bg-loss-soft text-loss-fg border-loss/25",
  warn: "bg-warn-soft text-warn-fg border-warn/25",
  info: "bg-info-soft text-info-fg border-info/25",
  outline: "bg-transparent text-content-muted border-line",
};

const SIZES = {
  xs: "h-[18px] px-1.5 text-2xs gap-1",
  sm: "h-5 px-2 text-2xs gap-1",
  md: "h-6 px-2.5 text-xs gap-1.5",
};

export function Badge({
  tone = "neutral",
  size = "sm",
  icon: Icon,
  dot = false,
  className,
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border font-medium leading-none",
        TONES[tone] ?? TONES.neutral,
        SIZES[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "profit" && "bg-profit",
            tone === "loss" && "bg-loss",
            tone === "warn" && "bg-warn",
            tone === "info" && "bg-info",
            tone === "brand" && "bg-brand",
            (tone === "neutral" || tone === "outline") && "bg-content-subtle"
          )}
        />
      )}
      {Icon && <Icon size={size === "md" ? 13 : 11} aria-hidden />}
      {children}
    </span>
  );
}

/** Small pill used for keyboard shortcuts. */
export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-line bg-surface-sunken px-1.5",
        "font-mono text-2xs font-medium text-content-subtle shadow-xs",
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default Badge;

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "./cn";
import Button from "./Button";

export function Skeleton({ className, ...props }) {
  return <div className={cn("skeleton", className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${100 - i * (60 / lines)}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, height = "h-28" }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface p-4",
        className
      )}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className={cn("mt-3 w-full", height)} />
    </div>
  );
}

export function Spinner({ size = 16, className }) {
  return (
    <Loader2
      size={size}
      className={cn("animate-spin text-content-subtle", className)}
      aria-label="Loading"
    />
  );
}

export function LoadingState({ label = "Loading…", className, compact = false }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-8" : "py-16",
        className
      )}
    >
      <div className="relative flex h-9 w-9 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-line" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
      </div>
      <p className="text-xs text-content-subtle">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
  compact = false,
  children,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-10" : "py-16",
        className
      )}
    >
      {Icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-2xl bg-brand/10 blur-xl" aria-hidden />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-sunken text-content-subtle">
            <Icon size={20} aria-hidden />
          </div>
        </div>
      )}
      <p className="text-sm font-semibold text-content">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-content-muted">
          {description}
        </p>
      )}
      {action ??
        (actionLabel && (
          <Button variant="secondary" size="sm" onClick={onAction} className="mt-4">
            {actionLabel}
          </Button>
        ))}
      {children}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry, className }) {
  return (
    <div className={cn("rounded-xl border border-loss/30 bg-loss-soft/40 p-4", className)}>
      <p className="text-sm font-semibold text-loss-fg">{title}</p>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-content-muted">{description}</p>
      )}
      {onRetry && (
        <Button variant="secondary" size="xs" onClick={onRetry} className="mt-3">
          Retry
        </Button>
      )}
    </div>
  );
}

export function Progress({ value = 0, max = 100, tone = "brand", className, showLabel = false }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill =
    tone === "profit"
      ? "bg-profit"
      : tone === "loss"
        ? "bg-loss"
        : tone === "warn"
          ? "bg-warn"
          : "bg-brand-gradient";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out-expo", fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 shrink-0 text-right font-mono text-2xs tnum text-content-subtle">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

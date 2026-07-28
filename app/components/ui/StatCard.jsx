"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "./cn";
import { Tooltip } from "./Overlays";

/** Animated number that eases to its target value. */
export function AnimatedNumber({ value, format, duration = 620, className }) {
  const [display, setDisplay] = useState(value ?? 0);
  const fromRef = useRef(value ?? 0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const from = Number(fromRef.current) || 0;
    if (from === target) {
      setDisplay(target);
      return undefined;
    }
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{format ? format(display) : Math.round(display)}</span>;
}

const TONE_TEXT = {
  profit: "text-profit",
  loss: "text-loss",
  warn: "text-warn",
  brand: "text-brand",
  neutral: "text-content",
};

/**
 * The headline metric tile used across dashboard and analytics.
 * `delta` is a percentage-point / percentage change vs the comparison period.
 */
export function StatCard({
  label,
  value,
  sublabel,
  delta,
  deltaLabel,
  deltaSuffix = "%",
  tone = "neutral",
  icon: Icon,
  hint,
  sparkline,
  loading = false,
  className,
  size = "md",
  invertDelta = false,
}) {
  const deltaPositive = delta != null && delta > 0;
  const deltaNegative = delta != null && delta < 0;
  const good = invertDelta ? deltaNegative : deltaPositive;
  const bad = invertDelta ? deltaPositive : deltaNegative;
  const DeltaIcon = deltaPositive ? ArrowUpRight : deltaNegative ? ArrowDownRight : Minus;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-sm",
        "transition-all duration-200 ease-out-expo hover:border-line-strong hover:shadow-md",
        className
      )}
    >
      {tone !== "neutral" && (
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-px",
            tone === "profit" && "bg-profit/50",
            tone === "loss" && "bg-loss/50",
            tone === "warn" && "bg-warn/50",
            tone === "brand" && "bg-brand/50"
          )}
          aria-hidden
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {Icon && <Icon size={13} className="shrink-0 text-content-subtle" aria-hidden />}
          <p className="truncate text-xs font-medium text-content-muted">{label}</p>
          {hint && (
            <Tooltip content={hint}>
              <span
                className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-line text-[9px] font-semibold text-content-subtle"
                aria-label={typeof hint === "string" ? hint : "More info"}
              >
                ?
              </span>
            </Tooltip>
          )}
        </div>

        {delta != null && Number.isFinite(delta) && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold tnum",
              good && "bg-profit-soft text-profit-fg",
              bad && "bg-loss-soft text-loss-fg",
              !good && !bad && "bg-neutralish-soft text-content-subtle"
            )}
          >
            <DeltaIcon size={10} />
            {Math.abs(delta).toFixed(delta % 1 === 0 ? 0 : 1)}
            {deltaSuffix}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-2.5 h-8 w-24 skeleton" />
      ) : (
        <p
          className={cn(
            "mt-2 stat-number",
            size === "lg" ? "text-stat-lg" : size === "sm" ? "text-xl" : "text-stat",
            TONE_TEXT[tone] ?? TONE_TEXT.neutral
          )}
        >
          {value}
        </p>
      )}

      {(sublabel || deltaLabel) && (
        <p className="mt-1 truncate text-2xs text-content-subtle">
          {sublabel ?? deltaLabel}
        </p>
      )}

      {sparkline && <div className="-mx-1 mt-3 h-9">{sparkline}</div>}
    </div>
  );
}

/** A dense label/value row for stat tables. */
export function StatRow({ label, value, tone = "neutral", hint, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line-subtle py-2 last:border-0",
        className
      )}
    >
      <span className="flex items-center gap-1.5 truncate text-xs text-content-muted">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <span className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-line text-[9px] font-semibold text-content-subtle">
              ?
            </span>
          </Tooltip>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-xs font-semibold tnum",
          TONE_TEXT[tone] ?? TONE_TEXT.neutral
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default StatCard;

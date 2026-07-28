"use client";

import { cn } from "./cn";

/** Underlined tab bar — for page-level sections. */
export function Tabs({ tabs, value, onChange, className, size = "md" }) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-1 overflow-x-auto border-b border-line no-scrollbar",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(tab.id)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-150",
              size === "sm" ? "px-2.5 pb-2 pt-1.5 text-xs" : "px-3 pb-2.5 pt-2 text-sm",
              active
                ? "text-content"
                : "text-content-subtle hover:text-content-muted"
            )}
          >
            {Icon && <Icon size={14} aria-hidden />}
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-2xs tnum",
                  active
                    ? "bg-brand-soft text-brand"
                    : "bg-surface-sunken text-content-subtle"
                )}
              >
                {tab.count}
              </span>
            )}
            <span
              className={cn(
                "absolute inset-x-1 -bottom-px h-0.5 rounded-full transition-all duration-200 ease-out-expo",
                active ? "bg-brand opacity-100" : "opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Pill switcher — for compact in-card option groups. */
export function Segmented({
  options,
  value,
  onChange,
  size = "md",
  className,
  full = false,
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-sunken p-0.5",
        full && "w-full",
        className
      )}
    >
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const Icon = typeof opt === "string" ? null : opt.icon;
        const active = val === value;
        return (
          <button
            key={val}
            role="tab"
            aria-selected={active}
            title={typeof opt === "object" ? opt.title : undefined}
            onClick={() => onChange?.(val)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] font-medium transition-all duration-150 ease-out-expo",
              size === "sm" ? "h-6 px-2 text-2xs" : "h-7 px-2.5 text-xs",
              active
                ? "bg-surface text-content shadow-xs"
                : "text-content-subtle hover:text-content-muted"
            )}
          >
            {Icon && <Icon size={13} aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;

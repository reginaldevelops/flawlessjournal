"use client";

import { forwardRef, useId } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "./cn";

const CONTROL_BASE =
  "w-full rounded-lg border border-line bg-surface-raised text-content " +
  "transition-[border-color,box-shadow,background-color] duration-150 " +
  "placeholder:text-content-subtle hover:border-line-strong " +
  "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/18 " +
  "disabled:cursor-not-allowed disabled:opacity-55";

const SIZES = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3 text-sm",
  lg: "h-10 px-3.5 text-base",
};

export const Input = forwardRef(function Input(
  { className, size = "md", icon: Icon, suffix, invalid, ...props },
  ref
) {
  const pad = size === "sm" ? "pl-8" : "pl-9";
  const control = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        SIZES[size],
        Icon && pad,
        suffix && "pr-9",
        invalid && "border-loss focus:border-loss focus:ring-loss/20",
        className
      )}
      {...props}
    />
  );

  if (!Icon && !suffix) return control;

  return (
    <div className="relative">
      {Icon && (
        <Icon
          size={size === "sm" ? 13 : 15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
          aria-hidden
        />
      )}
      {control}
      {suffix && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-content-subtle">
          {suffix}
        </div>
      )}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, invalid, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "min-h-[80px] resize-y px-3 py-2 text-sm leading-relaxed thin-scrollbar",
        invalid && "border-loss focus:border-loss focus:ring-loss/20",
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, size = "md", children, ...props },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL_BASE,
          SIZES[size],
          "cursor-pointer appearance-none pr-8",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-content-subtle"
        aria-hidden
      />
    </div>
  );
});

export function SearchInput({ value, onChange, onClear, className, ...props }) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
        aria-hidden
      />
      <input
        value={value}
        onChange={onChange}
        className={cn(CONTROL_BASE, SIZES.md, "pl-9", value && "pr-8")}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-content-subtle transition hover:bg-surface-hover hover:text-content"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function Field({ label, hint, error, required, className, children }) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="flex items-center gap-1 text-xs font-medium text-content-muted"
        >
          {label}
          {required && <span className="text-loss">*</span>}
        </label>
      )}
      {typeof children === "function" ? children(id) : children}
      {error ? (
        <p className="text-xs text-loss">{error}</p>
      ) : hint ? (
        <p className="text-xs text-content-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, size = "md" }) {
  const dims =
    size === "sm"
      ? { track: "h-4 w-7", knob: "h-3 w-3", shift: "translate-x-3" }
      : { track: "h-5 w-9", knob: "h-4 w-4", shift: "translate-x-4" };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border border-transparent p-0.5 transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        dims.track,
        checked ? "bg-brand" : "bg-line-strong",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-out-expo",
          dims.knob,
          checked ? dims.shift : "translate-x-0"
        )}
      />
    </button>
  );
}

export function Checkbox({ checked, onChange, indeterminate, className, ...props }) {
  return (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange?.(e.target.checked, e)}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked;
      }}
      className={cn(
        "h-4 w-4 cursor-pointer rounded border-line-strong bg-surface-raised text-brand",
        "transition focus:ring-2 focus:ring-brand/40 focus:ring-offset-0",
        "checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand",
        className
      )}
      {...props}
    />
  );
}

export default Input;

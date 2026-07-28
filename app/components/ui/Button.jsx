"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

const VARIANTS = {
  primary:
    "bg-brand text-brand-fg shadow-sm hover:bg-brand-hover active:scale-[0.985] disabled:hover:bg-brand",
  secondary:
    "bg-surface-raised text-content border border-line hover:bg-surface-hover hover:border-line-strong active:scale-[0.985]",
  ghost: "text-content-muted hover:bg-surface-hover hover:text-content",
  subtle: "bg-surface-sunken text-content-muted hover:bg-surface-hover hover:text-content",
  danger:
    "bg-loss text-white shadow-sm hover:brightness-110 active:scale-[0.985]",
  "danger-ghost": "text-loss hover:bg-loss/10",
  success: "bg-profit text-white shadow-sm hover:brightness-110 active:scale-[0.985]",
  outline:
    "border border-line-strong text-content hover:bg-surface-hover hover:border-brand/50",
  gradient:
    "bg-brand-gradient text-white shadow-glow hover:brightness-110 active:scale-[0.985]",
};

const SIZES = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-10 px-4 text-base gap-2 rounded-lg",
  xl: "h-11 px-5 text-md gap-2.5 rounded-xl",
};

const ICON_SIZES = {
  xs: "h-7 w-7 rounded-md",
  sm: "h-8 w-8 rounded-md",
  md: "h-9 w-9 rounded-lg",
  lg: "h-10 w-10 rounded-lg",
  xl: "h-11 w-11 rounded-xl",
};

const Button = forwardRef(function Button(
  {
    as: Comp = "button",
    variant = "secondary",
    size = "md",
    icon: Icon,
    iconRight: IconRight,
    iconOnly = false,
    loading = false,
    className,
    children,
    disabled,
    ...props
  },
  ref
) {
  const iconPx = size === "xs" || size === "sm" ? 14 : size === "xl" ? 18 : 16;

  return (
    <Comp
      ref={ref}
      disabled={Comp === "button" ? disabled || loading : undefined}
      data-loading={loading ? "" : undefined}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out-expo",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant] ?? VARIANTS.secondary,
        iconOnly ? ICON_SIZES[size] : SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconPx} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={iconPx} aria-hidden className="shrink-0" />
      )}
      {!iconOnly && children}
      {!iconOnly && IconRight && !loading && (
        <IconRight size={iconPx} aria-hidden className="shrink-0 opacity-70" />
      )}
    </Comp>
  );
});

export default Button;

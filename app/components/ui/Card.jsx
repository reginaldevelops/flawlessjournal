"use client";

import { cn } from "./cn";

/**
 * Base surface used by every panel in the app.
 * `interactive` adds hover affordance for clickable cards.
 */
export function Card({
  as: Comp = "div",
  className,
  interactive = false,
  inset = false,
  glow = false,
  children,
  ...props
}) {
  return (
    <Comp
      className={cn(
        "relative rounded-xl border border-line bg-surface",
        inset ? "bg-surface-sunken" : "shadow-sm",
        interactive &&
          "cursor-pointer transition-all duration-200 ease-out-expo hover:border-line-strong hover:shadow-md",
        glow && "shadow-glow",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
  children,
  compact = false,
  ...props
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-line",
        compact ? "px-4 py-2.5" : "px-5 py-3.5",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon
              size={15}
              className="shrink-0 text-content-subtle"
              aria-hidden
            />
          )}
          {title && (
            <h3 className="truncate text-sm font-semibold tracking-tight text-content">
              {title}
            </h3>
          )}
          {children}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-content-subtle">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      )}
    </div>
  );
}

export function CardBody({ className, padded = true, children, ...props }) {
  return (
    <div className={cn(padded && "p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-line px-5 py-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;

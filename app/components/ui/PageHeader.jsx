"use client";

import { cn } from "./cn";

/**
 * Consistent page heading used by every route.
 * `toolbar` renders below the title on its own row and sticks to the top bar.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  toolbar,
  className,
  children,
}) {
  return (
    <div className={cn("border-b border-line bg-canvas", className)}>
      <div className="mx-auto w-full max-w-page px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-content-subtle">
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-2xl font-semibold tracking-tight text-content">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-content-muted text-pretty">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
        {toolbar && <div className="mt-4">{toolbar}</div>}
        {children}
      </div>
    </div>
  );
}

export function PageBody({ className, children, wide = false }) {
  return (
    <div
      className={cn(
        "mx-auto w-full flex-1 px-4 py-5 sm:px-6",
        wide ? "max-w-none" : "max-w-page",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Groups related controls with a hairline separator between them. */
export function Toolbar({ className, children }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />;
}

export default PageHeader;

"use client";

import { cn } from "../ui/cn";

/** Compact mark used in the sidebar and on the login screen. */
export function LogoMark({ size = 28, className }) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size} height={size} fill="none">
        <defs>
          <linearGradient id="fj-mark" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="rgb(var(--brand))" />
            <stop offset="100%" stopColor="rgb(var(--brand-accent))" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#fj-mark)" />
        <path
          d="M8.5 21.5 13 14l4 4.4 6.5-9.4"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <circle cx="23.5" cy="9" r="2.1" fill="white" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }) {
  return (
    <span className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className="truncate text-sm font-semibold tracking-tight text-content">
        Flawless
      </span>
      <span className="truncate text-2xs font-medium uppercase tracking-[0.16em] text-content-subtle">
        Journal
      </span>
    </span>
  );
}

export default LogoMark;

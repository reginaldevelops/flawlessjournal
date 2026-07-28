"use client";

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, XCircle, X } from "lucide-react";
import { cn } from "./cn";

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

export function Tooltip({
  content,
  children,
  side = "top",
  delay = 250,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const timer = useRef(null);
  const id = useId();

  const show = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({
        top: side === "bottom" ? r.bottom + 8 : r.top - 8,
        left: r.left + r.width / 2,
      });
      setOpen(true);
    }, delay);
  }, [delay, side]);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!content) return children;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? id : undefined}
        className="contents"
      >
        {children}
      </span>
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              top: coords.top,
              left: coords.left,
              transform:
                side === "bottom"
                  ? "translate(-50%, 0)"
                  : "translate(-50%, -100%)",
            }}
            className={cn(
              "pointer-events-none fixed z-popover max-w-xs rounded-lg border border-line bg-surface-overlay",
              "px-2.5 py-1.5 text-xs leading-snug text-content shadow-lg animate-fade-in",
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Popover / dropdown menu                                             */
/* ------------------------------------------------------------------ */

export function Popover({
  trigger,
  children,
  align = "end",
  width = "w-56",
  className,
  contentClassName,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {cloneElement(trigger, {
        onClick: (e) => {
          trigger.props.onClick?.(e);
          setOpen((o) => !o);
        },
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+6px)] z-popover overflow-hidden rounded-xl border border-line bg-surface-overlay p-1 shadow-lg animate-fade-in-scale",
            align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
            width,
            contentClassName
          )}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  tone = "default",
  shortcut,
  active = false,
  disabled = false,
  className,
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        tone === "danger"
          ? "text-loss hover:bg-loss/10"
          : "text-content-muted hover:bg-surface-hover hover:text-content",
        active && "bg-surface-hover text-content",
        className
      )}
    >
      {Icon && <Icon size={14} className="shrink-0" aria-hidden />}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="font-mono text-2xs text-content-subtle">{shortcut}</span>
      )}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }) {
  return (
    <div className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

const TOAST_TONES = {
  success: "text-profit",
  error: "text-loss",
  warning: "text-warn",
  info: "text-info",
};

/** True only after the first client render, so portals never break hydration. */
export function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const mounted = useIsMounted();

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = Math.random().toString(36).slice(2);
      const entry = { id, variant: "info", duration: 4000, ...toast };
      setToasts((t) => [...t.slice(-3), entry]);
      if (entry.duration > 0) {
        setTimeout(() => dismiss(id), entry.duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      toast: push,
      success: (title, opts) => push({ ...opts, title, variant: "success" }),
      error: (title, opts) => push({ ...opts, title, variant: "error" }),
      warning: (title, opts) => push({ ...opts, title, variant: "warning" }),
      info: (title, opts) => push({ ...opts, title, variant: "info" }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
            {toasts.map((t) => {
              const Icon = TOAST_ICONS[t.variant] ?? Info;
              return (
                <div
                  key={t.id}
                  role="status"
                  className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface-overlay p-3 shadow-xl animate-fade-in-up"
                >
                  <Icon
                    size={16}
                    className={cn("mt-0.5 shrink-0", TOAST_TONES[t.variant])}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-content">
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-content-muted">
                        {t.description}
                      </p>
                    )}
                    {t.action && (
                      <button
                        type="button"
                        onClick={() => {
                          t.action.onClick?.();
                          dismiss(t.id);
                        }}
                        className="mt-1.5 text-xs font-medium text-brand hover:underline"
                      >
                        {t.action.label}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    className="-mr-1 -mt-1 rounded p-1 text-content-subtle transition hover:bg-surface-hover hover:text-content"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback so components never crash outside the provider.
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Measure helper used by charts that need parent width                */
/* ------------------------------------------------------------------ */

export function useMeasure() {
  const ref = useRef(null);
  const [rect, setRect] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setRect({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, rect];
}

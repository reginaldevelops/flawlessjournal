"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import Button from "./Button";
import { useIsMounted } from "./Overlays";

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(96rem,95vw)]",
};

function useDismiss(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  size = "md",
  footer,
  children,
  className,
  bodyClassName,
  hideClose = false,
}) {
  useDismiss(open, onClose);
  const mounted = useIsMounted();
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 bg-canvas/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "relative my-auto w-full rounded-2xl border border-line bg-surface-overlay shadow-xl animate-fade-in-scale",
          WIDTHS[size],
          className
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            {Icon && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-base font-semibold tracking-tight text-content">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs leading-relaxed text-content-muted">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={X}
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1"
              />
            )}
          </div>
        )}

        <div
          className={cn(
            "max-h-[min(70vh,44rem)] overflow-y-auto px-5 py-4 thin-scrollbar",
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  side = "right",
  width = "max-w-md",
  footer,
  children,
  className,
}) {
  useDismiss(open, onClose);
  const mounted = useIsMounted();
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal">
      <div
        className="absolute inset-0 bg-canvas/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute inset-y-0 flex w-full flex-col border-line bg-surface shadow-xl",
          side === "right"
            ? "right-0 border-l animate-slide-in-right"
            : "left-0 border-r animate-slide-in-right",
          width,
          className
        )}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-content">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-content-muted">{description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            onClick={onClose}
            aria-label="Close"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 thin-scrollbar">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            size="sm"
            loading={loading}
            onClick={async () => {
              await onConfirm?.();
              onClose?.();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-content-muted">
        This action cannot be undone.
      </p>
    </Modal>
  );
}

export default Modal;

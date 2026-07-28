"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Link2, Trash2, Upload } from "lucide-react";
import { Button, cn } from "../ui";
import {
  compressImageToDataUrl,
  isImageDataUrl,
  isProbablyUrl,
  readChartPaste,
} from "../../lib/chartImage";

/**
 * Chart / link field: paste a URL, paste a screenshot, drop a file, or pick one.
 */
export default function ChartField({
  label,
  value,
  onChange,
  compact = false,
  className,
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef(null);

  const hasValue = Boolean(value);
  const showAsImage =
    hasValue && (isImageDataUrl(value) || isProbablyUrl(value));

  const apply = useCallback(
    async (payload) => {
      if (!payload) return;
      setError(null);
      setBusy(true);
      try {
        onChange?.(payload.value);
        setUrlDraft("");
      } catch (err) {
        setError(err.message || "Could not add image");
      } finally {
        setBusy(false);
      }
    },
    [onChange]
  );

  const handlePaste = async (e) => {
    // Always try image first; don't block URL typing in the input
    try {
      const payload = await readChartPaste(e);
      if (!payload) return;
      e.preventDefault();
      if (payload.kind === "image") {
        setBusy(true);
        setError(null);
        onChange?.(payload.value);
        setBusy(false);
      } else {
        onChange?.(payload.value);
      }
    } catch (err) {
      setBusy(false);
      setError(err.message || "Paste failed");
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    try {
      const payload = await readChartPaste(e);
      if (payload) await apply(payload);
    } catch (err) {
      setError(err.message || "Drop failed");
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onChange?.(dataUrl);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const commitUrl = () => {
    const next = urlDraft.trim() || String(value ?? "").trim();
    if (!next) return;
    if (!isProbablyUrl(next) && !/^https?:\/\//i.test(next)) {
      // allow relative-looking pastes by prefixing https if it looks like a domain
      if (/^[\w.-]+\.[a-z]{2,}/i.test(next)) {
        onChange?.(`https://${next}`);
        setUrlDraft("");
        return;
      }
      setError("Paste a full image URL (https://…) or an image");
      return;
    }
    onChange?.(next);
    setUrlDraft("");
    setError(null);
  };

  return (
    <div className={cn("space-y-2", className)} onPaste={handlePaste}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-content">{label}</h3>
          {hasValue && (
            <Button
              variant="danger-ghost"
              size="xs"
              icon={Trash2}
              onClick={() => onChange?.("")}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed transition-colors",
          dragging
            ? "border-brand bg-brand-soft/40"
            : "border-line bg-surface-sunken/40",
          compact ? "min-h-[88px]" : "min-h-[160px]"
        )}
      >
        {showAsImage ? (
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label || "Chart"}
              className={cn(
                "mx-auto w-full object-contain",
                compact ? "max-h-[140px]" : "max-h-[800px]"
              )}
              onError={(e) => {
                e.currentTarget.style.opacity = "0.3";
              }}
            />
            {!isImageDataUrl(value) && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 rounded-md border border-line bg-surface/90 px-2 py-1 text-2xs font-medium text-brand opacity-0 transition group-hover:opacity-100"
              >
                Open link
              </a>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 px-4 py-8 text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-content-subtle">
              {busy ? (
                <Upload size={18} className="animate-pulse" />
              ) : (
                <ImagePlus size={18} />
              )}
            </div>
            <p className="text-xs font-medium text-content">
              {busy ? "Processing image…" : "Paste image or drop screenshot"}
            </p>
            <p className="text-2xs text-content-subtle">
              Or paste / type an image URL below · click to browse
            </p>
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-subtle"
          />
          <input
            type="url"
            value={hasValue && !urlDraft ? (isImageDataUrl(value) ? "" : value) : urlDraft}
            onChange={(e) => {
              setUrlDraft(e.target.value);
              setError(null);
            }}
            onPaste={async (e) => {
              // If clipboard has an image, handle at parent; if text URL, let it through
              const items = [...(e.clipboardData?.items || [])];
              if (items.some((i) => i.type.startsWith("image/"))) {
                e.preventDefault();
                handlePaste(e);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitUrl();
              }
            }}
            onBlur={() => {
              if (urlDraft.trim()) commitUrl();
            }}
            placeholder="https://… or paste image with Ctrl/Cmd+V"
            className="h-8 w-full rounded-lg border border-line bg-surface-raised pl-8 pr-3 text-xs text-content placeholder:text-content-subtle hover:border-line-strong focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/18"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Upload
        </Button>
      </div>

      {error && <p className="text-2xs text-loss">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          handleFile(file);
        }}
      />
    </div>
  );
}

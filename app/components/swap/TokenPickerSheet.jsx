"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ClipboardPaste, LoaderCircle, Search } from "lucide-react";
import { isValidSolanaAddress } from "../../lib/chain/validate";
import { Button, Input, Sheet } from "../ui";

/**
 * Paste or type a Solana token mint → lookup → hand off to SwapSheet.
 */
export default function TokenPickerSheet({ open, onClose, onConfirm }) {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!open) {
      setMint("");
      setLoading(false);
      setError(null);
      setPreview(null);
    }
  }, [open]);

  const lookup = useCallback(async (address) => {
    const value = String(address || "").trim();
    if (!isValidSolanaAddress(value)) {
      setError("Enter a valid Solana token address (base58, 32 bytes).");
      setPreview(null);
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/token/lookup?mint=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setPreview(data);
    } catch (err) {
      setError(err?.message ?? "Could not resolve token");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !mint.trim()) return undefined;
    if (!isValidSolanaAddress(mint.trim())) {
      setPreview(null);
      setError(null);
      return undefined;
    }
    const timer = setTimeout(() => void lookup(mint.trim()), 400);
    return () => clearTimeout(timer);
  }, [open, mint, lookup]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      setMint(trimmed);
      if (isValidSolanaAddress(trimmed)) void lookup(trimmed);
    } catch {
      setError("Could not read clipboard.");
    }
  };

  const confirm = () => {
    if (!preview) return;
    onConfirm?.(preview);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Swap trade"
      description="Paste a token contract address. After the swap, a journal trade is created with fills and chart."
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={ArrowRight}
            disabled={!preview || loading}
            onClick={confirm}
          >
            Continue to swap
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="token-mint" className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            Token address (mint)
          </label>
          <div className="flex gap-2">
            <Input
              id="token-mint"
              value={mint}
              onChange={(e) => setMint(e.target.value.trim())}
              placeholder="Paste Solana CA…"
              className="font-mono text-xs"
              autoFocus
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={ClipboardPaste}
              aria-label="Paste from clipboard"
              onClick={() => void pasteFromClipboard()}
            />
          </div>
          {loading && (
            <p className="flex items-center gap-1.5 text-xs text-content-muted">
              <LoaderCircle size={13} className="animate-spin" aria-hidden />
              Looking up token…
            </p>
          )}
          {error && <p className="text-xs text-loss">{error}</p>}
        </div>

        {preview && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
            {preview.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                {(preview.symbol || "?").slice(0, 2)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-content">{preview.symbol}</p>
              <p className="truncate text-2xs text-content-subtle">{preview.name}</p>
              <p className="mt-0.5 truncate font-mono text-2xs text-content-muted">{preview.address}</p>
            </div>
            <Search size={14} className="shrink-0 text-content-subtle" aria-hidden />
          </div>
        )}

        <p className="text-2xs leading-relaxed text-content-subtle">
          Tip: copy the contract from DexScreener or your wallet. Use{" "}
          <a href="/scanner" className="font-medium text-brand hover:underline">
            Scanner
          </a>{" "}
          to discover tokens with volume breakouts.
        </p>
      </div>
    </Sheet>
  );
}

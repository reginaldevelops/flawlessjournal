"use client";

import { useEffect, useState } from "react";
import { Button, Field, Select, cn } from "../ui";
import { loadSwapSettings, saveSwapSettings } from "../../lib/swap/settings";
import {
  DEFAULT_SWAP_SETTINGS,
  QUOTE_TOKENS,
  SLIPPAGE_OPTIONS,
} from "../../lib/swap/constants";
import { suggestSlippageBps } from "../../lib/swap/slippage";

/**
 * Compact swap settings: 0.5% / 4% slippage, fee mode, default quote.
 * Priority/Jito amounts are auto from p90 — not user-editable.
 */
export default function SwapSettingsPanel({
  open,
  onChange,
  /** Optional pair context for “Auto” slippage suggestion */
  pairContext,
  feeEstimate,
}) {
  const [settings, setSettings] = useState(DEFAULT_SWAP_SETTINGS);

  useEffect(() => {
    const loaded = loadSwapSettings();
    setSettings(loaded);
    onChange?.(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const update = (patch) => {
    const next = saveSwapSettings({ ...settings, ...patch });
    setSettings(next);
    onChange?.(next);
  };

  const applyAuto = () => {
    const bps = suggestSlippageBps(pairContext ?? {});
    update({ slippageBps: bps, slippageAuto: true });
  };

  const fee =
    settings.feeMode === "jito" ? feeEstimate?.jito : feeEstimate?.priority;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-sunken p-3.5 animate-fade-in">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-content">Slippage</p>
          <button
            type="button"
            onClick={applyAuto}
            className="text-2xs font-medium text-brand hover:text-brand-hover"
          >
            Auto
          </button>
        </div>
        <div className="flex gap-1.5">
          {SLIPPAGE_OPTIONS.map((opt) => {
            const on = settings.slippageBps === opt.bps;
            return (
              <button
                key={opt.bps}
                type="button"
                onClick={() =>
                  update({ slippageBps: opt.bps, slippageAuto: false })
                }
                className={cn(
                  "flex-1 rounded-md border px-2 py-2 text-sm font-semibold transition",
                  on
                    ? "border-brand/40 bg-brand-soft text-brand"
                    : "border-line bg-surface-raised text-content-muted hover:text-content"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-2xs text-content-subtle">
          Auto picks 4% for fresh (&lt;12h) or volatile (≥12% / 1h) pairs, otherwise
          0.5%.
        </p>
      </div>

      <Field label="Default quote (payment) token">
        {(id) => (
          <Select
            id={id}
            size="sm"
            value={settings.defaultQuoteMint}
            onChange={(e) => update({ defaultQuoteMint: e.target.value })}
          >
            {QUOTE_TOKENS.map((t) => (
              <option key={t.mint} value={t.mint}>
                {t.symbol}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Landing fee">
        {(id) => (
          <div id={id} className="flex gap-1.5">
            {["priority", "jito"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => update({ feeMode: mode })}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition",
                  settings.feeMode === mode
                    ? "border-brand/40 bg-brand-soft text-brand"
                    : "border-line bg-surface-raised text-content-muted hover:text-content"
                )}
              >
                {mode === "jito" ? "Jito tip" : "Priority fee"}
              </button>
            ))}
          </div>
        )}
      </Field>

      {fee && (
        <p className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-2xs text-content-muted">
          {settings.feeMode === "jito" ? "Jito tip" : "Priority fee"} · p90 ≈{" "}
          <span className="font-mono tnum text-content">
            ${Number(fee.usd).toFixed(3)}
          </span>
          {fee.capped ? (
            <span className="text-warn">
              {" "}
              (capped at ${fee.maxUsd.toFixed(2)})
            </span>
          ) : null}
          <span className="text-content-subtle">
            {" "}
            · max ${fee.maxUsd.toFixed(2)}
          </span>
        </p>
      )}

      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          const next = saveSwapSettings(DEFAULT_SWAP_SETTINGS);
          setSettings(next);
          onChange?.(next);
        }}
      >
        Reset to defaults
      </Button>
    </div>
  );
}

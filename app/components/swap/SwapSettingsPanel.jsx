"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Select, Switch, cn } from "../ui";
import { loadSwapSettings, saveSwapSettings } from "../../lib/swap/settings";
import { DEFAULT_SWAP_SETTINGS, QUOTE_TOKENS } from "../../lib/swap/constants";

export default function SwapSettingsPanel({ open, onChange }) {
  const [settings, setSettings] = useState(DEFAULT_SWAP_SETTINGS);

  useEffect(() => {
    const loaded = loadSwapSettings();
    setSettings(loaded);
    onChange?.(loaded);
  }, [onChange]);

  if (!open) return null;

  const update = (patch) => {
    const next = saveSwapSettings({ ...settings, ...patch });
    setSettings(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-sunken p-3.5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-content">Manual mode</p>
          <p className="text-2xs text-content-subtle">
            Fixed slippage — Jupiter won’t override with dynamic slippage.
          </p>
        </div>
        <Switch
          checked={settings.manualMode}
          onChange={(manualMode) => update({ manualMode })}
          label="Manual mode"
        />
      </div>

      <Field label={`Slippage (${(settings.slippageBps / 100).toFixed(2)}%)`}>
        {(id) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={5000}
            step={10}
            value={settings.slippageBps}
            onChange={(e) => update({ slippageBps: Number(e.target.value) || 100 })}
            size="sm"
          />
        )}
      </Field>

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

      <Field label="Landing fee mode">
        {(id) => (
          <div id={id} className="flex gap-1.5">
            {["priority", "jito"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => update({ feeMode: mode })}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition",
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

      {settings.feeMode === "priority" ? (
        <>
          <Field label="Priority level">
            {(id) => (
              <Select
                id={id}
                size="sm"
                value={settings.priorityLevel}
                onChange={(e) => update({ priorityLevel: e.target.value })}
              >
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="veryHigh">Very high</option>
              </Select>
            )}
          </Field>
          <Field label="Max priority fee (lamports)" hint="1e9 lamports = 1 SOL">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1000}
                step={10000}
                value={settings.maxPriorityLamports}
                onChange={(e) =>
                  update({ maxPriorityLamports: Number(e.target.value) || 1_000_000 })
                }
                size="sm"
              />
            )}
          </Field>
        </>
      ) : (
        <Field
          label="Jito tip (lamports)"
          hint="Requires a Jito-compatible broadcast path"
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1000}
              step={10000}
              value={settings.jitoTipLamports}
              onChange={(e) =>
                update({ jitoTipLamports: Number(e.target.value) || 1_000_000 })
              }
              size="sm"
            />
          )}
        </Field>
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

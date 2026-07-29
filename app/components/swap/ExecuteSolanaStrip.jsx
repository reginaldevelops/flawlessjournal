"use client";

import { ArrowDownUp } from "lucide-react";
import { Button } from "../ui";
import { useSwapFlow } from "./SwapFlowContext";

/** Compact CTA on manual trades — link a Solana swap to this journal entry. */
export default function ExecuteSolanaStrip({ tradeId, onComplete }) {
  const { openSwap } = useSwapFlow();

  return (
    <section className="rounded-2xl border border-dashed border-brand/35 bg-brand-soft/20 px-4 py-3 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content">Execute on Solana first?</p>
          <p className="mt-0.5 text-xs text-content-muted">
            Swap into this trade — fills, entry chart and PnL sync automatically.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={ArrowDownUp}
          onClick={() => openSwap({ tradeId, onComplete })}
        >
          Swap
        </Button>
      </div>
    </section>
  );
}

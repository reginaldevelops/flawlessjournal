"use client";

import { formatCurrency } from "../../lib/format";
import { cn } from "../ui";

/** Session fills shown beside the TradingView iframe (overlays aren't possible in embeds). */
export default function SessionFillsBar({ fills = [], className }) {
  if (!fills.length) return null;

  return (
    <div className={cn("border-t border-line bg-surface px-4 py-2", className)}>
      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
        Your entries this session
      </p>
      <ul className="flex flex-wrap gap-2">
        {fills.map((fill) => {
          const buy = fill.side !== "sell";
          const ts = fill.ts ? new Date(fill.ts) : null;
          const price = Number(fill.priceUsd);
          return (
            <li
              key={fill.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-2xs",
                buy
                  ? "border-profit/30 bg-profit/10 text-profit-fg"
                  : "border-loss/30 bg-loss/10 text-loss-fg"
              )}
            >
              <span className="font-semibold uppercase">{buy ? "Buy" : "Sell"}</span>
              {Number.isFinite(price) && price > 0 ? (
                <span className="font-mono tnum text-content">
                  {formatCurrency(price, {
                    compact: price < 0.01,
                    decimals: price < 0.01 ? 6 : 4,
                  })}
                </span>
              ) : null}
              {ts && !Number.isNaN(ts.getTime()) ? (
                <span className="text-content-subtle">
                  {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

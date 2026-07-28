"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge, Button, cn } from "../ui";
import { formatCurrency, formatRelative, toneTextClass } from "../../lib/format";
import SwapSheet from "./SwapSheet";

/**
 * Position summary + fill history for Solana journal trades created via Jupiter.
 */
export default function PositionPanel({ trade, onRefresh }) {
  const fj = trade?._fj;
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapSide, setSwapSide] = useState("buy");

  if (!fj || fj.kind !== "solana_position") return null;

  const c = fj.computed ?? {};
  const fills = [...(fj.fills ?? [])].reverse();

  const openSwap = (side) => {
    setSwapSide(side);
    setSwapOpen(true);
  };

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface overflow-hidden animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              Solana position
            </p>
            <p className="text-sm font-semibold text-content">
              {fj.tokenSymbol}
              <span className="ml-2 font-mono text-2xs font-normal text-content-subtle">
                {fj.tokenMint?.slice(0, 4)}…{fj.tokenMint?.slice(-4)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {fj.pairUrl && (
              <a
                href={fj.pairUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-hover"
              >
                DexScreener <ExternalLink size={12} />
              </a>
            )}
            <Button variant="subtle" size="xs" onClick={() => openSwap("sell")}>
              Sell
            </Button>
            <Button variant="primary" size="xs" onClick={() => openSwap("buy")}>
              Buy more
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          <Metric
            label="Avg entry"
            value={formatCurrency(c.avgEntryUsd, {
              compact: (c.avgEntryUsd ?? 0) < 0.01,
              decimals: (c.avgEntryUsd ?? 0) < 0.01 ? 6 : 4,
            })}
          />
          <Metric
            label="Total invested"
            value={formatCurrency(c.totalInvestedUsd, { compact: true })}
          />
          <Metric
            label="Avg sell"
            value={formatCurrency(c.avgExitUsd, {
              compact: (c.avgExitUsd ?? 0) < 0.01,
              decimals: (c.avgExitUsd ?? 0) < 0.01 ? 6 : 4,
              fallback: "—",
            })}
          />
          <Metric
            label="Realized PnL"
            value={formatCurrency(c.realizedPnlUsd, { compact: true, signed: true })}
            tone={c.realizedPnlUsd}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-line px-4 py-3 text-xs">
          <div>
            <p className="text-2xs text-content-subtle">Tokens open</p>
            <p className="font-mono tnum text-content">
              {Number(c.tokensOpen ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
            </p>
          </div>
          <div>
            <p className="text-2xs text-content-subtle">Open cost</p>
            <p className="font-mono tnum text-content">
              {formatCurrency(c.openCostUsd, { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-2xs text-content-subtle">Fills</p>
            <p className="font-mono tnum text-content">{fills.length}</p>
          </div>
        </div>

        {fills.length > 0 && (
          <div className="border-t border-line">
            <p className="px-4 pt-3 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              Fill history
            </p>
            <ul className="divide-y divide-line/80">
              {fills.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={f.side === "buy" ? "profit" : "loss"}
                      size="sm"
                      className="capitalize"
                    >
                      {f.side}
                    </Badge>
                    <span className="font-mono tnum text-content">
                      {Number(f.tokenAmount).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{" "}
                      {fj.tokenSymbol}
                    </span>
                    <span className="text-content-subtle">
                      via {f.quoteAmount?.toLocaleString?.(undefined, { maximumFractionDigits: 4 }) ?? f.quoteAmount}{" "}
                      {f.quoteSymbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-content-muted">
                    <span className="font-mono tnum">
                      {formatCurrency(f.usdValue, { compact: true })}
                    </span>
                    <span className="text-2xs">{formatRelative(f.ts)}</span>
                    {f.signature && (
                      <a
                        href={`https://solscan.io/tx/${f.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:text-brand-hover"
                      >
                        tx
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <SwapSheet
        open={swapOpen}
        onClose={() => {
          setSwapOpen(false);
          onRefresh?.();
        }}
        initialSide={swapSide}
        token={{
          address: fj.tokenMint,
          symbol: fj.tokenSymbol,
          name: fj.tokenName,
          url: fj.pairUrl,
          imageUrl: fj.imageUrl,
          chainId: "solana",
        }}
      />
    </>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-2xs text-content-subtle">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono tnum text-sm font-semibold",
          tone != null ? toneTextClass(tone) : "text-content"
        )}
      >
        {value}
      </p>
    </div>
  );
}

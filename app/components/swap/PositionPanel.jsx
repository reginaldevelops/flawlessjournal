"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge, Button, cn } from "../ui";
import { formatCurrency, formatRelative, toneTextClass } from "../../lib/format";
import {
  isPositionLive,
  unrealizedPnlUsd,
} from "../../lib/swap/position";
import { fetchUsdPrices } from "../../lib/swap/clientPrices";
import SwapSheet from "./SwapSheet";
import PositionCandlesChart from "./PositionCandlesChart";

/**
 * Position summary + fill history for Solana journal trades created via Jupiter.
 */
export default function PositionPanel({ trade, onRefresh }) {
  const fj = trade?._fj;
  const isPosition = Boolean(fj && fj.kind === "solana_position");
  const c = isPosition ? fj.computed ?? {} : {};
  const live = isPosition && isPositionLive(c);
  const mint = isPosition ? fj.tokenMint : null;

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapSide, setSwapSide] = useState("buy");
  const [showChart, setShowChart] = useState(false);
  const [markPrice, setMarkPrice] = useState(null);

  useEffect(() => {
    if (!live || !mint) {
      setMarkPrice(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const prices = await fetchUsdPrices([mint]);
      if (!cancelled) setMarkPrice(prices[mint] ?? null);
    })();
    const t = setInterval(async () => {
      const prices = await fetchUsdPrices([mint]);
      if (!cancelled) setMarkPrice(prices[mint] ?? null);
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [live, mint]);

  if (!isPosition) return null;

  const fillsChrono = [...(fj.fills ?? [])].sort(
    (a, b) => Date.parse(a.ts || 0) - Date.parse(b.ts || 0)
  );
  const fills = [...fillsChrono].reverse();
  const unrealized = live ? unrealizedPnlUsd(c, markPrice) : null;

  const openSwap = (side) => {
    setSwapSide(side);
    setSwapOpen(true);
  };

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface overflow-hidden animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                Solana position
              </p>
              <Badge tone={live ? "profit" : "neutral"} size="xs" dot>
                {live ? "Position live" : "Position closed"}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-content">
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

        {live && (
          <div className="border-b border-line px-4 py-3">
            <div className="rounded-xl border border-line bg-surface-sunken/50 px-4 py-3">
              <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                Unrealized PnL
              </p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                <p
                  className={cn(
                    "font-mono tnum text-2xl font-semibold tracking-tight",
                    unrealized != null ? toneTextClass(unrealized) : "text-content-muted"
                  )}
                >
                  {unrealized == null
                    ? "—"
                    : formatCurrency(unrealized, { compact: true, signed: true })}
                </p>
                <div className="text-right text-2xs text-content-subtle">
                  <p>
                    Mark{" "}
                    <span className="font-mono tnum text-content-muted">
                      {markPrice != null
                        ? formatCurrency(markPrice, {
                            compact: markPrice < 0.01,
                            decimals: markPrice < 0.01 ? 6 : 4,
                          })
                        : "—"}
                    </span>
                  </p>
                  <p className="mt-0.5">
                    Open cost{" "}
                    <span className="font-mono tnum text-content-muted">
                      {formatCurrency(c.openCostUsd, { compact: true })}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {fillsChrono.length > 0 && (
          <div className="border-b border-line">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                Entry chart
              </p>
              <Button
                variant="subtle"
                size="xs"
                iconRight={ChevronDown}
                onClick={() => setShowChart((v) => !v)}
                aria-expanded={showChart}
                className={showChart ? "[&_svg:last-child]:rotate-180" : undefined}
              >
                {showChart ? "Hide chart" : "Show entry on chart"}
              </Button>
            </div>
            {showChart && (
              <div className="pb-1">
                <PositionCandlesChart
                  mint={fj.tokenMint}
                  pairUrl={fj.pairUrl}
                  fills={fillsChrono}
                  symbol={fj.tokenSymbol}
                  height={280}
                />
              </div>
            )}
          </div>
        )}

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
                      via{" "}
                      {f.quoteAmount?.toLocaleString?.(undefined, {
                        maximumFractionDigits: 4,
                      }) ?? f.quoteAmount}{" "}
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

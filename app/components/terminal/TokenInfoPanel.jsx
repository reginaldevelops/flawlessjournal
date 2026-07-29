"use client";

import { Copy, ExternalLink, Globe } from "lucide-react";
import { Button, cn, useToast } from "../ui";
import {
  formatCurrency,
  formatPercent,
  formatRelative,
  truncateMiddle,
} from "../../lib/format";

function StatRow({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-2xs text-content-subtle">{label}</span>
      <span
        className={cn(
          "text-right font-mono text-xs tnum text-content",
          tone === "profit" && "text-profit-fg",
          tone === "loss" && "text-loss-fg"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function socialLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("twitter") || t === "x") return "X";
  if (t.includes("telegram")) return "Telegram";
  if (t.includes("discord")) return "Discord";
  if (t.includes("instagram")) return "Instagram";
  return type || "Link";
}

export default function TokenInfoPanel({ token, className }) {
  const { success: toastSuccess } = useToast();

  if (!token) {
    return (
      <div className={cn("px-4 py-6 text-center text-2xs text-content-subtle", className)}>
        Load a token to see pair stats.
      </div>
    );
  }

  const copyCa = async () => {
    try {
      await navigator.clipboard.writeText(token.address);
      toastSuccess("Copied", { description: "Contract address copied." });
    } catch {
      /* ignore */
    }
  };

  const h1 = token.priceChange?.h1 ?? token.changeH1;
  const h24 = token.priceChange?.h24;

  return (
    <div className={cn("border-b border-line", className)}>
      {token.headerImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={token.headerImageUrl}
          alt=""
          className="h-20 w-full object-cover"
        />
      ) : null}

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start gap-3">
          {token.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={token.imageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
              {(token.symbol || "?").slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-content">
              {token.symbol}
              {token.chainId && token.chainId !== "solana" ? (
                <span className="ml-2 rounded bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium capitalize text-content-muted">
                  {token.chainId}
                </span>
              ) : null}
            </h2>
            <p className="truncate text-2xs text-content-muted">{token.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-2xs text-content-subtle">
                {truncateMiddle(token.address, 6, 4)}
              </span>
              <button
                type="button"
                onClick={copyCa}
                className="rounded p-0.5 text-content-subtle hover:text-brand"
                title="Copy CA"
              >
                <Copy size={12} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface-sunken px-3 py-2">
          <p className="font-mono text-xl tnum font-semibold text-content">
            {token.priceUsd != null
              ? formatCurrency(token.priceUsd, {
                  compact: token.priceUsd < 0.01,
                  decimals: token.priceUsd < 0.01 ? 8 : 4,
                })
              : "—"}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-2xs">
            {h1 != null ? (
              <span className={h1 >= 0 ? "text-profit-fg" : "text-loss-fg"}>
                1h {formatPercent(h1, { signed: true })}
              </span>
            ) : null}
            {h24 != null ? (
              <span className={h24 >= 0 ? "text-profit-fg" : "text-loss-fg"}>
                24h {formatPercent(h24, { signed: true })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line bg-surface-raised px-3">
          <StatRow
            label="Market cap"
            value={
              token.marketCap != null
                ? formatCurrency(token.marketCap, { compact: true })
                : "—"
            }
          />
          <StatRow
            label="FDV"
            value={
              token.fdv != null ? formatCurrency(token.fdv, { compact: true }) : "—"
            }
          />
          <StatRow
            label="Liquidity"
            value={
              token.liquidity?.usd != null
                ? formatCurrency(token.liquidity.usd, { compact: true })
                : "—"
            }
          />
          <StatRow
            label="Volume 24h"
            value={
              token.volume?.h24 != null
                ? formatCurrency(token.volume.h24, { compact: true })
                : "—"
            }
          />
          <StatRow
            label="Volume 1h"
            value={
              token.volume?.h1 != null
                ? formatCurrency(token.volume.h1, { compact: true })
                : "—"
            }
          />
          <StatRow
            label="Pair created"
            value={
              token.pairCreatedAt
                ? formatRelative(token.pairCreatedAt)
                : token.ageHours != null
                  ? `${token.ageHours.toFixed(token.ageHours < 10 ? 1 : 0)}h ago`
                  : "—"
            }
          />
        </div>

        <div className="rounded-xl border border-line bg-surface-raised px-3 py-2 text-2xs">
          <p className="mb-1 font-semibold uppercase tracking-wider text-content-subtle">
            Pool
          </p>
          <p className="text-content">
            {token.dexId ? (
              <span className="capitalize">{token.dexId}</span>
            ) : (
              "—"
            )}
            {token.quoteToken?.symbol ? (
              <span className="text-content-muted">
                {" "}
                · {token.symbol}/{token.quoteToken.symbol}
              </span>
            ) : null}
          </p>
          {token.pairAddress ? (
            <p className="mt-1 font-mono text-content-subtle">
              {truncateMiddle(token.pairAddress, 6, 4)}
            </p>
          ) : null}
          {token.labels?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {token.labels.map((l) => (
                <span
                  key={l}
                  className="rounded bg-surface-sunken px-1.5 py-0.5 text-2xs text-content-muted"
                >
                  {l}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {(token.websites?.length > 0 || token.socials?.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {token.websites?.map((w) => (
              <a
                key={w.url}
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-raised px-2 py-1 text-2xs text-brand hover:text-brand-hover"
              >
                <Globe size={11} aria-hidden />
                {w.label || "Website"}
              </a>
            ))}
            {token.socials?.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-raised px-2 py-1 text-2xs text-content-muted hover:text-brand"
              >
                <ExternalLink size={11} aria-hidden />
                {socialLabel(s.type)}
              </a>
            ))}
          </div>
        )}

        {token.description ? (
          <div className="rounded-xl border border-line bg-surface-sunken px-3 py-2">
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              About
            </p>
            <p className="text-2xs leading-relaxed text-content-muted whitespace-pre-wrap">
              {token.description}
            </p>
          </div>
        ) : null}

        {token.url ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => window.open(token.url, "_blank", "noopener,noreferrer")}
          >
            Open on DexScreener
            <ExternalLink size={12} className="ml-1" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

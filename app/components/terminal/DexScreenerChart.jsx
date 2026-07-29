"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "../ui";
import { useTheme } from "../shell/ThemeProvider";

/** Extract pair address from a DexScreener URL. */
function pairAddressFromUrl(url, chainId = "solana") {
  if (!url) return null;
  const chain = String(chainId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const evm = new RegExp(`dexscreener\\.com\\/${chain}\\/(0x[a-fA-F0-9]{40})`, "i");
  const sol = new RegExp(
    `dexscreener\\.com\\/${chain}\\/([1-9A-HJ-NP-Za-km-z]{32,48})`,
    "i"
  );
  const m = String(url).match(evm) || String(url).match(sol);
  return m?.[1] || null;
}

/**
 * DexScreener embed — TradingView Advanced Charts (Solana, Robinhood, EVM).
 */
export default function DexScreenerChart({
  chainId = "solana",
  pairAddress,
  pairUrl,
  symbol,
  className,
}) {
  const { theme } = useTheme();
  const chain = String(chainId || "solana").toLowerCase();

  const resolvedPair = pairAddress || pairAddressFromUrl(pairUrl, chain);
  const embedSrc = useMemo(() => {
    if (!resolvedPair) return null;
    const params = new URLSearchParams({
      embed: "1",
      theme: theme === "light" ? "light" : "dark",
      trades: "0",
      info: "0",
    });
    return `https://dexscreener.com/${chain}/${encodeURIComponent(resolvedPair)}?${params}`;
  }, [resolvedPair, chain, theme]);

  const externalUrl =
    pairUrl || (resolvedPair ? `https://dexscreener.com/${chain}/${resolvedPair}` : null);

  if (!embedSrc) {
    return (
      <div
        className={cn(
          "flex min-h-[20rem] flex-1 flex-col items-center justify-center px-6 text-center",
          className
        )}
      >
        <p className="text-sm font-medium text-content">No pool found</p>
        <p className="mt-1 max-w-sm text-2xs text-content-subtle">
          TradingView charts need a DexScreener pair. This token may not have liquidity yet.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content">
            {symbol || "Chart"}
            <span className="ml-2 text-2xs font-normal text-content-subtle">
              · {chain} · TradingView
            </span>
          </p>
          <p className="text-2xs text-content-subtle">
            Timeframes, indicators &amp; drawing tools included
          </p>
        </div>
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-2xs text-brand hover:text-brand-hover"
          >
            Open full chart <ExternalLink size={10} aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="relative min-h-[24rem] flex-1 bg-surface-sunken sm:min-h-[32rem]">
        <iframe
          key={embedSrc}
          title={`${symbol || "Token"} chart`}
          src={embedSrc}
          className="absolute inset-0 h-full w-full border-0"
          allow="clipboard-write"
          loading="lazy"
        />
      </div>
    </div>
  );
}

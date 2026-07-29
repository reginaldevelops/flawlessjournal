"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "../ui";
import { useTheme } from "../shell/ThemeProvider";

/** Extract Solana pair address from a DexScreener URL. */
function pairAddressFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(
    /dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{32,48})/i
  );
  return m?.[1] || null;
}

/**
 * DexScreener embed — TradingView Advanced Charts under the hood.
 * Same chart engine BullX, Photon, etc. use via DexScreener for Solana pairs.
 */
export default function DexScreenerChart({
  pairAddress,
  pairUrl,
  symbol,
  className,
}) {
  const { theme } = useTheme();

  const resolvedPair = pairAddress || pairAddressFromUrl(pairUrl);
  const embedSrc = useMemo(() => {
    if (!resolvedPair) return null;
    const params = new URLSearchParams({
      embed: "1",
      theme: theme === "light" ? "light" : "dark",
      trades: "0",
      info: "0",
    });
    return `https://dexscreener.com/solana/${encodeURIComponent(resolvedPair)}?${params}`;
  }, [resolvedPair, theme]);

  const externalUrl =
    pairUrl ||
    (resolvedPair ? `https://dexscreener.com/solana/${resolvedPair}` : null);

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
              · TradingView via DexScreener
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

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  Button,
  Input,
  PageBody,
  PageHeader,
} from "../components/ui";
import { usePersistentJson } from "../components/dashboard/hooks";
import DexScreenerChart from "../components/terminal/DexScreenerChart";
import ResizeHandle from "../components/terminal/ResizeHandle";
import SessionFillsBar from "../components/terminal/SessionFillsBar";
import SwapSheet from "../components/swap/SwapSheet";
import TerminalSidebar, { WatchlistToggle } from "../components/terminal/TerminalSidebar";
import TokenInfoPanel from "../components/terminal/TokenInfoPanel";
import { useTerminalLayout } from "../components/terminal/useTerminalLayout";
import {
  isValidTerminalTokenAddress,
  normalizeTerminalQuery,
  terminalAddressError,
} from "../lib/terminal/validate";
import { mergeRecent, tokenListEntry } from "../lib/terminal/mapPair";

const WATCHLIST_KEY = "flawless.terminal.watchlist";
const RECENT_KEY = "flawless.terminal.recent";
const SIDEBAR_TAB_KEY = "flawless.terminal.sidebarTab";

function TerminalPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mintFromUrl = searchParams.get("mint")?.trim() || "";

  const [query, setQuery] = useState(mintFromUrl);
  const [token, setToken] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [sessionFills, setSessionFills] = useState([]);
  const [watchlist, setWatchlist] = usePersistentJson(WATCHLIST_KEY, []);
  const [recent, setRecent] = usePersistentJson(RECENT_KEY, []);
  const [sidebarTab, setSidebarTab] = usePersistentJson(SIDEBAR_TAB_KEY, "watchlist");

  const {
    sidebarWidth,
    rightWidth,
    chartHeight,
    startLeftResize,
    startRightResize,
    startChartResize,
  } = useTerminalLayout();

  const loadToken = useCallback(
    async (mint) => {
      const trimmed = normalizeTerminalQuery(mint);
      if (!trimmed) {
        setToken(null);
        setLookupError(null);
        return;
      }
      const addrErr = terminalAddressError(trimmed);
      if (addrErr) {
        setToken(null);
        setLookupError(addrErr);
        return;
      }

      setLookingUp(true);
      setLookupError(null);
      try {
        const res = await fetch(`/api/token/lookup?mint=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Token lookup failed");

        setToken(data);
        setQuery(trimmed);
        setSessionFills([]);
        router.replace(`/terminal?mint=${encodeURIComponent(trimmed)}`, { scroll: false });

        const entry = tokenListEntry(data);
        if (entry) {
          setRecent((prev) => mergeRecent(prev, entry, 20));
          setWatchlist((prev) =>
            (Array.isArray(prev) ? prev : []).map((w) =>
              w.address === entry.address && (w.chainId ?? "solana") === (entry.chainId ?? "solana")
                ? { ...w, priceUsd: entry.priceUsd, symbol: entry.symbol, imageUrl: entry.imageUrl, chainId: entry.chainId }
                : w
            )
          );
        }
      } catch (err) {
        setToken(null);
        setLookupError(err?.message || "Could not load token");
      } finally {
        setLookingUp(false);
      }
    },
    [router, setRecent, setWatchlist]
  );

  // Sync from URL only when ?mint= changes — never when `token` state updates,
  // otherwise a new load gets overwritten by the stale URL (e.g. stuck on Fartcoin).
  useEffect(() => {
    if (!mintFromUrl) return;
    setQuery(mintFromUrl);
    loadToken(mintFromUrl);
  }, [mintFromUrl, loadToken]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadToken(query);
  };

  const handleSwapSuccess = useCallback((result) => {
    const fill = result?.fill;
    if (!fill) return;
    setSessionFills((prev) => [
      ...prev,
      {
        id: fill.signature || fill.id || `fill-${Date.now()}`,
        side: fill.side,
        ts: fill.ts,
        priceUsd: fill.priceUsd,
      },
    ]);
  }, []);

  const inWatchlist = useMemo(
    () =>
      Boolean(
        token?.address &&
          watchlist.some(
            (w) =>
              w.address === token.address &&
              (w.chainId ?? "solana") === (token.chainId ?? "solana")
          )
      ),
    [token?.address, token?.chainId, watchlist]
  );

  const toggleWatchlist = useCallback(() => {
    if (!token?.address) return;
    const entry = tokenListEntry(token);
    if (!entry) return;
    setWatchlist((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.some((w) => w.address === token.address && (w.chainId ?? "solana") === (token.chainId ?? "solana"))) {
        return list.filter(
          (w) =>
            !(
              w.address === token.address &&
              (w.chainId ?? "solana") === (token.chainId ?? "solana")
            )
        );
      }
      return [entry, ...list];
    });
  }, [token, setWatchlist]);

  const removeFromWatchlist = useCallback(
    (address) => {
      setWatchlist((prev) => (Array.isArray(prev) ? prev : []).filter((w) => w.address !== address));
    },
    [setWatchlist]
  );

  return (
    <>
      <PageHeader
        title="Terminal"
        description="Watchlist, live TradingView chart, token stats and swap."
      />

      <PageBody wide className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        <form
          onSubmit={handleSearch}
          className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3"
        >
          <div className="relative min-w-[14rem] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Solana mint or Robinhood / EVM address (0x…)…"
              className="pl-9 font-mono text-sm"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <WatchlistToggle
            active={inWatchlist}
            disabled={!token}
            onClick={toggleWatchlist}
          />
          <Button type="submit" variant="primary" loading={lookingUp} disabled={!query.trim()}>
            Load
          </Button>
        </form>

        {lookupError ? (
          <p className="border-b border-loss/20 bg-loss/5 px-4 py-2 text-xs text-loss">
            {lookupError}
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col lg:min-h-[32rem] lg:flex-row">
          <div
            className="hidden min-h-0 shrink-0 flex-col border-b border-line lg:flex lg:border-b-0 lg:border-r"
            style={{ width: sidebarWidth }}
          >
            <TerminalSidebar
              tab={sidebarTab === "recent" ? "recent" : "watchlist"}
              onTabChange={setSidebarTab}
              watchlist={watchlist}
              recent={recent}
              activeMint={token?.address}
              onSelect={loadToken}
              onRemoveWatch={removeFromWatchlist}
              className="h-full min-h-[12rem]"
            />
          </div>

          <ResizeHandle
            axis="col"
            className="hidden lg:block"
            onDragStart={startLeftResize}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className="flex min-h-0 shrink-0 flex-col overflow-hidden"
              style={{ height: chartHeight }}
            >
              <DexScreenerChart
                key={`${token?.chainId}-${token?.address}` || "empty"}
                chainId={token?.chainId}
                pairAddress={token?.pairAddress}
                pairUrl={token?.url}
                symbol={token?.symbol}
                className="h-full"
              />
            </div>

            <ResizeHandle axis="row" onDragStart={(_, y) => startChartResize(y)} />

            <SessionFillsBar fills={sessionFills} />

            <div className="border-b border-line lg:hidden">
              <TerminalSidebar
                tab={sidebarTab === "recent" ? "recent" : "watchlist"}
                onTabChange={setSidebarTab}
                watchlist={watchlist}
                recent={recent}
                activeMint={token?.address}
                onSelect={loadToken}
                onRemoveWatch={removeFromWatchlist}
                className="max-h-48"
              />
            </div>
          </div>

          <ResizeHandle
            axis="col"
            className="hidden lg:block"
            onDragStart={startRightResize}
          />

          <aside
            className="hidden min-h-0 shrink-0 flex-col border-t border-line lg:flex lg:border-t-0 lg:border-l"
            style={{ width: rightWidth }}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <TokenInfoPanel token={token} />
              </div>
              <div className="shrink-0 border-t border-line">
                {token ? (
                  token.swapEnabled !== false ? (
                    <div className="max-h-[28rem] min-h-[18rem] overflow-y-auto">
                      <SwapSheet
                        key={token.address}
                        embedded
                        token={token}
                        initialSide="buy"
                        onSuccess={handleSwapSuccess}
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-medium text-content">Swap not available</p>
                      <p className="mt-1 text-2xs text-content-subtle">
                        Jupiter swaps are Solana-only. Chart and stats work for{" "}
                        <span className="capitalize">{token.chainId}</span> tokens — use
                        DexScreener or your wallet to trade on-chain.
                      </p>
                    </div>
                  )
                ) : (
                  <p className="px-4 py-8 text-center text-2xs text-content-subtle">
                    Load a token to swap
                  </p>
                )}
              </div>
            </div>
          </aside>

          <div className="border-t border-line lg:hidden">
            <TokenInfoPanel token={token} />
            {token ? (
              token.swapEnabled !== false ? (
                <SwapSheet
                  key={token.address}
                  embedded
                  token={token}
                  initialSide="buy"
                  onSuccess={handleSwapSuccess}
                />
              ) : (
                <p className="px-4 py-6 text-center text-2xs text-content-subtle">
                  Swap is Solana-only. View chart &amp; stats above.
                </p>
              )
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  );
}

export default function TerminalPage() {
  return (
    <Suspense
      fallback={
        <PageBody wide>
          <div className="animate-pulse rounded-lg bg-surface-raised p-8">Loading terminal…</div>
        </PageBody>
      }
    >
      <TerminalPageInner />
    </Suspense>
  );
}

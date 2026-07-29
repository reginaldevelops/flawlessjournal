"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LineChart, Search } from "lucide-react";
import {
  Button,
  Input,
  PageBody,
  PageHeader,
} from "../components/ui";
import DexScreenerChart from "../components/terminal/DexScreenerChart";
import SessionFillsBar from "../components/terminal/SessionFillsBar";
import SwapSheet from "../components/swap/SwapSheet";
import { isValidSolanaAddress } from "../lib/chain/validate";

function TerminalPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mintFromUrl = searchParams.get("mint")?.trim() || "";

  const [query, setQuery] = useState(mintFromUrl);
  const [token, setToken] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [sessionFills, setSessionFills] = useState([]);

  const loadToken = useCallback(async (mint) => {
    const trimmed = String(mint || "").trim();
    if (!trimmed) {
      setToken(null);
      setLookupError(null);
      return;
    }
    if (!isValidSolanaAddress(trimmed)) {
      setToken(null);
      setLookupError("Enter a valid Solana contract address (32-byte base58 mint).");
      return;
    }

    setLookingUp(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/token/lookup?mint=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Token lookup failed");
      setToken(data);
      router.replace(`/terminal?mint=${encodeURIComponent(trimmed)}`, { scroll: false });
    } catch (err) {
      setToken(null);
      setLookupError(err?.message || "Could not load token");
    } finally {
      setLookingUp(false);
    }
  }, [router]);

  useEffect(() => {
    if (mintFromUrl && mintFromUrl !== token?.address) {
      setQuery(mintFromUrl);
      loadToken(mintFromUrl);
    }
  }, [mintFromUrl, loadToken, token?.address]);

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

  return (
    <>
      <PageHeader
        title="Terminal"
        description="Paste a contract address — TradingView chart with buy/sell panel."
      />

      <PageBody wide className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        <form
          onSubmit={handleSearch}
          className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3"
        >
          <div className="relative min-w-[16rem] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste Solana contract address (CA)…"
              className="pl-9 font-mono text-sm"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="primary" loading={lookingUp} disabled={!query.trim()}>
            Load chart
          </Button>
          {token ? (
            <div className="flex items-center gap-2">
              {token.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={token.imageUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-2xs font-bold text-brand">
                  {(token.symbol || "?").slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-content">{token.symbol}</p>
                <p className="truncate font-mono text-2xs text-content-subtle">
                  {token.address.slice(0, 6)}…{token.address.slice(-4)}
                </p>
              </div>
            </div>
          ) : null}
        </form>

        {lookupError ? (
          <p className="border-b border-loss/20 bg-loss/5 px-4 py-2 text-xs text-loss">
            {lookupError}
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-[24rem] min-w-0 flex-1 flex-col border-b border-line lg:border-b-0 lg:border-r">
            <DexScreenerChart
              pairAddress={token?.pairAddress}
              pairUrl={token?.url}
              symbol={token?.symbol}
            />
            <SessionFillsBar fills={sessionFills} />
          </div>

          <aside className="flex w-full shrink-0 flex-col lg:w-[22rem] xl:w-[24rem]">
            {token ? (
              <div className="min-h-[28rem] flex-1">
                <SwapSheet
                  embedded
                  token={token}
                  initialSide="buy"
                  onSuccess={handleSwapSuccess}
                />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <LineChart size={32} className="mb-3 text-content-subtle" aria-hidden />
                <p className="text-sm font-medium text-content">No token loaded</p>
                <p className="mt-1 max-w-xs text-2xs text-content-subtle">
                  Paste a Solana mint address above to load the TradingView chart and swap panel.
                </p>
              </div>
            )}
          </aside>
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

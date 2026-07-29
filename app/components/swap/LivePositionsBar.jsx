"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Activity, ChevronRight } from "lucide-react";
import { Tooltip } from "../ui/Overlays";
import { cn } from "../ui";
import { formatCurrency, formatRelative, toneTextClass } from "../../lib/format";
import { useVisibleInterval } from "../../lib/hooks/useVisibleInterval";
import { supabase } from "../../lib/supabaseClient";
import { fetchUsdPrices } from "../../lib/swap/clientPrices";
import { LIVE_POSITIONS_REFRESH_MS } from "../../lib/swap/constants";
import { runWalletSync } from "../../lib/swap/importFills";
import {
  isPositionLive,
  unrealizedPnlUsd,
} from "../../lib/swap/position";
import {
  notifyPositionChanged,
  subscribePositionChanged,
} from "../../lib/swap/positionEvents";
import { fetchWalletMintBalance } from "../../lib/swap/walletBalance";

/**
 * Thin global bar under the app header for open Solana positions.
 * Refreshes every ~5s while tab visible; wallet reconcile when Phantom connected.
 */
export default function LivePositionsBar() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const syncCooldownUntil = useRef(0);

  const maybeSyncExternalClose = useCallback(async (address) => {
    const now = Date.now();
    if (now < syncCooldownUntil.current) return;
    syncCooldownUntil.current = now + 12_000;
    try {
      await runWalletSync(address, { limit: 40, quiet: true });
      notifyPositionChanged({ source: "wallet-sync" });
    } catch (err) {
      console.warn("[live-positions] wallet sync:", err?.message || err);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("id, data, trade_number")
        .order("id", { ascending: false })
        .limit(250);
      if (error) throw error;

      let open = (data ?? [])
        .map((row) => {
          const fj = row.data?._fj;
          if (!fj || fj.kind !== "solana_position") return null;
          if (!isPositionLive(fj.computed)) return null;
          return {
            id: row.id,
            tradeNumber: row.trade_number,
            symbol: fj.tokenSymbol || row.data?.Coins || row.data?.Coin || "Token",
            mint: fj.tokenMint,
            computed: fj.computed ?? {},
          };
        })
        .filter(Boolean);

      if (wallet.publicKey && open.length > 0) {
        let sawWalletEmpty = false;
        const checked = await Promise.all(
          open.map(async (row) => {
            const bal = await fetchWalletMintBalance(
              connection,
              wallet.publicKey,
              row.mint
            );
            if (bal && bal.ui <= 1e-12) {
              sawWalletEmpty = true;
              return null;
            }
            return row;
          })
        );
        open = checked.filter(Boolean);
        if (sawWalletEmpty) {
          maybeSyncExternalClose(wallet.publicKey.toBase58());
        }
      }

      setLastUpdatedAt(Date.now());

      if (!open.length) {
        setRows([]);
        return;
      }

      const prices = await fetchUsdPrices(open.map((o) => o.mint));
      setRows(
        open.map((o) => {
          const mark = prices[o.mint] ?? null;
          const unrealized = unrealizedPnlUsd(o.computed, mark);
          return { ...o, markPrice: mark, unrealized };
        })
      );
    } catch (err) {
      console.warn("[live-positions]", err?.message || err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey, maybeSyncExternalClose]);

  useVisibleInterval(load, LIVE_POSITIONS_REFRESH_MS, true);

  useEffect(() => {
    const unsub = subscribePositionChanged((ev) => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        load();
      }
      const source = ev?.detail?.source;
      if (
        (source === "swap" || source === "wallet-sync") &&
        wallet.publicKey
      ) {
        maybeSyncExternalClose(wallet.publicKey.toBase58());
      }
    });
    return unsub;
  }, [load, wallet.publicKey, maybeSyncExternalClose]);

  if (loading || rows.length === 0) return null;

  const updatedLabel = lastUpdatedAt
    ? `Last updated ${formatRelative(lastUpdatedAt)}`
    : "Updating…";

  return (
    <div className="sticky top-topbar z-header border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-1.5 sm:px-5">
        <Tooltip content={updatedLabel}>
          <span className="inline-flex shrink-0 cursor-default items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            <Activity size={11} aria-hidden />
            Live
          </span>
        </Tooltip>
        <div className="flex min-w-0 items-center gap-1.5">
          {rows.map((row) => {
            const pnl = row.unrealized;
            const tone =
              pnl == null ? "text-content-muted" : toneTextClass(pnl);
            return (
              <Link
                key={row.id}
                href={`/trade/${row.id}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface-raised px-2 py-1",
                  "text-2xs transition-colors hover:border-line-strong hover:bg-surface-hover"
                )}
              >
                <span className="font-semibold text-content">{row.symbol}</span>
                <span className={cn("font-mono tnum font-semibold", tone)}>
                  {pnl == null
                    ? "—"
                    : formatCurrency(pnl, { compact: true, signed: true })}
                </span>
                <ChevronRight size={10} className="text-content-subtle" aria-hidden />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

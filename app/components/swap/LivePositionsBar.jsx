"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { cn } from "../ui";
import { formatCurrency, toneTextClass } from "../../lib/format";
import { supabase } from "../../lib/supabaseClient";
import { fetchUsdPrices } from "../../lib/swap/clientPrices";
import {
  isPositionLive,
  unrealizedPnlUsd,
} from "../../lib/swap/position";

/**
 * Thin global bar under the app header for open Solana positions.
 */
export default function LivePositionsBar() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("id, data, trade_number")
        .order("id", { ascending: false })
        .limit(250);
      if (error) throw error;

      const open = (data ?? [])
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
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="sticky top-topbar z-header border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-1.5 sm:px-5">
        <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
          <Activity size={11} aria-hidden />
          Live
        </span>
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

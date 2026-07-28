"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { Badge, cn } from "../ui";
import { formatCurrency, formatDate, formatNumber, formatTime } from "../../lib/format";

/**
 * One compact trade line, shared by the recent-trades list and the calendar
 * day drill-in. Links straight to the trade detail page.
 */
export default function TradeRow({ trade, showDate = true }) {
  const open = !trade.hasResult;
  const tone = open ? "neutral" : trade.pnl > 0 ? "profit" : trade.pnl < 0 ? "loss" : "neutral";
  const SideIcon = trade.side === "short" ? ArrowDownRight : ArrowUpRight;

  return (
    <Link
      href={trade.id ? `/trade/${trade.id}` : "/trades"}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150",
        "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          trade.side === "short" ? "bg-loss-soft text-loss-fg" : "bg-profit-soft text-profit-fg"
        )}
        aria-hidden
      >
        <SideIcon size={14} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-content">{trade.symbol ?? "Unlabelled"}</p>
          {open && (
            <Badge tone="info" size="xs">
              Open
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-2xs text-content-subtle">
          {[
            showDate ? formatDate(trade.date, "short") : trade.entryTime ? formatTime(trade.entryTime) : null,
            trade.setup,
            trade.session,
          ]
            .filter(Boolean)
            .join(" · ") || "No details logged"}
        </p>
      </div>

      {trade.rMultiple != null && Number.isFinite(trade.rMultiple) && (
        <span className="hidden shrink-0 font-mono text-2xs tnum text-content-subtle sm:block">
          {formatNumber(trade.rMultiple, { decimals: 2, signed: true })}R
        </span>
      )}

      <span
        className={cn(
          "shrink-0 font-mono text-xs font-semibold tnum",
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-content-muted"
        )}
      >
        {open ? "—" : formatCurrency(trade.pnl, { decimals: 0, signed: true })}
      </span>

      <ChevronRight
        size={13}
        className="shrink-0 text-content-subtle opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

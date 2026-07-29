"use client";

import { Star, Trash2 } from "lucide-react";
import { Segmented, cn } from "../ui";
import { formatCurrency } from "../../lib/format";

export default function TerminalSidebar({
  tab,
  onTabChange,
  watchlist = [],
  recent = [],
  activeMint,
  onSelect,
  onRemoveWatch,
  className,
}) {
  const items = tab === "watchlist" ? watchlist : recent;

  return (
    <div className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <div className="border-b border-line px-2 py-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={onTabChange}
          options={[
            { value: "watchlist", label: "Watchlist" },
            { value: "recent", label: "Recent" },
          ]}
          full
          className="w-full"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-2xs text-content-subtle">
            {tab === "watchlist"
              ? "Star a token to add it here."
              : "Tokens you open appear here (last 20)."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = item.address === activeMint;
              return (
                <li key={`${item.chainId ?? "solana"}-${item.address}`}>
                  <div
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition",
                      active
                        ? "bg-brand-soft ring-1 ring-brand/30"
                        : "hover:bg-surface-raised"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(item.address)}
                      className="flex min-w-0 flex-1 items-center gap-2"
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-2xs font-bold text-brand">
                          {(item.symbol || "?").slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-content">
                          {item.symbol || "TOKEN"}
                          {item.chainId && item.chainId !== "solana" ? (
                            <span className="ml-1 text-2xs font-normal capitalize text-content-subtle">
                              · {item.chainId}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate font-mono text-2xs text-content-subtle">
                          {item.priceUsd != null
                            ? formatCurrency(item.priceUsd, {
                                compact: item.priceUsd < 0.01,
                                decimals: item.priceUsd < 0.01 ? 6 : 4,
                              })
                            : `${item.address.slice(0, 4)}…${item.address.slice(-4)}`}
                        </p>
                      </div>
                    </button>
                    {tab === "watchlist" ? (
                      <button
                        type="button"
                        title="Remove from watchlist"
                        onClick={() => onRemoveWatch(item.address)}
                        className="rounded p-1 text-content-subtle opacity-0 transition hover:bg-loss/10 hover:text-loss group-hover:opacity-100"
                      >
                        <Trash2 size={12} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function WatchlistToggle({ active, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition",
        active
          ? "border-brand/40 bg-brand-soft text-brand"
          : "border-line bg-surface-raised text-content-subtle hover:text-brand",
        disabled && "opacity-40"
      )}
    >
      <Star size={16} fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

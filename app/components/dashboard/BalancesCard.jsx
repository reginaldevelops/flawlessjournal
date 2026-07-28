"use client";

import Link from "next/link";
import { ArrowUpRight, RefreshCw, Wallet, WifiOff } from "lucide-react";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  Skeleton,
  Tooltip,
  cn,
} from "../ui";
import { formatCurrency, formatPercent, formatRelative, truncateMiddle } from "../../lib/format";

export default function BalancesCard({ balances }) {
  const { loading, venues, totalUSD, fetchedAt, errors, reload } = balances;
  const unavailable = !loading && (totalUSD == null || !venues.length);

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Wallet}
        title="Account equity"
        subtitle={venues.length ? `${venues.length} venue${venues.length === 1 ? "" : "s"} connected` : "Live balances"}
        actions={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={RefreshCw}
            aria-label="Refresh balances"
            onClick={reload}
            className={loading ? "pointer-events-none opacity-60" : undefined}
          />
        }
      />

      <CardBody className="flex flex-1 flex-col p-4 sm:p-5">
        {loading ? (
          <>
            <Skeleton className="h-9 w-40" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </>
        ) : unavailable ? (
          <EmptyState
            icon={WifiOff}
            title="Balances unavailable"
            description="The wallet and exchange endpoints did not respond. Your journal data is unaffected."
            compact
            action={
              <div className="mt-4 flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={reload}>
                  Retry
                </Button>
                <Button as={Link} href="/wallets" variant="ghost" size="sm">
                  Manage wallets
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <p className="stat-number text-stat text-content">
              <AnimatedNumber value={totalUSD} format={(v) => formatCurrency(v, { decimals: 0 })} />
            </p>
            <p className="mt-0.5 text-2xs text-content-subtle">
              Total across connected wallets and exchanges
            </p>

            <ul className="mt-4 space-y-2">
              {venues.map((venue) => {
                const share = totalUSD > 0 ? (venue.totalUSD / totalUSD) * 100 : 0;
                return (
                  <li key={venue.id} className="rounded-lg border border-line bg-surface-sunken px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-content">{venue.label}</p>
                        <p className="truncate text-2xs text-content-subtle">
                          {venue.detail ??
                            (venue.address ? truncateMiddle(venue.address, 6, 4) : "—")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-semibold tnum text-content">
                          {formatCurrency(venue.totalUSD, { decimals: 0 })}
                        </p>
                        <p className="font-mono text-2xs tnum text-content-subtle">
                          {formatPercent(share, { decimals: 0 })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-brand-gradient"
                        style={{ width: `${Math.max(share, 1)}%` }}
                      />
                    </div>
                    {venue.holdings?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {venue.holdings.map((holding) => (
                          <span
                            key={holding.symbol}
                            className={cn(
                              "rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs tnum text-content-muted"
                            )}
                          >
                            {holding.symbol} {formatCurrency(holding.valueUSD, { decimals: 0, compact: true })}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardBody>

      <CardFooter className="px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {fetchedAt ? (
            <p className="truncate text-2xs text-content-subtle">Updated {formatRelative(fetchedAt)}</p>
          ) : (
            <p className="text-2xs text-content-subtle">Live pricing</p>
          )}
          {!loading && errors.length > 0 && (
            <Tooltip content={errors.join(" · ")}>
              <Badge tone="warn" size="xs">
                Partial
              </Badge>
            </Tooltip>
          )}
        </div>
        <Button as={Link} href="/wallets" variant="ghost" size="xs" iconRight={ArrowUpRight}>
          Wallets
        </Button>
      </CardFooter>
    </Card>
  );
}

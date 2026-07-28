"use client";

import Link from "next/link";
import { ArrowUpRight, ListOrdered, Plus } from "lucide-react";
import { Button, Card, CardBody, CardHeader, EmptyState, Skeleton } from "../ui";
import TradeRow from "./TradeRow";

export default function RecentTradesCard({ trades = [], loading, limit = 8 }) {
  const rows = trades.slice(0, limit);

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={ListOrdered}
        title="Recent trades"
        subtitle={rows.length ? `Last ${rows.length} logged` : "Nothing logged yet"}
        actions={
          <Button as={Link} href="/trades" variant="ghost" size="xs" iconRight={ArrowUpRight}>
            All trades
          </Button>
        }
      />

      <CardBody className="flex-1 p-2 sm:p-3">
        {loading ? (
          <div className="space-y-1.5 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <EmptyState
            icon={Plus}
            title="No trades yet"
            description="Log your first trade and this dashboard fills itself in — metrics, calendar, insights and all."
            compact
            action={
              <Button as={Link} href="/trades" variant="primary" size="sm" className="mt-4">
                Log a trade
              </Button>
            }
          />
        ) : (
          <div className="space-y-0.5">
            {rows.map((trade) => (
              <TradeRow key={trade.id ?? trade.tradeNumber} trade={trade} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

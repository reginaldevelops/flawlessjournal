"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button, Card, CardBody, CardHeader, EmptyState, Skeleton, cn } from "../ui";

const TONE_STYLES = {
  profit: {
    icon: TrendingUp,
    wrap: "border-profit/25 bg-profit-soft/40",
    badge: "bg-profit-soft text-profit-fg",
    title: "text-content",
  },
  loss: {
    icon: TrendingDown,
    wrap: "border-loss/25 bg-loss-soft/40",
    badge: "bg-loss-soft text-loss-fg",
    title: "text-content",
  },
  warn: {
    icon: AlertTriangle,
    wrap: "border-warn/25 bg-warn-soft/40",
    badge: "bg-warn-soft text-warn-fg",
    title: "text-content",
  },
};

export default function InsightsCard({ insights = [], loading, tradeCount = 0 }) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Sparkles}
        title="What to work on"
        subtitle="Ranked by how much they move your bottom line"
        actions={
          <Button as={Link} href="/analytics" variant="ghost" size="xs" iconRight={ArrowUpRight}>
            Analytics
          </Button>
        }
      />

      <CardBody className="flex-1 p-3 sm:p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !insights.length ? (
          <EmptyState
            icon={Lightbulb}
            title={tradeCount < 5 ? "Insights need a few more trades" : "Nothing stands out this period"}
            description={
              tradeCount < 5
                ? "Once five trades are closed in the selected period, strengths and leaks are called out here automatically."
                : "No setup, session or risk pattern is materially helping or hurting you right now. Widen the period to look further back."
            }
            compact
          />
        ) : (
          <ul className="space-y-2">
            {insights.map((insight) => {
              const style = TONE_STYLES[insight.tone] ?? TONE_STYLES.warn;
              const Icon = style.icon;
              return (
                <li
                  key={insight.id}
                  className={cn(
                    "flex gap-3 rounded-lg border p-3 transition-colors duration-150",
                    style.wrap
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      style.badge
                    )}
                    aria-hidden
                  >
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-xs font-semibold leading-snug", style.title)}>{insight.title}</p>
                    <p className="mt-1 text-2xs leading-relaxed text-content-muted">{insight.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

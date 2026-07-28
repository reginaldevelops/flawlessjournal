"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Download,
  Lightbulb,
  Printer,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  MiniBar,
  Progress,
  Tooltip,
  cn,
} from "../ui";
import { generateInsights } from "../../lib/trades";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRatio,
  pluralize,
} from "../../lib/format";
import { Callout, MiniStat, SectionHeading } from "./shared";
import {
  disciplineReport,
  downloadCsv,
  leakReport,
  letterGrade,
  scoreTone,
  tradesToCsv,
} from "./metrics-extra";

const INSIGHT_ICON = { profit: TrendingUp, loss: TrendingDown, warn: AlertTriangle };

export function ReportTab({ metrics, trades, dims, plannedRisk, variables, window: dateWindow }) {
  const insights = useMemo(() => generateInsights(metrics.closed, metrics), [metrics]);
  const discipline = useMemo(
    () => disciplineReport(metrics.closed, metrics, { plannedRisk }),
    [metrics, plannedRisk]
  );
  const leaks = useMemo(
    () => leakReport(metrics.closed, metrics, dims, { plannedRisk }),
    [metrics, dims, plannedRisk]
  );

  const exportTrades = () => {
    downloadCsv(
      `trades-${dateWindow.effectiveStart ?? "all"}-${dateWindow.effectiveEnd ?? "all"}.csv`,
      tradesToCsv(trades, variables)
    );
  };

  return (
    <div className="space-y-5">
      <Card className="print:break-inside-avoid">
        <CardBody className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-content-subtle">
              Edge report
            </p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-content">
              {dateWindow.effectiveStart ? formatDate(dateWindow.effectiveStart, "medium") : "—"} →{" "}
              {dateWindow.effectiveEnd ? formatDate(dateWindow.effectiveEnd, "medium") : "—"}
            </h2>
            <p className="mt-1 text-xs text-content-muted">
              {pluralize(metrics.totalTrades, "closed trade")} across{" "}
              {pluralize(metrics.tradingDays, "session")} · generated{" "}
              {formatDate(new Date(), "medium")}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="secondary" size="sm" icon={Download} onClick={exportTrades}>
              Export trades
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Printer}
              onClick={() => typeof window !== "undefined" && window.print()}
            >
              Print
            </Button>
          </div>
        </CardBody>
        <div className="grid gap-3 border-t border-line p-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <MiniStat
            label="Net P&L"
            value={formatCurrency(metrics.netPnl, { decimals: 0, signed: true })}
            tone={metrics.netPnl >= 0 ? "profit" : "loss"}
          />
          <MiniStat label="Win rate" value={formatPercent(metrics.winRate, { decimals: 1 })} />
          <MiniStat
            label="Profit factor"
            value={formatRatio(metrics.profitFactor)}
            tone={metrics.profitFactor >= 1 ? "profit" : "loss"}
          />
          <MiniStat
            label="Expectancy"
            value={formatCurrency(metrics.expectancy, { decimals: 0, signed: true })}
            tone={metrics.expectancy >= 0 ? "profit" : "loss"}
          />
          <MiniStat
            label="Max drawdown"
            value={formatCurrency(metrics.maxDrawdown, { decimals: 0 })}
            tone="loss"
          />
          <MiniStat
            label="SQN"
            value={formatNumber(metrics.sqn, { decimals: 2 })}
            tone={metrics.sqn >= 2 ? "profit" : metrics.sqn >= 1 ? "warn" : "loss"}
          />
        </div>
      </Card>

      {insights.length > 0 && (
        <section className="space-y-3">
          <SectionHeading
            title="What the data is telling you"
            description="Ordered by how much money each observation is worth."
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {insights.map((insight, i) => (
              <Callout
                key={insight.id}
                tone={insight.tone}
                icon={INSIGHT_ICON[insight.tone] ?? Lightbulb}
                eyebrow={`Priority ${i + 1}`}
                title={insight.title}
                description={insight.detail}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {discipline && <Scorecard report={discipline} />}
        <FixList leaks={leaks} metrics={metrics} />
      </div>
    </div>
  );
}

function Scorecard({ report }) {
  const tone = scoreTone(report.score);
  const ring = tone === "profit" ? "border-profit/40" : tone === "warn" ? "border-warn/40" : "border-loss/40";
  const text = tone === "profit" ? "text-profit" : tone === "warn" ? "text-warn" : "text-loss";

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader
        title="Discipline scorecard"
        subtitle="Grades behaviour, not luck"
        icon={ShieldCheck}
      />
      <CardBody className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 bg-surface-sunken",
              ring
            )}
          >
            <span className={cn("stat-number text-2xl", text)}>{report.grade}</span>
            <span className="text-2xs text-content-subtle">{Math.round(report.score)}/100</span>
          </div>
          <p className="text-xs leading-relaxed text-content-muted text-pretty">
            {report.score >= 74
              ? "Your process is holding. Protect it: the biggest risk to a disciplined trader is a winning streak."
              : report.score >= 55
                ? "The plan exists but slips under pressure. The components below show exactly where."
                : "Execution — not strategy — is your bottleneck right now. Fix the lowest bar first; the P&L follows."}
          </p>
        </div>

        <div className="space-y-2.5">
          {report.components.map((c) => (
            <div key={c.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-content-muted">
                  {c.label}
                  <Tooltip content={c.hint}>
                    <span className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-line text-[9px] font-semibold text-content-subtle">
                      ?
                    </span>
                  </Tooltip>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-2xs tnum text-content-subtle">{c.value}</span>
                  <Badge tone={scoreTone(c.score)} size="xs">
                    {letterGrade(c.score)}
                  </Badge>
                </span>
              </div>
              <Progress value={c.score} tone={scoreTone(c.score)} />
              <p className="mt-1 text-2xs leading-relaxed text-content-subtle">{c.detail}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function FixList({ leaks, metrics }) {
  if (!leaks.length) {
    return (
      <Card className="print:break-inside-avoid">
        <CardHeader title="What to fix first" icon={Target} />
        <CardBody className="p-6">
          <p className="text-sm text-content-muted">
            No single bucket is bleeding enough to call it a leak in this selection. Widen the date
            range or clear a filter to look for one.
          </p>
        </CardBody>
      </Card>
    );
  }

  const maxCost = Math.max(...leaks.map((l) => l.cost));

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader
        title="What to fix first"
        subtitle="Ranked by the P&L you would have kept by removing each pattern entirely"
        icon={Target}
      />
      <div className="divide-y divide-line-subtle">
        {leaks.map((leak, i) => (
          <div key={leak.id} className="flex flex-wrap items-start gap-3 p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-loss-soft font-mono text-2xs font-bold tnum text-loss-fg">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral" size="xs">
                  {leak.scope}
                </Badge>
                <p className="text-sm font-semibold text-content">{leak.label}</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-content-muted text-pretty">
                {pluralize(leak.count, "trade")} at a {formatPercent(leak.winRate, { decimals: 0 })} win
                rate cost you {formatCurrency(leak.cost, { decimals: 0 })} —{" "}
                {formatPercent(leak.share, { decimals: 0 })} of every dollar you lost.
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-content-subtle">
                <span className="flex items-center gap-1">
                  <ClipboardCheck size={11} aria-hidden />
                  {leak.action}
                </span>
                <span className="font-mono tnum">
                  Net {formatCurrency(metrics.netPnl, { decimals: 0, signed: true })} →{" "}
                  <span className="text-profit">
                    {formatCurrency(leak.netWithout, { decimals: 0, signed: true })}
                  </span>
                </span>
                <span className="font-mono tnum">
                  PF {formatRatio(metrics.profitFactor)} →{" "}
                  <span className="text-profit">{formatRatio(leak.profitFactorWithout)}</span>
                </span>
              </p>
              <div className="mt-2 max-w-xs">
                <MiniBar value={leak.cost} max={maxCost} tone="loss" />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="stat-number text-lg text-profit">
                {formatCurrency(leak.netDelta, { decimals: 0, signed: true })}
              </p>
              <p className="text-2xs text-content-subtle">impact</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default ReportTab;

"use client";

import { Card, CardHeader, Tooltip } from "../ui";
import { CalendarClock } from "lucide-react";
import { formatCurrency, formatPercent, pluralize } from "../../lib/format";

/** Alpha ramp so a small edge is still visible without washing out the big ones. */
function tint(pnl, maxAbs) {
  if (!pnl || !maxAbs) return null;
  const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
  const alpha = 0.14 + intensity ** 0.7 * 0.66;
  return `rgb(var(--${pnl > 0 ? "profit" : "loss"}) / ${alpha.toFixed(3)})`;
}

/** Weekday × entry-hour P&L grid — the fastest way to spot a bad time slot. */
export function WeekdayHourHeatmap({ matrix }) {
  const { rows, hours, maxAbs } = matrix;

  return (
    <Card className="overflow-hidden print:break-inside-avoid">
      <CardHeader
        title="Weekday × hour heatmap"
        subtitle="Net P&L by day and entry hour — darker means more money made or lost"
        icon={CalendarClock}
        actions={<Legend />}
      />
      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-xs text-content-subtle">
          No entry times recorded in this selection.
        </div>
      ) : (
        <div className="overflow-x-auto p-4 thin-scrollbar">
          <div style={{ minWidth: Math.max(520, hours.length * 40 + 96) }}>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `2.5rem repeat(${hours.length}, minmax(0, 1fr)) 4.25rem` }}
            >
              <span />
              {hours.map((h) => (
                <span key={h} className="text-center font-mono text-2xs tnum text-content-subtle">
                  {String(h).padStart(2, "0")}
                </span>
              ))}
              <span className="text-right text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                Total
              </span>

              {rows.map((row) => (
                <Row key={row.weekday} row={row} maxAbs={maxAbs} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ row, maxAbs }) {
  return (
    <>
      <span className="flex items-center text-2xs font-medium text-content-muted">{row.label}</span>
      {row.cells.map((cell) => {
        const bg = tint(cell.pnl, maxAbs);
        const content = cell.count ? (
          <Tooltip
            content={
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {row.full} {String(cell.hour).padStart(2, "0")}:00
                </p>
                <p className="font-mono tnum">
                  {formatCurrency(cell.pnl, { decimals: 0, signed: true })} ·{" "}
                  {pluralize(cell.count, "trade")}
                </p>
                <p className="text-content-muted">
                  {formatPercent(cell.winRate, { decimals: 0 })} win rate
                </p>
              </div>
            }
          >
            <span
              className="flex h-8 cursor-help items-center justify-center rounded-md border border-line-subtle font-mono text-2xs tnum text-content transition-transform duration-150 hover:scale-[1.08]"
              style={bg ? { background: bg } : undefined}
            >
              {Math.abs(cell.pnl) >= 1000
                ? `${cell.pnl < 0 ? "-" : ""}${(Math.abs(cell.pnl) / 1000).toFixed(1)}k`
                : Math.round(cell.pnl)}
            </span>
          </Tooltip>
        ) : (
          <span className="flex h-8 items-center justify-center rounded-md bg-surface-sunken text-2xs text-content-subtle">
            ·
          </span>
        );
        return <span key={`${row.weekday}-${cell.hour}`}>{content}</span>;
      })}
      <span
        className={`flex h-8 items-center justify-end rounded-md px-2 font-mono text-2xs font-semibold tnum ${
          row.pnl >= 0 ? "text-profit" : "text-loss"
        }`}
        style={{ background: tint(row.pnl, maxAbs * 2.2) ?? undefined }}
      >
        {formatCurrency(row.pnl, { decimals: 0, compact: true, signed: true })}
      </span>
    </>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-content-subtle">Loss</span>
      <span className="flex">
        {[0.8, 0.5, 0.25].map((a) => (
          <span
            key={a}
            className="h-3 w-3 rounded-sm"
            style={{ background: `rgb(var(--loss) / ${a})` }}
          />
        ))}
        <span className="h-3 w-3 rounded-sm bg-surface-sunken" />
        {[0.25, 0.5, 0.8].map((a) => (
          <span
            key={a}
            className="h-3 w-3 rounded-sm"
            style={{ background: `rgb(var(--profit) / ${a})` }}
          />
        ))}
      </span>
      <span className="text-2xs text-content-subtle">Profit</span>
    </div>
  );
}

export default WeekdayHourHeatmap;

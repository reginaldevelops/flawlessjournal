"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, Tooltip, cn } from "../ui";
import {
  compactNumber,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatR,
  formatRatio,
  toneTextClass,
} from "../../lib/format";

/* ------------------------------------------------------------------ */
/* Formatting helpers shared by every analytics chart and table        */
/* ------------------------------------------------------------------ */

export const money = (v, opts = {}) => formatCurrency(v, { decimals: 0, ...opts });
export const moneySigned = (v, opts = {}) =>
  formatCurrency(v, { decimals: 0, signed: true, ...opts });

/** Axis ticks: compact, sign-aware, never wider than five characters. */
export const moneyTick = (v) => {
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${compactNumber(Math.abs(n))}`;
};

export const percentTick = (v) => `${Math.round(Number(v) || 0)}%`;
export const rTick = (v) => `${Number(v) > 0 ? "+" : ""}${Math.round(Number(v) || 0)}R`;

export const formatMetric = (kind, value) => {
  if (value === null || value === undefined) return "—";
  switch (kind) {
    case "currency":
      return money(value);
    case "percent":
      return formatPercent(value, { decimals: 1 });
    case "ratio":
      return formatRatio(value);
    case "r":
      return formatR(value);
    case "int":
      return formatNumber(value, { decimals: 0 });
    case "duration":
      return value >= 60
        ? `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`
        : `${Math.round(value)}m`;
    default:
      return formatNumber(value, { decimals: 2 });
  }
};

/* ------------------------------------------------------------------ */
/* Layout primitives                                                  */
/* ------------------------------------------------------------------ */

/** Card wrapper with a consistent header and a fixed-height chart area. */
export function ChartCard({
  title,
  subtitle,
  icon,
  actions,
  height = 280,
  children,
  footer,
  className,
  bodyClassName,
  empty,
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden print:break-inside-avoid", className)}>
      {(title || actions) && (
        <CardHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />
      )}
      <CardBody className={cn("flex-1 p-4 pt-4", bodyClassName)}>
        {empty ? (
          <div className="flex items-center justify-center" style={{ height }}>
            <p className="text-xs text-content-subtle">{empty}</p>
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </CardBody>
      {footer && (
        <div className="border-t border-line px-4 py-2.5 text-2xs text-content-subtle">{footer}</div>
      )}
    </Card>
  );
}

/** Highlighted "here is the story" panel used to surface the strongest signal. */
export function Callout({ tone = "brand", eyebrow, title, description, value, valueLabel, icon: Icon, className }) {
  const toneMap = {
    profit: "border-profit/30 bg-profit-soft/50",
    loss: "border-loss/30 bg-loss-soft/50",
    warn: "border-warn/30 bg-warn-soft/50",
    brand: "border-brand/25 bg-brand-soft/50",
    info: "border-info/30 bg-info-soft/50",
  };
  const textMap = {
    profit: "text-profit-fg",
    loss: "text-loss-fg",
    warn: "text-warn-fg",
    brand: "text-brand",
    info: "text-info-fg",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 print:break-inside-avoid",
        toneMap[tone] ?? toneMap.brand,
        className
      )}
    >
      {Icon && (
        <span className={cn("mt-0.5 shrink-0", textMap[tone] ?? textMap.brand)}>
          <Icon size={16} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-content-subtle">
            {eyebrow}
          </p>
        )}
        <p className="mt-0.5 text-sm font-semibold leading-snug text-content text-pretty">{title}</p>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-content-muted text-pretty">{description}</p>
        )}
      </div>
      {value != null && (
        <div className="shrink-0 text-right">
          <p className={cn("stat-number text-lg", textMap[tone] ?? textMap.brand)}>{value}</p>
          {valueLabel && <p className="text-2xs text-content-subtle">{valueLabel}</p>}
        </div>
      )}
    </div>
  );
}

/** Section label used between blocks inside a tab. */
export function SectionHeading({ title, description, actions, className }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-content">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-content-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Compact label/value pair for dense metric strips. */
export function MiniStat({ label, value, tone = "neutral", hint, className }) {
  const toneClass =
    tone === "profit"
      ? "text-profit"
      : tone === "loss"
        ? "text-loss"
        : tone === "warn"
          ? "text-warn"
          : tone === "brand"
            ? "text-brand"
            : "text-content";
  return (
    <div className={cn("rounded-lg border border-line bg-surface-sunken px-3 py-2", className)}>
      <p className="flex items-center gap-1 truncate text-2xs text-content-muted">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <span className="flex h-3 w-3 cursor-help items-center justify-center rounded-full border border-line text-[8px] font-semibold text-content-subtle">
              ?
            </span>
          </Tooltip>
        )}
      </p>
      <p className={cn("mt-1 stat-number text-base", toneClass)}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sortable table                                                     */
/* ------------------------------------------------------------------ */

/**
 * Dense sortable table used by every breakdown in the workspace.
 * `columns`: { id, label, align, sortable, sortValue, render, hint, width, className }
 */
export function DataTable({
  columns,
  rows,
  initialSort,
  rowKey = (row, i) => row.key ?? i,
  onRowClick,
  activeRow,
  emptyLabel = "Nothing to show",
  maxHeight,
  footer,
  className,
}) {
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return rows;
    const get = col.sortValue ?? ((row) => row[col.id]);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * dir;
      }
      const an = Number.isFinite(av) ? av : av === Infinity ? Number.MAX_SAFE_INTEGER : 0;
      const bn = Number.isFinite(bv) ? bv : bv === Infinity ? Number.MAX_SAFE_INTEGER : 0;
      return (an - bn) * dir;
    });
  }, [rows, sort, columns]);

  const toggle = (col) => {
    if (col.sortable === false) return;
    setSort((s) => {
      if (s?.id !== col.id) return { id: col.id, dir: col.defaultDir ?? "desc" };
      if (s.dir === "desc") return { id: col.id, dir: "asc" };
      return null;
    });
  };

  if (!rows.length) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-xs text-content-subtle">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto thin-scrollbar", className)} style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-surface-sunken">
          <tr>
            {columns.map((col) => {
              const active = sort?.id === col.id;
              const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
              return (
                <th
                  key={col.id}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "border-b border-line px-3 py-2 text-2xs font-semibold uppercase tracking-wider",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    active ? "text-content" : "text-content-subtle",
                    col.sortable !== false && "cursor-pointer select-none hover:text-content"
                  )}
                  onClick={() => toggle(col)}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.hint ? (
                      <Tooltip content={col.hint}>
                        <span className="cursor-help border-b border-dotted border-line-strong">
                          {col.label}
                        </span>
                      </Tooltip>
                    ) : (
                      col.label
                    )}
                    {col.sortable !== false && (
                      <Icon size={11} className={cn(!active && "opacity-40")} aria-hidden />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const key = rowKey(row, i);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-line-subtle transition-colors last:border-0",
                  onRowClick && "cursor-pointer",
                  activeRow === key ? "bg-brand-soft/40" : "hover:bg-surface-hover/60"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-3 py-2 text-xs",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                      col.className
                    )}
                  >
                    {col.render ? col.render(row, i) : row[col.id]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {footer && <tfoot className="bg-surface-sunken">{footer}</tfoot>}
      </table>
    </div>
  );
}

/** Monospace, tone-coloured numeric cell. */
export function NumCell({ value, format = money, tone, muted = false, className }) {
  const cls =
    tone === "auto"
      ? toneTextClass(value)
      : tone === "profit"
        ? "text-profit"
        : tone === "loss"
          ? "text-loss"
          : muted
            ? "text-content-muted"
            : "text-content";
  return <span className={cn("font-mono tnum", cls, className)}>{format(value)}</span>;
}

export function NoData({ label = "No data for this view", description, icon }) {
  return <EmptyState compact icon={icon} title={label} description={description} />;
}

"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Modal, Button, Badge, useToast } from "../ui";
import { formatCurrency, formatDate, formatRelative } from "../../lib/format";
import { FILL_ROLE_META } from "../../lib/swap/position";
import {
  planSummary,
  toggleFillInPlan,
  toggleTradeInPlan,
  warningLabel,
} from "../../lib/swap/importPlan";
import { commitImportPlan } from "../../lib/swap/importFills";

export default function WalletImportReviewModal({
  open,
  onClose,
  wallet,
  scanData,
  initialPlan,
  onCommitted,
}) {
  const toast = useToast();
  const [plan, setPlan] = useState(initialPlan);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (open && initialPlan) setPlan(initialPlan);
  }, [open, initialPlan]);

  const summary = useMemo(() => planSummary(plan ?? { trades: [] }), [plan]);

  if (!open || !wallet || !scanData || !plan) return null;

  const handleCommit = async () => {
    if (summary.included === 0) {
      toast.info("Nothing selected to import");
      return;
    }
    if (summary.warnings > 0) {
      const ok = window.confirm(
        `${summary.warnings} trade(s) start mid-position (no open in this batch). Import anyway?`
      );
      if (!ok) return;
    }

    setCommitting(true);
    try {
      const result = await commitImportPlan(
        plan,
        wallet.address,
        scanData,
        scanData.syncMode ?? {}
      );
      const n = result.imported.length;
      toast.success(`Imported ${n} fill${n === 1 ? "" : "s"}`, {
        description: `${result.deduped.length} already known · ${result.errors.length} errors`,
        action:
          n > 0 && result.imported[0]?.tradeId
            ? {
                label: "Open trade",
                onClick: () => {
                  window.location.href = `/trade/${result.imported[0].tradeId}`;
                },
              }
            : undefined,
      });
      onCommitted?.(result);
      onClose();
    } catch (err) {
      toast.error("Import failed", { description: err.message });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={committing ? undefined : onClose}
      title="Review wallet import"
      description={`${summary.included} fill${summary.included === 1 ? "" : "s"} selected · ${plan.trades.length} detected trade${plan.trades.length === 1 ? "" : "s"}`}
      icon={Download}
      size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={committing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={committing}
            onClick={handleCommit}
            disabled={summary.included === 0}
          >
            Import {summary.included} fill{summary.included === 1 ? "" : "s"}
          </Button>
        </>
      }
      bodyClassName="max-h-[70vh] overflow-y-auto"
    >
      <div className="space-y-4 py-1">
        {(summary.skipped > 0 || summary.excluded > 0) && (
          <p className="text-xs text-content-muted">
            {summary.skipped > 0 ? `${summary.skipped} already in journal · ` : ""}
            {summary.excluded > 0 ? `${summary.excluded} excluded` : ""}
          </p>
        )}

        {plan.trades.length === 0 ? (
          <p className="text-sm text-content-muted">No swaps detected in this batch.</p>
        ) : (
          plan.trades.map((trade) => {
            const activeCount = trade.fills.filter((f) => f.included && !f.excluded).length;
            const allIncluded = trade.fills.every(
              (f) => f.alreadyImported || (f.included && !f.excluded)
            );
            const hasWarn = trade.warnings.includes("incomplete_start");

            return (
              <div
                key={trade.id}
                className="rounded-xl border border-line bg-surface-raised overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-content">
                      {trade.tokenSymbol}
                    </span>
                    <Badge tone={trade.status === "open" ? "profit" : "neutral"} size="xs">
                      {trade.status === "open" ? "Open position" : "Closed"}
                    </Badge>
                    <span className="text-2xs text-content-subtle">
                      {trade.fills.length} tx{trade.fills.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-2xs text-content-muted">
                    <input
                      type="checkbox"
                      checked={allIncluded && activeCount > 0}
                      onChange={(e) =>
                        setPlan(toggleTradeInPlan(plan, trade.id, e.target.checked))
                      }
                      className="rounded border-line"
                    />
                    Include trade
                  </label>
                </div>

                {trade.warnings.length > 0 && (
                  <div className="space-y-1 border-b border-line/40 bg-warn-soft/30 px-4 py-2">
                    {trade.warnings.map((w) => (
                      <p
                        key={w}
                        className={`flex items-start gap-1.5 text-2xs ${
                          w === "incomplete_start" ? "text-warn-fg" : "text-content-muted"
                        }`}
                      >
                        {w === "incomplete_start" && (
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                        )}
                        {warningLabel(w)}
                      </p>
                    ))}
                  </div>
                )}

                {hasWarn && trade.linkTradeId && (
                  <p className="border-b border-line/40 px-4 py-1.5 text-2xs text-content-subtle">
                    Will link to existing live trade in journal.
                  </p>
                )}

                <ul className="divide-y divide-line/40">
                  {trade.fills.map((fill) => {
                    const roleMeta = FILL_ROLE_META[fill.role] ?? FILL_ROLE_META.unknown;
                    const disabled = fill.alreadyImported;
                    return (
                      <li
                        key={fill.id}
                        className={`flex flex-wrap items-center gap-3 px-4 py-2.5 text-xs ${
                          fill.excluded ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={fill.included && !fill.excluded}
                          disabled={disabled}
                          onChange={() => setPlan(toggleFillInPlan(plan, trade.id, fill.id))}
                          className="rounded border-line"
                          aria-label={`Include ${fill.role} ${fill.side}`}
                        />
                        <Badge tone={roleMeta.tone} size="xs">
                          {roleMeta.label}
                        </Badge>
                        <Badge tone={fill.side === "buy" ? "profit" : "loss"} size="xs">
                          {fill.side}
                        </Badge>
                        <span className="font-mono tnum text-content">
                          {fill.tokenAmount > 0
                            ? fill.tokenAmount.toLocaleString(undefined, {
                                maximumFractionDigits: 6,
                              })
                            : "—"}{" "}
                          {trade.tokenSymbol}
                        </span>
                        {fill.usdValue > 0 && (
                          <span className="font-mono tnum text-content-muted">
                            {formatCurrency(fill.usdValue, { compact: true })}
                          </span>
                        )}
                        <span className="ml-auto text-2xs text-content-subtle">
                          {fill.executedAt
                            ? formatRelative(fill.executedAt)
                            : "—"}
                        </span>
                        {disabled && (
                          <Badge tone="neutral" size="xs">
                            In journal
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}

        {scanData.oldestTime && (
          <p className="text-2xs text-content-subtle">
            Batch range:{" "}
            {formatDate(new Date(Number(scanData.oldestTime) * 1000), "medium")}
            {scanData.newestTime &&
            scanData.newestTime !== scanData.oldestTime
              ? ` – ${formatDate(new Date(Number(scanData.newestTime) * 1000), "medium")}`
              : ""}
          </p>
        )}
      </div>
    </Modal>
  );
}

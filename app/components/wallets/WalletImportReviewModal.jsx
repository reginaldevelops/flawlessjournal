"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Download, History } from "lucide-react";
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
  scanData: initialScanData,
  initialPlan,
  onCommitted,
  onLoadOlder,
  onReviewUpdated,
}) {
  const toast = useToast();
  const [plan, setPlan] = useState(initialPlan);
  const [scanData, setScanData] = useState(initialScanData);
  const [committing, setCommitting] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    if (open && initialPlan) setPlan(initialPlan);
    if (open && initialScanData) setScanData(initialScanData);
  }, [open, initialPlan, initialScanData]);

  const summary = useMemo(() => planSummary(plan ?? { trades: [] }), [plan]);
  const canLoadOlder =
    Boolean(onLoadOlder) &&
    scanData?.hasMoreOlder !== false &&
    Boolean(scanData?.oldestSignature);
  const showLoadOlder = canLoadOlder && summary.warnings > 0;

  if (!open || !wallet || !scanData || !plan) return null;

  const handleLoadOlder = async () => {
    if (!onLoadOlder || loadingOlder || committing) return;
    setLoadingOlder(true);
    try {
      const next = await onLoadOlder({ scanData, plan });
      if (!next?.scanData || !next?.plan) return;
      setScanData(next.scanData);
      setPlan(next.plan);
      onReviewUpdated?.(next);
      const nextSummary = planSummary(next.plan);
      toast.success("Older batch loaded", {
        description:
          nextSummary.warnings > 0
            ? `${next.scanData.mergedBatches ?? 2} batches · ${nextSummary.warnings} trade(s) still start mid-position — load again or exclude`
            : `${next.scanData.mergedBatches ?? 2} batches merged · orphan warnings cleared`,
      });
    } catch (err) {
      toast.error("Could not load older batch", { description: err.message });
    } finally {
      setLoadingOlder(false);
    }
  };

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
          {showLoadOlder && (
            <Button
              variant="secondary"
              size="sm"
              icon={History}
              loading={loadingOlder}
              onClick={handleLoadOlder}
              disabled={committing}
              className="mr-auto"
            >
              Load older batch
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} disabled={committing || loadingOlder}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={committing}
            onClick={handleCommit}
            disabled={summary.included === 0 || loadingOlder}
          >
            Import {summary.included} fill{summary.included === 1 ? "" : "s"}
          </Button>
        </>
      }
      bodyClassName="max-h-[70vh] overflow-y-auto"
    >
      <div className="space-y-4 py-1">
        {(summary.skipped > 0 || summary.excluded > 0 || (scanData.mergedBatches ?? 1) > 1) && (
          <p className="text-xs text-content-muted">
            {(scanData.mergedBatches ?? 1) > 1
              ? `${scanData.mergedBatches} batches merged · `
              : ""}
            {summary.skipped > 0 ? `${summary.skipped} already in journal · ` : ""}
            {summary.excluded > 0 ? `${summary.excluded} excluded` : ""}
          </p>
        )}

        {summary.warnings > 0 && canLoadOlder && (
          <div className="rounded-lg border border-warn/40 bg-warn-soft/40 px-3 py-2 text-xs text-warn-fg">
            <p className="font-medium">Mid-trade start detected</p>
            <p className="mt-0.5 text-content-muted">
              The opening buy is probably in an older batch. Use &ldquo;Load older batch&rdquo; below
              to pull it in before importing — repeat until warnings clear.
            </p>
          </div>
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

                {trade.linkTradeId && trade.warnings.includes("continues") && (
                  <p className="border-b border-line/40 px-4 py-1.5 text-2xs text-content-subtle">
                    Links to existing journal trade
                    {trade.openAtBatchStart > 0
                      ? ` (~${Math.round(trade.openAtBatchStart).toLocaleString()} tokens held before batch)`
                      : ""}
                    .
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
                    {fill.oversell && (
                      <Badge tone="warn" size="xs">
                        Oversell
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

"use client";

import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Download, History, Hand } from "lucide-react";
import { Modal, Button, Badge, useToast } from "../ui";
import { formatCurrency, formatDate, formatRelative } from "../../lib/format";
import { FILL_ROLE_META } from "../../lib/swap/position";
import {
  planSummary,
  toggleFillInPlan,
  toggleTradeInPlan,
  warningLabel,
  skipReasonLabel,
} from "../../lib/swap/importPlan";
import { commitImportPlan } from "../../lib/swap/importFills";

function TradeCard({ trade, plan, setPlan, manual = false }) {
  const activeCount = trade.fills.filter((f) => f.included && !f.excluded).length;
  const allIncluded = trade.fills.every(
    (f) => f.alreadyImported || (f.included && !f.excluded)
  );

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        manual
          ? "border-warn/30 bg-warn-soft/10"
          : "border-line bg-surface-raised"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-content">{trade.tokenSymbol}</span>
          <Badge tone={trade.status === "open" ? "profit" : "neutral"} size="xs">
            {trade.status === "open" ? "Open position" : "Closed"}
          </Badge>
          {manual && (
            <Badge tone="warn" size="xs">
              Manual only
            </Badge>
          )}
          <span className="text-2xs text-content-subtle">
            {trade.fills.length} tx{trade.fills.length === 1 ? "" : "s"}
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-2xs text-content-muted">
          <input
            type="checkbox"
            checked={allIncluded && activeCount > 0}
            onChange={(e) => setPlan(toggleTradeInPlan(plan, trade.id, e.target.checked))}
            className="rounded border-line"
          />
          {manual ? "Force include" : "Include trade"}
        </label>
      </div>

      {manual && trade.skipReason && (
        <div className="border-b border-line/40 bg-warn-soft/30 px-4 py-2">
          <p className="flex items-start gap-1.5 text-2xs text-warn-fg">
            <Hand size={12} className="mt-0.5 shrink-0" aria-hidden />
            {skipReasonLabel(trade.skipReason)}
          </p>
        </div>
      )}

      {trade.warnings.length > 0 && (
        <div className="space-y-1 border-b border-line/40 bg-surface-sunken/50 px-4 py-2">
          {trade.warnings.map((w) => (
            <p key={w} className="text-2xs text-content-muted">
              {warningLabel(w)}
            </p>
          ))}
        </div>
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
                  ? fill.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })
                  : "—"}{" "}
                {trade.tokenSymbol}
              </span>
              {fill.usdValue > 0 && (
                <span className="font-mono tnum text-content-muted">
                  {formatCurrency(fill.usdValue, { compact: true })}
                </span>
              )}
              <span className="ml-auto text-2xs text-content-subtle">
                {fill.executedAt ? formatRelative(fill.executedAt) : "—"}
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
}

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

  const readyTrades = useMemo(
    () => (plan?.trades ?? []).filter((t) => t.autoImportEligible),
    [plan]
  );
  const manualTrades = useMemo(
    () =>
      (plan?.trades ?? []).filter(
        (t) => !t.autoImportEligible && t.skipReason && t.skipReason !== "already_imported"
      ),
    [plan]
  );

  const canLoadOlder =
    Boolean(onLoadOlder) &&
    scanData?.hasMoreOlder !== false &&
    Boolean(scanData?.oldestSignature);
  const showLoadOlder = canLoadOlder && summary.manualOnly > 0;

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
        description: `${nextSummary.ready} ready · ${nextSummary.manualOnly} still manual`,
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
        `${summary.warnings} trade(s) were marked manual-only but you included them anyway. Import?`
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
        description: `${result.deduped.length} already known · ${summary.manualOnly} skipped for manual entry`,
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
      description={`${summary.ready} complete trade${summary.ready === 1 ? "" : "s"} ready · ${summary.manualOnly} manual`}
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
        <div className="rounded-lg border border-line bg-surface-sunken/40 px-3 py-2.5 text-xs">
          <p className="text-content">
            Auto-imports new positions (Open) and journal continuations (Add/Reduce/Close).
          </p>
          <p className="mt-1 text-content-muted">
            Skips mid-batch orphans and oversells — use Load older or add those manually in{" "}
            <span className="font-mono">/trades</span>.
          </p>
        </div>

        {(summary.skipped > 0 || summary.excluded > 0 || (scanData.mergedBatches ?? 1) > 1) && (
          <p className="text-xs text-content-muted">
            {(scanData.mergedBatches ?? 1) > 1 ? `${scanData.mergedBatches} batches merged · ` : ""}
            {summary.skipped > 0 ? `${summary.skipped} already in journal · ` : ""}
            {summary.excluded > 0 ? `${summary.excluded} excluded` : ""}
          </p>
        )}

        {plan.trades.length === 0 ? (
          <p className="text-sm text-content-muted">No swaps detected in this batch.</p>
        ) : (
          <>
            {readyTrades.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                  Ready to import ({readyTrades.length})
                </h3>
                {readyTrades.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} plan={plan} setPlan={setPlan} />
                ))}
              </section>
            )}

            {manualTrades.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warn-fg">
                  <AlertTriangle size={12} aria-hidden />
                  Manual only ({manualTrades.length})
                </h3>
                {manualTrades.map((trade) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    plan={plan}
                    setPlan={setPlan}
                    manual
                  />
                ))}
              </section>
            )}

            {readyTrades.length === 0 && manualTrades.length === 0 && (
              <p className="text-sm text-content-muted">
                All detected fills are already in your journal.
              </p>
            )}
          </>
        )}

        {scanData.oldestTime && (
          <p className="text-2xs text-content-subtle">
            Batch range:{" "}
            {formatDate(new Date(Number(scanData.oldestTime) * 1000), "medium")}
            {scanData.newestTime && scanData.newestTime !== scanData.oldestTime
              ? ` – ${formatDate(new Date(Number(scanData.newestTime) * 1000), "medium")}`
              : ""}
          </p>
        )}
      </div>
    </Modal>
  );
}

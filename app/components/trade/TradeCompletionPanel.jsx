"use client";

import { CheckCircle2, CircleDashed, ListChecks } from "lucide-react";
import { Badge, Button, cn } from "../ui";
import {
  getIncompleteFields,
  getJournalCompletionStatus,
  isFieldComplete,
  markFieldCheckedEmpty,
} from "../../lib/tradeCompletion";

const COL_LABELS = {
  Datum: "Date",
  Entreetijd: "Entry time",
  Exittijd: "Exit time",
  Munt: "Coin",
  Richting: "Direction",
  Sessie: "Session",
  Risico: "Risk",
  Winst: "Profit",
  Verlies: "Loss",
  Notities: "Notes",
  Opmerkingen: "Remarks",
  Graad: "Grade",
  Tijdframe: "Timeframe",
};

const colLabel = (key) => COL_LABELS[key] ?? key;

/**
 * Shows which journal fields still block Completed, with "Check done"
 * for fields you intentionally leave empty.
 */
export default function TradeCompletionPanel({ trade, variables = [], saveTrade }) {
  const status = getJournalCompletionStatus(trade, variables);
  const incomplete = getIncompleteFields(trade, variables);
  const completeCount = (variables || []).filter(
    (v) =>
      v?.visible &&
      v.varType !== "calculated" &&
      v.name !== "Trade number" &&
      v.name !== "trade_number" &&
      isFieldComplete(trade, v.name)
  ).length;
  const trackable = (variables || []).filter(
    (v) =>
      v?.visible &&
      v.varType !== "calculated" &&
      v.name !== "Trade number" &&
      v.name !== "trade_number"
  ).length;

  const markDone = (fieldName) => {
    saveTrade?.(markFieldCheckedEmpty(trade, fieldName));
  };

  if (!trackable) return null;

  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks size={14} className="text-content-subtle" aria-hidden />
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            Completion
          </p>
        </div>
        <Badge
          tone={status.key === "completed" ? "profit" : status.key === "in_progress" ? "warn" : "neutral"}
          size="xs"
        >
          {status.label}
        </Badge>
      </div>

      <p className="mb-2 font-mono text-2xs tnum text-content-muted">
        {completeCount}/{trackable} fields ready
      </p>

      {status.key === "completed" ? (
        <div className="flex items-start gap-2 rounded-lg border border-profit/25 bg-profit-soft/40 px-2.5 py-2">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-profit-fg" aria-hidden />
          <p className="text-xs text-content">
            All required fields are filled or marked check done.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {incomplete.map((v) => (
            <li
              key={v.id || v.name}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line",
                "bg-surface-sunken/40 px-2.5 py-1.5"
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <CircleDashed size={13} className="shrink-0 text-warn-fg" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-content">{colLabel(v.name)}</p>
                  <p className="text-2xs text-content-subtle">
                    {v.phase === "pre" ? "Pre-trade" : v.phase === "post" ? "Post-trade" : "Field"} · empty
                  </p>
                </div>
              </div>
              <Button variant="subtle" size="xs" onClick={() => markDone(v.name)}>
                Check done
              </Button>
            </li>
          ))}
        </ul>
      )}

      {status.key !== "completed" && (
        <p className="mt-2 text-2xs leading-relaxed text-content-subtle">
          Fill a field, or tap <span className="text-content-muted">Check done</span> if you want to leave it blank on purpose.
        </p>
      )}
    </div>
  );
}

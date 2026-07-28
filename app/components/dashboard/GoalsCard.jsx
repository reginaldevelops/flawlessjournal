"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  Input,
  Progress,
  Skeleton,
  Tooltip,
  cn,
} from "../ui";
import { formatCurrency, formatPercent } from "../../lib/format";
import { inferGoalProgress } from "./helpers";
import { usePersistentJson } from "./hooks";

function formatMeasure(progress) {
  if (!progress) return null;
  if (progress.kind === "amount") {
    return `${formatCurrency(progress.current, { decimals: 0, signed: progress.current < 0 })} / ${formatCurrency(
      progress.target,
      { decimals: 0 }
    )}`;
  }
  if (progress.kind === "limit") {
    return `${formatPercent(progress.current, { decimals: 1 })} / ${formatPercent(progress.target, { decimals: 0 })}`;
  }
  return `${progress.current} / ${progress.target}`;
}

function GoalItem({ goal, context, done, onToggleDone, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.content ?? "");

  const progress = useMemo(() => inferGoalProgress(goal.content, context), [goal.content, context]);
  const complete = progress ? progress.progress >= 100 && progress.kind !== "limit" : Boolean(done);

  if (editing) {
    return (
      <li className="rounded-lg border border-brand/30 bg-surface-sunken p-2.5">
        <Input
          size="sm"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(goal.id, draft);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(goal.content ?? "");
              setEditing(false);
            }
          }}
          aria-label="Goal"
        />
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            variant="primary"
            size="xs"
            icon={Check}
            onClick={() => {
              onSave(goal.id, draft);
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="xs"
            icon={X}
            onClick={() => {
              setDraft(goal.content ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="group rounded-lg border border-line bg-surface-raised p-2.5 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-2.5">
        {!progress && (
          <span className="mt-0.5">
            <Checkbox checked={Boolean(done)} onChange={() => onToggleDone(goal.id)} aria-label="Mark goal complete" />
          </span>
        )}
        <p
          className={cn(
            "min-w-0 flex-1 text-xs leading-relaxed text-content",
            !progress && done && "text-content-subtle line-through"
          )}
        >
          {goal.content}
        </p>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={Pencil}
            aria-label="Edit goal"
            onClick={() => setEditing(true)}
          />
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={Trash2}
            aria-label="Delete goal"
            className="text-content-subtle hover:text-loss"
            onClick={() => onDelete(goal.id)}
          />
        </div>

        {complete && (
          <Badge tone="profit" size="xs" className="shrink-0">
            Done
          </Badge>
        )}
      </div>

      {progress && (
        <div className="mt-2">
          <Progress value={Math.min(progress.progress, 100)} tone={progress.tone === "brand" ? "brand" : progress.tone} />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="truncate text-2xs text-content-subtle">{progress.caption}</p>
            <Tooltip content={`${Math.round(progress.progress)}% of target`}>
              <p className="shrink-0 font-mono text-2xs tnum text-content-muted">{formatMeasure(progress)}</p>
            </Tooltip>
          </div>
        </div>
      )}
    </li>
  );
}

export default function GoalsCard({ goals = [], loading, context, onAdd, onUpdate, onDelete }) {
  const [draft, setDraft] = useState("");
  const [done, setDone] = usePersistentJson("flawless.dashboard.goals.done", {});

  const toggleDone = (id) => setDone({ ...done, [id]: !done[id] });

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Target}
        title="Goals"
        subtitle={goals.length ? `${goals.length} active` : "Set your first target"}
      />

      <CardBody className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !goals.length ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Write goals with a number in them — like “Reach $10,000 account equity” — and progress is tracked from your trades automatically."
            compact
          />
        ) : (
          <ul className="space-y-2">
            {goals.map((goal) => (
              <GoalItem
                key={goal.id}
                goal={goal}
                context={context}
                done={done[goal.id]}
                onToggleDone={toggleDone}
                onSave={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="mt-auto flex items-center gap-2 pt-1">
          <Input
            size="sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a goal…"
            aria-label="New goal"
          />
          <Button type="submit" variant="secondary" size="sm" iconOnly icon={Plus} aria-label="Add goal" />
        </form>
      </CardBody>
    </Card>
  );
}

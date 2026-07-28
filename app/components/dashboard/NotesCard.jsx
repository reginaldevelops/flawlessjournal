"use client";

import { AlertCircle, Check, NotebookPen } from "lucide-react";
import { Card, CardBody, CardHeader, Skeleton, Spinner, Textarea, cn } from "../ui";
import { formatRelative } from "../../lib/format";

function SaveIndicator({ status, savedAt }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-2xs text-content-subtle">
        <Spinner size={11} />
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-2xs text-loss">
        <AlertCircle size={11} />
        Not saved
      </span>
    );
  }
  if (status === "saved" || savedAt) {
    return (
      <span className="flex items-center gap-1.5 text-2xs text-content-subtle">
        <Check size={11} className="text-profit" />
        Saved {savedAt ? formatRelative(savedAt) : ""}
      </span>
    );
  }
  return <span className="text-2xs text-content-subtle">Autosaves as you type</span>;
}

export default function NotesCard({ value, onChange, onBlur, status, savedAt }) {
  const loading = status === "loading";

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={NotebookPen}
        title="Scratchpad"
        subtitle="Rules, reminders, focus for the week"
        actions={<SaveIndicator status={status} savedAt={savedAt} />}
      />

      <CardBody className="flex flex-1 flex-col p-3 sm:p-4">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={"One setup traded well beats five traded adequately.\nSize stays at 1% until equity makes a new high."}
            className={cn("min-h-[10rem] flex-1 resize-none bg-surface-sunken leading-relaxed")}
            aria-label="Scratchpad notes"
          />
        )}
      </CardBody>
    </Card>
  );
}

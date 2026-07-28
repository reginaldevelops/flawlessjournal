"use client";

import { useState, useEffect } from "react";
import { Button, Input, cn } from "./ui";

function updateAtPath(obj, path, updater) {
  if (path.length === 1) {
    const key = path[0];
    const oldVal = obj[key];
    return { ...obj, [key]: updater(oldVal) };
  }
  const [head, ...rest] = path;
  return { ...obj, [head]: updateAtPath(obj[head], rest, updater) };
}

function ConditionalBlock({ block, onChange, setActiveField, path }) {
  const updateField = (field, val) => {
    onChange({ ...block, [field]: val });
  };

  const removeElse = () => {
    onChange({ ...block, else: null });
  };

  return (
    <div className="ml-1 mt-3 space-y-3 border-l-2 border-line pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 shrink-0 text-xs font-semibold text-brand">IF</span>
        <Input
          size="sm"
          value={block.condition}
          onChange={(e) => updateField("condition", e.target.value)}
          onFocus={() => setActiveField([...path, "condition"])}
          placeholder="Condition…"
          className="max-w-xs flex-1 font-mono"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 shrink-0 text-xs font-semibold text-content-muted">
          THEN
        </span>
        <Input
          size="sm"
          value={block.then}
          onChange={(e) => updateField("then", e.target.value)}
          onFocus={() => setActiveField([...path, "then"])}
          placeholder="Result…"
          className="max-w-xs flex-1 font-mono"
        />
      </div>

      {block.else !== null ? (
        typeof block.else === "string" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-semibold text-content-muted">
              ELSE
            </span>
            <Input
              size="sm"
              value={block.else}
              onChange={(e) => updateField("else", e.target.value)}
              onFocus={() => setActiveField([...path, "else"])}
              placeholder="Else result…"
              className="max-w-xs flex-1 font-mono"
            />
            <Button variant="danger-ghost" size="xs" onClick={removeElse}>
              Remove
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <ConditionalBlock
              block={block.else}
              onChange={(val) => updateField("else", val)}
              setActiveField={setActiveField}
              path={[...path, "else"]}
            />
            <Button variant="danger-ghost" size="xs" onClick={removeElse}>
              Remove nested IF
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="subtle"
            size="xs"
            onClick={() => updateField("else", "")}
          >
            + OR ELSE
          </Button>
          <Button
            variant="subtle"
            size="xs"
            onClick={() =>
              updateField("else", { condition: "", then: "", else: null })
            }
          >
            + OR IF
          </Button>
        </div>
      )}
    </div>
  );
}

function wrapValue(val) {
  if (val === "") return "0";
  if (!isNaN(parseFloat(val))) return val;
  return JSON.stringify(val);
}

function toFormula(block) {
  let result = `if(${block.condition || "0"}, ${wrapValue(block.then)}, `;
  if (block.else) {
    if (typeof block.else === "string") {
      result += wrapValue(block.else);
    } else {
      result += toFormula(block.else);
    }
  } else {
    result += "0";
  }
  result += ")";
  return result;
}

export default function ConditionalBuilder({
  variables = [],
  onChange,
  setInFocus,
}) {
  const [rootBlock, setRootBlock] = useState({
    condition: "",
    then: "",
    else: null,
  });

  const [activePath, setActivePath] = useState(null);

  useEffect(() => {
    onChange(toFormula(rootBlock));
  }, [rootBlock, onChange]);

  useEffect(() => {
    setInFocus?.(Boolean(activePath));
  }, [activePath, setInFocus]);

  const insertToken = (token) => {
    if (!activePath) return;
    setRootBlock((prev) =>
      updateAtPath(prev, activePath, (oldVal) => (oldVal || "") + token)
    );
  };

  const chipClass =
    "rounded-md border border-line bg-surface-raised px-2 py-1 text-xs font-medium text-content transition hover:border-line-strong hover:bg-surface-hover";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5"
      )}
    >
      <p className="text-xs font-medium text-content-muted">
        Conditional formula builder
      </p>

      <div>
        <p className="mb-1.5 text-2xs uppercase tracking-wider text-content-subtle">
          Numeric variables
        </p>
        <div className="flex flex-wrap gap-1.5">
          {variables
            .filter((v) => ["number", "calculated"].includes(v.varType))
            .map((varItem) => {
              const token = varItem.name.replace(/\s+/g, "").toLowerCase();
              return (
                <button
                  key={varItem.id}
                  type="button"
                  onClick={() => insertToken(token)}
                  className={chipClass}
                >
                  {token}
                </button>
              );
            })}
          {variables.filter((v) =>
            ["number", "calculated"].includes(v.varType)
          ).length === 0 && (
            <span className="text-xs text-content-subtle">
              No numeric variables yet
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-2xs uppercase tracking-wider text-content-subtle">
          Operators
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["+", "-", "*", "/", ">", "<", ">=", "<=", "=="].map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => insertToken(op)}
              className={cn(chipClass, "font-semibold")}
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      <ConditionalBlock
        block={rootBlock}
        onChange={setRootBlock}
        setActiveField={setActivePath}
        path={[]}
      />
    </div>
  );
}

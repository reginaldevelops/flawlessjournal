"use client";

import { useState, useEffect } from "react";

/* Utility: deep update via path */
function updateAtPath(obj, path, updater) {
  if (path.length === 1) {
    const key = path[0];
    const oldVal = obj[key];
    // ✅ support voor string velden
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
    <div className="ml-2 mt-3 border-l-2 pl-3">
      {/* IF */}
      <div className="mb-2 py-5">
        <label className="font-bold text-sm mr-2">IF</label>
        <input
          type="text"
          value={block.condition}
          onChange={(e) => updateField("condition", e.target.value)}
          onFocus={() => setActiveField([...path, "condition"])}
          placeholder="Condition..."
          className="border-b border-black w-64 text-sm px-1"
        />
      </div>

      {/* THEN */}
      <div className="mb-2 py-3">
        <label className="font-bold text-sm mr-2">→ THEN</label>
        <input
          type="text"
          value={block.then}
          onChange={(e) => updateField("then", e.target.value)}
          onFocus={() => setActiveField([...path, "then"])}
          placeholder="Result..."
          className="border-b border-black w-64 text-sm px-1"
        />
      </div>

      {/* ELSE */}
      {block.else !== null ? (
        typeof block.else === "string" ? (
          <div className="mb-2">
            <label className="font-bold text-sm mr-2">ELSE</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={block.else}
                onChange={(e) => updateField("else", e.target.value)}
                onFocus={() => setActiveField([...path, "else"])}
                placeholder="Else result..."
                className="border-b border-black w-64 text-sm px-1"
              />
              <button
                type="button"
                onClick={removeElse}
                className="text-xs text-red-600 underline"
              >
                ✕ Remove
              </button>
            </div>
          </div>
        ) : (
          <div>
            <ConditionalBlock
              block={block.else}
              onChange={(val) => updateField("else", val)}
              setActiveField={setActiveField}
              path={[...path, "else"]}
            />
            <button
              type="button"
              onClick={removeElse}
              className="mt-1 text-xs text-red-600 underline"
            >
              ✕ Remove OR IF
            </button>
          </div>
        )
      ) : (
        <div className="flex gap-2 mt-2">
          {/* ✅ ELSE maakt nu expliciet een string */}
          <button
            type="button"
            onClick={() => updateField("else", "")}
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          >
            + OR ELSE
          </button>

          <button
            type="button"
            onClick={() =>
              updateField("else", { condition: "", then: "", else: null })
            }
            className="px-2 py-1 text-xs bg-sky-100 text-sky-600 rounded hover:bg-sky-200"
          >
            + OR IF
          </button>
        </div>
      )}
    </div>
  );
}

function wrapValue(val) {
  if (val === "") return "0";
  if (!isNaN(parseFloat(val))) return val; // getal blijft getal
  return JSON.stringify(val); // altijd string in quotes
}

/* Formula generator */
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

/* Main builder */
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

  const insertToken = (token) => {
    if (!activePath) return;
    setRootBlock((prev) =>
      updateAtPath(prev, activePath, (oldVal) => (oldVal || "") + token)
    );
  };

  return (
    <div className="border p-3 rounded flex flex-col gap-3 bg-gray-50">
      <p className="text-xs text-gray-600 font-medium">
        Conditional Formula Builder
      </p>

      {/* Toolbar */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Numeric variables:</p>
        <div className="flex flex-wrap gap-2">
          {variables
            .filter((v) => ["number", "calculated"].includes(v.varType))
            .map((varItem) => {
              const token = varItem.name.replace(/\s+/g, "").toLowerCase();
              return (
                <button
                  key={varItem.id}
                  type="button"
                  onClick={() => insertToken(token)}
                  className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                >
                  {token}
                </button>
              );
            })}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Operators:</p>
        <div className="flex flex-wrap gap-2">
          {["+", "-", "*", "/", ">", "<", ">=", "<=", "=="].map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => insertToken(op)}
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      {/* Recursive block */}
      <ConditionalBlock
        block={rootBlock}
        onChange={setRootBlock}
        setActiveField={setActivePath}
        path={[]} // root pad
      />
    </div>
  );
}

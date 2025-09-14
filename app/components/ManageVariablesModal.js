"use client";

import { useState, useEffect } from "react";
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  defaultAnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "../lib/supabaseClient";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Parser } from "expr-eval";
import ConditionalBuilder from "./ConditionalBuilder";

// 🔄 Recalc helper (met auto-formule evaluatie)
async function recalcAllTrades(variable) {
  if (variable.varType !== "calculated" || !variable.formula) return;

  const parser = new Parser();
  let expr;
  try {
    expr = parser.parse(variable.formula);
  } catch (err) {
    console.warn("⚠️ Invalid formula for", variable.name, err.message);
    return;
  }

  const { data: trades, error } = await supabase
    .from("trades")
    .select("id, data");
  if (error) {
    console.error("❌ Fetch trades error:", error);
    return;
  }

  const updatedTrades = [];

  for (const trade of trades) {
    const values = Object.fromEntries(
      Object.entries(trade.data).map(([k, val]) => {
        const key = k.replace(/\s+/g, "").toLowerCase();
        const num = parseFloat(val);
        return [key, !isNaN(num) && val !== null && val !== "" ? num : val];
      })
    );

    const hasAllInputs = expr
      .variables()
      .every((key) => values[key] !== undefined);

    if (!hasAllInputs) continue;

    try {
      let calc = expr.evaluate(values);

      // 👉 extra check voor inner formulas
      if (typeof calc === "string") {
        try {
          const innerExpr = parser.parse(calc);
          const innerVars = innerExpr.variables();
          const hasAllInner = innerVars.every(
            (key) => values[key] !== undefined
          );
          if (hasAllInner) calc = innerExpr.evaluate(values);
        } catch {
          // blijft gewoon string
        }
      }

      if (typeof calc === "number" && !isNaN(calc)) {
        trade.data[variable.name] = parseFloat(calc.toFixed(2));
      } else if (typeof calc === "string") {
        trade.data[variable.name] = calc;
      } else if (typeof calc === "boolean") {
        trade.data[variable.name] = calc ? "TRUE" : "FALSE";
      } else {
        trade.data[variable.name] = calc?.toString?.() ?? "N/A";
      }

      updatedTrades.push({ id: trade.id, data: trade.data });
    } catch (err) {
      console.warn(`⚠️ Could not calc for trade ${trade.id}:`, err.message);
    }
  }

  // 🔄 batch update in één keer
  if (updatedTrades.length > 0) {
    const { error: updateError } = await supabase
      .from("trades")
      .upsert(updatedTrades, { onConflict: "id" });

    if (updateError) {
      console.error("❌ Batch update error:", updateError);
    } else {
      console.log(`✅ ${updatedTrades.length} trades updated`);
    }
  }
}

/* ---------- Sortable Item ---------- */
function SortableItemModal({
  v,
  onRename,
  onDelete,
  onToggleVisible,
  onEditFormula,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: v.id,
      animateLayoutChanges: (args) =>
        defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
    });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex flex-col-2 items-center justify-between p-2 border rounded bg-white mb-1"
    >
      {/* Drag handle */}
      <span {...listeners} className="cursor-grab text-gray-400 mr-2">
        ⠿
      </span>

      {/* Variable name */}
      <span className="flex-1 text-xs">{v.name}</span>

      {/* Actions */}
      <div className="flex gap-2 text-gray-500">
        <button
          onClick={() => onToggleVisible(v)}
          className="hover:text-gray-700"
        >
          {v.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        {v.type === "custom" && (
          <>
            <button onClick={() => onRename(v)} className="hover:text-blue-600">
              <Pencil size={16} />
            </button>
            {v.varType === "calculated" && (
              <button
                onClick={() => onEditFormula(v)}
                className="hover:text-purple-600"
              >
                ƒx
              </button>
            )}
            <button onClick={() => onDelete(v)} className="hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */
function ManageVariablesModal({ context, variables, setVariables, onClose }) {
  const [activeId, setActiveId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("text");
  const [newVarFormula, setNewVarFormula] = useState("");
  const [showConditional, setShowConditional] = useState(false);
  const [inConditionalFocus, setInConditionalFocus] = useState(false);

  // 🔄 loading states
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingFormula, setIsUpdatingFormula] = useState(false);

  const handleRename = async (variable) => {
    const newName = prompt("New name?", variable.name);
    if (!newName || newName === variable.name) return;

    setIsRenaming(true);
    try {
      const { error: varError } = await supabase
        .from("variables")
        .update({ name: newName })
        .eq("id", variable.id);
      if (varError) throw varError;

      const { data: trades, error: tradeError } = await supabase
        .from("trades")
        .select("id, data");
      if (tradeError) throw tradeError;

      const updatedTrades = trades
        .map((trade) => {
          if (trade.data.hasOwnProperty(variable.name)) {
            const newData = { ...trade.data };
            newData[newName] = newData[variable.name];
            delete newData[variable.name];
            return { id: trade.id, data: newData };
          }
          return null;
        })
        .filter(Boolean);

      if (updatedTrades.length > 0) {
        const { error: updateError } = await supabase
          .from("trades")
          .upsert(updatedTrades, { onConflict: "id" });
        if (updateError) throw updateError;
      }

      setVariables((prev) =>
        prev.map((x) => (x.id === variable.id ? { ...x, name: newName } : x))
      );
    } catch (err) {
      console.error("❌ Rename error:", err);
      alert("Rename failed: " + err.message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleEditFormula = async (variable) => {
    const newFormula = prompt("New formula?", variable.formula || "");
    if (!newFormula || newFormula === variable.formula) return;

    setIsUpdatingFormula(true);
    try {
      const parser = new Parser();
      parser.parse(newFormula);
    } catch (err) {
      setIsUpdatingFormula(false);
      alert(`❌ Invalid formula: ${err.message}`);
      return;
    }

    const { error } = await supabase
      .from("variables")
      .update({ formula: newFormula })
      .eq("id", variable.id);

    if (error) {
      console.error("❌ Error updating formula:", error);
      alert("Formula update failed: " + error.message);
    } else {
      setVariables((prev) =>
        prev.map((x) =>
          x.id === variable.id ? { ...x, formula: newFormula } : x
        )
      );
      await recalcAllTrades({ ...variable, formula: newFormula });
    }
    setIsUpdatingFormula(false);
  };

  const handleDelete = async (variable) => {
    if (
      !confirm(
        `Delete variable "${variable.name}"? This will also remove it from all trades.`
      )
    )
      return;

    setIsDeleting(true);
    try {
      const { error: varError } = await supabase
        .from("variables")
        .delete()
        .eq("id", variable.id);
      if (varError) throw varError;

      const { error: tradeError } = await supabase.rpc("remove_variable_key", {
        key_name: variable.name,
      });
      if (tradeError) throw tradeError;

      setVariables((prev) => prev.filter((x) => x.id !== variable.id));
    } catch (err) {
      console.error("❌ Error deleting variable:", err);
      alert("Delete failed: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleVisible = async (variable) => {
    const newValue = !variable.visible;
    await supabase
      .from("variables")
      .update({ visible: newValue })
      .eq("id", variable.id);

    setVariables((prev) =>
      prev.map((x) => (x.id === variable.id ? { ...x, visible: newValue } : x))
    );
  };

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeVar = variables.find((v) => v.id === active.id);
    const overVar = variables.find((v) => v.id === over.id);
    if (!activeVar) return;

    let targetPhase = activeVar.phase;
    if (overVar && overVar.phase !== activeVar.phase)
      targetPhase = overVar.phase;
    if (!overVar && event.over?.id === "post-dropzone") targetPhase = "post";
    if (!overVar && event.over?.id === "pre-dropzone") targetPhase = "pre";

    const varsInTarget = variables.filter((v) => v.phase === targetPhase);
    const oldIndex = variables
      .filter((v) => v.phase === activeVar.phase)
      .findIndex((v) => v.id === active.id);
    const newIndex = overVar
      ? varsInTarget.findIndex((v) => v.id === over.id)
      : varsInTarget.length;

    const reordered =
      activeVar.phase === targetPhase
        ? arrayMove(varsInTarget, oldIndex, newIndex)
        : [
            ...varsInTarget.slice(0, newIndex),
            { ...activeVar, phase: targetPhase },
            ...varsInTarget.slice(newIndex),
          ];

    setVariables((prev) => {
      const others = prev.filter(
        (v) => v.id !== activeVar.id && v.phase !== targetPhase
      );
      return [...others, ...reordered];
    });

    await supabase
      .from("variables")
      .update({ phase: targetPhase })
      .eq("id", activeVar.id);
    await Promise.all(
      reordered.map((v, index) =>
        supabase.from("variables").update({ order: index }).eq("id", v.id)
      )
    );
  };

  const handleAdd = async () => {
    if (!newVarName.trim()) return;

    const { data, error } = await supabase
      .from("variables")
      .insert([
        {
          name: newVarName.trim(),
          type: "custom",
          varType: newVarType,
          formula: newVarType === "calculated" ? newVarFormula.trim() : null,
          options: [],
          editable: true,
          phase: "pre",
          order: 0,
        },
      ])
      .select();

    if (error) {
      console.error("❌ Insert error:", error);
      return;
    }

    if (data) {
      const variable = data[0];
      setVariables((prev) => [variable, ...prev]);
      setNewVarName("");
      setNewVarType("text");
      setNewVarFormula("");
      setShowAddForm(false);

      await recalcAllTrades(variable);
    }
  };

  const renderSection = (phase, title, dropzoneId) => {
    const varsInPhase = variables.filter((v) => v.phase === phase);

    return (
      <div className="mb-6">
        <h3 className="font-semibold mb-2">{title}</h3>
        <SortableContext
          id={dropzoneId}
          items={varsInPhase.map((v) => v.id)}
          strategy={verticalListSortingStrategy}
        >
          {varsInPhase.map((v) => (
            <SortableItemModal
              key={v.id}
              v={v}
              onRename={handleRename}
              onEditFormula={handleEditFormula}
              onDelete={handleDelete}
              onToggleVisible={handleToggleVisible}
            />
          ))}
        </SortableContext>
        {varsInPhase.length === 0 && (
          <div className="text-xs text-gray-400 italic">Drop items here</div>
        )}
      </div>
    );
  };

  const currentAction =
    (isRenaming && "Renaming…") ||
    (isDeleting && "Deleting…") ||
    (isUpdatingFormula && "Updating formula…");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[500px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Manage Variables
          {currentAction && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <svg
                className="animate-spin h-4 w-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              {currentAction}
            </span>
          )}
        </h2>

        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="mb-4 px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-600 rounded text-sm font-medium"
          >
            + Add new variable
          </button>
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Variable name"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
              />
              <select
                value={newVarType}
                onChange={(e) => setNewVarType(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="dropdown">Dropdown</option>
                <option value="time">Time</option>
                <option value="date">Date</option>
                <option value="textarea">Textarea</option>
                <option value="chart">Chart</option>
                <option value="calculated">Calculated</option>
              </select>
            </div>

            {newVarType === "calculated" && (
              <div className="flex flex-col gap-3">
                {!showConditional && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Build formula:</p>
                    {!inConditionalFocus && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {variables
                          .filter((v) =>
                            ["number", "calculated"].includes(v.varType)
                          )
                          .map((varItem) => {
                            const token = varItem.name
                              .replace(/\s+/g, "")
                              .toLowerCase();
                            return (
                              <button
                                key={varItem.id}
                                type="button"
                                onClick={() =>
                                  setNewVarFormula(
                                    (prev) => (prev || "") + token
                                  )
                                }
                                className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                              >
                                {token}
                              </button>
                            );
                          })}
                        {["+", "-", "*", "/", ">", "<", ">=", "<=", "=="].map(
                          (op) => (
                            <button
                              key={op}
                              type="button"
                              onClick={() =>
                                setNewVarFormula((prev) => (prev || "") + op)
                              }
                              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                            >
                              {op}
                            </button>
                          )
                        )}
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Formula"
                      value={newVarFormula}
                      onChange={(e) => setNewVarFormula(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                    />
                  </div>
                )}

                {!showConditional ? (
                  <button
                    type="button"
                    onClick={() => setShowConditional(true)}
                    className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 w-fit"
                  >
                    + Conditional
                  </button>
                ) : (
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs text-gray-500 mb-1">
                      Conditional logic:
                    </p>
                    <ConditionalBuilder
                      variables={variables}
                      onChange={(condFormula) => setNewVarFormula(condFormula)}
                      setInFocus={setInConditionalFocus}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowConditional(false);
                        setInConditionalFocus(false);
                      }}
                      className="mt-2 px-2 py-1 text-xs bg-red-100 rounded hover:bg-red-200 w-fit"
                    >
                      ✕ Remove conditional
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-3 py-1 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-2 gap-4 items-start">
            {renderSection("pre", "Pre-Trade", "pre-dropzone")}
            {renderSection("post", "Post-Trade", "post-dropzone")}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
            {activeId ? (
              <SortableItemModal
                key={activeId}
                v={variables.find((x) => x.id === activeId)}
                onRename={handleRename}
                onEditFormula={handleEditFormula}
                onDelete={handleDelete}
                onToggleVisible={handleToggleVisible}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageVariablesModal;

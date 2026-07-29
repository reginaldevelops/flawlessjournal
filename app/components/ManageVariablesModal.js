// components/ManageVariablesModal.jsx
"use client";

import { useState } from "react";
import {
  DndContext,
  pointerWithin,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  defaultAnimateLayoutChanges,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../lib/supabaseClient";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Parser } from "expr-eval";
import ConditionalBuilder from "./ConditionalBuilder";

// 🔄 Recalc helper
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
    if (!trade.data) continue;

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

      if (typeof calc === "string") {
        try {
          const innerExpr = parser.parse(calc);
          const innerVars = innerExpr.variables();
          const hasAllInner = innerVars.every(
            (key) => values[key] !== undefined
          );
          if (hasAllInner) calc = innerExpr.evaluate(values);
        } catch {}
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

  if (updatedTrades.length > 0) {
    const { error: updateError } = await supabase
      .from("trades")
      .upsert(updatedTrades, { onConflict: "id" });

    if (updateError) console.error("❌ Batch update error:", updateError);
  }
}

/* ---------- Variable row (presentational — safe for DragOverlay) ---------- */
function VariableRow({ v, dragHandleProps, isDragging, onRename, onDelete, onToggleVisible, onEditFormula }) {
  if (!v) return null;
  return (
    <div
      className={`flex items-center justify-between p-2.5 border border-slate-200 rounded-xl bg-white mb-2 shadow-sm ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span
        {...dragHandleProps}
        className="cursor-grab text-slate-300 hover:text-slate-500 mr-2 select-none text-base active:cursor-grabbing"
      >
        ⠿
      </span>
      <span className="flex-1 text-xs font-medium text-slate-800">{v.name}</span>
      <div className="flex items-center gap-2.5 text-slate-400">
        <button type="button" onClick={() => onToggleVisible(v)} className="hover:text-slate-600 transition">
          {v.visible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        {v.type === "custom" && (
          <>
            <button type="button" onClick={() => onRename(v)} className="hover:text-blue-600 transition">
              <Pencil size={15} />
            </button>
            {v.varType === "calculated" && (
              <button type="button" onClick={() => onEditFormula(v)} className="hover:text-purple-600 font-bold text-xs transition">
                ƒx
              </button>
            )}
            <button type="button" onClick={() => onDelete(v)} className="hover:text-red-600 transition">
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Sortable Item ---------- */
function SortableItemModal({
  v,
  onRename,
  onDelete,
  onToggleVisible,
  onEditFormula,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: v.id,
      animateLayoutChanges: (args) =>
        defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <VariableRow
        v={v}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        onRename={onRename}
        onDelete={onDelete}
        onToggleVisible={onToggleVisible}
        onEditFormula={onEditFormula}
      />
    </div>
  );
}

/* ---------- Droppable Container voor Fase-kolommen ---------- */
function DroppableSection({ id, title, children }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex flex-col bg-slate-50 p-3.5 rounded-2xl border border-slate-200 min-h-[260px]">
      <h3 className="font-bold mb-3 text-xs text-slate-700 uppercase tracking-wider">
        {title}
      </h3>
      <div ref={setNodeRef} className="flex-1 min-h-[200px]">
        {children}
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */
export default function ManageVariablesModal({
  context,
  variables,
  setVariables,
  onClose,
}) {
  const [activeId, setActiveId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("text");
  const [newVarFormula, setNewVarFormula] = useState("");
  const [showConditional, setShowConditional] = useState(false);
  const [inConditionalFocus, setInConditionalFocus] = useState(false);

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
          if (trade.data?.hasOwnProperty(variable.name)) {
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
    if (!over) return;

    const activeVar = variables.find((v) => v.id === active.id);
    if (!activeVar) return;

    let targetPhase = activeVar.phase;
    if (over.id === "pre-dropzone") {
      targetPhase = "pre";
    } else if (over.id === "post-dropzone") {
      targetPhase = "post";
    } else {
      const overVar = variables.find((v) => v.id === over.id);
      if (overVar) targetPhase = overVar.phase;
    }

    const varsInTarget = variables.filter((v) => v.phase === targetPhase);
    const overVar = variables.find((v) => v.id === over.id);

    const oldIndex = variables
      .filter((v) => v.phase === activeVar.phase)
      .findIndex((v) => v.id === active.id);

    const newIndex = overVar
      ? varsInTarget.findIndex((v) => v.id === over.id)
      : varsInTarget.length;

    let reordered;
    if (activeVar.phase === targetPhase) {
      if (active.id === over.id) return;
      reordered = arrayMove(varsInTarget, oldIndex, newIndex);
    } else {
      reordered = [
        ...varsInTarget.slice(0, newIndex),
        { ...activeVar, phase: targetPhase },
        ...varsInTarget.slice(newIndex),
      ];
    }

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
      <DroppableSection id={dropzoneId} title={title}>
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
          <div className="text-xs text-slate-400 italic text-center py-10">
            Sleep variabelen hierheen
          </div>
        )}
      </DroppableSection>
    );
  };

  const currentAction =
    (isRenaming && "Renaming…") ||
    (isDeleting && "Deleting…") ||
    (isUpdatingFormula && "Updating formula…");

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Manage Variables
            {currentAction && (
              <span className="flex items-center gap-1.5 text-xs font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                <svg
                  className="animate-spin h-3.5 w-3.5 text-slate-500"
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
        </div>

        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mb-4 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold transition"
          >
            + Add new variable
          </button>
        ) : (
          <div className="mb-5 flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Variable name"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-xs flex-1 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <select
                value={newVarType}
                onChange={(e) => setNewVarType(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none bg-white"
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
              <div className="flex flex-col gap-3 pt-2 border-t border-slate-200">
                {!showConditional && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1.5">
                      Build formula:
                    </p>
                    {!inConditionalFocus && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
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
                                className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 font-medium text-slate-700 transition"
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
                              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 font-bold text-slate-700 transition"
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
                      className="border border-slate-300 rounded-xl px-3 py-2 text-xs w-full outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                    />
                  </div>
                )}

                {!showConditional ? (
                  <button
                    type="button"
                    onClick={() => setShowConditional(true)}
                    className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg w-fit font-semibold transition"
                  >
                    + Conditional
                  </button>
                ) : (
                  <div className="mt-2 border-t pt-3">
                    <p className="text-xs font-medium text-slate-600 mb-1.5">
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
                      className="mt-3 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg w-fit font-semibold transition"
                    >
                      ✕ Remove conditional
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleAdd}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
              >
                Save Variable
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <DndContext
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {renderSection("pre", "Pre-Trade", "pre-dropzone")}
            {renderSection("post", "Post-Trade", "post-dropzone")}
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
            {activeId ? (
              <div className="w-[280px] cursor-grabbing">
                <VariableRow
                  v={variables.find((x) => x.id === activeId)}
                  onRename={handleRename}
                  onEditFormula={handleEditFormula}
                  onDelete={handleDelete}
                  onToggleVisible={handleToggleVisible}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="flex justify-end mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

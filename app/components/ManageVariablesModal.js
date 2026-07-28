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
import { Pencil, Trash2, Eye, EyeOff, GripVertical, Plus, FunctionSquare } from "lucide-react";
import { Parser } from "expr-eval";
import { supabase } from "../lib/supabaseClient";
import {
  Modal,
  Button,
  Input,
  Select,
  Field,
  ConfirmDialog,
  Spinner,
  cn,
} from "./ui";
import ConditionalBuilder from "./ConditionalBuilder";

async function recalcAllTrades(variable) {
  if (variable.varType !== "calculated" || !variable.formula) return;

  const parser = new Parser();
  let expr;
  try {
    expr = parser.parse(variable.formula);
  } catch (err) {
    console.warn("Invalid formula for", variable.name, err.message);
    return;
  }

  const { data: trades, error } = await supabase.from("trades").select("id, data");
  if (error) {
    console.error("Fetch trades error:", error);
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

    const hasAllInputs = expr.variables().every((key) => values[key] !== undefined);
    if (!hasAllInputs) continue;

    try {
      let calc = expr.evaluate(values);

      if (typeof calc === "string") {
        try {
          const innerExpr = parser.parse(calc);
          const innerVars = innerExpr.variables();
          const hasAllInner = innerVars.every((key) => values[key] !== undefined);
          if (hasAllInner) calc = innerExpr.evaluate(values);
        } catch {
          /* keep string */
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
      console.warn(`Could not calc for trade ${trade.id}:`, err.message);
    }
  }

  if (updatedTrades.length > 0) {
    const { error: updateError } = await supabase
      .from("trades")
      .upsert(updatedTrades, { onConflict: "id" });
    if (updateError) console.error("Batch update error:", updateError);
  }
}

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
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "mb-2 flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-2.5 py-2",
        "shadow-sm transition-colors",
        isDragging && "opacity-60 ring-2 ring-brand/30"
      )}
    >
      <button
        type="button"
        {...listeners}
        className="cursor-grab touch-none text-content-subtle hover:text-content-muted active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-content">
        {v.name}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="xs"
          iconOnly
          icon={v.visible ? Eye : EyeOff}
          onClick={() => onToggleVisible(v)}
          aria-label={v.visible ? "Hide variable" : "Show variable"}
        />
        {v.type === "custom" && (
          <>
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              icon={Pencil}
              onClick={() => onRename(v)}
              aria-label="Rename"
            />
            {v.varType === "calculated" && (
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                icon={FunctionSquare}
                onClick={() => onEditFormula(v)}
                aria-label="Edit formula"
              />
            )}
            <Button
              variant="danger-ghost"
              size="xs"
              iconOnly
              icon={Trash2}
              onClick={() => onDelete(v)}
              aria-label="Delete"
            />
          </>
        )}
      </div>
    </div>
  );
}

function DroppableSection({ id, title, children, empty }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col rounded-xl border border-line bg-surface-sunken p-3.5 transition-colors",
        isOver && "border-brand/50 bg-brand-soft/40"
      )}
    >
      <h3 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-content-muted">
        {title}
      </h3>
      <div ref={setNodeRef} className="min-h-[200px] flex-1">
        {children}
        {empty && (
          <div className="rounded-lg border border-dashed border-line px-3 py-10 text-center text-xs italic text-content-subtle">
            Drag variables here
          </div>
        )}
      </div>
    </div>
  );
}

const VAR_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "dropdown", label: "Dropdown" },
  { value: "time", label: "Time" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Textarea" },
  { value: "chart", label: "Chart" },
  { value: "calculated", label: "Calculated" },
];

export default function ManageVariablesModal({
  open = true,
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
  const [saving, setSaving] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingFormula, setIsUpdatingFormula] = useState(false);

  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [formulaTarget, setFormulaTarget] = useState(null);
  const [formulaValue, setFormulaValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState(null);

  const handleRenameSubmit = async () => {
    if (!renameTarget) return;
    const newName = renameValue.trim();
    if (!newName || newName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }

    setIsRenaming(true);
    try {
      const { error: varError } = await supabase
        .from("variables")
        .update({ name: newName })
        .eq("id", renameTarget.id);
      if (varError) throw varError;

      const { data: trades, error: tradeError } = await supabase
        .from("trades")
        .select("id, data");
      if (tradeError) throw tradeError;

      const updatedTrades = trades
        .map((trade) => {
          if (trade.data?.hasOwnProperty(renameTarget.name)) {
            const newData = { ...trade.data };
            newData[newName] = newData[renameTarget.name];
            delete newData[renameTarget.name];
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
        prev.map((x) => (x.id === renameTarget.id ? { ...x, name: newName } : x))
      );
      setRenameTarget(null);
    } catch (err) {
      console.error("Rename error:", err);
      setFormError("Rename failed: " + err.message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleEditFormulaSubmit = async () => {
    if (!formulaTarget) return;
    const newFormula = formulaValue.trim();
    if (!newFormula || newFormula === formulaTarget.formula) {
      setFormulaTarget(null);
      return;
    }

    setIsUpdatingFormula(true);
    try {
      const parser = new Parser();
      parser.parse(newFormula);
    } catch (err) {
      setIsUpdatingFormula(false);
      setFormError(`Invalid formula: ${err.message}`);
      return;
    }

    const { error } = await supabase
      .from("variables")
      .update({ formula: newFormula })
      .eq("id", formulaTarget.id);

    if (error) {
      console.error("Error updating formula:", error);
      setFormError("Formula update failed: " + error.message);
    } else {
      setVariables((prev) =>
        prev.map((x) =>
          x.id === formulaTarget.id ? { ...x, formula: newFormula } : x
        )
      );
      await recalcAllTrades({ ...formulaTarget, formula: newFormula });
      setFormulaTarget(null);
    }
    setIsUpdatingFormula(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error: varError } = await supabase
        .from("variables")
        .delete()
        .eq("id", deleteTarget.id);
      if (varError) throw varError;

      const { error: tradeError } = await supabase.rpc("remove_variable_key", {
        key_name: deleteTarget.name,
      });
      if (tradeError) throw tradeError;

      setVariables((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting variable:", err);
      setFormError("Delete failed: " + err.message);
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
    if (!newVarName.trim()) {
      setFormError("Enter a variable name.");
      return;
    }
    setFormError(null);
    setSaving(true);

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

    setSaving(false);

    if (error) {
      console.error("Insert error:", error);
      setFormError(error.message);
      return;
    }

    if (data) {
      const variable = data[0];
      setVariables((prev) => [variable, ...prev]);
      setNewVarName("");
      setNewVarType("text");
      setNewVarFormula("");
      setShowAddForm(false);
      setShowConditional(false);
      await recalcAllTrades(variable);
    }
  };

  const renderSection = (phase, title, dropzoneId) => {
    const varsInPhase = variables.filter((v) => v.phase === phase);

    return (
      <DroppableSection
        id={dropzoneId}
        title={title}
        empty={varsInPhase.length === 0}
      >
        <SortableContext
          id={dropzoneId}
          items={varsInPhase.map((v) => v.id)}
          strategy={verticalListSortingStrategy}
        >
          {varsInPhase.map((v) => (
            <SortableItemModal
              key={v.id}
              v={v}
              onRename={(item) => {
                setFormError(null);
                setRenameTarget(item);
                setRenameValue(item.name);
              }}
              onEditFormula={(item) => {
                setFormError(null);
                setFormulaTarget(item);
                setFormulaValue(item.formula || "");
              }}
              onDelete={(item) => {
                setFormError(null);
                setDeleteTarget(item);
              }}
              onToggleVisible={handleToggleVisible}
            />
          ))}
        </SortableContext>
      </DroppableSection>
    );
  };

  const currentAction =
    (isRenaming && "Renaming…") ||
    (isDeleting && "Deleting…") ||
    (isUpdatingFormula && "Updating formula…");

  const activeVar = activeId ? variables.find((x) => x.id === activeId) : null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Manage variables"
        description="Add fields, set visibility, and drag between pre- and post-trade."
        size="lg"
        footer={
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      >
        {currentAction && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface-sunken px-2.5 py-1 text-xs text-content-muted">
            <Spinner size={12} />
            {currentAction}
          </div>
        )}

        {formError && (
          <div className="mb-4 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss">
            {formError}
          </div>
        )}

        {!showAddForm ? (
          <Button
            variant="subtle"
            size="sm"
            icon={Plus}
            className="mb-4"
            onClick={() => {
              setFormError(null);
              setShowAddForm(true);
            }}
          >
            Add new variable
          </Button>
        ) : (
          <div className="mb-5 space-y-3 rounded-xl border border-line bg-surface-sunken p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Field label="Name" className="flex-1" required>
                {(id) => (
                  <Input
                    id={id}
                    size="sm"
                    placeholder="Variable name"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    autoFocus
                  />
                )}
              </Field>
              <Field label="Type" className="sm:w-40">
                {(id) => (
                  <Select
                    id={id}
                    size="sm"
                    value={newVarType}
                    onChange={(e) => setNewVarType(e.target.value)}
                  >
                    {VAR_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            {newVarType === "calculated" && (
              <div className="space-y-3 border-t border-line pt-3">
                {!showConditional && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-content-muted">
                      Build formula
                    </p>
                    {!inConditionalFocus && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
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
                                  setNewVarFormula((prev) => (prev || "") + token)
                                }
                                className="rounded-md border border-line bg-surface-raised px-2 py-1 text-xs font-medium text-content transition hover:border-line-strong hover:bg-surface-hover"
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
                              className="rounded-md border border-line bg-surface-raised px-2.5 py-1 text-xs font-semibold text-content transition hover:border-line-strong hover:bg-surface-hover"
                            >
                              {op}
                            </button>
                          )
                        )}
                      </div>
                    )}
                    <Input
                      size="sm"
                      placeholder="Formula"
                      value={newVarFormula}
                      onChange={(e) => setNewVarFormula(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                )}

                {!showConditional ? (
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => setShowConditional(true)}
                  >
                    + Conditional
                  </Button>
                ) : (
                  <div className="space-y-3 border-t border-line pt-3">
                    <p className="text-xs font-medium text-content-muted">
                      Conditional logic
                    </p>
                    <ConditionalBuilder
                      variables={variables}
                      onChange={(condFormula) => setNewVarFormula(condFormula)}
                      setInFocus={setInConditionalFocus}
                    />
                    <Button
                      variant="danger-ghost"
                      size="xs"
                      onClick={() => {
                        setShowConditional(false);
                        setInConditionalFocus(false);
                      }}
                    >
                      Remove conditional
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={handleAdd}
              >
                Save variable
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setShowConditional(false);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <DndContext
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            {renderSection("pre", "Pre-trade", "pre-dropzone")}
            {renderSection("post", "Post-trade", "post-dropzone")}
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
            {activeVar ? (
              <SortableItemModal
                key={activeId}
                v={activeVar}
                onRename={() => {}}
                onEditFormula={() => {}}
                onDelete={() => {}}
                onToggleVisible={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </Modal>

      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename variable"
        description="This updates the field name on every trade that uses it."
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isRenaming}
              onClick={handleRenameSubmit}
            >
              Save name
            </Button>
          </>
        }
      >
        <Field label="Name" required>
          {(id) => (
            <Input
              id={id}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
              }}
            />
          )}
        </Field>
      </Modal>

      <Modal
        open={Boolean(formulaTarget)}
        onClose={() => setFormulaTarget(null)}
        title="Edit formula"
        description={formulaTarget ? `Variable: ${formulaTarget.name}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setFormulaTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isUpdatingFormula}
              onClick={handleEditFormulaSubmit}
            >
              Save formula
            </Button>
          </>
        }
      >
        <Field label="Formula" required>
          {(id) => (
            <Input
              id={id}
              value={formulaValue}
              onChange={(e) => setFormulaValue(e.target.value)}
              className="font-mono"
              autoFocus
            />
          )}
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete variable?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from all trades.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        loading={isDeleting}
      />
    </>
  );
}

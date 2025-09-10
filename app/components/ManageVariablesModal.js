"use client";

import { useState } from "react";
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

/* ---------- Sortable Item ---------- */
function SortableItemModal({ v, onRename, onDelete, onToggleVisible }) {
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
      className="flex items-center justify-between p-2 border rounded bg-white mb-1"
    >
      {/* Drag handle */}
      <span {...listeners} className="cursor-grab text-gray-400 mr-2">
        ⠿
      </span>

      {/* Variable name */}
      <span className="flex-1">{v.name}</span>

      {/* Actions */}
      <div className="flex gap-2 text-gray-500">
        {/* Show/Hide toggle */}
        <button
          onClick={() => onToggleVisible(v)}
          className="hover:text-gray-700"
        >
          {v.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        {/* Rename + Delete only for custom */}
        {v.type === "custom" && (
          <>
            <button onClick={() => onRename(v)} className="hover:text-blue-600">
              <Pencil size={16} />
            </button>
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

  const handleRename = async (variable) => {
    const newName = prompt("New name?", variable.name);
    if (!newName || newName === variable.name) return;
    await supabase
      .from("variables")
      .update({ name: newName })
      .eq("id", variable.id);
    setVariables((prev) =>
      prev.map((x) => (x.id === variable.id ? { ...x, name: newName } : x))
    );
  };

  const handleDelete = async (variable) => {
    if (!confirm(`Delete variable "${variable.name}"?`)) return;
    await supabase.from("variables").delete().eq("id", variable.id);
    setVariables((prev) => prev.filter((x) => x.id !== variable.id));
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

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeVar = variables.find((v) => v.id === active.id);
    const overVar = variables.find((v) => v.id === over.id);

    if (!activeVar) return;

    let targetPhase = activeVar.phase;
    if (overVar && overVar.phase !== activeVar.phase) {
      targetPhase = overVar.phase;
    }

    if (!overVar && event.over?.id === "post-dropzone") {
      targetPhase = "post";
    }
    if (!overVar && event.over?.id === "pre-dropzone") {
      targetPhase = "pre";
    }

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
          options: [],
          editable: true,
          phase: "pre",
          order: 0, // ensure it shows at the top
        },
      ])
      .select();

    if (error) {
      console.error("❌ Insert error:", error);
      return;
    }

    if (data) {
      setVariables((prev) => [data[0], ...prev]); // add at top
      setNewVarName("");
      setNewVarType("text");
      setShowAddForm(false);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[500px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Manage Variables</h2>

        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="mb-4 px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-600 rounded text-sm font-medium"
          >
            + Add new variable
          </button>
        ) : (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="text"
              placeholder="Variable name"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
            />
            <select
              value={newVarType}
              onChange={(e) => setNewVarType(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="dropdown">Dropdown</option>
              <option value="time">Time</option>
              <option value="date">Date</option>
              <option value="textarea">Textarea</option>
              <option value="chart">Chart</option>
            </select>
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
        )}

        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {renderSection("pre", "Pre-Trade", "pre-dropzone")}
          {renderSection("post", "Post-Trade", "post-dropzone")}
          <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
            {activeId ? (
              <SortableItemModal
                key={activeId}
                v={variables.find((x) => x.id === activeId)}
                onRename={handleRename}
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

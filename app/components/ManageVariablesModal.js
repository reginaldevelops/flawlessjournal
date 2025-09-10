"use client";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "../lib/supabaseClient";

// ---------- SortableItem for modal ----------
function SortableItemModal({ v, onRename, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: v.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center justify-between p-2 border rounded bg-white mb-1"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 mr-2"
      >
        ⠿
      </span>
      <span className="flex-1">{v.name}</span>
      <div className="flex gap-2 text-xs">
        <button onClick={() => onRename(v)}>✏ Rename</button>
        <button onClick={() => onDelete(v)} className="text-red-500">
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// ---------- Modal ----------
function ManageVariablesModal({ context, variables, setVariables, onClose }) {
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

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeVar = variables.find((v) => v.id === active.id);
    const overVar = variables.find((v) => v.id === over.id);

    if (!activeVar) return;

    let targetPhase = activeVar.phase;
    if (overVar && overVar.phase !== activeVar.phase) {
      // Dropped onto another phase
      targetPhase = overVar.phase;
    }

    // If dropped into empty area of Post-Trade container
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

        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {renderSection("pre", "Pre-Trade", "pre-dropzone")}
          {renderSection("post", "Post-Trade", "post-dropzone")}
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

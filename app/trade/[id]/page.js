"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import CreatableSelect from "react-select/creatable";
import ManageVariablesModal from "../../components/ManageVariablesModal";

/* 🟢 DnD-kit imports */
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function useOutsideClick(ref, onClickOutside) {
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClickOutside();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, onClickOutside]);
}

function SortableItem({ v, trade, saveTrade, setVariables }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: v.id });

  const value = trade[v.name] || "";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="bg-white rounded-lg text-sm p-1"
    >
      <div className="grid grid-cols-[20px,1fr] items-center gap-2">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab select-none text-xs text-gray-400"
        >
          ⠿
        </div>

        {/* Field (label + input/select) */}
        <div className="flex flex-col gap-1">
          {(!v.varType || v.varType === "dropdown") && (
            <>
              <span className="text-xs text-gray-600">{v.name}</span>
              <CreatableSelect
                isClearable
                value={value ? { value, label: value } : null}
                options={v.options.map((opt) => ({ value: opt, label: opt }))}
                onChange={(sel) =>
                  saveTrade({ ...trade, [v.name]: sel ? sel.value : null })
                }
                onCreateOption={async (inputValue) => {
                  const newOptions = [...v.options, inputValue];
                  await supabase
                    .from("variables")
                    .update({ options: newOptions })
                    .eq("id", v.id);
                  setVariables((prev) =>
                    prev.map((x) =>
                      x.id === v.id ? { ...x, options: newOptions } : x
                    )
                  );
                  saveTrade({ ...trade, [v.name]: inputValue });
                }}
                placeholder="Select or type..."
                className="react-select text-xs"
                classNamePrefix="react-select"
              />
            </>
          )}

          {v.varType === "text" && (
            <div className="grid grid-cols-[120px,1fr] items-center gap-2">
              <span className="text-xs text-gray-600">{v.name}</span>
              <input
                type="text"
                value={value}
                onChange={(e) =>
                  saveTrade({ ...trade, [v.name]: e.target.value })
                }
                className="border rounded px-2 py-1 text-xs w-full"
              />
            </div>
          )}

          {v.varType === "number" && (
            <div className="grid grid-cols-[120px,1fr] items-center gap-2">
              <span className="text-xs text-gray-600">{v.name}</span>
              <input
                type="number"
                value={value}
                onChange={(e) =>
                  saveTrade({ ...trade, [v.name]: Number(e.target.value) })
                }
                className="border rounded px-2 py-1 text-xs w-full"
              />
            </div>
          )}

          {v.varType === "time" && (
            <div className="grid grid-cols-[120px,1fr] items-center gap-2">
              <span className="text-xs text-gray-600">{v.name}</span>
              <input
                type="time"
                value={value}
                onChange={(e) =>
                  saveTrade({ ...trade, [v.name]: e.target.value })
                }
                className="border rounded px-2 py-1 text-xs w-full"
              />
            </div>
          )}

          {v.varType === "date" && (
            <div className="grid grid-cols-[90px,1fr] items-center gap-2">
              <span className="text-xs text-gray-600">{v.name}</span>
              <input
                type="date"
                value={value}
                onChange={(e) =>
                  saveTrade({ ...trade, [v.name]: e.target.value })
                }
                className="border rounded px-2 py-1 text-xs w-full max-w-[140px]"
              />
            </div>
          )}

          {v.varType === "textarea" && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">{v.name}</span>
              <textarea
                rows={3}
                value={value}
                onChange={(e) =>
                  saveTrade({ ...trade, [v.name]: e.target.value })
                }
                className="border rounded px-2 py-1 text-xs resize-y w-full h-[100px]"
              />
            </div>
          )}

          {v.varType === "chart" && (
            <div className="grid grid-cols-[90px,1fr] items-center gap-2">
              <span className="text-xs text-gray-600">{v.name}</span>
              <input
                type="text"
                value={value}
                onChange={(e) =>
                  saveTrade({ ...trade, [v.name]: e.target.value })
                }
                placeholder="Paste chart link..."
                className="border rounded px-2 py-1 text-xs w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TradeViewPage() {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [variables, setVariables] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);
  const [showUsdtChart, setShowUsdtChart] = useState(true);
  const [showManageModal, setShowManageModal] = useState(false);

  const fixedOrder = [
    "Trade number",
    "Coins",
    "Datum",
    "Entreetijd",
    "Chart",
    "USDT.D chart",
    "Confidence",
    "Target Win",
    "Target loss",
    "Reasons for entry",
  ];

  const layoutOverrides = {
    "Reasons for entry": "column",
  };

  /* ---------- Load trade ---------- */
  useEffect(() => {
    const loadTrade = async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        const newState = {
          id: data.id,
          "Trade number": data.trade_number,
          ...data.data,
        };
        setTrade(newState);
      } else {
        console.error("❌ Load trade error:", error);
      }
    };
    if (id) loadTrade();
  }, [id]);

  /* ---------- Load variables ---------- */
  useEffect(() => {
    const loadVariables = async () => {
      const { data, error } = await supabase
        .from("variables")
        .select("*")
        .order("order", { ascending: true });

      if (!error && data) {
        setVariables(data);
      } else {
        console.error("❌ Load variables error:", error);
      }
    };
    loadVariables();
  }, []);

  const saveTrade = async (updated) => {
    setTrade(updated);
    const { error } = await supabase
      .from("trades")
      .update({ data: updated })
      .eq("id", updated.id);
    if (error) console.error("❌ Save error:", error);
  };

  const deleteTrade = async () => {
    if (!confirm("Weet je zeker dat je deze trade wilt verwijderen?")) return;
    const { error } = await supabase.from("trades").delete().eq("id", trade.id);
    if (error) {
      console.error("❌ Delete error:", error);
      return;
    }
    window.location.href = "/";
  };

  const addVariable = async (phase) => {
    const newKey = prompt("Name of new variable?");
    if (!newKey) return;
    const varType = prompt(
      "Type? (dropdown, text, number, time, chart)",
      "text"
    );
    if (!varType) return;

    const { data, error } = await supabase
      .from("variables")
      .insert([
        {
          name: newKey.trim(),
          type: "custom",
          varType: varType.trim(),
          options: [],
          editable: true,
          phase,
        },
      ])
      .select();
    if (!error && data) {
      setVariables((prev) => [...prev, data[0]]);
    }
  };

  const renameVariable = async (variable, newName) => {
    if (!newName || newName === variable.name) {
      setMenuOpen(null);
      return;
    }
    const { error } = await supabase
      .from("variables")
      .update({ name: newName })
      .eq("id", variable.id);

    if (!error) {
      setVariables((prev) =>
        prev.map((x) => (x.id === variable.id ? { ...x, name: newName } : x))
      );
      if (trade[variable.name] !== undefined) {
        const updated = { ...trade };
        updated[newName] = updated[variable.name];
        delete updated[variable.name];
        saveTrade(updated);
      }
    }
    setMenuOpen(null);
  };

  const deleteVariable = async (variable) => {
    if (!confirm(`Delete variable "${variable.name}"?`)) return;
    const { error } = await supabase
      .from("variables")
      .delete()
      .eq("id", variable.id);
    if (!error) {
      setVariables((prev) => prev.filter((x) => x.id !== variable.id));
      const updated = { ...trade };
      delete updated[variable.name];
      saveTrade(updated);
    }
    setMenuOpen(null);
  };

  const moveVariable = async (variable, newPhase) => {
    const { error } = await supabase
      .from("variables")
      .update({ phase: newPhase })
      .eq("id", variable.id);
    if (!error) {
      setVariables((prev) =>
        prev.map((x) => (x.id === variable.id ? { ...x, phase: newPhase } : x))
      );
    }
    setMenuOpen(null);
  };

  if (!trade) return <div className="p-4">Loading trade...</div>;

  const handleDragEnd = async (event, phase) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const varsInPhase = variables.filter((v) => v.phase === phase);
    const oldIndex = varsInPhase.findIndex((v) => v.id === active.id);
    const newIndex = varsInPhase.findIndex((v) => v.id === over.id);

    const reordered = arrayMove(varsInPhase, oldIndex, newIndex);

    setVariables((prev) => {
      const others = prev.filter((v) => v.phase !== phase);
      return [...others, ...reordered];
    });

    // ✅ Save new order to Supabase
    await Promise.all(
      reordered.map((v, index) =>
        supabase.from("variables").update({ order: index }).eq("id", v.id)
      )
    );
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-transparent">
        {/* Links: coin + pnl */}
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-semibold">
            {trade.Coins || "Unknown Coin"}
          </h2>
          <div
            className={`rounded-lg text-xl font-semibold shadow-inner px-3 py-1 ${
              Number(trade["PNL"]) >= 0
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {Number(trade["PNL"]) >= 0 ? "+" : ""}
            {trade["PNL"] || 0}
          </div>
        </div>

        {/* Rechts: datum + delete */}
        <div className="flex items-center gap-3 text-lg">
          <span>{trade.Datum || "—"}</span>
          <button
            onClick={deleteTrade}
            className="text-white bg-red-800 hover:bg-red-500 text-sm px-2 py-1 rounded"
          >
            DEL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] gap-2 p-2">
        {/* Sidebar */}
        <div className="flex flex-col gap-2">
          {/* Variable management trigger */}
          <div className="mb-2">
            <button
              onClick={() => setShowManageModal(true)}
              className="px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-600 rounded text-sm font-medium"
            >
              Variable Management
            </button>
          </div>
          {/* Pre-Trade */}
          <div className="bg-white rounded-xl shadow px-3 py-3 flex flex-col gap-2">
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, "pre")}
            >
              <SortableContext
                items={variables
                  .filter((v) => v.phase === "pre")
                  .map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                {variables
                  .filter((v) => v.phase === "pre")
                  .map((v) => (
                    <SortableItem
                      key={v.id}
                      v={v}
                      trade={trade}
                      saveTrade={saveTrade}
                      setVariables={setVariables}
                      renameVariable={renameVariable}
                      deleteVariable={deleteVariable}
                      moveVariable={moveVariable}
                      menuOpen={menuOpen}
                      setMenuOpen={setMenuOpen}
                    />
                  ))}
              </SortableContext>
            </DndContext>

            <button
              onClick={() => addVariable("pre")}
              className="mt-2 text-xs text-sky-500 hover:underline"
            >
              + Add new pre variable
            </button>
          </div>

          {/* Post-Trade */}
          <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, "post")}
            >
              <SortableContext
                items={variables
                  .filter((v) => v.phase === "post")
                  .map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                {variables
                  .filter((v) => v.phase === "post")
                  .map((v) => (
                    <SortableItem
                      key={v.id}
                      v={v}
                      trade={trade}
                      saveTrade={saveTrade}
                      setVariables={setVariables}
                      renameVariable={renameVariable}
                      deleteVariable={deleteVariable}
                      moveVariable={moveVariable}
                      menuOpen={menuOpen}
                      setMenuOpen={setMenuOpen}
                    />
                  ))}
              </SortableContext>
            </DndContext>

            <button
              onClick={() => addVariable("post")}
              className="mt-2 text-xs text-sky-500 hover:underline"
            >
              + Add new post variable
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Dynamic chart variables */}
          {variables.filter((v) => v.varType === "chart").length > 0 ? (
            variables
              .filter((v) => v.varType === "chart")
              .map((v) => (
                <div key={v.id} className="bg-white rounded-xl shadow p-4">
                  <h3 className="font-semibold mb-2">{v.name}</h3>
                  {trade[v.name] ? (
                    <a
                      href={trade[v.name]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={trade[v.name]}
                        alt={v.name}
                        className="max-w-full max-h-[800px] object-contain rounded"
                      />
                    </a>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-8">
                      No chart added
                    </div>
                  )}
                </div>
              ))
          ) : (
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2">Charts</h3>
              <div className="text-sm text-gray-400 text-center py-8">
                Add a chart
              </div>
            </div>
          )}

          {/* Keep Trade evaluation section as is */}
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold mb-2">Trade evaluation</h3>
            <textarea
              value={trade["Notes"] || ""}
              onChange={(e) => saveTrade({ ...trade, Notes: e.target.value })}
              className="w-full min-h-[150px] border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>
      {showManageModal && (
        <ManageVariablesModal
          context="trade"
          variables={variables}
          setVariables={setVariables}
          onClose={() => setShowManageModal(false)}
        />
      )}
    </div>
  );
}

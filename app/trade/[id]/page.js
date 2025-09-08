"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import CreatableSelect from "react-select/creatable";

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

function SortableItem({
  v,
  trade,
  saveTrade,
  setVariables,
  renameVariable,
  deleteVariable,
  menuOpen,
  setMenuOpen,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: v.id });

  const value = trade[v.name] || null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="flex flex-col gap-2 bg-white rounded-lg text-sm p-1"
    >
      {/* Header */}
      <div className="flex justify-between text-xs">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab px-1 text-xs select-none"
        >
          ⠿ <span className="text-xs truncate">{v.name}</span>
        </div>

        {v.editable && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(menuOpen === v.id ? null : v.id)}
              className="bg-none border-none text-sm cursor-pointer"
            >
              ⋮
            </button>
            {menuOpen === v.id && (
              <div className="absolute top-5 right-0 bg-white border border-gray-200 rounded-md shadow-md flex flex-col z-10 text-xs">
                <button
                  className="px-2 py-1 hover:bg-gray-100 text-left"
                  onClick={() => {
                    const newName = prompt("New name?", v.name);
                    if (newName) renameVariable(v, newName.trim());
                  }}
                >
                  ✏ Rename
                </button>
                <button
                  className="px-2 py-1 hover:bg-gray-100 text-left"
                  onClick={() =>
                    moveVariable(v, v.phase === "pre" ? "post" : "pre")
                  }
                >
                  {v.phase === "pre" ? "➡ Change to post" : "⬅ Change to pre"}
                </button>
                <button
                  className="px-2 py-1 hover:bg-gray-100 text-red-600 text-left"
                  onClick={() => deleteVariable(v)}
                >
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <CreatableSelect
        isClearable
        value={value ? { value, label: value } : null}
        options={v.options.map((opt) => ({
          value: opt,
          label: opt,
        }))}
        onChange={(sel) =>
          saveTrade({
            ...trade,
            [v.name]: sel ? sel.value : null,
          })
        }
        onCreateOption={async (inputValue) => {
          const newOptions = [...v.options, inputValue];
          await supabase
            .from("variables")
            .update({ options: newOptions })
            .eq("id", v.id);

          setVariables((prev) =>
            prev.map((x) => (x.id === v.id ? { ...x, options: newOptions } : x))
          );

          saveTrade({ ...trade, [v.name]: inputValue });
        }}
        placeholder="Select or type..."
        className="react-select text-xs"
        classNamePrefix="react-select"
        styles={{
          control: (base) => ({
            ...base,
            minHeight: "26px",
            height: "33px",
            fontSize: "0.75rem",
          }),
          valueContainer: (base) => ({
            ...base,
            padding: "5px 5px",
          }),
          input: (base) => ({
            ...base,
            margin: 0,
            padding: 0,
          }),
          menu: (base) => ({
            ...base,
            fontSize: "0.75rem",
          }),
        }}
      />
    </div>
  );
}

export default function TradeViewPage() {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [variables, setVariables] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);
  const [showUsdtChart, setShowUsdtChart] = useState(true);

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
    const { data, error } = await supabase
      .from("variables")
      .insert([
        {
          name: newKey.trim(),
          type: "custom",
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

    const customVars = variables.filter(
      (v) => v.type === "custom" && v.phase === phase
    );
    const oldIndex = customVars.findIndex((v) => v.id === active.id);
    const newIndex = customVars.findIndex((v) => v.id === over.id);
    const reordered = arrayMove(customVars, oldIndex, newIndex);

    setVariables((prev) => {
      const others = prev.filter(
        (v) => !(v.type === "custom" && v.phase === phase)
      );
      return [...others, ...reordered];
    });

    await Promise.all(
      reordered.map((v, index) =>
        supabase.from("variables").update({ order: index }).eq("id", v.id)
      )
    );
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between px-6 py-4 bg-transparent">
        <h2 className="text-3xl font-semibold">
          {trade.Coins || "Unknown Coin"}
        </h2>
        <div className="flex items-center gap-3 text-1xl">
          <span>{trade.Datum || "—"}</span>
          <button
            onClick={deleteTrade}
            className="text-white bg-red-800 hover:bg-red-500 text-sl p-1"
          >
            DEL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] gap-2 p-2">
        {/* Sidebar */}
        <div className="flex flex-col gap-2">
          {/* Net PnL Badge */}
          <div
            className={`flex justify-between items-center px-4 py-3 rounded-lg text-2xl font-semibold shadow-inner ${
              Number(trade["PNL"]) >= 0
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            <span className="text-sm font-medium text-gray-500">Net PnL</span>
            {Number(trade["PNL"]) >= 0 ? "+" : ""}${trade["PNL"] || 0}
          </div>

          {/* Pre-Trade */}
          <div className="bg-white rounded-xl shadow px-3 py-3 flex flex-col gap-2">
            {variables
              .filter((v) => v.type === "fixed")
              .sort(
                (a, b) =>
                  fixedOrder.indexOf(a.name) - fixedOrder.indexOf(b.name)
              )
              .map((v) => {
                if (v.name === "PNL" || v.name === "Time exit") return null;
                const value = trade[v.name] || "";
                const layout = layoutOverrides[v.name] || "row";

                if (v.name === "Datum") {
                  return (
                    <div
                      key={v.id}
                      className="flex flex-row items-center gap-2"
                    >
                      <strong className="w-full text-xs text-gray-600">
                        {v.name}
                      </strong>
                      <input
                        type="date"
                        value={value}
                        onChange={(e) =>
                          saveTrade({ ...trade, [v.name]: e.target.value })
                        }
                        className="border rounded px-2 py-1 text-xs flex-1"
                      />
                    </div>
                  );
                }

                if (v.name === "Entreetijd") {
                  return (
                    <div
                      key={v.id}
                      className="flex flex-row items-center gap-2"
                    >
                      <strong className="w-full text-xs text-gray-600">
                        {v.name}
                      </strong>
                      <input
                        type="time"
                        value={value}
                        onChange={(e) =>
                          saveTrade({ ...trade, [v.name]: e.target.value })
                        }
                        className="border rounded px-2 py-1 text-xs  flex-1"
                      />
                    </div>
                  );
                }

                if (v.name === "Reasons for entry") {
                  return (
                    <div key={v.id} className="flex flex-col gap-1">
                      <strong className="text-xs text-gray-600">
                        {v.name}
                      </strong>
                      <textarea
                        rows={3}
                        value={value}
                        onChange={(e) =>
                          saveTrade({ ...trade, [v.name]: e.target.value })
                        }
                        className="border rounded px-2 py-1 text-xs resize-y h-[100px]"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={v.id}
                    className="grid grid-cols-[120px,1fr] items-center gap-2"
                  >
                    <strong className="text-xs text-gray-600">{v.name}</strong>
                    {v.name === "Reasons for entry" ? (
                      <textarea
                        rows={3}
                        value={value}
                        onChange={(e) =>
                          saveTrade({ ...trade, [v.name]: e.target.value })
                        }
                        className="border rounded px-2 py-1 text-xs resize-y w-full"
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          saveTrade({ ...trade, [v.name]: e.target.value })
                        }
                        className="border rounded px-2 py-1 text-xs  w-full"
                      />
                    )}
                  </div>
                );
              })}

            {/* Custom Pre Variables */}
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, "pre")}
            >
              <SortableContext
                items={variables
                  .filter((v) => v.type === "custom" && v.phase === "pre")
                  .map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                {variables
                  .filter((v) => v.type === "custom" && v.phase === "pre")
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
            <div className="flex flex-row items-center gap-2">
              <strong className="w-[120px] text-xs text-gray-600">
                Exit time
              </strong>
              <input
                type="time"
                value={trade["Time exit"] || ""}
                onChange={(e) =>
                  saveTrade({ ...trade, ["Time exit"]: e.target.value })
                }
                className="border rounded px-2 py-1 text-xs flex-1"
              />
            </div>
            <div className="grid grid-cols-[120px,1fr] items-center gap-2">
              <strong className="w-[120px] text-xs text-gray-600">PNL</strong>
              <input
                type="number"
                step="0.01"
                value={trade["PNL"] || ""}
                onChange={(e) =>
                  saveTrade({ ...trade, PNL: Number(e.target.value) })
                }
                className="border rounded px-2 py-1 text-xs w-full"
              />
            </div>

            {/* Custom Post Variables */}
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, "post")}
            >
              <SortableContext
                items={variables
                  .filter((v) => v.type === "custom" && v.phase === "post")
                  .map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                {variables
                  .filter((v) => v.type === "custom" && v.phase === "post")
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

        {/* Main content */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold mb-2">Coin Chart</h3>
            {trade.Chart ? (
              <a href={trade.Chart} target="_blank" rel="noopener noreferrer">
                <img
                  src={trade.Chart}
                  alt="Coin Chart"
                  className="max-w-full max-h-[800px] object-contain rounded"
                />
              </a>
            ) : (
              <div className="text-sm text-gray-400 text-center py-8">
                Geen chart toegevoegd
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold mb-2 flex items-center">
              USDT.D Chart
              <button
                onClick={() => setShowUsdtChart(!showUsdtChart)}
                className="ml-2 text-xs px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100"
              >
                {showUsdtChart ? "Hide" : "Show"}
              </button>
            </h3>
            {showUsdtChart &&
              (trade["USDT.D chart"] ? (
                <a
                  href={trade["USDT.D chart"]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={trade["USDT.D chart"]}
                    alt="USDT.D Chart"
                    className="max-w-full max-h-[800px] object-contain rounded"
                  />
                </a>
              ) : (
                <div className="text-sm text-gray-400 text-center py-8">
                  Geen USDT.D chart toegevoegd
                </div>
              ))}
          </div>

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
    </div>
  );
}

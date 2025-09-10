"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import CreatableSelect from "react-select/creatable";
import ManageVariablesModal from "../../components/ManageVariablesModal";

/* ---------- VariableItem ---------- */
function VariableItem({ v, trade, saveTrade, setVariables }) {
  const value = trade[v.name] || "";

  // Dropdown
  if (!v.varType || v.varType === "dropdown") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[70px,1fr] gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <CreatableSelect
            isClearable
            value={value ? { value, label: value } : null}
            options={v.options.map((opt) => ({ value: opt, label: opt }))}
            onChange={(sel) =>
              saveTrade({ ...trade, [v.name]: sel ? sel.value : null })
            }
            styles={{
              control: (base, state) => ({
                ...base,
                minHeight: "25px",
                height: "25px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "inherit",
                color: "inherit",
                padding: "0 2px",
                border: "1px solid transparent", // ✅ default transparent
                boxShadow: "none", // ✅ remove blue glow
                ...(state.isFocused && { border: "1px solid #6b7280" }), // focus: gray-500
                ":hover": {
                  border: "1px solid #9ca3af", // hover: gray-400
                },
              }),

              valueContainer: (base) => ({
                ...base,
                height: "25px",
                padding: "0 6px",
                fontSize: "12px",
                fontFamily: "inherit",
                color: "inherit",
              }),
              singleValue: (base) => ({
                ...base,
                color: "inherit",
                fontSize: "12px", // ✅ keep consistent
                fontFamily: "inherit",
              }),
              placeholder: (base) => ({
                ...base,
                color: "inherit", // ✅ placeholder text
                opacity: 0.6, // match normal input placeholder look
                fontFamily: "inherit",
              }),
              input: (base) => ({
                ...base,
                margin: 0,
                padding: 0,
              }),
              menu: (base) => ({
                ...base,
                marginTop: 2,
                border: "1px solid transparent", // ✅ start transparent
                boxShadow: "none", // ✅ remove drop shadow
                borderRadius: "4px",
                ":hover": {
                  border: "1px solid #9ca3af", // hover: gray-400
                },
              }),
              option: (base, state) => ({
                ...base,
                fontSize: "12px",
                fontFamily: "inherit",
                color: state.isSelected ? "white" : "inherit",
                backgroundColor: state.isSelected
                  ? "#6b7280" // gray-500
                  : state.isFocused
                    ? "#f3f4f6" // gray-100
                    : "white",
                cursor: "pointer",
              }),
              indicatorsContainer: (base) => ({
                ...base,
                height: "25px",
              }),
            }}
            classNamePrefix="react-select"
          />
        </div>
      </div>
    );
  }

  // Text
  if (v.varType === "text") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[70px,1fr] items-center gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
            className="px-2 py-1 text-xs w-full border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0 truncate"
          />
        </div>
      </div>
    );
  }

  // Number
  if (v.varType === "number") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[70px,1fr] items-center gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <input
            type="number"
            value={value}
            onChange={(e) =>
              saveTrade({ ...trade, [v.name]: Number(e.target.value) })
            }
            className="px-2 py-1 text-xs w-full border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0 truncate"
          />
        </div>
      </div>
    );
  }

  // Time
  if (v.varType === "time") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[70px,1fr] items-center gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <input
            type="time"
            value={value}
            onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
            className="rounded px-2 py-1 text-xs w-[80px] border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0 truncate"
          />
        </div>
      </div>
    );
  }

  // Date
  if (v.varType === "date") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[70px,1fr] items-center gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <input
            type="date"
            value={value}
            onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
            className="rounded px-2 py-1 text-xs w-[115px] border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0"
          />
        </div>
      </div>
    );
  }

  // Textarea
  if (v.varType === "textarea") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">{v.name}</span>
          <textarea
            rows={3}
            value={value}
            onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
            className="border rounded px-2 py-1 text-xs resize-y w-full h-[100px]"
          />
        </div>
      </div>
    );
  }

  // Chart
  if (v.varType === "chart") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[70px,1fr] items-center gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
            placeholder="Paste chart link..."
            className="px-2 py-1 text-xs w-full border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0 truncate"
          />
        </div>
      </div>
    );
  }

  return null;
}

/* ---------- Page ---------- */
export default function TradeViewPage() {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [variables, setVariables] = useState([]);
  const [showManageModal, setShowManageModal] = useState(false);

  // Load trade
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

  // Load variables
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

  if (!trade) return <div className="p-4">Loading trade...</div>;

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-transparent">
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

      <div className="grid grid-cols-1 md:grid-cols-[320px,1fr] gap-2 p-2">
        {/* Sidebar */}
        <div className="flex flex-col gap-2">
          <div className="mb-2 w-full flex justify-end">
            <button
              onClick={() => setShowManageModal(true)}
              className="px-4 py-0 text-gray-500 text-sm font-medium text-right"
            >
              Variable Management
            </button>
          </div>

          {/* Pre-Trade */}
          <div className="bg-white rounded-xl shadow px-3 py-3 flex flex-col gap-2">
            {variables
              .filter((v) => v.phase === "pre")
              .map((v) => (
                <VariableItem
                  key={v.id}
                  v={v}
                  trade={trade}
                  saveTrade={saveTrade}
                  setVariables={setVariables}
                />
              ))}
          </div>

          {/* Post-Trade */}
          <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
            {variables
              .filter((v) => v.phase === "post")
              .map((v) => (
                <VariableItem
                  key={v.id}
                  v={v}
                  trade={trade}
                  saveTrade={saveTrade}
                  setVariables={setVariables}
                />
              ))}
          </div>
        </div>

        {/* Charts + Notes */}
        <div className="flex flex-col gap-4">
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

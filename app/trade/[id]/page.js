"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import CreatableSelect from "react-select/creatable";
import ManageVariablesModal from "../../components/ManageVariablesModal";
import { Parser } from "expr-eval";
import {
  XCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  Sigma,
} from "lucide-react";

function getTradeStatus(trade, variables) {
  const preVars = variables.filter((v) => v.phase === "pre" && v.visible);
  const postVars = variables.filter((v) => v.phase === "post" && v.visible);

  const isFilled = (v) => {
    const val = trade[v.name];
    return val !== null && val !== undefined && val !== "";
  };

  const allPreFilled = preVars.every(isFilled);
  const allPostFilled = postVars.every(isFilled);
  const pnlFilled = isFilled({ name: "PNL" });

  if (!allPreFilled)
    return {
      icon: XCircle,
      color: "bg-red-100 text-red-600 border border-red-300",
    };
  if (allPreFilled && !allPostFilled && !pnlFilled)
    return {
      icon: Clock,
      color: "bg-gray-100 text-gray-600 border border-gray-300",
    };
  if (pnlFilled && !allPostFilled)
    return {
      icon: AlertTriangle,
      color: "bg-orange-100 text-orange-600 border border-orange-300",
    };
  if (allPreFilled && allPostFilled)
    return {
      icon: CheckCircle,
      color: "bg-emerald-100 text-emerald-700 border border-emerald-300",
    };

  return {
    icon: Clock,
    color: "bg-gray-100 text-gray-600 border border-gray-300",
  };
}

/* ---------- VariableItem ---------- */
function VariableItem({ v, trade, saveTrade, setVariables }) {
  const value = trade[v.name] || "";
  const [manualOverride, setManualOverride] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);

  // 🔢 Numeric input helpers
  const handleNumericChange = (e) => {
    const val = e.target.value;
    saveTrade({ ...trade, [v.name]: val }); // keep raw string while typing
  };

  const handleNumericBlur = (e) => {
    const val = e.target.value;
    saveTrade({
      ...trade,
      [v.name]: val === "" ? "" : Number(val), // only coerce on blur
    });
  };

  useEffect(() => {
    if (v.varType === "calculated" && !manualOverride && v.formula) {
      setCalcLoading(true); // start berekening
      try {
        const parser = new Parser();
        const expr = parser.parse(v.formula);

        const values = Object.fromEntries(
          Object.entries(trade).map(([k, val]) => {
            const key = k.replace(/\s+/g, "").toLowerCase();
            const num = parseFloat(val);
            return [key, !isNaN(num) ? num : val];
          })
        );

        const hasAllInputs = expr
          .variables()
          .every((key) => values[key] !== undefined && values[key] !== "");

        if (!hasAllInputs) {
          console.log("⏸️ Nog niet alle inputs beschikbaar voor", v.name);
          setCalcLoading(false);
          return;
        }

        let calc = expr.evaluate(values);

        // Probeer string alsnog als formule
        if (typeof calc === "string") {
          try {
            const innerExpr = parser.parse(calc);
            const innerVars = innerExpr.variables();
            const hasAllInner = innerVars.every(
              (key) => values[key] !== undefined && values[key] !== ""
            );
            if (hasAllInner) calc = innerExpr.evaluate(values);
          } catch {
            // blijft gewoon string
          }
        }

        if (typeof calc === "number" && !isNaN(calc)) {
          if (calc.toFixed(2) !== (value?.toString() || "")) {
            saveTrade({ ...trade, [v.name]: calc.toFixed(2) });
          }
        } else if (typeof calc === "string") {
          if (calc !== value) saveTrade({ ...trade, [v.name]: calc });
        } else if (typeof calc === "boolean") {
          const boolStr = calc ? "TRUE" : "FALSE";
          if (boolStr !== value) saveTrade({ ...trade, [v.name]: boolStr });
        }
      } catch (err) {
        console.warn(`⚠️ Invalid formula for ${v.name}:`, err.message);
        if (value !== "N/A") {
          saveTrade({ ...trade, [v.name]: "N/A" });
        }
      } finally {
        setCalcLoading(false); // klaar
      }
    }
  }, [trade, v.formula, v.varType, manualOverride]);

  // Dropdown
  if (!v.varType || v.varType === "dropdown") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[72px,1fr] gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <CreatableSelect
            isClearable
            value={value ? { value, label: value } : null}
            options={v.options.map((opt) => ({ value: opt, label: opt }))}
            onChange={async (sel) => {
              const newVal = sel ? sel.value : null;

              // ✅ save trade value
              saveTrade({ ...trade, [v.name]: newVal });

              // ✅ if it's a new option, add to variables.options + supabase
              if (newVal && !v.options.includes(newVal)) {
                const updatedOptions = [...v.options, newVal];

                // update local state
                setVariables((prev) =>
                  prev.map((varObj) =>
                    varObj.id === v.id
                      ? { ...varObj, options: updatedOptions }
                      : varObj
                  )
                );

                // update database
                const { error } = await supabase
                  .from("variables")
                  .update({ options: updatedOptions })
                  .eq("id", v.id);

                if (error)
                  console.error("❌ Error updating variable options:", error);
              }
            }}
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
                border: "1px solid transparent",
                boxShadow: "none",
                ...(state.isFocused && { border: "1px solid #6b7280" }),
                ":hover": { border: "1px solid #9ca3af" },
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
                fontSize: "12px",
                fontFamily: "inherit",
              }),
              placeholder: (base) => ({
                ...base,
                color: "inherit",
                opacity: 0.6,
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
                border: "1px solid transparent",
                boxShadow: "none",
                borderRadius: "4px",
                ":hover": { border: "1px solid #9ca3af" },
              }),
              option: (base, state) => ({
                ...base,
                fontSize: "12px",
                fontFamily: "inherit",
                color: state.isSelected ? "white" : "inherit",
                backgroundColor: state.isSelected
                  ? "#6b7280"
                  : state.isFocused
                    ? "#f3f4f6"
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

  // calculated
  if (v.varType === "calculated") {
    const isNumber = typeof value === "number" || !isNaN(Number(value));

    // haal string-opties uit de formule
    let stringOptions = [];
    if (v.formula) {
      const matches = v.formula.match(/"([^"]+)"/g); // alle "..." stukjes
      if (matches) {
        stringOptions = [...new Set(matches.map((m) => m.replace(/"/g, "")))];
      }
    }

    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[76px,1fr] items-center gap-2">
          <div className="text-xs text-gray-600 flex items-center gap-1">
            <Sigma size={12} className="text-gray-500" />
            <div>{v.name}</div>
          </div>

          {calcLoading ? (
            <div className="flex items-center justify-center h-[calc(100vh-4rem)] md:h-screen md:ml-16 pt-16 md:pt-0">
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-12 w-12 text-black"
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
                <p className="mt-4 text-lg font-semibold text-black">
                  Loading trades...
                </p>
              </div>
            </div>
          ) : isNumber ? (
            <input
              type="number"
              value={value}
              onChange={(e) => {
                setManualOverride(true);
                handleNumericChange(e);
              }}
              onBlur={handleNumericBlur}
              className="px-2 py-1 text-xs w-full border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0 truncate"
            />
          ) : stringOptions.length > 0 ? (
            <select
              value={value}
              onChange={(e) => {
                setManualOverride(true);
                saveTrade({ ...trade, [v.name]: e.target.value });
              }}
              className="px-2 py-1 text-xs w-full border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0 truncate"
            >
              {stringOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {/* custom optie */}
              {!stringOptions.includes(value) && value && (
                <option value={value}>{value}</option>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setManualOverride(true);
                saveTrade({ ...trade, [v.name]: e.target.value });
              }}
              className="px-2 py-1 text-xs w-full border border-transparent hover:border-gray-400 focus:border-gray-500 focus:ring-0 truncate"
            />
          )}

          {manualOverride && (
            <button
              onClick={() => setManualOverride(false)}
              className="text-[10px] text-blue-600 underline ml-1"
            >
              reset
            </button>
          )}
        </div>
      </div>
    );
  }

  // Text
  if (v.varType === "text") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[76px,1fr] items-center gap-2">
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
        <div className="grid grid-cols-[76px,1fr] items-center gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <input
            type="number"
            value={value}
            onChange={handleNumericChange}
            onBlur={handleNumericBlur}
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
        <div className="grid grid-cols-[76px,1fr] items-center gap-2">
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
        <div className="grid grid-cols-[76px,1fr] items-center gap-2">
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
        <div className="grid grid-cols-[76px,1fr] items-center gap-2">
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

  const status = getTradeStatus(trade, variables);

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
          <span
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium ${status.color}`}
          >
            <status.icon size={16} />
            {status.label}
          </span>

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
          <div className="mb-2 w-full flex justify-between bg-white rounded-xl p-2">
            <button
              onClick={() => (window.location.href = "/trades")}
              className="px-2 text-gray-500 text-sm font-medium"
            >
              BACK
            </button>
            <button
              onClick={() => setShowManageModal(true)}
              className="px-4 py-0 text-gray-500 text-sm font-medium"
            >
              SETTINGS
            </button>
          </div>

          {/* Pre-Trade */}
          <div className="bg-white rounded-xl shadow px-3 py-3 flex flex-col gap-2">
            {variables
              .filter((v) => v.phase === "pre" && v.visible)
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
              .filter((v) => v.phase === "post" && v.visible)
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

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold mb-2">Trade evaluation</h3>
            <textarea
              value={trade["Notes"] || ""}
              onChange={(e) => saveTrade({ ...trade, Notes: e.target.value })}
              className="w-full min-h-[150px] border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        {/* Charts + Notes */}
        <div className="flex flex-col gap-4">
          {/* Pre-trade charts */}
          {variables
            .filter(
              (v) => v.varType === "chart" && v.visible && v.phase === "pre"
            )
            .sort((a, b) => a.order - b.order)
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
            ))}

          {/* Post-trade charts */}
          {variables
            .filter(
              (v) => v.varType === "chart" && v.visible && v.phase === "post"
            )
            .sort((a, b) => a.order - b.order)
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
            ))}
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

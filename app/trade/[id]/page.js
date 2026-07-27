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
  Trash2,
} from "lucide-react";

// Helper om flexibel en case-insensitive de PnL waarde uit de trade te halen
function getPnlValue(trade, variables) {
  if (!trade) return 0;

  // Zoek eerst of er een variabele is gedefinieerd als PnL / system
  const pnlVar = variables.find(
    (v) => v.type === "system" || v.name.toLowerCase() === "pnl"
  );
  const pnlKeyName = pnlVar ? pnlVar.name : null;

  // Check mogelijke sleutels in trade data of direct op trade object
  if (
    pnlKeyName &&
    trade[pnlKeyName] !== undefined &&
    trade[pnlKeyName] !== ""
  ) {
    return trade[pnlKeyName];
  }
  if (trade["PNL"] !== undefined && trade["PNL"] !== "") return trade["PNL"];
  if (trade["Pnl"] !== undefined && trade["Pnl"] !== "") return trade["Pnl"];
  if (trade["pnl"] !== undefined && trade["pnl"] !== "") return trade["pnl"];

  // Zoek in alle sleutels case-insensitive
  const foundKey = Object.keys(trade).find((k) => k.toLowerCase() === "pnl");
  if (foundKey && trade[foundKey] !== undefined && trade[foundKey] !== "") {
    return trade[foundKey];
  }

  return 0;
}

function getTradeStatus(trade, variables) {
  const preVars = variables.filter((v) => v.phase === "pre" && v.visible);
  const postVars = variables.filter((v) => v.phase === "post" && v.visible);

  const isFilled = (vName) => {
    const val = trade[vName];
    return val !== null && val !== undefined && val !== "";
  };

  const allPreFilled = preVars.every((v) => isFilled(v.name));
  const allPostFilled = postVars.every((v) => isFilled(v.name));

  const pnlVal = getPnlValue(trade, variables);
  const pnlFilled =
    pnlVal !== 0 && pnlVal !== "" && pnlVal !== null && pnlVal !== undefined;

  if (!allPreFilled)
    return {
      icon: XCircle,
      color: "bg-red-100 text-red-600 border border-red-300",
      label: "Pre-trade incomplete",
    };
  if (allPreFilled && !allPostFilled && !pnlFilled)
    return {
      icon: Clock,
      color: "bg-gray-100 text-gray-600 border border-gray-300",
      label: "Open",
    };
  if (pnlFilled && !allPostFilled)
    return {
      icon: AlertTriangle,
      color: "bg-orange-100 text-orange-600 border border-orange-300",
      label: "In progress",
    };
  if (allPreFilled && allPostFilled)
    return {
      icon: CheckCircle,
      color: "bg-emerald-100 text-emerald-700 border border-emerald-300",
      label: "Completed",
    };

  return {
    icon: Clock,
    color: "bg-gray-100 text-gray-600 border border-gray-300",
    label: "Open",
  };
}

async function removeDropdownOption(variable, optionToRemove, setVariables) {
  if (!optionToRemove) return;

  const updatedOptions = (variable.options || []).filter(
    (opt) => opt !== optionToRemove
  );

  setVariables((prev) =>
    prev.map((v) =>
      v.id === variable.id ? { ...v, options: updatedOptions } : v
    )
  );

  const { error } = await supabase
    .from("variables")
    .update({ options: updatedOptions })
    .eq("id", variable.id);

  if (error) {
    console.error("❌ Error removing dropdown option:", error);
  }
}

const DeleteableOption = (props) => {
  const { data, selectProps } = props;

  return (
    <div
      {...props.innerProps}
      className="flex items-start justify-between gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100"
    >
      <span className="flex-1 break-words pr-2">{data.label}</span>

      <button
        type="button"
        className="p-0.5 mt-[2px] text-red-500 hover:text-red-700 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          if (selectProps.onDeleteOption) {
            selectProps.onDeleteOption(data.value);
          }
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

/* ---------- VariableItem ---------- */
function VariableItem({ v, trade, saveTrade, setVariables }) {
  const value = trade[v.name] || "";
  const [manualOverride, setManualOverride] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);

  const handleNumericChange = (e) => {
    const val = e.target.value;
    saveTrade({ ...trade, [v.name]: val });
  };

  const handleNumericBlur = (e) => {
    const val = e.target.value;
    saveTrade({
      ...trade,
      [v.name]: val === "" ? "" : Number(val),
    });
  };

  useEffect(() => {
    if (v.varType === "calculated" && !manualOverride && v.formula) {
      setCalcLoading(true);
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
          setCalcLoading(false);
          return;
        }

        let calc = expr.evaluate(values);

        if (typeof calc === "string") {
          try {
            const innerExpr = parser.parse(calc);
            const innerVars = innerExpr.variables();
            const hasAllInner = innerVars.every(
              (key) => values[key] !== undefined && values[key] !== ""
            );
            if (hasAllInner) calc = innerExpr.evaluate(values);
          } catch {
            // blijft string
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
        if (value !== "N/A") {
          saveTrade({ ...trade, [v.name]: "N/A" });
        }
      } finally {
        setCalcLoading(false);
      }
    }
  }, [trade, v.formula, v.varType, manualOverride, value, saveTrade, v.name]);

  const handleDeleteOption = async (optionToRemove) => {
    if (!optionToRemove) return;

    const confirmed = window.confirm(
      `Wil je de optie "${optionToRemove}" uit de lijst verwijderen?`
    );
    if (!confirmed) return;

    const updatedOptions = (v.options || []).filter(
      (opt) => opt !== optionToRemove
    );

    setVariables((prev) =>
      prev.map((varObj) =>
        varObj.id === v.id ? { ...varObj, options: updatedOptions } : varObj
      )
    );

    const { error } = await supabase
      .from("variables")
      .update({ options: updatedOptions })
      .eq("id", v.id);

    if (error) {
      console.error("❌ Error removing option:", error);
    }

    if (trade[v.name] === optionToRemove) {
      saveTrade({ ...trade, [v.name]: "" });
    }
  };

  // Dropdown
  if (!v.varType || v.varType === "dropdown") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[72px,1fr] gap-2 items-center">
          <span className="text-xs text-gray-600">{v.name}</span>

          <CreatableSelect
            isClearable
            value={value ? { value, label: value } : null}
            options={(v.options || []).map((opt) => ({
              value: opt,
              label: opt,
            }))}
            components={{ Option: DeleteableOption }}
            onDeleteOption={handleDeleteOption}
            onChange={async (sel) => {
              const newVal = sel ? sel.value : null;
              saveTrade({ ...trade, [v.name]: newVal });

              if (newVal && !v.options.includes(newVal)) {
                const updatedOptions = [...(v.options || []), newVal];

                setVariables((prev) =>
                  prev.map((varObj) =>
                    varObj.id === v.id
                      ? { ...varObj, options: updatedOptions }
                      : varObj
                  )
                );

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
                borderRadius: "4px",
              }),
              option: (base, state) => ({
                ...base,
                fontSize: "12px",
                fontFamily: "inherit",
                backgroundColor: state.isSelected
                  ? "#6b7280"
                  : state.isFocused
                    ? "#f3f4f6"
                    : "white",
                color: state.isSelected ? "white" : "inherit",
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

  // Calculated
  if (v.varType === "calculated") {
    const isNumber = typeof value === "number" || !isNaN(Number(value));

    let stringOptions = [];
    if (v.formula) {
      const matches = v.formula.match(/"([^"]+)"/g);
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
            <div className="flex items-center text-xs text-gray-400">
              Calculating...
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

  // Link / Chart
  if (v.varType === "chart" || v.varType === "link") {
    return (
      <div className="bg-white rounded-lg text-sm p-1">
        <div className="grid grid-cols-[76px,1fr] items-center gap-2">
          <span className="text-xs text-gray-600">{v.name}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
            placeholder="Paste link..."
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
    window.location.href = "/trades";
  };

  if (!trade) return <div className="p-4">Loading trade...</div>;

  const status = getTradeStatus(trade, variables);
  const pnlValue = getPnlValue(trade, variables);
  const numericPnl = Number(pnlValue) || 0;

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-transparent">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-semibold">
            {trade.Coins || trade["Coin"] || "Unknown Coin"}
          </h2>

          <div
            className={`rounded-lg text-xl font-semibold shadow-inner px-3 py-1 ${
              numericPnl >= 0
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {numericPnl >= 0 ? "+" : ""}
            {pnlValue !== "" && pnlValue !== null ? pnlValue : 0}
          </div>
        </div>

        <div className="flex items-center gap-3 text-lg">
          <span
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium ${status.color}`}
          >
            <status.icon size={16} />
            {status.label}
          </span>

          <span>{trade.Datum || trade["Date"] || "—"}</span>
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
              value={trade["Notes"] || trade["Evaluation"] || ""}
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
              (v) =>
                (v.varType === "chart" || v.varType === "link") &&
                v.visible &&
                v.phase === "pre"
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
                      onError={(e) => {
                        // Als het geen geldige afbeelding is, verberg img entoon link tekst
                        e.target.style.display = "none";
                      }}
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
              (v) =>
                (v.varType === "chart" || v.varType === "link") &&
                v.visible &&
                v.phase === "post"
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
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
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

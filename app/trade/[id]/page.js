"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import CreatableSelect from "react-select/creatable";
import ManageVariablesModal from "../../components/ManageVariablesModal";
import PositionPanel from "../../components/swap/PositionPanel";
import ChartField from "../../components/trade/ChartField";
import { Parser } from "expr-eval";
import {
  XCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  Sigma,
  Trash2,
} from "lucide-react";

const COL_LABELS = {
  Datum: "Date",
  Entreetijd: "Entry time",
  Exittijd: "Exit time",
  Munt: "Coin",
  Richting: "Direction",
  Sessie: "Session",
  Risico: "Risk",
  Winst: "Profit",
  Verlies: "Loss",
  Notities: "Notes",
  Opmerkingen: "Remarks",
  Graad: "Grade",
  Tijdframe: "Timeframe",
};
const colLabel = (key) => COL_LABELS[key] ?? key;

// Helper to flexibly resolve PnL value from trade
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
      color: "bg-loss-soft text-loss-fg border border-loss/30",
      label: "Pre-trade incomplete",
    };
  if (allPreFilled && !allPostFilled && !pnlFilled)
    return {
      icon: Clock,
      color: "bg-surface-raised text-content-muted border border-line",
      label: "Open",
    };
  if (pnlFilled && !allPostFilled)
    return {
      icon: AlertTriangle,
      color: "bg-warn-soft text-warn-fg border border-warn/30",
      label: "In progress",
    };
  if (allPreFilled && allPostFilled)
    return {
      icon: CheckCircle,
      color: "bg-profit-soft text-profit-fg border border-profit/30",
      label: "Completed",
    };

  return {
    icon: Clock,
    color: "bg-surface-raised text-content-muted border border-line",
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
      className="flex items-start justify-between gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-surface-hover"
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
      <div className="grid grid-cols-[80px,1fr] gap-2 items-center py-0.5">
        <span className="text-xs text-content-subtle truncate">{colLabel(v.name)}</span>

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
                console.error("Error updating variable options:", error);
            }
          }}
          styles={{
            control: (base, state) => ({
              ...base,
              minHeight: "28px",
              height: "28px",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "inherit",
              backgroundColor: "rgb(var(--surface-raised))",
              color: "rgb(var(--content))",
              padding: "0 2px",
              border: state.isFocused
                ? "1px solid rgb(var(--brand))"
                : "1px solid rgb(var(--line))",
              boxShadow: "none",
              ":hover": { borderColor: "rgb(var(--line-strong))" },
            }),
            valueContainer: (base) => ({
              ...base,
              height: "28px",
              padding: "0 6px",
              fontSize: "12px",
              fontFamily: "inherit",
              color: "rgb(var(--content))",
            }),
            singleValue: (base) => ({
              ...base,
              color: "rgb(var(--content))",
              fontSize: "12px",
              fontFamily: "inherit",
            }),
            placeholder: (base) => ({
              ...base,
              color: "rgb(var(--content-subtle))",
              fontFamily: "inherit",
            }),
            input: (base) => ({
              ...base,
              margin: 0,
              padding: 0,
              color: "rgb(var(--content))",
            }),
            menu: (base) => ({
              ...base,
              marginTop: 2,
              borderRadius: "8px",
              backgroundColor: "rgb(var(--surface-overlay))",
              border: "1px solid rgb(var(--line))",
              boxShadow: "var(--shadow-lg)",
            }),
            option: (base, state) => ({
              ...base,
              fontSize: "12px",
              fontFamily: "inherit",
              backgroundColor: state.isSelected
                ? "rgb(var(--brand-soft))"
                : state.isFocused
                  ? "rgb(var(--surface-hover))"
                  : "transparent",
              color: state.isSelected ? "rgb(var(--brand))" : "rgb(var(--content))",
            }),
            indicatorsContainer: (base) => ({
              ...base,
              height: "28px",
            }),
            clearIndicator: (base) => ({
              ...base,
              color: "rgb(var(--content-subtle))",
              ":hover": { color: "rgb(var(--content-muted))" },
            }),
            dropdownIndicator: (base) => ({
              ...base,
              color: "rgb(var(--content-subtle))",
              ":hover": { color: "rgb(var(--content-muted))" },
            }),
          }}
          classNamePrefix="react-select"
        />
      </div>
    );
  }

  // Calculated
  if (v.varType === "calculated") {
    const isNumber = typeof value === "number" || (!isNaN(Number(value)) && value !== "");

    let stringOptions = [];
    if (v.formula) {
      const matches = v.formula.match(/"([^"]+)"/g);
      if (matches) {
        stringOptions = [...new Set(matches.map((m) => m.replace(/"/g, "")))];
      }
    }

    const inputCls = "h-7 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-content hover:border-line focus:border-brand focus:outline-none focus:ring-[2px] focus:ring-brand/18 transition-colors";

    return (
      <div className="grid grid-cols-[80px,1fr] items-center gap-2 py-0.5">
        <div className="text-xs text-content-subtle flex items-center gap-1 truncate">
          <Sigma size={11} className="text-content-subtle shrink-0" />
          <span className="truncate">{colLabel(v.name)}</span>
        </div>

        {calcLoading ? (
          <div className="flex items-center text-xs text-content-subtle">
            Calculating…
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
            className={inputCls}
          />
        ) : stringOptions.length > 0 ? (
          <select
            value={value}
            onChange={(e) => {
              setManualOverride(true);
              saveTrade({ ...trade, [v.name]: e.target.value });
            }}
            className={inputCls}
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
            className={inputCls}
          />
        )}

        {manualOverride && (
          <button
            onClick={() => setManualOverride(false)}
            className="col-start-2 text-[10px] text-brand hover:underline text-left"
          >
            reset
          </button>
        )}
      </div>
    );
  }

  const fieldCls = "h-7 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-content hover:border-line focus:border-brand focus:outline-none focus:ring-[2px] focus:ring-brand/18 transition-colors";
  const rowCls = "grid grid-cols-[80px,1fr] items-center gap-2 py-0.5";
  const labelCls = "text-xs text-content-subtle truncate";

  // Text
  if (v.varType === "text") {
    return (
      <div className={rowCls}>
        <span className={labelCls}>{colLabel(v.name)}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
          className={fieldCls}
        />
      </div>
    );
  }

  // Number
  if (v.varType === "number") {
    return (
      <div className={rowCls}>
        <span className={labelCls}>{colLabel(v.name)}</span>
        <input
          type="number"
          value={value}
          onChange={handleNumericChange}
          onBlur={handleNumericBlur}
          className={fieldCls}
        />
      </div>
    );
  }

  // Time
  if (v.varType === "time") {
    return (
      <div className={rowCls}>
        <span className={labelCls}>{colLabel(v.name)}</span>
        <input
          type="time"
          value={value}
          onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
          className={`${fieldCls} w-[90px]`}
        />
      </div>
    );
  }

  // Date
  if (v.varType === "date") {
    return (
      <div className={rowCls}>
        <span className={labelCls}>{colLabel(v.name)}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
          className={`${fieldCls} w-[130px]`}
        />
      </div>
    );
  }

  // Textarea
  if (v.varType === "textarea") {
    return (
      <div className="flex flex-col gap-1 py-0.5">
        <span className={labelCls}>{colLabel(v.name)}</span>
        <textarea
          rows={3}
          value={value}
          onChange={(e) => saveTrade({ ...trade, [v.name]: e.target.value })}
          className="w-full rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs text-content resize-y h-[90px] hover:border-line-strong focus:border-brand focus:outline-none focus:ring-[2px] focus:ring-brand/18 transition-colors"
        />
      </div>
    );
  }

  // Link / Chart — URL or pasted/uploaded image
  if (v.varType === "chart" || v.varType === "link") {
    return (
      <div className="py-1">
        <ChartField
          label={colLabel(v.name)}
          value={value}
          compact
          onChange={(next) => saveTrade({ ...trade, [v.name]: next })}
        />
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

  const loadTrade = async () => {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      const number =
        data.trade_number ??
        data.data?.["Trade number"] ??
        data.data?.["Trade Number"] ??
        null;
      const newState = {
        id: data.id,
        "Trade number": number,
        ...data.data,
      };
      if (newState["Trade number"] == null && number != null) {
        newState["Trade number"] = number;
      }
      setTrade(newState);
    } else {
      console.error("❌ Load trade error:", error);
    }
  };

  // Load trade
  useEffect(() => {
    if (id) loadTrade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!confirm("Delete this trade? This cannot be undone.")) return;
    const { error } = await supabase.from("trades").delete().eq("id", trade.id);
    if (error) {
      console.error("❌ Delete error:", error);
      return;
    }
    window.location.href = "/trades";
  };

  if (!trade) return (
    <div className="flex items-center justify-center h-[calc(100vh-var(--topbar-h))]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-line" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
        </div>
        <p className="text-xs text-content-subtle">Loading trade…</p>
      </div>
    </div>
  );

  const status = getTradeStatus(trade, variables);
  const pnlValue = getPnlValue(trade, variables);
  const numericPnl = Number(pnlValue) || 0;

  return (
    <div className="flex flex-col max-w-7xl mx-auto px-4 py-4 gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <a
            href="/trades"
            className="text-xs font-medium text-content-subtle hover:text-content transition-colors"
          >
            ← Trades
          </a>
          <h2 className="text-2xl font-semibold tracking-tight text-content">
            {trade.Coins || trade["Coin"] || "Unknown coin"}
          </h2>
          {pnlValue !== "" && pnlValue !== null && (
            <span
              className={`rounded-lg text-base font-semibold px-2.5 py-1 ${
                numericPnl >= 0
                  ? "bg-profit-soft text-profit-fg"
                  : "bg-loss-soft text-loss-fg"
              }`}
            >
              {numericPnl >= 0 ? "+" : ""}
              {pnlValue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${status.color}`}
          >
            <status.icon size={13} />
            {status.label}
          </span>
          <span className="text-sm text-content-muted font-mono">
            {trade.Datum || trade["Date"] || "—"}
          </span>
          <button
            onClick={() => setShowManageModal(true)}
            className="h-8 px-3 rounded-md border border-line text-content-subtle text-xs font-medium hover:bg-surface-hover hover:text-content transition-colors"
          >
            Settings
          </button>
          <button
            onClick={deleteTrade}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-line text-content-subtle hover:bg-loss-soft hover:text-loss hover:border-loss/30 transition-colors"
            aria-label="Delete trade"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <PositionPanel trade={trade} onRefresh={loadTrade} />

      <div className="grid grid-cols-1 md:grid-cols-[320px,1fr] gap-3">
        {/* Sidebar */}
        <div className="flex flex-col gap-2.5">
          {/* Pre-Trade fields */}
          {variables.filter((v) => v.phase === "pre" && v.visible).length > 0 && (
            <div className="rounded-xl border border-line bg-surface px-3 py-3 flex flex-col gap-1.5">
              <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle mb-1">Pre-trade</p>
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
          )}

          {/* Post-Trade fields */}
          {variables.filter((v) => v.phase === "post" && v.visible).length > 0 && (
            <div className="rounded-xl border border-line bg-surface px-3 py-3 flex flex-col gap-1.5">
              <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle mb-1">Post-trade</p>
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
          )}

          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle mb-2">Notes</p>
            <textarea
              value={trade["Notes"] || trade["Evaluation"] || ""}
              onChange={(e) => saveTrade({ ...trade, Notes: e.target.value })}
              className="w-full min-h-[120px] resize-y rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-content leading-relaxed placeholder:text-content-subtle hover:border-line-strong focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/18 transition-colors"
              placeholder="Notes on execution, mindset, what you learned…"
            />
          </div>
        </div>

        {/* Charts */}
        <div className="flex flex-col gap-3">
          {variables
            .filter(
              (v) =>
                (v.varType === "chart" || v.varType === "link") &&
                v.visible &&
                v.phase === "pre"
            )
            .sort((a, b) => a.order - b.order)
            .map((v) => (
              <div key={v.id} className="rounded-xl border border-line bg-surface p-4">
                <ChartField
                  label={v.name}
                  value={trade[v.name] || ""}
                  onChange={(next) => saveTrade({ ...trade, [v.name]: next })}
                />
              </div>
            ))}

          {variables
            .filter(
              (v) =>
                (v.varType === "chart" || v.varType === "link") &&
                v.visible &&
                v.phase === "post"
            )
            .sort((a, b) => a.order - b.order)
            .map((v) => (
              <div key={v.id} className="rounded-xl border border-line bg-surface p-4">
                <ChartField
                  label={v.name}
                  value={trade[v.name] || ""}
                  onChange={(next) => saveTrade({ ...trade, [v.name]: next })}
                />
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

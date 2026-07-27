// app/onboarding/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { Parser } from "expr-eval";
import ConditionalBuilder from "../components/ConditionalBuilder";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Verplichte PnL variabele state
  const [pnlName, setPnlName] = useState("PnL");

  // Dynamische variabelen lijst (start alleen met de verplichte PnL)
  const [variables, setVariables] = useState([
    {
      id: "default-pnl",
      name: "PnL",
      type: "system",
      varType: "number",
      phase: "post",
      options: [],
      formula: null,
      visible: true,
    },
  ]);

  // Form state voor nieuwe variabele toevoegen
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("text");
  const [newVarPhase, setNewVarPhase] = useState("pre");
  const [newVarOptions, setNewVarOptions] = useState(""); // Voor dropdowns
  const [newVarFormula, setNewVarFormula] = useState("");
  const [showConditional, setShowConditional] = useState(false);
  const [inConditionalFocus, setInConditionalFocus] = useState(false);

  // Extra variabele toevoegen
  const handleAddVariable = () => {
    if (!newVarName.trim()) return;

    let parsedOptions = [];
    if (newVarType === "dropdown" && newVarOptions.trim()) {
      parsedOptions = newVarOptions
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    }

    const newVar = {
      id: `custom-${Date.now()}`,
      name: newVarName.trim(),
      type: "custom",
      varType: newVarType,
      phase: newVarPhase,
      options: parsedOptions,
      formula: newVarType === "calculated" ? newVarFormula.trim() : null,
      visible: true,
    };

    setVariables((prev) => [...prev, newVar]);

    // Reset form
    setNewVarName("");
    setNewVarOptions("");
    setNewVarType("text");
    setNewVarPhase("pre");
    setNewVarFormula("");
    setShowConditional(false);
  };

  // Variabele verwijderen
  const handleRemoveVariable = (id) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
  };

  // 🚀 Alles opslaan en onboarding voltooien
  const handleCompleteOnboarding = async () => {
    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Geen ingelogde gebruiker gevonden.");
      }

      // Zorg dat de PnL naam correct is ingevuld bij de systeemvariabele
      const finalVariables = variables.map((v, idx) => {
        let name = v.name;
        if (v.id === "default-pnl") {
          name = pnlName.trim() || "PnL";
        }

        return {
          user_id: user.id,
          name: name,
          type: v.type,
          varType: v.varType,
          phase: v.phase,
          options: v.options || [],
          formula: v.formula || null,
          visible: v.visible,
          order: idx + 1,
        };
      });

      const { error } = await supabase.from("variables").insert(finalVariables);

      if (error) {
        throw new Error(error.message);
      }

      // Stuur door naar het hoofdscherm
      router.replace("/trades");
    } catch (err) {
      console.error("❌ Onboarding mislukt:", err);
      alert("Er is iets misgegaan bij het opslaan: " + err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden">
        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-blue-600 h-1.5 transition-all duration-300"
            style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
          />
        </div>

        <div className="p-8">
          {/* STEP 1: Welkom */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
                📈
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Welkom bij je Trading Journal
                </h1>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  Laten we in 2 korte stappen je journal opzetten. Je kunt
                  direct bepalen welke variabelen (kolommen) je wilt gebruiken
                  voor je trades.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
              >
                Aan de slag <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 2: PnL Naam Instellen */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Stap 1 van 2
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Stel je PnL-variabele in
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Dit veld is verplicht voor alle winst- en verliesberekeningen
                  in je dashboard.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                <ShieldCheck
                  className="text-amber-600 shrink-0 mt-0.5"
                  size={18}
                />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Deze variabele wordt automatisch ingesteld als een{" "}
                  <span className="font-semibold">Post-Trade getal</span>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Naam van je PnL-veld
                </label>
                <input
                  type="text"
                  value={pnlName}
                  onChange={(e) => setPnlName(e.target.value)}
                  placeholder="bijv. PnL"
                  className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-2.5 text-slate-600 hover:bg-slate-100 font-medium rounded-xl text-sm transition"
                >
                  Terug
                </button>
                <button
                  type="button"
                  disabled={!pnlName.trim()}
                  onClick={() => setStep(3)}
                  className="w-2/3 py-2.5 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition"
                >
                  Volgende <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Variabelen Lijst & Toevoegen */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Stap 2 van 2
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Configureer je variabelen
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Voeg kolommen toe of pas ze aan voor je Pre-Trade en
                  Post-Trade analyse.
                </p>
              </div>

              {/* Overzicht huidige variabelen */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {variables.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">
                        {v.id === "default-pnl"
                          ? pnlName.trim() || "PnL"
                          : v.name}{" "}
                        <span className="text-slate-400 font-normal">
                          ({v.varType} / {v.phase})
                        </span>
                      </span>
                      {v.varType === "dropdown" && v.options?.length > 0 && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Opties: {v.options.join(", ")}
                        </div>
                      )}
                      {v.varType === "calculated" && v.formula && (
                        <div className="text-[10px] text-purple-600 mt-0.5 font-mono">
                          Formule: {v.formula}
                        </div>
                      )}
                    </div>
                    {v.id !== "default-pnl" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariable(v.id)}
                        className="text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Formulier om nieuwe variabele toe te voegen */}
              <div className="space-y-2.5 pt-3 border-t border-slate-200 bg-slate-50/50 p-3 rounded-xl border">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Naam (bijv. Chart, Setup)"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <select
                    value={newVarType}
                    onChange={(e) => setNewVarType(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2 py-2 outline-none bg-white"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="time">Time</option>
                    <option value="date">Date</option>
                    <option value="textarea">Textarea</option>
                    <option value="link">Link (Charts/URLs)</option>
                    <option value="calculated">Calculated</option>
                  </select>
                  <select
                    value={newVarPhase}
                    onChange={(e) => setNewVarPhase(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2 py-2 outline-none bg-white"
                  >
                    <option value="pre">Pre-Trade</option>
                    <option value="post">Post-Trade</option>
                  </select>
                </div>

                {/* Extra opties indien Dropdown */}
                {newVarType === "dropdown" && (
                  <input
                    type="text"
                    placeholder="Opties gescheiden door komma's (bijv. Long, Short)"
                    value={newVarOptions}
                    onChange={(e) => setNewVarOptions(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                )}

                {/* Formule bouwer indien Calculated */}
                {newVarType === "calculated" && (
                  <div className="space-y-2 pt-1 border-t border-slate-200">
                    {!showConditional && (
                      <div>
                        <p className="text-[11px] font-medium text-slate-600 mb-1">
                          Bouw formule:
                        </p>
                        {!inConditionalFocus && (
                          <div className="flex flex-wrap gap-1 mb-2">
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
                                    className="px-2 py-0.5 text-[11px] bg-white border border-slate-200 rounded hover:bg-slate-100 font-medium text-slate-700"
                                  >
                                    {token}
                                  </button>
                                );
                              })}
                            {[
                              "+",
                              "-",
                              "*",
                              "/",
                              ">",
                              "<",
                              ">=",
                              "<=",
                              "==",
                            ].map((op) => (
                              <button
                                key={op}
                                type="button"
                                onClick={() =>
                                  setNewVarFormula((prev) => (prev || "") + op)
                                }
                                className="px-2 py-0.5 text-[11px] bg-white border border-slate-200 rounded hover:bg-slate-100 font-bold text-slate-700"
                              >
                                {op}
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder="Formule (bijv. pnl / risk)"
                          value={newVarFormula}
                          onChange={(e) => setNewVarFormula(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                        />
                      </div>
                    )}

                    {!showConditional ? (
                      <button
                        type="button"
                        onClick={() => setShowConditional(true)}
                        className="px-2 py-1 text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-semibold transition"
                      >
                        + Conditional
                      </button>
                    ) : (
                      <div className="mt-2 border-t pt-2">
                        <p className="text-[11px] font-medium text-slate-600 mb-1">
                          Conditional logic:
                        </p>
                        <ConditionalBuilder
                          variables={variables}
                          onChange={(condFormula) =>
                            setNewVarFormula(condFormula)
                          }
                          setInFocus={setInConditionalFocus}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowConditional(false);
                            setInConditionalFocus(false);
                          }}
                          className="mt-2 px-2 py-1 text-[11px] bg-red-50 hover:bg-red-100 text-red-600 rounded font-semibold transition"
                        >
                          ✕ Remove conditional
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Plus size={14} /> Voeg variabele toe
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep(2)}
                  className="w-1/3 py-2.5 text-slate-600 hover:bg-slate-100 font-medium rounded-xl text-sm disabled:opacity-50 transition"
                >
                  Terug
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCompleteOnboarding}
                  className="w-2/3 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Opslaan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Voltooien & Starten
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

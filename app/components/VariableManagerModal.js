"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Edit2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export default function VariableManagerModal({
  isOpen,
  onClose,
  onVariablesUpdated,
}) {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);

  // State voor het toevoegen / bewerken van een variabele
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    varType: "text", // text, number, dropdown, date, boolean
    phase: "pre", // pre, post
    options: "", // komma-gescheiden opties voor dropdowns
  });

  useEffect(() => {
    if (isOpen) {
      fetchVariables();
    }
  }, [isOpen]);

  // 1. Variabelen ophalen
  const fetchVariables = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("variables")
      .select("*")
      .order("order", { ascending: true });

    if (!error && data) {
      setVariables(data);
    }
    setLoading(false);
  };

  // 2. Variabele opslaan (Nieuw of Bewerken)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);

    const payload = {
      name: formData.name.trim(),
      varType: formData.varType,
      phase: formData.phase,
      options:
        formData.varType === "dropdown"
          ? formData.options
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
      visible: true,
    };

    if (editingId) {
      // Updaten
      const { error } = await supabase
        .from("variables")
        .update(payload)
        .eq("id", editingId);

      if (error) console.error("Error updating variable:", error);
    } else {
      // Nieuwe toevoegen
      const newOrder =
        variables.length > 0
          ? Math.max(...variables.map((v) => v.order || 0)) + 1
          : 1;
      const { error } = await supabase
        .from("variables")
        .insert([{ ...payload, order: newOrder }]);

      if (error) console.error("Error adding variable:", error);
    }

    resetForm();
    await fetchVariables();
    if (onVariablesUpdated) onVariablesUpdated();
  };

  // 3. Bewerken starten
  const startEdit = (v) => {
    setEditingId(v.id);
    setFormData({
      name: v.name,
      varType: v.varType || "text",
      phase: v.phase || "pre",
      options: Array.isArray(v.options) ? v.options.join(", ") : "",
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: "", varType: "text", phase: "pre", options: "" });
  };

  // 4. Zichtbaarheid togglen
  const toggleVisibility = async (v) => {
    const newVisible = !v.visible;
    setVariables((prev) =>
      prev.map((item) =>
        item.id === v.id ? { ...item, visible: newVisible } : item
      )
    );

    await supabase
      .from("variables")
      .update({ visible: newVisible })
      .eq("id", v.id);
    if (onVariablesUpdated) onVariablesUpdated();
  };

  // 5. Variabele verwijderen + data opschonen uit trades
  const handleDelete = async (v) => {
    if (
      !confirm(
        `Weet je zeker dat je '${v.name}' wilt verwijderen? Dit wist de data uit bestaande trades.`
      )
    )
      return;

    setLoading(true);

    // Verwijder uit variabelen tabel
    const { error } = await supabase.from("variables").delete().eq("id", v.id);

    if (!error) {
      // Roep de SQL functie aan die we in de DB hebben gemaakt om de sleutel te strippen uit jsonb
      await supabase.rpc("remove_variable_key", { key_name: v.name });
      await fetchVariables();
      if (onVariablesUpdated) onVariablesUpdated();
    } else {
      console.error("Error deleting variable:", error);
      setLoading(false);
    }
  };

  // 6. Volgorde aanpassen (Omhoog / Omlaag)
  const moveOrder = async (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= variables.length) return;

    const updated = [...variables];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Update de 'order' waarden
    const updates = updated.map((item, idx) => ({
      id: item.id,
      order: idx + 1,
    }));

    setVariables(updated);

    for (const item of updates) {
      await supabase
        .from("variables")
        .update({ order: item.order })
        .eq("id", item.id);
    }

    if (onVariablesUpdated) onVariablesUpdated();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            Variabelen & Kolommen Beheren
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Formulier: Toevoegen / Bewerken */}
          <form
            onSubmit={handleSave}
            className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-3"
          >
            <h3 className="text-sm font-semibold text-blue-900">
              {editingId ? "Variabele Bewerken" : "Nieuwe Variabele Toevoegen"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Naam
                </label>
                <input
                  type="text"
                  placeholder="bijv. Pair, RRR, PnL"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Type
                </label>
                <select
                  value={formData.varType}
                  onChange={(e) =>
                    setFormData({ ...formData, varType: e.target.value })
                  }
                  className="w-full text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="text">Tekst</option>
                  <option value="number">Getal / Valuta</option>
                  <option value="dropdown">Dropdown (Opties)</option>
                  <option value="date">Datum</option>
                  <option value="boolean">Ja/Nee Checkbox</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fase
                </label>
                <select
                  value={formData.phase}
                  onChange={(e) =>
                    setFormData({ ...formData, phase: e.target.value })
                  }
                  className="w-full text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="pre">Pre-Trade (Vooraf)</option>
                  <option value="post">Post-Trade (Achteraf)</option>
                </select>
              </div>
            </div>

            {formData.varType === "dropdown" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Dropdown Opties (komma-gescheiden)
                </label>
                <input
                  type="text"
                  placeholder="BTC, ETH, SOL, XRP"
                  value={formData.options}
                  onChange={(e) =>
                    setFormData({ ...formData, options: e.target.value })
                  }
                  className="w-full text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  Annuleren
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
              >
                {editingId ? <Check size={14} /> : <Plus size={14} />}
                {editingId ? "Update Variabele" : "Toevoegen"}
              </button>
            </div>
          </form>

          {/* Lijst van Variabelen */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Actieve Variabelen ({variables.length})
            </h3>

            {variables.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">
                Nog geen variabelen aangemaakt.
              </p>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden bg-white">
                {variables.map((v, index) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 transition text-sm"
                  >
                    {/* Links: Volgorde + Info */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col text-gray-300">
                        <button
                          disabled={index === 0}
                          onClick={() => moveOrder(index, "up")}
                          className="hover:text-gray-600 disabled:opacity-20"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          disabled={index === variables.length - 1}
                          onClick={() => moveOrder(index, "down")}
                          className="hover:text-gray-600 disabled:opacity-20"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">
                            {v.name}
                          </span>
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border">
                            {v.varType || "text"}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${v.phase === "pre" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}
                          >
                            {v.phase}
                          </span>
                        </div>
                        {Array.isArray(v.options) && v.options.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Opties: {v.options.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rechts: Acties */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleVisibility(v)}
                        className={`p-1.5 rounded-lg border transition ${v.visible !== false ? "text-gray-600 border-gray-200 hover:bg-gray-100" : "text-gray-300 border-gray-100 bg-gray-50"}`}
                        title={
                          v.visible !== false
                            ? "Zichtbaar in tabel"
                            : "Verborgen in tabel"
                        }
                      >
                        {v.visible !== false ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </button>

                      <button
                        onClick={() => startEdit(v)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        onClick={() => handleDelete(v)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-100 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800"
          >
            Klaar
          </button>
        </div>
      </div>
    </div>
  );
}

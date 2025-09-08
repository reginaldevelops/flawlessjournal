"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function GoalsArea() {
  const [goals, setGoals] = useState([]);
  const [newGoal, setNewGoal] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("type", "goal")
      .order("updated_at", { ascending: false });
    if (!error) setGoals(data);
  }

  async function addGoal(e) {
    e.preventDefault();
    if (!newGoal.trim()) return;
    const { error } = await supabase.from("notes").insert({
      content: newGoal,
      type: "goal",
    });
    if (!error) {
      setNewGoal("");
      loadGoals();
    }
  }

  async function deleteGoal(id) {
    await supabase.from("notes").delete().eq("id", id);
    loadGoals();
  }

  async function updateGoal(id) {
    if (!editText.trim()) return;
    await supabase.from("notes").update({ content: editText }).eq("id", id);
    setEditingId(null);
    setEditText("");
    loadGoals();
  }

  return (
    <div>
      <h3 className="mt-3 mb-2 text-slate-800 font-semibold text-sm sm:text-base">
        Weekly Goals
      </h3>
      <ul className="flex flex-col gap-2 mb-3">
        {goals.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between gap-2 bg-slate-50 border border-gray-200 p-2 rounded-lg text-sm text-gray-800"
          >
            {editingId === g.id ? (
              <>
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  autoFocus
                />
                <button
                  onClick={() => updateGoal(g.id)}
                  className="p-1 text-green-600 hover:text-green-800"
                  title="Save"
                >
                  💾
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Cancel"
                >
                  ✖️
                </button>
              </>
            ) : (
              <>
                <span>🎯 {g.content}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingId(g.id);
                      setEditText(g.content);
                    }}
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addGoal} className="flex gap-2">
        <input
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          placeholder="Nieuw doel..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-blue-600 text-white rounded-lg"
          title="Add goal"
        >
          +
        </button>
      </form>
    </div>
  );
}

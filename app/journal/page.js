"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import styled from "styled-components";

export default function JournalPage() {
  const [entriesByDay, setEntriesByDay] = useState({});
  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString("en-CA") // intern altijd YYYY-MM-DD
  );

  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [expandedIds, setExpandedIds] = useState([]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11

  const toggleExpand = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ✏️ start edit
  const handleStartEdit = (entry) => {
    setEditingId(entry.id);
    setEditText(entry.content);
  };

  // 💾 save edit
  const handleSaveEdit = async (id) => {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from("journal_entries")
      .update({ content: editText })
      .eq("id", id);
    if (!error) {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, content: editText } : e))
      );
      setEditingId(null);
      setEditText("");
    }
  };

  // ❌ cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  // 🗑️ delete
  const handleDelete = async (id) => {
    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", id);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setEntriesByDay((prev) => {
        const updated = { ...prev };
        if (updated[selectedDate]) {
          updated[selectedDate] = updated[selectedDate] - 1;
          if (updated[selectedDate] <= 0) delete updated[selectedDate];
        }
        return updated;
      });
    }
  };

  // ➕ nieuwe entry vandaag
  const [newEntryToday, setNewEntryToday] = useState("");

  const addEntryToday = async () => {
    if (!newEntryToday.trim()) return;

    const timestamp = new Date(); // lokaal nu
    const { data, error } = await supabase
      .from("journal_entries")
      .insert([{ content: newEntryToday, created_at: timestamp }])
      .select();

    if (!error && data?.length) {
      const inserted = data[0];
      if (
        new Date(inserted.created_at).toLocaleDateString("en-CA") ===
        new Date().toLocaleDateString("en-CA")
      ) {
        setEntries((prev) => [...prev, inserted]);
      }
      setEntriesByDay((prev) => {
        const updated = { ...prev };
        const d = new Date(inserted.created_at).toLocaleDateString("en-CA");
        updated[d] = (updated[d] || 0) + 1;
        return updated;
      });
      setNewEntryToday("");
    }
  };

  // ➕ nieuwe entry voor geselecteerde dag
  const [newEntrySelected, setNewEntrySelected] = useState("");

  const addEntryForSelected = async () => {
    if (!newEntrySelected.trim()) return;

    const now = new Date();
    const timestamp = new Date(
      `${selectedDate}T${now.toTimeString().slice(0, 5)}`
    );

    const { data, error } = await supabase
      .from("journal_entries")
      .insert([{ content: newEntrySelected, created_at: timestamp }])
      .select();

    if (!error && data?.length) {
      const inserted = data[0];
      if (
        new Date(inserted.created_at).toLocaleDateString("en-CA") ===
        selectedDate
      ) {
        setEntries((prev) => [...prev, inserted]);
      }
      setEntriesByDay((prev) => {
        const updated = { ...prev };
        const d = new Date(inserted.created_at).toLocaleDateString("en-CA");
        updated[d] = (updated[d] || 0) + 1;
        return updated;
      });
      setNewEntrySelected("");
    }
  };

  // 📥 entries voor geselecteerde dag
  const loadEntries = async (date) => {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);

    const { data } = await supabase
      .from("journal_entries")
      .select("id, created_at, content")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true });

    setEntries(data || []);
  };

  // 📥 kalender data
  const loadCalendar = async (y = viewYear, m = viewMonth) => {
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    const { data } = await supabase
      .from("journal_entries")
      .select("id, created_at")
      .gte("created_at", firstDay.toISOString())
      .lte("created_at", lastDay.toISOString());

    const grouped = (data || []).reduce((acc, e) => {
      const d = new Date(e.created_at).toLocaleDateString("en-CA");
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    setEntriesByDay(grouped);
  };

  // 🔄 init load
  useEffect(() => {
    loadCalendar();
  }, [viewYear, viewMonth]);

  useEffect(() => {
    loadEntries(selectedDate);
  }, [selectedDate]);

  // 🔀 maand wisselen
  const changeMonth = (offset) => {
    let newMonth = viewMonth + offset;
    let newYear = viewYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }

    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  // kalender helpers
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const blanks = Array(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1).fill("");

  return (
    <div className="flex flex-col flex-1 bg-white">
      <section className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[300px,1fr] md:gap-8 md:p-8 bg-white text-gray-900 overflow-auto max-w-[1250px] mx-auto w-full rounded-lg min-h-0">
        {/* 📅 Kalender */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <button className="bg-slate-100 border border-gray-300 px-2 py-1 rounded text-sm hover:bg-slate-200">
              ←
            </button>
            <h3 className="font-semibold text-gray-800 px-3">
              {new Date(viewYear, viewMonth).toLocaleString("nl-NL", {
                month: "long",
              })}{" "}
              {viewYear}
            </h3>
            <div className="flex items-center gap-1">
              <button className="bg-slate-100 border border-gray-300 px-2 py-1 rounded text-sm hover:bg-slate-200">
                →
              </button>
              <button className="bg-white border border-gray-300 text-blue-600 font-medium px-3 py-1 rounded text-sm hover:bg-blue-50 hover:border-blue-600">
                Vandaag
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-semibold text-gray-500"
              >
                {d}
              </div>
            ))}

            {blanks.map((_, i) => (
              <div
                key={`b-${i}`}
                className="min-h-[55px] border border-gray-200 rounded"
              ></div>
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              const count = entriesByDay[dateStr] || 0;
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={day}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    loadEntries(dateStr);
                  }}
                  className={`min-h-[55px] border border-gray-200 rounded p-1 cursor-pointer flex flex-col justify-between transition
                    ${
                      isSelected
                        ? "bg-blue-600 text-white hover:bg-blue-800"
                        : count > 0
                          ? "bg-sky-100 hover:bg-slate-50"
                          : "bg-white hover:bg-slate-50"
                    }`}
                >
                  <span className="text-sm font-medium">{day}</span>
                  {count > 0 && (
                    <span
                      className={`text-[0.7rem] self-end rounded-full px-1
                        ${
                          isSelected
                            ? "bg-white text-blue-600"
                            : "bg-blue-600 text-white"
                        }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 📝 Entries */}
        <div>
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            {new Date(selectedDate).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h2>

          {/* Nieuwe entry */}
          <div className="flex flex-col gap-2 mb-4">
            <textarea
              placeholder={`Add a note for ${selectedDate}`}
              value={newEntrySelected}
              onChange={(e) => setNewEntrySelected(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.shiftKey &&
                (e.preventDefault(), addEntryForSelected())
              }
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={addEntryForSelected}
              className="self-end bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-800"
            >
              Add
            </button>
          </div>

          {entries.length === 0 ? (
            <p>No entries.</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => {
                const isEditing = editingId === e.id;
                const isExpanded = expandedIds.includes(e.id);

                const displayContent =
                  !isExpanded && (e.content || "").length > 200
                    ? (e.content || "").slice(0, 200) + "..."
                    : e.content || "";

                return (
                  <li
                    key={e.id}
                    className="bg-slate-50 border border-gray-200 rounded p-3 flex flex-col gap-2"
                  >
                    <div className="text-xs font-semibold text-gray-800">
                      {new Date(e.created_at).toLocaleTimeString("nl-NL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="flex flex-col gap-2">
                      {isEditing ? (
                        <>
                          <textarea
                            value={editText}
                            onChange={(ev) => setEditText(ev.target.value)}
                            rows={4}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(e.id)}
                              className="text-blue-600 text-sm hover:underline"
                            >
                              💾 Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-red-600 text-sm hover:underline"
                            >
                              ✖ Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="whitespace-pre-wrap break-words text-sm">
                            {displayContent}
                          </span>
                          <div className="flex gap-2 flex-wrap text-sm">
                            {(e.content || "").length > 200 && (
                              <button
                                onClick={() => toggleExpand(e.id)}
                                className="text-blue-600 hover:underline"
                              >
                                {isExpanded ? "Show less" : "Show more"}
                              </button>
                            )}
                            <button
                              onClick={() => handleStartEdit(e)}
                              className="text-blue-600 hover:underline"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="text-red-600 hover:underline"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

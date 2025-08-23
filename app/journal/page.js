"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import styled from "styled-components";

export default function JournalPage() {
  const [entriesByDay, setEntriesByDay] = useState({});
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [expandedIds, setExpandedIds] = useState([]);

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

  // ➕ nieuwe entry
  const addEntry = async () => {
    if (!newEntry.trim()) return;
    const { data, error } = await supabase
      .from("journal_entries")
      .insert([{ content: newEntry }])
      .select();

    if (!error && data && data.length > 0) {
      const inserted = data[0];
      if (inserted.created_at.slice(0, 10) === selectedDate) {
        setEntries((prev) => [...prev, inserted]);
      }
      setEntriesByDay((prev) => {
        const updated = { ...prev };
        const d = inserted.created_at.slice(0, 10);
        updated[d] = (updated[d] || 0) + 1;
        return updated;
      });
      setNewEntry("");
    }
  };

  // 📥 entries voor geselecteerde dag
  const loadEntries = async (date) => {
    const start = new Date(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, created_at, content")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()) // 👈 veldnaam erbij!
      .order("created_at", { ascending: true });

    setEntries(data || []);
  };

  // 📥 kalender data
  const loadCalendar = async () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data } = await supabase
      .from("journal_entries")
      .select("id, created_at")
      .gte("created_at", firstDay.toISOString())
      .lte("created_at", lastDay.toISOString());

    const grouped = (data || []).reduce((acc, e) => {
      const d = e.created_at.slice(0, 10);
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    setEntriesByDay(grouped);
  };

  // 🔄 init load
  useEffect(() => {
    loadCalendar();
  }, []);

  useEffect(() => {
    loadEntries(selectedDate);
  }, [selectedDate]);

  // kalender helpers
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const blanks = Array(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1).fill("");

  return (
    <PageWrapper>
      {/* Input Section */}
      <InputSection>
        <h3>What's on your mind today...?</h3>
        <div className="input-box">
          <input
            type="text"
            placeholder="Start typing..."
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
          />
          <button onClick={addEntry}>Add</button>
        </div>
      </InputSection>

      {/* Calendar + Entries */}
      <ContentSection>
        <CalendarPane>
          <h3>
            {now.toLocaleString("default", { month: "long" })} {year}
          </h3>
          <CalendarGrid>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <DayHeader key={d}>{d}</DayHeader>
            ))}
            {blanks.map((_, i) => (
              <DayCell key={`b-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              const count = entriesByDay[dateStr] || 0;
              const isSelected = selectedDate === dateStr;
              return (
                <DayCell
                  key={day}
                  $hasEntries={count > 0}
                  $selected={isSelected}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    loadEntries(dateStr);
                  }}
                >
                  <span className="day">{day}</span>
                  {count > 0 && <span className="count">{count}</span>}
                </DayCell>
              );
            })}
          </CalendarGrid>
        </CalendarPane>

        <EntryPane>
          <h2>
            {new Date(selectedDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h2>
          {entries.length === 0 ? (
            <p>No entries.</p>
          ) : (
            <ul>
              {entries.map((e) => {
                const isEditing = editingId === e.id;
                const isExpanded = expandedIds.includes(e.id);

                // 👇 veilig display content
                const displayContent =
                  !isExpanded && (e.content || "").length > 200
                    ? (e.content || "").slice(0, 200) + "..."
                    : e.content || "";

                return (
                  <li key={e.id}>
                    <div className="entry-header">
                      <strong>
                        {new Date(e.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                    </div>
                    <div className="entry-body">
                      {isEditing ? (
                        <>
                          <textarea
                            value={editText}
                            onChange={(ev) => setEditText(ev.target.value)}
                            rows={4}
                          />
                          <button onClick={() => handleSaveEdit(e.id)}>
                            💾
                          </button>
                          <button onClick={handleCancelEdit}>✖️</button>
                        </>
                      ) : (
                        <>
                          <span className="content">{displayContent}</span>
                          <div className="actions">
                            {(e.content || "").length > 200 && (
                              <button onClick={() => toggleExpand(e.id)}>
                                {isExpanded ? "Show less" : "Show more"}
                              </button>
                            )}
                            <button onClick={() => handleStartEdit(e)}>
                              ✏️
                            </button>
                            <button onClick={() => handleDelete(e.id)}>
                              🗑️
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
        </EntryPane>
      </ContentSection>
    </PageWrapper>
  );
}

/* ---------------- styled ---------------- */
const PageWrapper = styled.div`
  background: white;
  font-family: "Inter", sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

/* Input section */
const InputSection = styled.section`
  position: relative;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: url("/relaxingclouds.png") center/cover no-repeat;
  background-color: #f0f9ff;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.6);
  }

  > * {
    position: relative;
    z-index: 1;
  }

  h3 {
    margin-bottom: 1.5rem;
    font-size: 1.8rem;
    font-weight: 700;
    color: #222;
  }

  .input-box {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  input {
    width: 320px;
    padding: 0.9rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    font-size: 1rem;
    background: white;
  }

  button {
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.9rem 1.4rem;
    cursor: pointer;
    font-weight: 600;
    transition: 0.2s;
    &:hover {
      background: #1e40af;
    }
  }
`;

/* Content section */
const ContentSection = styled.section`
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 2rem;
  padding: 2.5rem;
  background: white;
  color: #222;
  border-top: 1px solid #eee;
`;

const CalendarPane = styled.div`
  h3 {
    text-align: center;
    margin-bottom: 1rem;
    font-weight: 600;
    color: #333;
  }
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
`;

const DayHeader = styled.div`
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #666;
`;

const DayCell = styled.div`
  min-height: 55px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  background: ${(p) =>
    p.$selected ? "#2563eb" : p.$hasEntries ? "#e0f2fe" : "white"};
  color: ${(p) => (p.$selected ? "white" : "#111")};
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: 0.2s;

  &:hover {
    background: ${(p) => (p.$selected ? "#1e40af" : "#f9fafb")};
  }

  .day {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .count {
    font-size: 0.7rem;
    align-self: flex-end;
    background: ${(p) => (p.$selected ? "white" : "#2563eb")};
    color: ${(p) => (p.$selected ? "#2563eb" : "white")};
    border-radius: 999px;
    padding: 0 5px;
  }
`;

const EntryPane = styled.div`
  h2 {
    margin-bottom: 1rem;
    font-size: 1.4rem;
    font-weight: 700;
    color: #222;
  }

  ul {
    list-style: none;
    padding-left: 0;
  }

  li {
    margin-bottom: 0.8rem;
    padding: 0.8rem 1rem;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #eee;
    color: #333;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .entry-header {
    font-size: 0.85rem;
    font-weight: 600;
    color: #111;
  }

  .entry-body {
    display: flex;
    flex-direction: column; /* content + actions onder elkaar */
    gap: 0.5rem;
  }

  .content {
    white-space: pre-wrap; /* behoudt enters */
    word-break: break-word; /* breekt lange woorden */
  }

  textarea {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.95rem;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .actions button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: #2563eb;
  }

  .actions button:hover {
    text-decoration: underline;
  }
`;

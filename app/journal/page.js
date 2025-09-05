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
    <PageWrapper>
      <ContentSection>
        <CalendarPane>
          <HeaderRow>
            <button onClick={() => changeMonth(-1)}>←</button>
            <h3>
              {new Date(viewYear, viewMonth).toLocaleString("nl-NL", {
                month: "long",
              })}{" "}
              {viewYear}
            </h3>
            <RightControls>
              <button onClick={() => changeMonth(1)}>→</button>
              <TodayButton
                onClick={() => {
                  const today = new Date();
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  setSelectedDate(today.toLocaleDateString("en-CA"));
                  loadCalendar(today.getFullYear(), today.getMonth());
                }}
              >
                Vandaag
              </TodayButton>
            </RightControls>
          </HeaderRow>

          <CalendarGrid>
            {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d) => (
              <DayHeader key={d}>{d}</DayHeader>
            ))}

            {blanks.map((_, i) => (
              <DayCell key={`b-${i}`} />
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

        {/* Entries */}
        <EntryPane>
          <h2>
            {new Date(selectedDate).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h2>

          {/* Nieuw invoerveld voor geselecteerde dag */}
          <NoteInput>
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
            />
            <button onClick={addEntryForSelected}>Add</button>
          </NoteInput>

          {entries.length === 0 ? (
            <p>No entries.</p>
          ) : (
            <ul>
              {entries.map((e) => {
                const isEditing = editingId === e.id;
                const isExpanded = expandedIds.includes(e.id);

                const displayContent =
                  !isExpanded && (e.content || "").length > 200
                    ? (e.content || "").slice(0, 200) + "..."
                    : e.content || "";

                return (
                  <li key={e.id}>
                    <div className="entry-header">
                      <strong>
                        {new Date(e.created_at).toLocaleTimeString("nl-NL", {
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
  display: flex;
  flex-direction: column;
  background: inherit;
  flex: 1;
`;

/* Content section */
const ContentSection = styled.section`
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 2rem;
  padding: 2rem;
  background: white;
  color: #222;
  overflow: auto;
  max-width: 1250px;
  margin: auto auto;
  width: 100%;
  border-radius: 10px;

  height: 99vh; /* ⬅️ maximaal 80% van viewport */
  min-height: 0; /* voorkomt dat flexbox het blijft rekken */
`;

const CalendarPane = styled.div`
  h3 {
    text-align: center;
    margin-bottom: 1rem;
    font-weight: 600;
    color: #333;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h3 {
    margin: 0;
    font-weight: 600;
    color: #333;
  }

  button {
    background: #f1f5f9;
    border: 1px solid #ccc;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: 0.2s;

    &:hover {
      background: #e2e8f0;
    }
  }
`;

const RightControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const TodayButton = styled.button`
  background: #fff;
  border: 1px solid #ccc;
  color: #2563eb;
  font-weight: 500;
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: 0.2s;

  &:hover {
    background: #eff6ff;
    border-color: #2563eb;
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
    flex-direction: column;
    gap: 0.5rem;
  }

  .content {
    white-space: pre-wrap;
    word-break: break-word;
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

const NoteInput = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.2rem;

  textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 0.95rem;
    background: #fff;
    resize: vertical;
    transition: 0.2s;

    &:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 2px #2563eb33;
    }
  }

  button {
    align-self: flex-end;
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1.2rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    transition: 0.2s;

    &:hover {
      background: #1e40af;
    }
  }
`;

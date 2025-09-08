"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { supabase } from "../lib/supabaseClient";

export default function NotesArea() {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // 📥 Ophalen bij laden
  useEffect(() => {
    async function loadNote() {
      const { data, error } = await supabase
        .from("notes")
        .select("content")
        .eq("type", "note")
        .single();

      if (!error && data) setNote(data.content || "");
    }
    loadNote();
  }, []);

  // 💾 Opslaan (debounced)
  useEffect(() => {
    if (note === "") return;

    const timeout = setTimeout(async () => {
      setLoading(true);

      const { error } = await supabase
        .from("notes")
        .update({ content: note })
        .eq("type", "note");

      if (error) console.error("Save note error:", error);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, [note]);

  return (
    <div>
      <h3 className="mb-2 text-slate-800 font-semibold text-sm sm:text-base">
        Quick Notes
      </h3>
      <StyledTextArea value={note} onChange={(e) => setNote(e.target.value)} />
      {loading && <small>Opslaan...</small>}
    </div>
  );
}

const StyledTextArea = styled.textarea`
  margin-top: 0.75rem;
  width: 100%;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  color: #1f2937;
  border-radius: 10px;
  padding: 1rem;
  min-height: 120px;
  resize: none;
  font-size: 0.9rem;
  line-height: 1.4rem;

  &:focus {
    outline: none;
    border-color: #93c5fd;
    box-shadow: 0 0 0 2px #bfdbfe;
    background: #ffffff;
  }
`;

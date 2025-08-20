"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styled from "styled-components";

export default function SortableItem({ col, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: col.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editing, setEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(col.label);

  return (
    <Row ref={setNodeRef} style={style} $hidden={!col.visible}>
      {/* Drag handle */}
      <DragHandle {...attributes} {...listeners}>
        ☰
      </DragHandle>

      {editing ? (
        <>
          <input
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
          />
          <input
            type="checkbox"
            checked={col.visible}
            onChange={(e) => onUpdate(col.id, { visible: e.target.checked })}
          />
          <button onClick={() => onDelete(col.id)}>❌</button>
          <button
            onClick={() => {
              onUpdate(col.id, { label: tempLabel });
              setEditing(false);
            }}
          >
            ✔
          </button>
          <button onClick={() => setEditing(false)} style={{ color: "grey" }}>
            ✖
          </button>
        </>
      ) : (
        <>
          <span>{col.label}</span>
          <button onClick={() => setEditing(true)}>✏️</button>
        </>
      )}
    </Row>
  );
}

/* === Styles === */
const Row = styled.div`
  display: flex;
  align-items: center;
  padding: 0.4rem 0.6rem;
  margin-bottom: 0.3rem;
  background: ${(p) => (p.$hidden ? "#f0f0f0" : "#fff")};
  color: ${(p) => (p.$hidden ? "#999" : "#000")};
  border: 1px solid #ddd;
  border-radius: 4px;

  input[type="text"] {
    flex: 1;
    margin-right: 0.5rem;
  }

  span {
    flex: 1;
  }

  button {
    margin-left: 0.3rem;
    border: none;
    background: none;
    cursor: pointer;
  }
`;

const DragHandle = styled.div`
  cursor: grab;
  margin-right: 0.5rem;
  user-select: none;
`;

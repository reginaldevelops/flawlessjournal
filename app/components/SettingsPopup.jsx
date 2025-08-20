"use client";

import { useState } from "react";
import styled from "styled-components";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem";

export default function SettingsPopup({
  onClose,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  columns,
  setColumns,
}) {
  const [editingId, setEditingId] = useState(null);

  // Drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      setColumns(arrayMove(columns, oldIndex, newIndex));
    }
  };

  // Rename column
  const handleRename = (id, newLabel) => {
    setColumns(
      columns.map((c) => (c.id === id ? { ...c, label: newLabel } : c))
    );
  };

  // Toggle column visibility
  const toggleVisible = (id) => {
    setColumns(
      columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  // Delete column
  const deleteColumn = (id) => {
    setColumns(columns.filter((c) => c.id !== id));
  };

  // Add column
  const addColumn = () => {
    const newId = `col_${Date.now()}`;
    setColumns([...columns, { id: newId, label: "New Column", visible: true }]);
  };

  return (
    <Panel>
      <Header>
        <h3>⚙️ Settings</h3>
        <CloseBtn onClick={onClose}>✖</CloseBtn>
      </Header>

      {/* === Font Controls === */}
      <Section>
        <label>Font Size:</label>
        <select
          value={fontSize.replace("px", "")}
          onChange={(e) => setFontSize(e.target.value + "px")}
        >
          <option value="14">14px</option>
          <option value="16">16px</option>
          <option value="18">18px</option>
          <option value="20">20px</option>
        </select>
      </Section>

      <Section>
        <label>Font Family:</label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
        >
          <option value="Arial, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Verdana, sans-serif">Verdana</option>
        </select>
      </Section>

      {/* === Columns === */}
      <Section>
        <label>Columns:</label>
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {columns.map((col) => (
              <SortableItem key={col.id} id={col.id}>
                {editingId === col.id ? (
                  <>
                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) => handleRename(col.id, e.target.value)}
                    />
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={() => toggleVisible(col.id)}
                    />
                    <button onClick={() => deleteColumn(col.id)}>🗑</button>
                    <button onClick={() => setEditingId(null)}>✔</button>
                  </>
                ) : (
                  <>
                    <span style={{ opacity: col.visible ? 1 : 0.5 }}>
                      {col.label}
                    </span>
                    <EditBtn onClick={() => setEditingId(col.id)}>✏️</EditBtn>
                  </>
                )}
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <AddBtn onClick={addColumn}>+ Add Column</AddBtn>
      </Section>
    </Panel>
  );
}

/* === Styles === */

const Panel = styled.div`
  position: fixed;
  top: 1rem;
  right: 1rem;
  width: 320px;
  background: ${(p) => (p.theme.background === "#171717" ? "#1e1e1e" : "#fff")};
  border: 1px solid
    ${(p) => (p.theme.background === "#171717" ? "#333" : "#ddd")};
  border-radius: 8px;
  padding: 1rem;
  z-index: 999;
  color: ${(p) => p.theme.foreground};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  color: ${(p) => p.theme.foreground};
`;

const Section = styled.div`
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  label {
    font-weight: bold;
  }

  select,
  input[type="text"] {
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
`;

const AddBtn = styled.button`
  margin-top: 0.5rem;
  padding: 0.4rem 0.8rem;
  border: none;
  background: #2563eb;
  color: white;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: #1d4ed8;
  }
`;

const EditBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  margin-left: auto;
  font-size: 1rem;
`;

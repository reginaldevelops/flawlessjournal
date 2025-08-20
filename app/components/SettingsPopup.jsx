"use client";

import { useState } from "react";
import styled from "styled-components";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem";

export default function SettingsPopup({
  onClose,
  columns,
  setColumns,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      setColumns(arrayMove(columns, oldIndex, newIndex));
    }
  };

  const handleUpdate = (id, updated) => {
    setColumns(columns.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  };

  const handleDelete = (id) => {
    setColumns(columns.filter((c) => c.id !== id));
  };

  const handleAddColumn = () => {
    const newId = Date.now().toString();
    setColumns([...columns, { id: newId, label: "New Column", visible: true }]);
  };

  return (
    <Overlay>
      <Popup>
        <Header>
          ⚙️ Settings
          <CloseBtn onClick={onClose}>✖</CloseBtn>
        </Header>

        <Section>
          <h4>General settings</h4>
          <label>
            Font size:
            <input
              type="number"
              value={parseInt(fontSize)}
              onChange={(e) => setFontSize(`${e.target.value}px`)}
            />
          </label>
          <label>
            Font family:
            <input
              type="text"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
            />
          </label>
        </Section>

        <Section>
          <h4>Columns</h4>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {columns.map((col) => (
                <SortableItem
                  key={col.id}
                  col={col}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>

          <AddBtn onClick={handleAddColumn}>➕ Add column</AddBtn>
        </Section>
      </Popup>
    </Overlay>
  );
}

/* === Styles === */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Popup = styled.div`
  background: white;
  padding: 1rem;
  border-radius: 8px;
  width: 400px;
  max-height: 80vh;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  font-size: 1.2rem;
  margin-bottom: 1rem;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
`;

const Section = styled.div`
  margin-bottom: 1rem;

  h4 {
    margin-bottom: 0.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
  }
`;

const AddBtn = styled.button`
  margin-top: 0.5rem;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #eee;
`;

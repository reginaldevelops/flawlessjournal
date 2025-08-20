"use client";

import { useState } from "react";
import styled from "styled-components";

export default function ColumnFormDrawer({
  columns,
  onAddColumn,
  onReorder,
  onUpdateColumn,
  onDeleteColumn,
}) {
  const [open, setOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [editIndex, setEditIndex] = useState(null); // ✅ bijhouden welke kolom we editen
  const [editData, setEditData] = useState({ name: "", type: "text" });
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const type = e.target.type.value;

    // ✅ check duplicaat
    if (columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError("Kolomnamen moeten uniek zijn");
      return;
    }

    onAddColumn({ name, type });
    setError("");
    setOpen(false);
    e.target.reset();
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDrop = (index) => {
    if (draggedIndex === null) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(draggedIndex, 1);
    newCols.splice(index, 0, moved);
    setDraggedIndex(null);
    onReorder(newCols);
  };

  const startEdit = (index) => {
    setEditIndex(index);
    setEditData(columns[index]);
  };

  const saveEdit = () => {
    const newName = editData.name.trim();

    if (
      columns.some(
        (c, idx) =>
          idx !== editIndex && c.name.toLowerCase() === newName.toLowerCase()
      )
    ) {
      setError("Kolomnamen moeten uniek zijn");
      return;
    }

    onUpdateColumn(editIndex, editData);
    setEditIndex(null);
    setError("");
  };

  return (
    <>
      <AddButton onClick={() => setOpen(true)}>+ Kolom toevoegen</AddButton>

      <Drawer $open={open}>
        <DrawerContent>
          <CloseButton onClick={() => setOpen(false)}>✕</CloseButton>
          <h2>Nieuwe kolom</h2>
          <Form onSubmit={handleSubmit}>
            <Input name="name" placeholder="Kolomnaam" />
            <Select name="type">
              <option value="text">Tekst</option>
              <option value="number">Nummer</option>
              <option value="boolean">Boolean</option>
              <option value="currency">Bedrag</option>
              <option value="date">Datum</option>
              <option value="time">Tijd</option>
            </Select>
            <SubmitButton type="submit">Opslaan</SubmitButton>
            {error && <ErrorText>{error}</ErrorText>}
          </Form>

          <h3 style={{ marginTop: "2rem" }}>Huidige kolommen</h3>
          <ColumnList>
            {columns.map((col, i) => (
              <ColumnItem
                key={col.name}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
              >
                {editIndex === i ? (
                  <EditForm>
                    <SmallInput
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({ ...editData, name: e.target.value })
                      }
                    />
                    <SmallSelect
                      value={editData.type}
                      onChange={(e) =>
                        setEditData({ ...editData, type: e.target.value })
                      }
                    >
                      <option value="text">Tekst</option>
                      <option value="number">Nummer</option>
                      <option value="boolean">Boolean</option>
                      <option value="currency">Bedrag</option>
                      <option value="date">Datum</option>
                      <option value="time">Tijd</option>
                    </SmallSelect>
                    <ActionButton onClick={saveEdit}>💾</ActionButton>
                    <ActionButton onClick={() => setEditIndex(null)}>
                      ✕
                    </ActionButton>
                  </EditForm>
                ) : (
                  <RowFlex>
                    <span>
                      {col.name} <TypeTag>({col.type})</TypeTag>
                    </span>
                    <Actions>
                      <ActionButton onClick={() => startEdit(i)}>
                        ✏️
                      </ActionButton>
                      <ActionButton onClick={() => onDeleteColumn(i)}>
                        ❌
                      </ActionButton>
                    </Actions>
                  </RowFlex>
                )}
              </ColumnItem>
            ))}
          </ColumnList>
        </DrawerContent>
      </Drawer>

      {open && <Overlay onClick={() => setOpen(false)} />}
    </>
  );
}

/* styled */

const AddButton = styled.button`
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.2rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: #2563eb;
  }
`;

const Drawer = styled.div`
  position: fixed;
  top: 0;
  left: ${({ $open }) => ($open ? "0" : "-400px")};
  height: 100vh;
  width: 400px;
  background: white;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease;
  z-index: 50;
  display: flex;
  flex-direction: column;
`;

const DrawerContent = styled.div`
  padding: 2rem;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const CloseButton = styled.button`
  align-self: flex-end;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #555;
  margin-bottom: 1rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Input = styled.input`
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
`;

const Select = styled.select`
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
`;

const SubmitButton = styled.button`
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: auto;
  &:hover {
    background: #16a34a;
  }
`;

const ColumnList = styled.ul`
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
`;

const ColumnItem = styled.li`
  padding: 0.6rem;
  margin-bottom: 0.4rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #f9fafb;
  cursor: grab;
  &:active {
    cursor: grabbing;
    background: #e5e7eb;
  }
`;

const RowFlex = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TypeTag = styled.span`
  color: #666;
  font-size: 0.85rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.3rem;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
`;

const EditForm = styled.div`
  display: flex;
  gap: 0.3rem;
  align-items: center;
`;

const SmallInput = styled.input`
  flex: 1;
  padding: 0.3rem;
  border: 1px solid #ccc;
  border-radius: 6px;
`;

const SmallSelect = styled.select`
  padding: 0.3rem;
  border: 1px solid #ccc;
  border-radius: 6px;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 40;
`;

const ErrorText = styled.p`
  color: #dc2626;
  font-size: 0.85rem;
  margin-top: 0.5rem;
`;

"use client";

import { useState } from "react";
import styled from "styled-components";
import { supabase } from "../lib/supabaseClient";
import { Trash2, Pencil, Save, Plus, close } from "lucide-react";

export default function ColumnFormDrawer({
  columns,
  setColumns,
  rows,
  setRows,
}) {
  const [open, setOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    type: "text",
    options: [],
  });

  const [error, setError] = useState("");
  const [showNewOptions, setShowNewOptions] = useState(false);
  const [newOptionAdd, setNewOptionAdd] = useState("");
  const [newOptionEdit, setNewOptionEdit] = useState("");
  const [tempOptions, setTempOptions] = useState([]);

  /* ---------------- Supabase actions ---------------- */
  const addColumn = async (col) => {
    const newCol = { ...col, width: 150 };
    const { data, error } = await supabase
      .from("columns")
      .insert([{ definition: newCol, order: columns.length }])
      .select();

    if (error) console.error(error);
    else
      setColumns((prev) => [
        ...prev,
        { id: data[0].id, ...data[0].definition },
      ]);
  };

  const updateColumn = async (index, updated) => {
    const col = columns[index];
    const definition = { width: col.width ?? 150, ...updated };
    const { error } = await supabase
      .from("columns")
      .update({ definition })
      .eq("id", col.id);
    if (error) console.error(error);
    else {
      const newCols = [...columns];
      newCols[index] = { id: col.id, ...definition };
      setColumns(newCols);
    }
  };

  const deleteColumn = async (index, rows, setRows) => {
    const col = columns[index];
    await supabase.from("columns").delete().eq("id", col.id);

    const newCols = [...columns];
    newCols.splice(index, 1);
    setColumns(newCols);

    const updatedRows = rows.map((r) => {
      const copy = { ...r };
      delete copy[col.name];
      return copy;
    });
    setRows(updatedRows);
  };

  const reorderColumns = async (newCols) => {
    setColumns(newCols);
    for (let i = 0; i < newCols.length; i++) {
      const col = newCols[i];
      await supabase.from("columns").update({ order: i }).eq("id", col.id);
    }
  };

  /* ---------------- UI handlers ---------------- */
  const handleSubmit = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const type = e.target.type.value;
    if (!name) return setError("Kolomnaam mag niet leeg zijn");
    if (columns.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return setError("Kolomnamen moeten uniek zijn");

    const newCol = { name, type };
    if (type === "select") newCol.options = tempOptions;

    addColumn(newCol);
    setError("");
    e.target.reset();
    setTempOptions([]);
    setNewOptionAdd("");
  };

  const handleDrop = (index) => {
    if (draggedIndex === null) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(draggedIndex, 1);
    newCols.splice(index, 0, moved);
    setDraggedIndex(null);
    reorderColumns(newCols);
  };

  const saveEdit = async () => {
    if (!editData.name.trim()) return setError("Naam mag niet leeg zijn");
    if (
      columns.some(
        (c, idx) =>
          idx !== editIndex &&
          c.name.toLowerCase() === editData.name.toLowerCase()
      )
    )
      return setError("Kolomnamen moeten uniek zijn");

    await updateColumn(editIndex, editData);
    setEditIndex(null);
    setError("");
  };

  /* ---------------- JSX ---------------- */
  return (
    <>
      <AddButton onClick={() => setOpen(true)}>Tabel management</AddButton>

      <Drawer $open={open}>
        <DrawerContent>
          <CloseButton onClick={() => setOpen(false)}>✕</CloseButton>

          {/* Nieuwe kolom */}
          <h2>Nieuwe kolom</h2>
          <Form onSubmit={handleSubmit}>
            <Input name="name" placeholder="Kolomnaam" />
            <Select
              name="type"
              onChange={(e) => setShowNewOptions(e.target.value === "select")}
            >
              <option value="text">Tekst</option>
              <option value="number">Nummer</option>
              <option value="boolean">Boolean</option>
              <option value="currency">Bedrag</option>
              <option value="date">Datum</option>
              <option value="time">Tijd</option>
              <option value="select">Dropdown</option>
            </Select>

            {showNewOptions && (
              <>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {tempOptions.map((opt, i) => (
                    <span key={i} style={tagStyle}>
                      {opt}
                      <button
                        type="button"
                        onClick={() =>
                          setTempOptions((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                      >
                        ❌
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <InputNewOption
                    type="text"
                    placeholder="Nieuwe optie..."
                    value={newOptionAdd}
                    onChange={(e) => setNewOptionAdd(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newOptionAdd.trim()) {
                        e.preventDefault();
                        if (tempOptions.includes(newOptionAdd.trim()))
                          return setError("Deze optie bestaat al.");
                        setTempOptions((prev) => [
                          ...prev,
                          newOptionAdd.trim(),
                        ]);
                        setNewOptionAdd("");
                        setError("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newOptionAdd.trim()) return;
                      if (tempOptions.includes(newOptionAdd.trim()))
                        return setError("Deze optie bestaat al.");
                      setTempOptions((prev) => [...prev, newOptionAdd.trim()]);
                      setNewOptionAdd("");
                    }}
                  >
                    +
                  </button>
                </div>
              </>
            )}
            <SubmitButton type="submit">Opslaan</SubmitButton>
            {error && <ErrorText>{error}</ErrorText>}
          </Form>

          {/* Huidige kolommen */}
          <h3 style={{ marginTop: "2rem" }}>Huidige kolommen</h3>
          <ColumnList>
            {columns.map((col, i) => (
              <ColumnItem
                key={col.id || col.name}
                draggable
                onDragStart={() => setDraggedIndex(i)}
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
                      <option value="select">Dropdown</option>
                    </SmallSelect>

                    {editData.type === "select" && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                          }}
                        >
                          {editData.options?.map((opt, idx) => (
                            <span key={idx} style={tagStyle}>
                              {opt}
                              <SelectionTagExit
                                type="button"
                                onClick={() =>
                                  setEditData((prev) => ({
                                    ...prev,
                                    options: prev.options.filter(
                                      (_, j) => j !== idx
                                    ),
                                  }))
                                }
                              >
                                ❌
                              </SelectionTagExit>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <InputNewOption
                            type="text"
                            placeholder="Nieuwe optie..."
                            value={newOptionEdit}
                            onChange={(e) => setNewOptionEdit(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newOptionEdit.trim()) {
                                e.preventDefault();
                                if (
                                  editData.options?.includes(
                                    newOptionEdit.trim()
                                  )
                                )
                                  return setError("Deze optie bestaat al.");
                                setEditData((prev) => ({
                                  ...prev,
                                  options: [
                                    ...(prev.options || []),
                                    newOptionEdit.trim(),
                                  ],
                                }));
                                setNewOptionEdit("");
                                setError("");
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newOptionEdit.trim()) return;
                              if (
                                editData.options?.includes(newOptionEdit.trim())
                              )
                                return setError("Deze optie bestaat al.");
                              setEditData((prev) => ({
                                ...prev,
                                options: [
                                  ...(prev.options || []),
                                  newOptionEdit.trim(),
                                ],
                              }));
                              setNewOptionEdit("");
                            }}
                          >
                            <Plus size={9} />
                          </button>
                        </div>
                      </>
                    )}

                    <ActionButton onClick={saveEdit}>Collapse</ActionButton>
                  </EditForm>
                ) : (
                  <RowFlex>
                    <ColumnLabel>
                      {col.name} <TypeTag>({col.type})</TypeTag>
                      {col.type === "select" && col.options?.length > 0 && (
                        <TypeTag> → [{col.options.join(", ")}]</TypeTag>
                      )}
                    </ColumnLabel>
                    <Actions>
                      <ActionButton
                        onClick={() => {
                          setEditIndex(i);
                          setEditData(col);
                        }}
                      >
                        <Pencil size={14} />
                      </ActionButton>
                      <ActionButton
                        onClick={() => deleteColumn(i, rows, setRows)}
                      >
                        <Trash2 size={14} />
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

/* ----- styles ----- */

const SelectionTagExit = styled.button`
  border: none;
  font-size: 10px;
  background-color: transparent;
`;

const tagStyle = {
  padding: "0.25rem 0.5rem",
  background: "#e6e6e6ff",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
};

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
  right: ${({ $open }) => ($open ? "0" : "-400px")};
  height: 100vh;
  width: 400px;
  background: white;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
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

const ColumnLabel = styled.span`
  display: inline-block;
  width: 100%;
  vertical-align: middle;
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
  padding: 0.5em;
`;

const TypeTag = styled.span`
  color: #666666f7;
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
  color: grey;
`;

const EditForm = styled.div`
  display: flex;
  flex-wrap: wrap; /* ✅ voorkomt overflow */
  gap: 1rem;
  align-items: center;
  width: 100%;
`;

const SmallInput = styled.input`
  flex: 1 1 100%; /* ✅ neemt volle breedte in binnen EditForm */
  min-width: 0; /* voorkomt overflow door lange inhoud */
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
`;

const SmallSelect = styled.select`
  flex: 1 1 auto;
  min-width: 80px;
  max-width: 50%;
  padding: 0.25rem;
  border: 1px solid #ccc;
  background-color: #e6e6e6ff;
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

const InputNewOption = styled.input`
  font-size: 15px;
  padding: 2px 5px;
`;

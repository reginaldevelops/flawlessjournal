"use client";

import { useState, useEffect } from "react";
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

  // Voorkomt dat achtergrond scrollt als drawer openstaat
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => (document.body.style.overflow = "auto");
  }, [open]);

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
              <option value="link">Link</option>
            </Select>

            {showNewOptions && (
              <>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {tempOptions.map((opt, i) => (
                    <span key={i} style={tagStyle}>
                      {opt}
                      <SelectionTagExit
                        type="button"
                        onClick={() =>
                          setTempOptions((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
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
                      <option value="link">Link</option>
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

/* ----- styles (light Notion + subtle cyberpunk accents) ----- */

const SelectionTagExit = styled.button`
  all: unset;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;

  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: #db2777;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #f43f5e;
  }

  &:focus,
  &:active {
    outline: none !important;
    box-shadow: none !important;
    background: none !important;
  }
`;

const tagStyle = {
  padding: "0.25rem 0.6rem",
  background: "#f9fafb",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  fontSize: "0.85rem",
};

const AddButton = styled.button`
  background: linear-gradient(90deg, #0ea5e9, #22d3ee); /* cyan glow */
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1.2rem;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
`;

const Drawer = styled.div`
  position: fixed;
  top: 0;
  right: ${({ $open }) => ($open ? "0" : "-420px")};
  height: 100vh;
  width: 420px;
  background: #fff;
  box-shadow: -6px 0 15px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
  z-index: 50;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e5e7eb;
`;

const DrawerContent = styled.div`
  padding: 2rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  color: #111;
  overflow-y: auto;
`;

const ColumnLabel = styled.span`
  display: inline-block;
  width: 100%;
  font-size: 0.95rem;
`;

const CloseButton = styled.button`
  align-self: flex-end;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;

  &:hover {
    color: #db2777; /* neon pink accent */
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Input = styled.input`
  padding: 0.6rem;
  border: 1px solid #e5e7eb;
  background: #fafafa;
  border-radius: 6px;
  color: #111;

  &::placeholder {
    color: #aaa;
  }
`;

const Select = styled.select`
  padding: 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
  color: #111;

  &:focus {
    border-color: #db2777; /* pink accent */
    outline: none;
    box-shadow: 0 0 0 2px rgba(219, 39, 119, 0.15);
  }
`;

const SubmitButton = styled.button`
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-weight: bold;
  cursor: pointer;
  margin-top: auto;
  text-transform: uppercase;
  transition: background 0.2s;
`;

const ColumnList = styled.ul`
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
`;

const ColumnItem = styled.li`
  padding: 0.6rem;
  margin-bottom: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
  cursor: grab;
  transition: background 0.2s;

  &:active {
    cursor: grabbing;
    background: #f3faff; /* zacht blauw */
  }
`;

const RowFlex = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TypeTag = styled.span`
  color: #666;
  font-size: 0.8rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.4rem;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: #888;
  transition: color 0.2s;

  &:hover {
    color: #0ea5e9; /* cyan hover */
  }
`;

const EditForm = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  width: 100%;
`;

const SmallInput = styled.input`
  flex: 1 1 100%;
  min-width: 0;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
  color: #111;
`;

const SmallSelect = styled.select`
  flex: 1 1 auto;
  min-width: 80px;
  max-width: 50%;
  padding: 0.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
  color: #111;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 40;
`;

const ErrorText = styled.p`
  color: #db2777;
  font-size: 0.85rem;
  margin-top: 0.5rem;
`;

const InputNewOption = styled.input`
  font-size: 0.9rem;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #fafafa;
  color: #111;
`;

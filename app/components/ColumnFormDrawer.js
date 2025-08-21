"use client";

import { useState } from "react";
import styled from "styled-components";
import { supabase } from "../lib/supabaseClient";

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
  const [extraOptions, setExtraOptions] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  /* ---------------------- Supabase actions ---------------------- */

  const addColumn = async (col) => {
    const { data, error } = await supabase
      .from("columns")
      .insert([{ definition: col, order: columns.length }])
      .select();

    if (error) {
      console.error("Add column error:", error);
    } else {
      setColumns((prev) => [
        ...prev,
        { id: data[0].id, ...data[0].definition },
      ]);
    }
  };

  const updateColumn = async (index, updated) => {
    const col = columns[index];
    const { error } = await supabase
      .from("columns")
      .update({ definition: updated })
      .eq("id", col.id);

    if (error) {
      console.error("Update column error:", error);
    } else {
      const newCols = [...columns];
      newCols[index] = { id: col.id, ...updated };
      setColumns(newCols);
    }
  };

  const deleteColumn = async (index, rows, setRows) => {
    const col = columns[index];

    // 1️⃣ Kolom zelf uit de columns tabel verwijderen
    const { error: colError } = await supabase
      .from("columns")
      .delete()
      .eq("id", col.id);

    if (colError) {
      console.error("Delete column error:", colError);
      return;
    }

    // 2️⃣ Kolom lokaal uit state halen
    const newCols = [...columns];
    newCols.splice(index, 1);
    setColumns(newCols);

    // 3️⃣ Als er helemaal geen kolommen meer zijn → verwijder alle trades
    if (newCols.length === 0) {
      const { error: rowError } = await supabase
        .from("trades")
        .delete()
        .not("id", "is", null);

      if (rowError) {
        console.error("Delete all rows error:", rowError);
      } else {
        console.log("Alle trades verwijderd omdat er geen kolommen meer zijn.");
        setRows([]);
      }
    } else {
      // 4️⃣ Anders: laat Supabase de kolom key verwijderen via RPC
      const { error: rpcError } = await supabase.rpc(
        "remove_column_from_trades",
        { col_name: col.name } // 🔹 moet exact overeenkomen met je functieparameter
      );

      if (rpcError) {
        console.error("RPC error:", rpcError);
      } else {
        console.log(`Kolom '${col.name}' verwijderd uit alle trades`);
        // lokale rows updaten zodat UI ook klopt
        const updatedRows = rows.map((r) => {
          const newR = { ...r };
          delete newR[col.name];
          return newR;
        });
        setRows(updatedRows);
      }
    }
  };

  const reorderColumns = async (newCols) => {
    setColumns(newCols); // lokaal alvast updaten

    // schrijf nieuwe volgorde naar supabase
    for (let i = 0; i < newCols.length; i++) {
      const col = newCols[i];
      await supabase.from("columns").update({ order: i }).eq("id", col.id);
    }
  };

  /* ---------------------- UI handlers ---------------------- */

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const type = e.target.type.value;

    if (!name) {
      setError("Kolomnaam mag niet leeg zijn");
      return;
    }

    if (columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError("Kolomnamen moeten uniek zijn");
      return;
    }

    const newCol = { name, type };

    if (type === "select" && extraOptions.trim()) {
      newCol.options = extraOptions.split(",").map((o) => o.trim());
    }

    addColumn(newCol);
    setError("");
    e.target.reset();
    setExtraOptions("");
  };

  const handleDrop = (index) => {
    if (draggedIndex === null) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(draggedIndex, 1);
    newCols.splice(index, 0, moved);
    setDraggedIndex(null);
    reorderColumns(newCols);
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

    if (editData.type === "select" && typeof editData.options === "string") {
      editData.options = editData.options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    }

    updateColumn(editIndex, editData);
    setEditIndex(null);
    setError("");
  };

  /* ---------------------- JSX ---------------------- */

  return (
    <>
      <AddButton onClick={() => setOpen(true)}>Tabel management</AddButton>

      <Drawer $open={open}>
        <DrawerContent>
          <CloseButton onClick={() => setOpen(false)}>✕</CloseButton>
          <h2>Nieuwe kolom</h2>
          <Form onSubmit={handleSubmit}>
            <Input name="name" placeholder="Kolomnaam" />
            <Select
              name="type"
              onChange={(e) => setShowOptions(e.target.value === "select")}
            >
              <option value="text">Tekst</option>
              <option value="number">Nummer</option>
              <option value="boolean">Boolean</option>
              <option value="currency">Bedrag</option>
              <option value="date">Datum</option>
              <option value="time">Tijd</option>
              <option value="select">Dropdown</option>
            </Select>

            {showOptions && (
              <Input
                placeholder="Opties, gescheiden door komma's"
                value={extraOptions}
                onChange={(e) => setExtraOptions(e.target.value)}
              />
            )}

            <SubmitButton type="submit">Opslaan</SubmitButton>
            {error && <ErrorText>{error}</ErrorText>}
          </Form>

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
                      <SmallInput
                        placeholder="Opties (komma's)"
                        value={editData.options?.join(", ") ?? ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            options: e.target.value
                              .split(",")
                              .map((opt) => opt.trim()),
                          })
                        }
                      />
                    )}

                    <ActionButton onClick={saveEdit}>💾</ActionButton>
                    <ActionButton onClick={() => setEditIndex(null)}>
                      ✕
                    </ActionButton>
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
                        ✏️
                      </ActionButton>
                      <ActionButton
                        onClick={() => deleteColumn(i, rows, setRows)}
                      >
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
  flex-wrap: wrap; /* ✅ voorkomt overflow */
  gap: 0.3rem;
  align-items: center;
  width: 100%;
`;

const SmallInput = styled.input`
  flex: 1 1 100%; /* ✅ neemt volle breedte in binnen EditForm */
  min-width: 0; /* voorkomt overflow door lange inhoud */
  padding: 0.3rem;
  border: 1px solid #ccc;
  border-radius: 6px;
`;

const SmallSelect = styled.select`
  flex: 1 1 auto;
  min-width: 80px;
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

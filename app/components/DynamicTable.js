"use client";

import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import RowFormDrawer from "./RowFormDrawer";
import ColumnFormDrawer from "./ColumnFormDrawer";
import { supabase } from "../lib/supabaseClient";

export default function DynamicTable() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [colWidths, setColWidths] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const startX = useRef(null);
  const startWidth = useRef(null);
  const resizingIndex = useRef(null);

  /* ---------- Load data ---------- */
  const loadRows = async () => {
    const { data, error } = await supabase.from("trades").select("*");
    if (!error) {
      setRows(data.map((d) => ({ id: d.id, ...d.data })));
    }
  };

  const loadColumns = async () => {
    const { data, error } = await supabase
      .from("columns")
      .select("*")
      .order("order", { ascending: true });

    if (error) {
      console.error("Load columns error:", error);
    } else {
      setColumns(data.map((c) => ({ id: c.id, ...c.definition })));
      setColWidths(data.map((c) => c.definition.width || 150));
    }
  };

  useEffect(() => {
    loadRows();
    loadColumns();
  }, []);

  /* ---------- Column resizing ---------- */
  const onMouseDown = (e, index) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = colWidths[index];
    resizingIndex.current = index;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e) => {
    if (resizingIndex.current === null) return;
    const delta = e.clientX - startX.current;
    const newWidths = [...colWidths];
    newWidths[resizingIndex.current] = Math.max(60, startWidth.current + delta);
    setColWidths(newWidths);
  };

  const onMouseUp = async () => {
    if (resizingIndex.current !== null) {
      const index = resizingIndex.current;
      const col = columns[index];
      const newWidth = colWidths[index];

      // Alleen de velden die in definition horen
      const newDefinition = {
        name: col.name,
        type: col.type,
        width: newWidth,
        options: col.options || [],
      };

      const { error } = await supabase
        .from("columns")
        .update({ definition: newDefinition })
        .eq("id", col.id);

      if (error) {
        console.error("Update column width error:", error);
      } else {
        // Update state: kolommen + breedtes synchroon houden
        const newCols = [...columns];
        newCols[index] = { ...col, ...newDefinition };
        setColumns(newCols);

        const newWidths = [...colWidths];
        newWidths[index] = newWidth;
        setColWidths(newWidths);
      }
    }

    resizingIndex.current = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  /* ---------- Row actions ---------- */
  const handleAddRow = async (newRow) => {
    const { data, error } = await supabase
      .from("trades")
      .insert([{ data: newRow }])
      .select();

    if (!error && data) {
      setRows((prev) => [...prev, { id: data[0].id, ...data[0].data }]);
    }
  };

  const handleCellChange = async (rowIndex, colName, value) => {
    const updatedRows = [...rows];
    updatedRows[rowIndex][colName] = value;
    setRows(updatedRows);

    if (value === "__new") return;

    const row = updatedRows[rowIndex];
    const { id, ...jsonData } = row;

    const { error } = await supabase
      .from("trades")
      .update({ data: jsonData })
      .eq("id", id);

    if (error) console.error("Update row error:", error);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    const { error } = await supabase
      .from("trades")
      .delete()
      .in("id", selectedRows);

    if (error) {
      console.error("Bulk delete error:", error);
    } else {
      setRows(rows.filter((r) => !selectedRows.includes(r.id)));
      setSelectedRows([]);
    }
  };

  const toggleRowSelection = (rowId) => {
    setSelectedRows(
      (prev) =>
        prev.includes(rowId)
          ? prev.filter((id) => id !== rowId) // verwijderen
          : [...prev, rowId] // toevoegen
    );
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === rows.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(rows.map((r) => r.id));
    }
  };

  /* ---------- Render ---------- */
  return (
    <Wrapper>
      <TableManagementSection>
        <RowFormDrawer columns={columns} onAddRow={handleAddRow} />
        <ColumnFormDrawer
          columns={columns}
          setColumns={setColumns}
          rows={rows}
          setRows={setRows}
        />
      </TableManagementSection>

      {rows.length > 0 && (
        <BulkActions>
          <button onClick={toggleSelectAll}>
            {selectedRows.length === rows.length
              ? "Unselect All"
              : "Select All"}
          </button>
          <button onClick={handleDeleteSelected}>
            Delete Selected ({selectedRows.length})
          </button>
        </BulkActions>
      )}

      <TableWrapper>
        <StyledTable>
          <colgroup>
            <col style={{ width: 40 }} />
            {columns.map((_, i) => (
              <col key={i} style={{ width: colWidths[i] || 150 }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <Th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={
                    selectedRows.length === rows.length && rows.length > 0
                  }
                  onChange={toggleSelectAll}
                />
              </Th>
              {columns.map((col, i) => (
                <Th key={col.id}>
                  {col.name}
                  <Resizer onMouseDown={(e) => onMouseDown(e, i)} />
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                <Td style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onChange={() => toggleRowSelection(row.id)}
                  />
                </Td>

                {columns.map((col) => {
                  const value = row[col.name] ?? "";

                  switch (col.type) {
                    case "date":
                      return (
                        <Td key={col.id}>
                          <input
                            type="date"
                            value={value || ""}
                            onChange={(e) =>
                              handleCellChange(
                                rowIndex,
                                col.name,
                                e.target.value
                              )
                            }
                          />
                        </Td>
                      );

                    case "time":
                      return (
                        <Td key={col.id}>
                          <input
                            type="time"
                            value={value || ""}
                            onChange={(e) =>
                              handleCellChange(
                                rowIndex,
                                col.name,
                                e.target.value
                              )
                            }
                          />
                        </Td>
                      );

                    case "number":
                      return (
                        <Td key={col.id}>
                          <input
                            type="number"
                            value={value ?? ""} // voorkomt uncontrolled → controlled warning
                            onChange={(e) =>
                              handleCellChange(
                                rowIndex,
                                col.name,
                                e.target.value === ""
                                  ? null
                                  : e.target.valueAsNumber
                              )
                            }
                          />
                        </Td>
                      );

                    case "boolean":
                      return (
                        <Td key={col.id}>
                          <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) =>
                              handleCellChange(
                                rowIndex,
                                col.name,
                                e.target.checked
                              )
                            }
                          />
                        </Td>
                      );

                    case "select":
                      return (
                        <Td key={col.id}>
                          <select
                            value={value || ""}
                            onChange={async (e) => {
                              const v = e.target.value;
                              if (v === "__new") {
                                const newVal = prompt(
                                  "Nieuwe waarde toevoegen:"
                                );
                                if (newVal) {
                                  const newOptions = [
                                    ...(col.options || []),
                                    newVal,
                                  ];

                                  // update in supabase
                                  await supabase
                                    .from("columns")
                                    .update({
                                      definition: {
                                        name: col.name,
                                        type: col.type,
                                        width: col.width,
                                        options: newOptions,
                                      },
                                    })
                                    .eq("id", col.id);

                                  // update in state
                                  setColumns((prev) =>
                                    prev.map((c) =>
                                      c.id === col.id
                                        ? { ...c, options: newOptions }
                                        : c
                                    )
                                  );

                                  handleCellChange(rowIndex, col.name, newVal);
                                }
                              } else {
                                handleCellChange(rowIndex, col.name, v);
                              }
                            }}
                          >
                            <option value="">-- selecteer --</option>
                            {col.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                            <option value="__new">
                              ➕ Nieuwe waarde toevoegen
                            </option>
                          </select>
                        </Td>
                      );

                    default:
                      return (
                        <Td key={col.id}>
                          <input
                            type="text"
                            value={value || ""}
                            onChange={(e) =>
                              handleCellChange(
                                rowIndex,
                                col.name,
                                e.target.value
                              )
                            }
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                            }}
                          />
                        </Td>
                      );
                  }
                })}
              </tr>
            ))}
          </tbody>
        </StyledTable>
      </TableWrapper>
    </Wrapper>
  );
}

/* ---------------- styled ---------------- */
const Wrapper = styled.div`
  padding: 2rem;
  font-family: "Inter", sans-serif;
  color: #333;
  width: 100%;
`;

const TableManagementSection = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 25%;
`;

const BulkActions = styled.div`
  margin: 1rem 0;
  display: flex;
  gap: 1rem;

  button {
    background: #f3f4f6;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;

    &:hover {
      background: #e5e7eb;
    }
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  margin-top: 1rem;
`;

const StyledTable = styled.table`
  border-spacing: 0;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  table-layout: fixed;
  width: auto;
  min-width: max-content;
`;

const Th = styled.th`
  position: relative;
  background: #f3f4f6;
  text-align: left;
  padding: 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid #e5e7eb;
  white-space: normal;
`;

const Resizer = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 8px;
  cursor: col-resize;
  user-select: none;
  z-index: 10;
`;

const Td = styled.td`
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  vertical-align: middle;

  input,
  select {
    max-width: 100%;
  }
`;

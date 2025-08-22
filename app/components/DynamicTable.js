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
  const startX = useRef(null);
  const startWidth = useRef(null);
  const resizingIndex = useRef(null);

  /* ---------- Load data ---------- */
  const loadRows = async () => {
    const { data, error } = await supabase.from("trades").select("*");
    if (!error) {
      setRows(data.map((d) => ({ id: d.id, ...d.data }))); // uuid id
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
      setColWidths(data.map(() => 150)); // standaard breedte
    }
  };

  useEffect(() => {
    loadRows();
    loadColumns();
  }, []);

  /* ---------- Column resizing ---------- */
  const onMouseDown = (e, index) => {
    e.preventDefault(); // 👉 voorkomt tekstselectie
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

  const onMouseUp = () => {
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

    if (value === "__new") return; // skip tijdelijk "__new"

    const row = updatedRows[rowIndex];
    const { id, ...jsonData } = row;

    const { error } = await supabase
      .from("trades")
      .update({ data: jsonData })
      .eq("id", id);

    if (error) console.error("Update row error:", error);
  };

  const handleDeleteRow = async (rowIndex) => {
    const row = rows[rowIndex];
    const { error } = await supabase.from("trades").delete().eq("id", row.id);

    if (error) {
      console.error("Delete row error:", error);
    } else {
      setRows(rows.filter((_, i) => i !== rowIndex));
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

      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <Th key={col.id} style={{ width: colWidths[i] }}>
                  {col.name}
                  <Resizer onMouseDown={(e) => onMouseDown(e, i)} />
                </Th>
              ))}
              {rows.length > 0 && <Th>Acties</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <Tr key={row.id}>
                {columns.map((col) => (
                  <Td key={col.id}>
                    {col.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={!!row[col.name]}
                        onChange={(e) =>
                          handleCellChange(rIdx, col.name, e.target.checked)
                        }
                      />
                    ) : col.type === "select" ? (
                      <SelectWrapper>
                        <ModernSelect
                          value={row[col.name] ?? ""}
                          onChange={(e) => {
                            if (e.target.value === "__new") {
                              handleCellChange(rIdx, col.name, "__new");
                            } else {
                              handleCellChange(rIdx, col.name, e.target.value);
                            }
                          }}
                        >
                          <option value="">-- Kies --</option>
                          {col.options?.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value="__new">➕ Nieuwe toevoegen...</option>
                        </ModernSelect>
                        <DropdownArrow>▾</DropdownArrow>

                        {row[col.name] === "__new" && (
                          <InlineNewInput
                            type="text"
                            autoFocus
                            placeholder="Nieuwe optie..."
                            onKeyDown={(e) =>
                              e.key === "Enter" && e.target.blur()
                            }
                            onBlur={async (e) => {
                              const newOption = e.target.value.trim();
                              if (newOption) {
                                const updatedCols = [...columns];
                                const colIndex = updatedCols.findIndex(
                                  (c) => c.id === col.id
                                );

                                updatedCols[colIndex] = {
                                  ...updatedCols[colIndex],
                                  options: [
                                    ...(updatedCols[colIndex].options || []),
                                    newOption,
                                  ],
                                };
                                setColumns(updatedCols);
                                handleCellChange(rIdx, col.name, newOption);

                                const updatedCol = updatedCols[colIndex];
                                const { error } = await supabase
                                  .from("columns")
                                  .update({
                                    definition: {
                                      name: updatedCol.name,
                                      type: updatedCol.type,
                                      options: updatedCol.options,
                                    },
                                  })
                                  .eq("id", updatedCol.id);

                                if (error)
                                  console.error(
                                    "Update column options error:",
                                    error
                                  );
                              } else {
                                handleCellChange(rIdx, col.name, "");
                              }
                            }}
                          />
                        )}
                      </SelectWrapper>
                    ) : (
                      <CellInput
                        type={col.type}
                        value={row[col.name] ?? ""}
                        onChange={(e) =>
                          handleCellChange(rIdx, col.name, e.target.value)
                        }
                      />
                    )}
                  </Td>
                ))}
                <Td>
                  <DeleteButton onClick={() => handleDeleteRow(rIdx)}>
                    ✕
                  </DeleteButton>
                </Td>
              </Tr>
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

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  margin-top: 1rem;
`;

const StyledTable = styled.table`
  min-width: 600px;
  width: 100%;
  table-layout: fixed;
  border-spacing: 0;
  border-collapse: collapse; /* 👉 belangrijk: geeft grid look */
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  td:not(:has(input)):not(:has(select)) {
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Th = styled.th`
  position: relative;
  background: #f3f4f6;
  text-align: left;
  padding: 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid #e5e7eb; /* 👉 border rondom */
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

const Tr = styled.tr``;

const Td = styled.td`
  padding: 0.75rem;
  border: 1px solid #e5e7eb; /* 👉 border rondom */
  vertical-align: middle;
  white-space: nowrap;
  width: 1%;
  overflow: hidden;
  text-overflow: ellipsis;

  input,
  select {
    max-width: 100%;
    white-space: normal;
    text-overflow: initial;
  }
`;

const CellInput = styled.input`
  width: auto;
  min-width: 0;
  padding: 0.35rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 0.9rem;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: #ef4444;
  font-size: 1rem;
  cursor: pointer;
  &:hover {
    color: #dc2626;
    transform: scale(1.1);
  }
`;

const SelectWrapper = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
`;

const ModernSelect = styled.select`
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;

  width: 100%;
  max-width: 100%;
  padding: 0.35rem 2rem 0.35rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  color: #333;
  cursor: pointer;

  &:hover {
    border-color: #3b82f6;
  }

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px #bfdbfe;
  }
`;

const DropdownArrow = styled.span`
  position: absolute;
  right: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #555;
  font-size: 0.8rem;
  z-index: 2;
`;

const InlineNewInput = styled.input`
  width: 100%;
  margin-top: 4px;
  padding: 0.35rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #f9fafb;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    background: #fff;
    box-shadow: 0 0 0 2px #bfdbfe;
  }
`;

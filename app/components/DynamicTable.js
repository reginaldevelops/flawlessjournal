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
  const updateTimeouts = useRef({});

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
      setColumns(
        data.map((c) => ({
          id: c.id,
          name: c.definition.name,
          type: c.definition.type,
          options: c.definition.options || [],
          width: c.width || 150,
        }))
      );
      setColWidths(data.map((c) => c.width || 150));
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
    const newWidth = Math.max(60, startWidth.current + delta);

    setColumns((prev) =>
      prev.map((c, i) =>
        i === resizingIndex.current ? { ...c, width: newWidth } : c
      )
    );
  };

  const onMouseUp = async (e) => {
    if (resizingIndex.current !== null) {
      const index = resizingIndex.current;
      const col = columns[index];

      // bereken nieuwe breedte rechtstreeks uit de muispositie
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(60, startWidth.current + delta);

      console.log("🔧 Resizing finished:");
      console.log(" - Column:", col.name, `(id: ${col.id})`);
      console.log(" - Old width:", startWidth.current);
      console.log(" - New width (calculated):", newWidth);

      const { error } = await supabase
        .from("columns")
        .update({ width: newWidth })
        .eq("id", col.id);

      if (error) {
        console.error("❌ Update column width error:", error);
      } else {
        console.log("✅ Supabase updated with new width:", newWidth);
      }

      // reset
      resizingIndex.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
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

  const handleCellChange = (rowIndex, colName, value) => {
    const updatedRows = [...rows];
    updatedRows[rowIndex][colName] = value;
    setRows(updatedRows);

    if (value === "__new") return;

    const row = updatedRows[rowIndex];
    const { id, ...jsonData } = row;

    if (updateTimeouts.current[id]) {
      clearTimeout(updateTimeouts.current[id]);
    }

    updateTimeouts.current[id] = setTimeout(async () => {
      const { error } = await supabase
        .from("trades")
        .update({ data: jsonData })
        .eq("id", id);

      if (error) {
        console.error("Update row error:", error);
      } else {
        console.log("Row updated in Supabase:", id);
      }

      delete updateTimeouts.current[id];
    }, 2000);
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
    setSelectedRows((prev) =>
      prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId]
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
            {columns.map((c) => (
              <col key={c.id} style={{ width: c.width || 150 }} />
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
                <Td>
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
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={value || ""}
                            onChange={(e) =>
                              handleCellChange(
                                rowIndex,
                                col.name,
                                e.target.value
                              )
                            }
                            style={{ textAlign: "right" }}
                          />
                        </Td>
                      );

                    case "boolean":
                      return (
                        <Td key={col.id}>
                          <input
                            type="checkbox"
                            checked={value === "true"}
                            onChange={(e) =>
                              handleCellChange(
                                rowIndex,
                                col.name,
                                e.target.checked ? "true" : "false"
                              )
                            }
                          />
                        </Td>
                      );

                    case "select":
                      return (
                        <Td key={col.id}>
                          {value === "__new" ? (
                            <input
                              type="text"
                              autoFocus
                              placeholder="Nieuwe waarde..."
                              onBlur={async (e) => {
                                const newVal = e.target.value.trim();
                                if (!newVal) {
                                  // niets ingevuld → reset
                                  handleCellChange(rowIndex, col.name, "");
                                  return;
                                }

                                // check of waarde al bestaat
                                if (col.options?.includes(newVal)) {
                                  alert("Deze waarde bestaat al.");
                                  handleCellChange(rowIndex, col.name, newVal); // gewoon selecteren
                                  return;
                                }

                                const newOptions = [
                                  ...(col.options || []),
                                  newVal,
                                ];

                                // update in Supabase
                                const { error } = await supabase
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

                                if (error) {
                                  console.error(
                                    "Fout bij opslaan nieuwe optie:",
                                    error
                                  );
                                  return;
                                }

                                // update state
                                setColumns((prev) =>
                                  prev.map((c) =>
                                    c.id === col.id
                                      ? { ...c, options: newOptions }
                                      : c
                                  )
                                );

                                handleCellChange(rowIndex, col.name, newVal);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.target.blur(); // save bij Enter
                              }}
                              style={{
                                width: "100%",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                              }}
                            />
                          ) : (
                            <select
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
                          )}
                        </Td>
                      );

                      return (
                        <Td key={col.id}>
                          {value === "__new" ? (
                            <input
                              type="text"
                              autoFocus
                              placeholder="Nieuwe waarde..."
                              onBlur={async (e) => {
                                const newVal = e.target.value.trim();
                                if (newVal) {
                                  const newOptions = [
                                    ...(col.options || []),
                                    newVal,
                                  ];

                                  // update in Supabase
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

                                  // update state
                                  setColumns((prev) =>
                                    prev.map((c) =>
                                      c.id === col.id
                                        ? { ...c, options: newOptions }
                                        : c
                                    )
                                  );

                                  handleCellChange(rowIndex, col.name, newVal);
                                } else {
                                  // als user niks invult → reset
                                  handleCellChange(rowIndex, col.name, "");
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.target.blur(); // save bij Enter
                              }}
                              style={{
                                width: "100%",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                              }}
                            />
                          ) : (
                            <select
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
                          )}
                        </Td>
                      );

                      return (
                        <Td key={col.id}>
                          <input
                            type="text"
                            list={`datalist-${col.id}`}
                            value={value || ""}
                            onChange={async (e) => {
                              const v = e.target.value;

                              // update cel direct
                              handleCellChange(rowIndex, col.name, v);

                              // check of het een nieuwe optie is
                              if (v && !col.options?.includes(v)) {
                                const newOptions = [...(col.options || []), v];

                                // update in Supabase
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
                              }
                            }}
                            onBlur={(e) => {
                              // bij verlaten cel ook check doen
                              const v = e.target.value;
                              if (v && !col.options?.includes(v)) {
                                handleCellChange(rowIndex, col.name, v);
                              }
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                            }}
                          />
                          <datalist id={`datalist-${col.id}`}>
                            {col.options?.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </Td>
                      );

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
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
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
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
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

                      return (
                        <Td key={col.id}>
                          <input
                            list={`datalist-${col.id}`}
                            value={value || ""}
                            onChange={async (e) => {
                              const v = e.target.value;

                              // Als gebruiker iets nieuws intypt → voeg toe aan opties
                              if (v && !col.options.includes(v)) {
                                const newOptions = [...col.options, v];

                                // update in Supabase
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
                              }

                              // update celwaarde
                              handleCellChange(rowIndex, col.name, v);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                            }}
                          />
                          <datalist id={`datalist-${col.id}`}>
                            {col.options?.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </Td>
                      );

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

                                  await supabase
                                    .from("columns")
                                    .update({
                                      definition: {
                                        name: col.name,
                                        type: col.type,
                                        options: newOptions,
                                      },
                                    })
                                    .eq("id", col.id);

                                  setColumns((prev) =>
                                    prev.map((c, i) =>
                                      i === index
                                        ? { ...c, width: newWidth }
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

  select {
    width: 100%;
  }
`;

"use client";
import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import RowFormDrawer from "./RowFormDrawer";
import ColumnFormDrawer from "./ColumnFormDrawer";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DynamicTable() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [colWidths, setColWidths] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const startX = useRef(null);
  const startWidth = useRef(null);
  const resizingIndex = useRef(null);
  const updateTimeouts = useRef({});
  const router = useRouter();

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

  const loadSort = async () => {
    const { data, error } = await supabase
      .from("table_settings")
      .select("sort_key, sort_direction")
      .eq("id", 1)
      .single();

    if (!error && data) {
      setSortConfig({
        key: data.sort_key,
        direction: data.sort_direction || "asc",
      });
    }
  };

  useEffect(() => {
    loadRows();
    loadColumns();
    loadSort();
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
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(60, startWidth.current + delta);

      console.log("🔧 Resizing finished:");
      console.log(` - Column: ${col.name} (id: ${col.id})`);
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

  const handleCellChange = (rowId, colName, value) => {
    const updatedRows = rows.map((r) =>
      r.id === rowId ? { ...r, [colName]: value } : r
    );
    setRows(updatedRows);

    if (value === "__new") return;

    const row = updatedRows.find((r) => r.id === rowId);
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

  const handleSort = async (col) => {
    setSortConfig((prev) => {
      let newConfig;
      if (prev.key === col.name) {
        newConfig = {
          key: col.name,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      } else {
        newConfig = { key: col.name, direction: "asc" };
      }

      supabase.from("table_settings").upsert({
        id: 1,
        sort_key: newConfig.key,
        sort_direction: newConfig.direction,
      });

      return newConfig;
    });
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

  /* ---------- Sorting ---------- */
  const sortedRows = [...rows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = a[sortConfig.key] ?? "";
    const valB = b[sortConfig.key] ?? "";
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

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
            <col style={{ width: 60 }} />
            {columns.map((c) => (
              <col key={c.id} style={{ width: c.width || 150 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <Th style={{ width: 40 }}>
                <CheckboxInput
                  type="checkbox"
                  checked={
                    selectedRows.length === rows.length && rows.length > 0
                  }
                  onChange={toggleSelectAll}
                />
              </Th>
              {columns.map((col, i) => (
                <Th key={col.id} onClick={() => handleSort(col)}>
                  {col.name}
                  <Resizer onMouseDown={(e) => onMouseDown(e, i)} />
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <Tr
                key={row.id}
                onClick={() => router.push(`/trade/${row.id}`)}
                style={{ cursor: "pointer" }}
              >
                <Td onClick={(e) => e.stopPropagation()}>
                  <CheckboxWrapper>
                    <CheckboxInput
                      type="checkbox"
                      checked={selectedRows.includes(row.id)}
                      onChange={() => toggleRowSelection(row.id)}
                    />
                  </CheckboxWrapper>
                </Td>

                {columns.map((col) => {
                  const value = row[col.name] ?? "";

                  switch (col.type) {
                    case "date":
                      return (
                        <Td key={col.id}>
                          {value
                            ? new Date(value).toLocaleDateString("nl-NL")
                            : "—"}
                        </Td>
                      );

                    case "time":
                      return <Td key={col.id}>{value || "—"}</Td>;

                    case "number":
                      return (
                        <Td key={col.id} style={{ textAlign: "right" }}>
                          {value !== "" ? Number(value) : "—"}
                        </Td>
                      );

                    case "boolean":
                      return (
                        <Td key={col.id}>
                          {value === "true"
                            ? "✅"
                            : value === "false"
                              ? "❌"
                              : "—"}
                        </Td>
                      );

                    case "link":
                      return (
                        <Td
                          key={col.id}
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textAlign: "left",
                            maxWidth: "200px", // pas aan naar wens
                            position: "relative",
                          }}
                          title={value || ""}
                        >
                          {value ? (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                              }}
                            >
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "#0ea5e9",
                                  textDecoration: "underline",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "160px", // laat ruimte voor icoon
                                  display: "inline-block",
                                }}
                              >
                                {value}
                              </a>
                              <span
                                style={{ fontSize: "1rem", color: "#0ea5e9" }}
                              >
                                🔗
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </Td>
                      );

                    case "select":
                      return <Td key={col.id}>{value || "—"}</Td>;

                    default:
                      return (
                        <Td
                          key={col.id}
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textAlign: "left",
                            lineHeight: "1.4",
                            fontSize: "0.85rem",
                            padding: "0.6rem 0.8rem",
                            color: "#111",
                            maxWidth: "200px", // cutoff breedte
                          }}
                          title={value || ""}
                        >
                          {value || "—"}
                        </Td>
                      );
                  }
                })}
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
  color: #111;
  width: 100%;
  min-height: 100vh;
`;

const TableManagementSection = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.5rem;

  button {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.55rem 1.1rem;
    cursor: pointer;
    color: #111;
    font-weight: 500;
    font-size: 0.85rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.2s;

    &:hover {
      border-color: rgba(0, 200, 255, 0.5);
      color: #0ea5e9;
      box-shadow: 0 2px 6px rgba(0, 200, 255, 0.2);
    }
  }
`;

const BulkActions = styled.div`
  margin: 1rem 0;
  display: flex;
  gap: 0.8rem;

  button {
    background: #fdfdfd;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    color: #111;
    font-size: 0.8rem;
    transition: all 0.2s;

    &:hover {
      border-color: rgba(255, 0, 128, 0.6);
      color: #db2777;
      box-shadow: 0 2px 6px rgba(255, 0, 128, 0.25);
    }
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  margin-top: 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
`;

const StyledTable = styled.table`
  border-spacing: 0;
  border-collapse: collapse;
  width: 100%;
  min-width: max-content;
  table-layout: fixed;
  font-size: 0.9rem;
  color: #111;
  border: 1px solid #e5e7eb;
`;

const Th = styled.th`
  position: relative;
  text-align: left;
  padding: 0.85rem 1rem;
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.3px;
  border: 1px solid #e5e7eb;
  color: #111;
  background: #fafafa;
  white-space: nowrap;
  cursor: pointer;
`;

const Tr = styled.tr`
  background: #ffffff;

  &:hover {
    background: #f3faff;
  }
`;

const Resizer = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 4px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;

  &:hover {
    background: rgba(14, 165, 233, 0.4);
  }
`;

const Td = styled.td`
  padding: 0.9rem 1rem;
  border: 1px solid #e5e7eb;
  transition: background 0.15s;
  text-align: center;

  select,
  input[type="text"],
  input[type="date"],
  input[type="time"],
  input[type="number"] {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: #111;
    font-size: 0.85rem;
  }
`;

const CheckboxWrapper = styled.label`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const CheckboxInput = styled.input.attrs({ type: "checkbox" })`
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;

  &:hover {
    border-color: #0ea5e9;
  }

  &:checked {
    background: #0ea5e9;
    border-color: #0ea5e9;
  }

  &:checked::after {
    content: "✓";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -55%);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
  }
`;

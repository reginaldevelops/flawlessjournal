"use client";

import { useState } from "react";
import styled from "styled-components";
import RowFormDrawer from "./RowFormDrawer";
import ColumnFormDrawer from "./ColumnFormDrawer";

export default function DynamicTable() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);

  // ✅ handler voor rijen
  const handleAddRow = (newRow) => {
    setRows([...rows, newRow]);
  };

  // ✅ handler voor cell updates
  const handleCellChange = (rowIndex, colName, value) => {
    const updatedRows = [...rows];
    updatedRows[rowIndex][colName] = value;
    setRows(updatedRows);
  };

  // ✅ handler voor rijen verwijderen
  const handleDeleteRow = (rowIndex) => {
    setRows(rows.filter((_, i) => i !== rowIndex));
  };

  return (
    <Wrapper>
      <TableManagementSection>
        <RowFormDrawer columns={columns} onAddRow={handleAddRow} />
        <ColumnFormDrawer
          columns={columns}
          onAddColumn={(col) => setColumns([...columns, col])}
          onReorder={(newCols) => setColumns(newCols)}
          onUpdateColumn={(i, updated) => {
            const newCols = [...columns];
            newCols[i] = updated;
            setColumns(newCols);
          }}
          onDeleteColumn={(i) => {
            const newCols = [...columns];
            newCols.splice(i, 1);
            setColumns(newCols);
          }}
        />
      </TableManagementSection>

      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              {columns.map((col) => (
                <Th key={col.name}>{col.name}</Th>
              ))}
              {rows.length > 0 && <Th>Acties</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <Tr key={rIdx}>
                {columns.map((col) => (
                  <Td key={col.name}>
                    {col.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={!!row[col.name]}
                        onChange={(e) =>
                          handleCellChange(rIdx, col.name, e.target.checked)
                        }
                      />
                    ) : col.type === "select" ? (
                      <div style={{ position: "relative" }}>
                        <select
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
                        </select>

                        {row[col.name] === "__new" && (
                          <input
                            type="text"
                            autoFocus
                            placeholder="Nieuwe optie..."
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              marginTop: "4px",
                              padding: "4px 6px",
                              fontSize: "0.85rem",
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.target.blur();
                            }}
                            onBlur={(e) => {
                              const newOption = e.target.value.trim();
                              if (newOption) {
                                const updatedCols = [...columns];
                                const colIndex = updatedCols.findIndex(
                                  (c) => c.name === col.name
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
                              } else {
                                handleCellChange(rIdx, col.name, "");
                              }
                            }}
                          />
                        )}
                      </div>
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
  table-layout: auto;
  border-spacing: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

const Th = styled.th`
  background: #f9fafb;
  text-align: left;
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 1px solid #e5e7eb;
  white-space: normal;
`;

const Tr = styled.tr``;

const Td = styled.td`
  padding: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  width: 1%;
  white-space: normal;
`;

const CellInput = styled.input`
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 0.9rem;
  &:focus {
    outline: none;
    border-color: #3b82f6;
    background: #eff6ff;
  }
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

const Select = styled.select`
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.9rem;
`;

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

      <RowFormDrawer columns={columns} onAddRow={handleAddRow} />

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
                    <CellInput
                      type={col.type === "boolean" ? "text" : col.type}
                      value={row[col.name] ?? ""}
                      onChange={(e) =>
                        handleCellChange(rIdx, col.name, e.target.value)
                      }
                    />
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
  padding: 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 1px solid #e5e7eb;
  white-space: normal;
  word-break: break-word;
`;

const Tr = styled.tr`
  &:hover {
    background: #f9fafb;
  }
`;

const Td = styled.td`
  padding: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  width: 1%;
  white-space: normal;
  word-break: break-word;
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

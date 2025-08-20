"use client";

import styled from "styled-components";

export default function JournalTable({
  trades,
  onRowClick,
  selectedIds,
  toggleSelect,
  columns,
}) {
  return (
    <ScrollContainer>
      <StyledTable>
        <thead>
          <tr>
            <th></th>
            {columns
              .filter((c) => c.visible)
              .map((col) => (
                <th key={col.id}>{col.label}</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 ? (
            <tr>
              <td colSpan={columns.filter((c) => c.visible).length + 1}>
                No trades yet
              </td>
            </tr>
          ) : (
            trades.map((t) => (
              <tr key={t.id} onClick={() => onRowClick(t)}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => toggleSelect(t.id)}
                  />
                </td>
                {columns
                  .filter((c) => c.visible)
                  .map((col) => (
                    <td key={col.id}>{t[col.id] || ""}</td>
                  ))}
              </tr>
            ))
          )}
        </tbody>
      </StyledTable>
    </ScrollContainer>
  );
}

/* === Styles === */

const ScrollContainer = styled.div`
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #ddd;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;

  th,
  td {
    padding: 0.8rem 1.2rem; /* ✅ wider padding */
    border: 1px solid #ddd;
    text-align: center;
    white-space: nowrap;
  }

  th {
    background: #f0f0f0;
    font-weight: bold;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  tbody tr {
    background: #fff;
    transition: background 0.2s;
    cursor: pointer;
  }

  tbody tr:nth-child(even) {
    background: #fafafa;
  }

  tbody tr:hover {
    background: #eaeaea;
  }

  input[type="checkbox"] {
    cursor: pointer;
  }
`;

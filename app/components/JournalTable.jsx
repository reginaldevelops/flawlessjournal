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
            <th>Select / Edit</th>
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
              <tr key={t.id}>
                <td>
                  <RowTools>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggleSelect(t.id)}
                    />
                    <EditBtn onClick={() => onRowClick(t)}>✏️</EditBtn>
                  </RowTools>
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
  font-size: inherit;

  th,
  td {
    padding: 0.8rem 1.2rem;
    border: 1px solid
      ${(p) => (p.theme.background === "#171717" ? "#444" : "#ddd")};
    text-align: center;
    white-space: nowrap;
  }

  th {
    background: ${(p) =>
      p.theme.background === "#171717" ? "#222" : "#f0f0f0"};
    font-weight: bold;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  tbody tr {
    background: ${(p) =>
      p.theme.background === "#171717" ? "#1e1e1e" : "#fff"};
    transition: background 0.2s;
  }

  tbody tr:nth-child(even) {
    background: ${(p) =>
      p.theme.background === "#171717" ? "#2a2a2a" : "#fafafa"};
  }

  tbody tr:hover {
    background: ${(p) =>
      p.theme.background === "#171717" ? "#333" : "#eaeaea"};
  }

  input[type="checkbox"] {
    cursor: pointer;
  }
`;

const RowTools = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
`;

const EditBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem;

  &:hover {
    opacity: 0.8;
  }
`;

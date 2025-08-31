"use client";
import { useState, useEffect } from "react";
import styled from "styled-components";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DynamicTable2() {
  const [rows, setRows] = useState([]);
  const [visibleCols, setVisibleCols] = useState([]);
  const [allCols, setAllCols] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [variables, setVariables] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]); // ✅ geselecteerde trades
  const [bulkOpen, setBulkOpen] = useState(false); // ✅ bulk menu
  const [sortConfig, setSortConfig] = useState({
    key: "Datum",
    direction: "desc",
  });
  const router = useRouter();

  const fixedCols = [
    "Trade Number",
    "Coins",
    "Datum",
    "Entreetijd",
    "Chart",
    "USDT.D chart",
    "Confidence",
    "Target Win",
    "Target loss",
    "Reasons for entry",
    "PnL",
    "Result",
    "Tags",
  ];

  const loadVariables = async () => {
    const { data, error } = await supabase.from("trade_variables").select("*");
    if (!error && data) setVariables(data.map((v) => v.name));
  };

  const loadRows = async () => {
    const { data, error } = await supabase.from("trades").select("*");
    if (!error && data) {
      const parsed = data.map((d) => {
        const base = {
          id: d.id,
          "Trade Number": d.trade_number,
          Coins: d.data?.Coins,
          Datum: d.data?.Datum,
          Entreetijd: d.data?.Entreetijd,
          "Time exit": d.data?.["Time exit"],
          Chart: d.data?.Chart,
          "USDT.D chart": d.data?.["USDT.D chart"],
          Confidence: d.data?.Confidence,
          "Target Win": d.data?.["Target Win"],
          "Target loss": d.data?.["Target loss"],
          "Reasons for entry": d.data?.["Reasons for entry"],
          PnL: d.data?.PNL,
          Result: d.data?.Result,
          Tags: d.data?.tags || [],
        };
        variables.forEach((v) => {
          base[v] = d.data?.[v] || "";
        });
        return base;
      });

      setRows(parsed);
      setAllCols([...fixedCols, ...variables]);
    }
  };

  const loadVisibleCols = async (allColumns) => {
    const { data, error } = await supabase
      .from("table_settings")
      .select("visible_columns")
      .eq("id", 1)
      .single();

    if (!error && data?.visible_columns) {
      setVisibleCols(data.visible_columns);
    } else {
      setVisibleCols(allColumns);
      await supabase
        .from("table_settings")
        .upsert({ id: 1, visible_columns: allColumns })
        .select();
    }
  };

  const toggleCol = async (col) => {
    const updated = visibleCols.includes(col)
      ? visibleCols.filter((c) => c !== col)
      : [...visibleCols, col];
    setVisibleCols(updated);
    await supabase
      .from("table_settings")
      .upsert({ id: 1, visible_columns: updated })
      .select();
  };

  useEffect(() => {
    loadVariables();
  }, []);

  useEffect(() => {
    if (variables.length >= 0) {
      loadRows().then(() => {
        const combinedCols = [...fixedCols, ...variables];
        loadVisibleCols(combinedCols);
      });
    }
  }, [variables]);

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = a[sortConfig.key] ?? "";
    const valB = b[sortConfig.key] ?? "";
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (col) => {
    setSortConfig((prev) =>
      prev.key === col
        ? { key: col, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key: col, direction: "asc" }
    );
  };

  const addTrade = async () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newTrade = {
      data: {
        Coins: "",
        Datum: date,
        Entreetijd: time,
        "Time exit": "",
        Chart: "",
        "USDT.D chart": "",
        Confidence: "",
        "Target Win": "",
        "Target loss": "",
        "Reasons for entry": "",
        PNL: "",
        Result: "",
        tags: [],
      },
    };

    const { data, error } = await supabase
      .from("trades")
      .insert([newTrade])
      .select();

    if (error) return console.error("❌ Error adding trade:", error);
    if (data && data.length > 0) router.push(`/trade/${data[0].id}`);
  };

  const bulkDelete = async () => {
    if (!confirm("Delete selected trades?")) return;

    const { error } = await supabase
      .from("trades")
      .delete()
      .in("id", selectedRows);

    if (error) return console.error("❌ Bulk delete error:", error);

    setRows((prev) => prev.filter((r) => !selectedRows.includes(r.id)));
    setSelectedRows([]);
    setBulkOpen(false);
  };

  return (
    <Wrapper>
      <TableManagement>
        <AddTradeButton onClick={addTrade}>+ Add Trade</AddTradeButton>
        <RightControls>
          <BulkWrapper>
            <BulkButton onClick={() => setBulkOpen(!bulkOpen)}>
              Bulk actions ▾
            </BulkButton>
            {bulkOpen && (
              <BulkMenu>
                <button onClick={bulkDelete} style={{ color: "red" }}>
                  🗑 Delete trades
                </button>
              </BulkMenu>
            )}
          </BulkWrapper>
          <GearButton onClick={() => setShowModal(true)}>⚙️</GearButton>
        </RightControls>
      </TableManagement>

      {showModal && (
        <ModalOverlay>
          <ModalContent>
            <h3>Select columns</h3>
            <div className="grid">
              {allCols.map((col) => (
                <label key={col}>
                  <input
                    type="checkbox"
                    checked={visibleCols.includes(col)}
                    onChange={() => toggleCol(col)}
                  />
                  {col}
                </label>
              ))}
            </div>
            <ModalFooter>
              <button onClick={() => setVisibleCols(allCols)}>All</button>
              <button onClick={() => setVisibleCols([])}>None</button>
              <button onClick={() => setVisibleCols(fixedCols)}>Default</button>
              <div className="spacer" />
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button
                onClick={async () => {
                  await supabase
                    .from("table_settings")
                    .upsert({ id: 1, visible_columns: visibleCols })
                    .select();
                  setShowModal(false);
                }}
              >
                Update
              </button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              <Th>
                <input
                  type="checkbox"
                  checked={
                    selectedRows.length === rows.length && rows.length > 0
                  }
                  onChange={(e) =>
                    setSelectedRows(
                      e.target.checked ? rows.map((r) => r.id) : []
                    )
                  }
                />
              </Th>
              {visibleCols.map((col) => (
                <Th key={col} onClick={() => handleSort(col)}>
                  {col}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows((prev) => [...prev, row.id]);
                      } else {
                        setSelectedRows((prev) =>
                          prev.filter((id) => id !== row.id)
                        );
                      }
                    }}
                  />
                </Td>
                {visibleCols.map((col) => {
                  const val = row[col];
                  if (col === "PnL") {
                    return (
                      <Td key={col} $positive={Number(val) >= 0}>
                        {val ? `$${val}` : "—"}
                      </Td>
                    );
                  }
                  if (col === "Tags") {
                    return (
                      <Td key={col}>
                        {Array.isArray(val) && val.length > 0
                          ? val.map((t) => <Tag key={t}>{t}</Tag>)
                          : "—"}
                      </Td>
                    );
                  }
                  return (
                    <Td
                      key={col}
                      onClick={() => router.push(`/trade/${row.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      {val || "—"}
                    </Td>
                  );
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
  margin: 1rem;
  background: #fff;
  border-radius: 20px;
`;
const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
`;
const StyledTable = styled.table`
  border-spacing: 0;
  border-collapse: collapse;
  width: 100%;
  table-layout: auto;
  font-size: 0.9rem;
  color: #111;
`;
const Th = styled.th`
  text-align: left;
  padding: 0.8rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
`;
const Tr = styled.tr`
  &:hover {
    background: #f9fafb;
  }
`;
const Td = styled.td`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: ${({ $positive }) =>
    $positive === undefined ? "#111" : $positive ? "#16a34a" : "#dc2626"};
`;
const Tag = styled.span`
  background: #e0f2fe;
  color: #0369a1;
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  margin-right: 0.3rem;
`;
const AddTradeButton = styled.button`
  margin-right: 1rem;
  background: #0ea5e9;
  color: #fff;
  font-size: 0.9rem;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  &:hover {
    background: #0284c7;
  }
`;
const GearButton = styled.button`
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
`;
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
`;
const ModalContent = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  h3 {
    margin-bottom: 1rem;
    font-size: 1rem;
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
`;
const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  .spacer {
    flex-grow: 1;
  }
  button {
    padding: 0.4rem 0.8rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  button:hover {
    background: #f3f4f6;
  }
`;
const TableManagement = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 10px 0px;
`;
const RightControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;
const BulkWrapper = styled.div`
  position: relative;
`;
const BulkButton = styled.button`
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
  &:hover {
    background: #f3f4f6;
  }
`;
const BulkMenu = styled.div`
  position: absolute;
  right: 0;
  top: 2.2rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 20;
  button {
    background: none;
    border: none;
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    cursor: pointer;
    text-align: left;
    &:hover {
      background: #f3f4f6;
    }
  }
`;

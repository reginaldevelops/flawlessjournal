"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DynamicTable2({ rows: initialRows, variables }) {
  const [rows, setRows] = useState(initialRows || []);
  const [visibleCols, setVisibleCols] = useState([]);
  const [allCols, setAllCols] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: "Datum",
    direction: "desc",
  });
  const router = useRouter();
  const rowsPerPage = 20;

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

  useEffect(() => {
    const cols = [...fixedCols, ...variables];
    setAllCols(cols);
    loadVisibleCols(cols);
  }, [variables]);

  useEffect(() => {
    setRows(initialRows || []);
  }, [initialRows]);

  const loadVisibleCols = async (allColumns) => {
    const { data, error } = await supabase
      .from("table_settings")
      .select("visible_columns, sort_key, sort_direction")
      .eq("id", 1)
      .single();

    if (!error && data) {
      setVisibleCols(data.visible_columns || allColumns);
      setSortConfig({
        key: data.sort_key || "Datum",
        direction: data.sort_direction || "desc",
      });
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

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = a[sortConfig.key] ?? "";
    const valB = b[sortConfig.key] ?? "";
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentRows = sortedRows.slice(startIndex, endIndex);

  const handleSort = async (col) => {
    setSortConfig((prev) => {
      const newConfig =
        prev.key === col
          ? { key: col, direction: prev.direction === "asc" ? "desc" : "asc" }
          : { key: col, direction: "asc" };

      (async () => {
        await supabase
          .from("table_settings")
          .upsert({
            id: 1,
            sort_key: newConfig.key,
            sort_direction: newConfig.direction,
          })
          .select();
      })();

      return newConfig;
    });
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
    <div className="p-8 m-4 rounded-2xl bg-inherit">
      {/* Top controls */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={addTrade}
          className="mr-2 bg-green-600 hover:bg-green-700 text-white text-base px-3 py-1 rounded-lg"
        >
          + Add Trade
        </button>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setBulkOpen(!bulkOpen)}
              className="bg-gray-50 border border-gray-300 rounded px-3 py-1 text-sm hover:bg-gray-100"
            >
              Bulk actions ▾
            </button>
            {bulkOpen && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 shadow-md rounded flex flex-col">
                <button
                  onClick={bulkDelete}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  🗑 Delete trades
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setShowModal(true)} className="text-xl">
            ⚙️
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">Select columns</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {allCols.map((col) => (
                <label key={col} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleCols.includes(col)}
                    onChange={() => toggleCol(col)}
                  />
                  {col}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setVisibleCols(allCols)}>All</button>
              <button onClick={() => setVisibleCols([])}>None</button>
              <button onClick={() => setVisibleCols(fixedCols)}>Default</button>
              <div className="flex-grow" />
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button
                onClick={async () => {
                  await supabase
                    .from("table_settings")
                    .upsert({ id: 1, visible_columns: visibleCols })
                    .select();
                  setShowModal(false);
                }}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto border rounded-lg bg-white">
        <table className="w-full text-sm text-gray-900">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-6 py-4 border-b">
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
              </th>
              {visibleCols.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-2 border-b font-semibold cursor-pointer"
                >
                  {col}{" "}
                  {sortConfig.key === col
                    ? sortConfig.direction === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 border-b">
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
                </td>
                {visibleCols.map((col) => {
                  const val = row[col];
                  if (col === "PnL") {
                    return (
                      <td
                        key={col}
                        className={`px-4 py-2 border-b ${
                          Number(val) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {val ? `$${val}` : "—"}
                      </td>
                    );
                  }
                  if (col === "Tags") {
                    return (
                      <td key={col} className="px-4 py-2 border-b">
                        {Array.isArray(val) && val.length > 0
                          ? val.map((t) => (
                              <span
                                key={t}
                                className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded mr-1"
                              >
                                {t}
                              </span>
                            ))
                          : "—"}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col}
                      onClick={() => router.push(`/trade/${row.id}`)}
                      className="px-4 py-2 border-b cursor-pointer"
                    >
                      {val || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 text-sm text-gray-600">
          <span>
            {startIndex + 1} – {Math.min(endIndex, sortedRows.length)} of{" "}
            {sortedRows.length} trades
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-2 py-1 border rounded disabled:text-gray-400 disabled:bg-gray-50"
            >
              ‹
            </button>
            <span>
              {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-2 py-1 border rounded disabled:text-gray-400 disabled:bg-gray-50"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

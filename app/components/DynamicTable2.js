"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  XCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Klein hulpcomponent voor een versleepbaar item in de modal
function SortableColumnItem({ col, visibleCols, toggleCol }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const isVisible = visibleCols.includes(col);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 rounded-xl border transition ${
        isDragging
          ? "bg-slate-100 border-slate-300 shadow-md"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5"
        >
          <GripVertical size={16} />
        </button>
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 truncate select-none">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={() => toggleCol(col)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <span className="truncate">{col}</span>
        </label>
      </div>
    </div>
  );
}

function getTradeStatus(row, variables) {
  const preVars = variables.filter((v) => v.phase === "pre" && v.visible);
  const postVars = variables.filter((v) => v.phase === "post" && v.visible);

  const isFilled = (v) => {
    const val = row[v.name];
    return val !== null && val !== undefined && val !== "";
  };

  const allPreFilled = preVars.every(isFilled);
  const allPostFilled = postVars.every(isFilled);
  const pnlFilled = isFilled({ name: "PnL" }) || isFilled({ name: "PNL" });

  if (!allPreFilled)
    return { icon: XCircle, color: "text-red-600", label: "Incomplete" };
  if (allPreFilled && !allPostFilled && !pnlFilled)
    return { icon: Clock, color: "text-gray-600", label: "Open" };
  if (pnlFilled && !allPostFilled)
    return {
      icon: AlertTriangle,
      color: "text-orange-500",
      label: "Needs Review",
    };
  if (allPreFilled && allPostFilled)
    return { icon: CheckCircle, color: "text-emerald-600", label: "Completed" };

  return { icon: Clock, color: "text-gray-600", label: "Open" };
}

export default function DynamicTable2({ rows: initialRows, variables }) {
  const [rows, setRows] = useState(initialRows || []);
  const [visibleCols, setVisibleCols] = useState([]);
  const [allCols, setAllCols] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: "",
    direction: "desc",
  });
  const router = useRouter();
  const rowsPerPage = 10;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function getCellValue(row, col) {
    if (row[col] !== undefined && row[col] !== null) return row[col];
    if (row.data && row.data[col] !== undefined && row.data[col] !== null)
      return row.data[col];
    return null;
  }

  useEffect(() => {
    const variableNames = variables.map((v) => v?.name).filter(Boolean);

    const keysFromRows = new Set();
    (initialRows || []).forEach((row) => {
      if (row.data) {
        Object.keys(row.data).forEach((k) => keysFromRows.add(k));
      }
      Object.keys(row).forEach((k) => {
        if (k !== "id" && k !== "data") keysFromRows.add(k);
      });
    });

    const combinedCols = [
      ...new Set([...variableNames, ...Array.from(keysFromRows)]),
    ];
    setAllCols(combinedCols);
    loadVisibleCols(combinedCols);
  }, [variables, initialRows]);

  useEffect(() => {
    setRows(initialRows || []);
  }, [initialRows]);

  const loadVisibleCols = async (allColumns) => {
    const { data, error } = await supabase
      .from("table_settings")
      .select("visible_columns, sort_key, sort_direction")
      .eq("id", 1)
      .single();

    if (!error && data && data.visible_columns?.length > 0) {
      // Zorg ervoor dat eventuele nieuwe kolommen die nog niet in settings staan achteraan worden toegevoegd
      const savedCols = data.visible_columns;
      const mergedCols = [
        ...savedCols,
        ...allColumns.filter((c) => !savedCols.includes(c)),
      ];
      setVisibleCols(mergedCols);

      // Update ook meteen de allCols volgorde als we opgeslagen volgorde hebben
      setAllCols(mergedCols);

      setSortConfig({
        key: data.sort_key || allColumns[0] || "",
        direction: data.sort_direction || "desc",
      });
    } else {
      setVisibleCols(allColumns);
      setSortConfig((prev) => ({ ...prev, key: allColumns[0] || "" }));
      await supabase
        .from("table_settings")
        .upsert({ id: 1, visible_columns: allColumns })
        .select();
    }
  };

  const toggleCol = (col) => {
    const updated = visibleCols.includes(col)
      ? visibleCols.filter((c) => c !== col)
      : [...visibleCols, col];
    setVisibleCols(updated);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAllCols((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newCols = arrayMove(items, oldIndex, newIndex);
        return newCols;
      });
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = getCellValue(a, sortConfig.key) ?? "";
    const valB = getCellValue(b, sortConfig.key) ?? "";
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage) || 1;
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
        Datum: date,
        Entreetijd: time,
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
    <div className="px-1 py-8 m-4 rounded-2xl bg-inherit">
      {/* Top controls */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={addTrade}
          className="mr-2 bg-green-600 hover:bg-green-700 text-white text-base px-3 py-1.5 rounded-xl font-semibold transition"
        >
          + Add Trade
        </button>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setBulkOpen(!bulkOpen)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Bulk actions ▾
            </button>
            {bulkOpen && (
              <div className="absolute right-0 top-10 bg-white border border-slate-200 shadow-xl rounded-2xl flex flex-col z-10 py-1 min-w-[140px]">
                <button
                  onClick={bulkDelete}
                  className="px-4 py-2 text-xs font-semibold text-red-600 hover:bg-slate-50 text-left transition"
                >
                  🗑 Delete trades
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center text-lg"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Modern DND Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Select columns
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Sleep kolommen om de volgorde aan te passen.
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={allCols.filter(Boolean)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                  {allCols.filter(Boolean).map((col) => (
                    <SortableColumnItem
                      key={col}
                      col={col}
                      visibleCols={visibleCols}
                      toggleCol={toggleCol}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Knoppen onderin */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCols(allCols)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCols([])}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  None
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase
                      .from("table_settings")
                      .upsert({ id: 1, visible_columns: visibleCols })
                      .select();
                    setShowModal(false);
                  }}
                  className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm text-slate-900">
          <thead className="bg-slate-50 text-left border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 w-10">
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
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
              </th>
              <th className="px-4 py-3 font-semibold text-xs text-slate-600 uppercase tracking-wider">
                Status
              </th>

              {visibleCols.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-3 font-semibold text-xs text-slate-600 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
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
          <tbody className="divide-y divide-slate-100">
            {currentRows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50/80 transition-colors"
              >
                <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
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
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                </td>
                <td
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => router.push(`/trade/${row.id}`)}
                >
                  {(() => {
                    const status = getTradeStatus(row, variables);
                    const IconComponent = status.icon;
                    return (
                      <span
                        className={`flex items-center gap-1.5 text-xs font-semibold ${status.color}`}
                      >
                        <IconComponent size={14} />
                        {status.label}
                      </span>
                    );
                  })()}
                </td>

                {visibleCols.map((col) => {
                  const val = getCellValue(row, col);

                  if (col.toLowerCase() === "pnl") {
                    return (
                      <td
                        key={col}
                        onClick={() => router.push(`/trade/${row.id}`)}
                        className={`px-4 py-3 cursor-pointer font-semibold ${
                          Number(val) >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {val !== null && val !== undefined ? `${val}` : "—"}
                      </td>
                    );
                  }

                  if (col.toLowerCase() === "tags") {
                    return (
                      <td
                        key={col}
                        onClick={() => router.push(`/trade/${row.id}`)}
                        className="px-4 py-3 cursor-pointer"
                      >
                        {Array.isArray(val) && val.length > 0
                          ? val.map((t) => (
                              <span
                                key={t}
                                className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-md font-medium mr-1"
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
                      className="px-4 py-3 cursor-pointer truncate max-w-xs text-slate-700"
                    >
                      {val !== null && val !== undefined && val !== ""
                        ? val
                        : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 text-xs font-medium text-slate-600 border-t border-slate-200 bg-slate-50/50">
          <span>
            {sortedRows.length > 0 ? startIndex + 1 : 0} –{" "}
            {Math.min(endIndex, sortedRows.length)} of {sortedRows.length}{" "}
            trades
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-2.5 py-1 border border-slate-200 bg-white rounded-lg disabled:text-slate-300 disabled:bg-slate-50 hover:bg-slate-100 transition"
            >
              ‹
            </button>
            <span className="font-semibold text-slate-700">
              {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-2.5 py-1 border border-slate-200 bg-white rounded-lg disabled:text-slate-300 disabled:bg-slate-50 hover:bg-slate-100 transition"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

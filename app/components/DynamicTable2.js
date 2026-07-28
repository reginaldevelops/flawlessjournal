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
  Settings2,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ListOrdered,
} from "lucide-react";
import { EmptyState } from "./ui";

/** Position / system blobs stored in trades.data — never table columns. */
function isInternalTradeKey(key) {
  if (!key || typeof key !== "string") return true;
  if (key === "id" || key === "data") return true;
  if (key.startsWith("_")) return true; // e.g. _fj
  return false;
}

function formatCellValue(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "object") return null; // never render raw objects/arrays (except tags)
  return val;
}
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
import { getJournalCompletionStatus } from "../lib/tradeCompletion";

/* ------------------------------------------------------------------ */
/* Column display-name overrides — keeps DB keys intact               */
/* ------------------------------------------------------------------ */
const COL_LABELS = {
  Datum: "Date",
  Entreetijd: "Entry time",
  Exittijd: "Exit time",
  Munt: "Coin",
  Richting: "Direction",
  Setup: "Setup",
  Sessie: "Session",
  Risico: "Risk",
  Winst: "Profit",
  Verlies: "Loss",
  Notities: "Notes",
  Opmerkingen: "Remarks",
  Graad: "Grade",
  Tijdframe: "Timeframe",
};

function colLabel(col) {
  return COL_LABELS[col] ?? col;
}

/* ------------------------------------------------------------------ */
/* Drag-sortable column item (dark-themed)                             */
/* ------------------------------------------------------------------ */
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
      className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
        isDragging
          ? "bg-surface-raised border-line-strong shadow-md"
          : "bg-surface border-line hover:border-line-strong"
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-content-subtle hover:text-content-muted cursor-grab active:cursor-grabbing p-0.5"
        >
          <GripVertical size={14} />
        </button>
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-content truncate select-none">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={() => toggleCol(col)}
            className="rounded border-line-strong text-brand focus:ring-brand/50 w-3.5 h-3.5 bg-surface"
          />
          <span className="truncate">{colLabel(col)}</span>
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status helpers                                                      */
/* ------------------------------------------------------------------ */
const STATUS_META = {
  Incomplete: {
    icon: XCircle,
    className: "text-loss",
    bg: "bg-loss/10",
  },
  Open: {
    icon: Clock,
    className: "text-content-muted",
    bg: "bg-surface-raised",
  },
  "Needs Review": {
    icon: AlertTriangle,
    className: "text-warn-fg",
    bg: "bg-warn-soft",
  },
  Completed: {
    icon: CheckCircle,
    className: "text-profit-fg",
    bg: "bg-profit-soft",
  },
};

function getTradeStatus(row, variables) {
  const status = getJournalCompletionStatus(row, variables);
  const map = {
    incomplete: "Incomplete",
    open: "Open",
    in_progress: "Needs Review",
    completed: "Completed",
  };
  return map[status.key] || "Open";
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export default function DynamicTable2({ rows: initialRows, variables }) {
  const [rows, setRows] = useState(initialRows || []);
  const [visibleCols, setVisibleCols] = useState([]);
  const [allCols, setAllCols] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "desc" });
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
        Object.keys(row.data).forEach((k) => {
          if (!isInternalTradeKey(k)) keysFromRows.add(k);
        });
      }
      Object.keys(row).forEach((k) => {
        if (!isInternalTradeKey(k)) keysFromRows.add(k);
      });
    });
    const combinedCols = [
      ...new Set(["Tags", ...variableNames, ...Array.from(keysFromRows)]),
    ].filter((c) => !isInternalTradeKey(c));
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
      const savedCols = data.visible_columns.filter((c) => !isInternalTradeKey(c));
      const mergedCols = [
        ...savedCols,
        ...allColumns.filter((c) => !savedCols.includes(c) && !isInternalTradeKey(c)),
      ];
      setVisibleCols(mergedCols);
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
    setVisibleCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAllCols((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
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
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Prefer writing trade_number when the column exists; fall back otherwise.
    const payloadWithNumber = {
      data: { Datum: date, Entreetijd: time },
    };
    let { data, error } = await supabase
      .from("trades")
      .insert([payloadWithNumber])
      .select();

    if (error && /trade_number|null value|not-null/i.test(error.message ?? "")) {
      // Trigger/column missing — still insert the trade body.
      ({ data, error } = await supabase
        .from("trades")
        .insert([{ data: { Datum: date, Entreetijd: time } }])
        .select());
    }

    if (error) return console.error("Error adding trade:", error);
    if (data && data.length > 0) router.push(`/trade/${data[0].id}`);
  };

  const bulkDelete = async () => {
    if (!confirm("Delete selected trades?")) return;
    const { error } = await supabase
      .from("trades")
      .delete()
      .in("id", selectedRows);
    if (error) return console.error("Bulk delete error:", error);
    setRows((prev) => prev.filter((r) => !selectedRows.includes(r.id)));
    setSelectedRows([]);
    setBulkOpen(false);
  };

  const allSelected = selectedRows.length === rows.length && rows.length > 0;

  return (
    <div>
      {/* Top controls */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={addTrade}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-xs font-semibold hover:bg-brand-hover transition-colors"
        >
          <Plus size={14} aria-hidden />
          Add Trade
        </button>

        <div className="flex items-center gap-2">
          {/* Bulk actions */}
          <div className="relative">
            <button
              onClick={() => setBulkOpen(!bulkOpen)}
              className="h-8 px-3 rounded-md border border-line bg-surface text-content-muted text-xs font-medium hover:bg-surface-hover hover:text-content hover:border-line-strong transition-colors"
            >
              Bulk actions ▾
            </button>
            {bulkOpen && (
              <div className="absolute right-0 top-10 bg-surface-overlay border border-line shadow-lg rounded-xl z-10 py-1 min-w-[140px]">
                <button
                  onClick={bulkDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-loss hover:bg-loss/10 transition-colors"
                >
                  <Trash2 size={13} aria-hidden />
                  Delete trades
                </button>
              </div>
            )}
          </div>

          {/* Column settings */}
          <button
            onClick={() => setShowModal(true)}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-line bg-surface text-content-muted hover:bg-surface-hover hover:text-content hover:border-line-strong transition-colors"
            aria-label="Column settings"
          >
            <Settings2 size={15} aria-hidden />
          </button>
        </div>
      </div>

      {/* Column settings modal */}
      {showModal && (
        <div className="fixed inset-0 bg-canvas/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-line shadow-xl flex flex-col">
            <h2 className="text-base font-semibold text-content mb-0.5">
              Columns
            </h2>
            <p className="text-xs text-content-subtle mb-4">
              Drag to reorder. Toggle to show or hide.
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-6">
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

            <div className="flex items-center justify-between pt-4 border-t border-line mt-auto">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCols(allCols)}
                  className="px-2.5 py-1.5 rounded-md border border-line bg-surface text-content-muted text-xs font-medium hover:bg-surface-hover hover:text-content transition-colors"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCols([])}
                  className="px-2.5 py-1.5 rounded-md border border-line bg-surface text-content-muted text-xs font-medium hover:bg-surface-hover hover:text-content transition-colors"
                >
                  None
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded-md border border-line bg-surface text-content-muted text-xs font-medium hover:bg-surface-hover hover:text-content transition-colors"
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
                  className="px-3.5 py-1.5 rounded-md bg-brand text-brand-fg text-xs font-semibold hover:bg-brand-hover transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {sortedRows.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No trades yet"
          description="Add your first trade to start building your journal."
          compact
          action={
            <button
              type="button"
              onClick={addTrade}
              className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand text-brand-fg text-xs font-semibold hover:bg-brand-hover transition-colors"
            >
              <Plus size={14} aria-hidden />
              Add Trade
            </button>
          }
        />
      ) : (
      <>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelectedRows(
                      e.target.checked ? rows.map((r) => r.id) : []
                    )
                  }
                  className="rounded border-line-strong bg-surface w-3.5 h-3.5 accent-brand"
                />
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-2xs uppercase tracking-wider text-content-subtle whitespace-nowrap">
                Status
              </th>
              {visibleCols.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-2.5 text-left font-medium text-2xs uppercase tracking-wider text-content-subtle cursor-pointer select-none whitespace-nowrap hover:text-content transition-colors group"
                >
                  <span className="inline-flex items-center gap-1">
                    {colLabel(col)}
                    {sortConfig.key === col ? (
                      sortConfig.direction === "asc" ? (
                        <ChevronUp size={11} className="text-brand" />
                      ) : (
                        <ChevronDown size={11} className="text-brand" />
                      )
                    ) : (
                      <ChevronDown size={11} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, i) => {
              const statusKey = getTradeStatus(row, variables);
              const meta = STATUS_META[statusKey] ?? STATUS_META["Open"];
              const StatusIcon = meta.icon;
              const isSelected = selectedRows.includes(row.id);
              return (
                <tr
                  key={row.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open trade ${row["Trade number"] ?? row.id}`}
                  onClick={() => router.push(`/trade/${row.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/trade/${row.id}`);
                    }
                  }}
                  className={`border-b border-line/60 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-brand/5"
                      : "hover:bg-surface-hover"
                  }`}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows((prev) => [...prev, row.id]);
                        } else {
                          setSelectedRows((prev) =>
                            prev.filter((id) => id !== row.id)
                          );
                        }
                      }}
                      className="rounded border-line-strong bg-surface w-3.5 h-3.5 accent-brand"
                    />
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.className}`}
                      title={statusKey}
                    >
                      <StatusIcon size={13} aria-hidden />
                      <span className="hidden sm:inline">{statusKey}</span>
                      <span className="sr-only sm:hidden">{statusKey}</span>
                    </span>
                  </td>

                  {visibleCols.map((col) => {
                    const val = getCellValue(row, col);
                    const colLow = col.toLowerCase();

                    if (colLow === "pnl") {
                      const hasVal = val !== null && val !== undefined && val !== "";
                      const num = hasVal ? Number(val) : 0;
                      return (
                        <td
                          key={col}
                          className={`px-4 py-3 font-semibold font-mono tnum text-sm ${
                            !hasVal
                              ? "text-content-subtle"
                              : num >= 0
                              ? "text-profit-fg"
                              : "text-loss-fg"
                          }`}
                        >
                          {hasVal
                            ? num >= 0
                              ? `+${val}`
                              : `${val}`
                            : <span className="select-none">—</span>}
                        </td>
                      );
                    }

                    if (colLow === "r" || colLow === "r-multiple") {
                      const hasVal = val !== null && val !== undefined && val !== "";
                      const num = hasVal ? Number(val) : 0;
                      return (
                        <td
                          key={col}
                          className={`px-4 py-3 font-mono tnum text-sm ${
                            !hasVal
                              ? "text-content-subtle"
                              : num >= 0
                              ? "text-profit-fg"
                              : "text-loss-fg"
                          }`}
                        >
                          {hasVal ? (num >= 0 ? `+${num}` : `${num}`) : <span className="select-none">—</span>}
                        </td>
                      );
                    }

                    if (colLow === "grade" || colLow === "graad") {
                      const grade = String(val ?? "").trim().toUpperCase();
                      const gradeClass =
                        !grade
                          ? "text-content-subtle"
                          : /^A/.test(grade)
                          ? "text-profit-fg bg-profit-soft"
                          : /^B/.test(grade)
                          ? "text-brand bg-brand/10"
                          : /^C/.test(grade)
                          ? "text-warn-fg bg-warn-soft"
                          : "text-loss-fg bg-loss-soft";
                      return (
                        <td
                          key={col}
                          className="px-4 py-3"
                        >
                          {grade ? (
                            <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-2xs font-bold ${gradeClass}`}>
                              {grade}
                            </span>
                          ) : (
                            <span className="text-content-subtle select-none">—</span>
                          )}
                        </td>
                      );
                    }

                    if (colLow === "tags") {
                      return (
                        <td
                          key={col}
                          className="px-4 py-3"
                        >
                          {Array.isArray(val) && val.length > 0 ? (
                            val.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center bg-brand/10 text-brand text-2xs px-1.5 py-0.5 rounded font-medium mr-1"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-content-subtle">—</span>
                          )}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col}
                        className="px-4 py-3 text-content-muted whitespace-nowrap"
                      >
                        {formatCellValue(val) != null ? (
                          <span className="text-content">{formatCellValue(val)}</span>
                        ) : (
                          <span className="text-content-subtle select-none">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-line">
        <span className="text-xs text-content-subtle">
          {startIndex + 1}–
          {Math.min(endIndex, sortedRows.length)} of {sortedRows.length} trades
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-line text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2.5 py-1 text-xs font-medium text-content-muted">
            {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-line text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Select from "react-select";
import CalendarView from "../components/CalendarView";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import DeepDiveTab from "../components/DeepDiveTab";

/* ---------------- OverviewTab component ---------------- */
function OverviewTab({ startDate, endDate, selectedVariable, selectedValues }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);

      let query = supabase.from("trades").select("data");
      if (startDate) query = query.gte("data->>Datum", startDate);
      if (endDate) query = query.lte("data->>Datum", endDate);
      if (
        selectedVariable &&
        selectedVariable !== "all" &&
        selectedValues.length > 0
      ) {
        query = query.in(`data->>${selectedVariable}`, selectedValues);
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setStats(null);
        setLoading(false);
        return;
      }

      let totalTrades = 0,
        grossProfit = 0,
        grossLoss = 0,
        wins = 0,
        losses = 0,
        maxWin = -Infinity,
        maxLoss = Infinity,
        pnlSeries = [],
        winners = [],
        losers = [];

      let cumulative = 0;
      let peak = 0;
      let maxDrawdown = 0;

      data.forEach((row) => {
        const pnlRaw = row.data?.PNL;
        if (pnlRaw && pnlRaw !== "-") {
          const pnl = parseFloat(pnlRaw);
          if (!isNaN(pnl)) {
            totalTrades++;
            cumulative += pnl;
            pnlSeries.push(cumulative);

            if (pnl > 0) {
              wins++;
              grossProfit += pnl;
              winners.push(pnl);
              if (pnl > maxWin) maxWin = pnl;
            } else {
              losses++;
              grossLoss += pnl;
              losers.push(pnl);
              if (pnl < maxLoss) maxLoss = pnl;
            }

            if (cumulative > peak) peak = cumulative;
            const drawdown = peak - cumulative;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
          }
        }
      });

      const netPnl = grossProfit + grossLoss;
      const winRate =
        totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
      const profitFactor =
        Math.abs(grossLoss) > 0
          ? (grossProfit / Math.abs(grossLoss)).toFixed(2)
          : "∞";
      const avgWinner =
        winners.length > 0
          ? (winners.reduce((a, b) => a + b, 0) / winners.length).toFixed(0)
          : 0;
      const avgLoser =
        losers.length > 0
          ? (
              Math.abs(losers.reduce((a, b) => a + b, 0)) / losers.length
            ).toFixed(0)
          : 0;

      setStats({
        totalTrades,
        wins,
        losses,
        winRate,
        grossProfit,
        grossLoss,
        netPnl,
        profitFactor,
        maxWin: maxWin === -Infinity ? 0 : maxWin,
        maxLoss: maxLoss === Infinity ? 0 : maxLoss,
        maxDrawdown,
        avgWinner,
        avgLoser,
      });
      setLoading(false);
    }

    fetchStats();
  }, [startDate, endDate, selectedVariable, selectedValues]);

  if (loading) return <div>Loading overview...</div>;
  if (!stats) return <div>No trades in this period.</div>;

  return (
    <div className="grid grid-cols-2 gap-6 text-sm text-gray-800">
      <table className="w-full border border-gray-300">
        <tbody>
          <tr className="border-b">
            <td className="p-2">Total Trades</td>
            <td className="p-2 text-right">{stats.totalTrades}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Win Rate</td>
            <td className="p-2 text-right">{stats.winRate}%</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Wins</td>
            <td className="p-2 text-right">{stats.wins}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Losses</td>
            <td className="p-2 text-right">{stats.losses}</td>
          </tr>
          <tr>
            <td className="p-2">Profit Factor</td>
            <td className="p-2 text-right">{stats.profitFactor}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border border-gray-300">
        <tbody>
          <tr className="border-b">
            <td className="p-2">Gross Profit</td>
            <td className="p-2 text-right">€{stats.grossProfit}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Gross Loss</td>
            <td className="p-2 text-right">€{stats.grossLoss}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Net PnL</td>
            <td className="p-2 text-right">€{stats.netPnl}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Max Win</td>
            <td className="p-2 text-right">€{stats.maxWin}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Max Loss</td>
            <td className="p-2 text-right">€{stats.maxLoss}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Max Drawdown</td>
            <td className="p-2 text-right">€{stats.maxDrawdown}</td>
          </tr>
          <tr>
            <td className="p-2">Avg Winner / Loser</td>
            <td className="p-2 text-right">
              €{stats.avgWinner} / €{stats.avgLoser}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- AnalyticsPage ---------------- */
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const [rangeType, setRangeType] = useState("month");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedValue, setSelectedValue] = useState(8);

  const [availableVariables, setAvailableVariables] = useState([]);
  const [variableValues, setVariableValues] = useState([]);

  const [selectedVariable, setSelectedVariable] = useState("all");
  const [selectedValues, setSelectedValues] = useState([]);

  // bereken start en end date
  let startDate, endDate;
  if (rangeType === "month") {
    const start = startOfMonth(new Date(selectedYear, selectedValue, 1));
    const end = endOfMonth(start);
    startDate = format(start, "yyyy-MM-dd");
    endDate = format(end, "yyyy-MM-dd");
  }
  if (rangeType === "week") {
    const firstDay = new Date(selectedYear, 0, 1 + (selectedValue - 1) * 7);
    const start = startOfWeek(firstDay, { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    startDate = format(start, "yyyy-MM-dd");
    endDate = format(end, "yyyy-MM-dd");
  }

  // haal mogelijke variabelen (keys) uit supabase
  useEffect(() => {
    async function fetchVariables() {
      const { data, error } = await supabase
        .from("trades")
        .select("data")
        .limit(1);

      if (error) {
        console.error("Error fetching variables:", error);
        return;
      }

      if (data && data.length > 0) {
        const keys = Object.keys(data[0].data || {});
        setAvailableVariables(keys);
      }
    }
    fetchVariables();
  }, []);

  // haal mogelijke values voor gekozen variable
  useEffect(() => {
    async function fetchValues() {
      if (!selectedVariable || selectedVariable === "all") {
        setVariableValues([]);
        return;
      }

      const { data, error } = await supabase
        .from("trades")
        .select(`data->>"${selectedVariable}"`)
        .not(`data->>"${selectedVariable}"`, "is", null)
        .limit(200);

      if (error) {
        console.error("fetchValues error:", error);
        return;
      }

      // Hier zit de value als onbekende key → pak de eerste property:
      const vals = [
        ...new Set(data.map((row) => Object.values(row)[0]).filter(Boolean)),
      ];

      setVariableValues(vals);
    }

    fetchValues();
  }, [selectedVariable]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "charts", label: "Charts & Analysis" },
    { id: "calendar", label: "Calendar View" },
    { id: "deepdive", label: "Deep Dive" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Analytics</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-6 mb-6">
        {/* Range type */}
        <select
          value={rangeType}
          onChange={(e) => {
            setRangeType(e.target.value);
            setSelectedValue(0);
          }}
          className="border rounded-md px-2 py-1 text-sm"
        >
          <option value="month">Month</option>
          <option value="week">Week</option>
        </select>

        {/* Year */}
        <input
          type="number"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="border rounded-md px-2 py-1 text-sm w-20"
        />

        {/* Value */}
        <select
          value={selectedValue}
          onChange={(e) => setSelectedValue(Number(e.target.value))}
          className="border rounded-md px-2 py-1 text-sm"
        >
          {rangeType === "week"
            ? Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))
            : Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {format(new Date(2000, i, 1), "MMMM")}
                </option>
              ))}
        </select>

        {/* Variable selector */}
        <select
          value={selectedVariable}
          onChange={(e) => {
            setSelectedVariable(e.target.value);
            setSelectedValues([]);
          }}
          className="border rounded-md px-2 py-1 text-sm"
        >
          <option value="all">All</option>
          {availableVariables.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Multi-select for values */}
        {selectedVariable !== "all" && (
          <div className="w-64">
            <Select
              isMulti
              options={variableValues.map((v) => ({ value: v, label: v }))}
              value={selectedValues.map((v) => ({ value: v, label: v }))}
              onChange={(vals) => setSelectedValues(vals.map((v) => v.value))}
              placeholder="Select values..."
              className="text-sm"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-300 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm font-medium ${
              activeTab === tab.id
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          startDate={startDate}
          endDate={endDate}
          selectedVariable={selectedVariable}
          selectedValues={selectedValues}
        />
      )}
      {activeTab === "charts" && (
        <div className="text-gray-600">📊 Charts (coming soon)</div>
      )}
      {activeTab === "calendar" && (
        <CalendarView
          startDate={startDate}
          endDate={endDate}
          selectedVariable={selectedVariable}
          selectedValues={selectedValues}
        />
      )}
      {activeTab === "deepdive" && (
        <div className="text-gray-600">
          <DeepDiveTab
            startDate={startDate}
            endDate={endDate}
            selectedVariable={selectedVariable}
            selectedValues={selectedValues}
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DynamicTable2 from "../components/DynamicTable2";
import CumulativePnLChart from "../components/CumulativePnLChart";
import ProfitFactorCard from "../components/ProfitFactorCard";
import WinRateCard from "../components/WinRateCard";
import AvgWinLossCard from "../components/AvgWinLossCard";

export default function TradeDataPage() {
  const [rows, setRows] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: trades } = await supabase.from("trades").select("*");
      const { data: tradeVars } = await supabase
        .from("trade_variables")
        .select("*");

      const vars = tradeVars?.map((v) => v.name) || [];

      const mapped = trades.map((d) => {
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
        vars.forEach((v) => {
          base[v] = d.data?.[v] || "";
        });
        return base;
      });

      setVariables(vars);
      setRows(mapped);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="flex flex-col items-center">
          <svg
            className="animate-spin h-12 w-12 text-black-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
          <p className="mt-4 text-lg font-semibold text-black">
            Loading trades...
          </p>
        </div>
      </div>
    );
  }

  // ✅ Profit factor berekenen
  const pnlValues = rows.map((r) => Number(r.PnL) || 0);
  const totalWins = pnlValues.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const totalLosses = pnlValues.filter((p) => p < 0).reduce((a, b) => a + b, 0);

  const profitFactor = totalLosses < 0 ? totalWins / Math.abs(totalLosses) : 0;

  function StatCard({ children }) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center h-full w-full">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-8 space-y-8 max-w-6xl mx-auto flex-1 min-h-0 w-full">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Tradelist
        </h1>
      </header>

      {/* Grid met analytics cards */}
      <div className="grid gap-x-10 gap-y-5 grid-cols-2 auto-rows-[200px]">
        <StatCard>
          <CumulativePnLChart rows={rows} />
        </StatCard>
        <StatCard>
          <ProfitFactorCard value={profitFactor} />
        </StatCard>
        <StatCard>
          <WinRateCard rows={rows} />
        </StatCard>
        <StatCard>
          <AvgWinLossCard rows={rows} />
        </StatCard>
      </div>

      {/* Tabel */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <DynamicTable2 rows={rows} variables={variables} />
      </div>
    </div>
  );
}

// max-width: 1256px;
// flex: 1;
// min-height: 0;
// margin: auto;

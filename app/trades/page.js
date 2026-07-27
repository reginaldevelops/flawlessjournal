"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import DynamicTable2 from "../components/DynamicTable2";

export default function TradeDataPage() {
  const [rows, setRows] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Trades ophalen
      const { data: trades, error: tradesError } = await supabase
        .from("trades")
        .select("*");

      if (tradesError) {
        console.error("❌ Error loading trades:", tradesError);
        return;
      }

      // Variables ophalen uit de variables tabel
      const { data: tradeVars, error: varsError } = await supabase
        .from("variables")
        .select("*")
        .order("order", { ascending: true });

      if (varsError) {
        console.error("❌ Error loading variables:", varsError);
        return;
      }

      setVariables(tradeVars || []);

      // Volledig dynamisch mappen op basis van wat er in d.data zit
      const mapped = trades.map((d) => {
        const base = {
          id: d.id,
          ...d.data, // Pakt automatisch alle sleutels die in de JSON van de trade staan
        };

        // Zorg ervoor dat PnL altijd goed gekoppeld is als PNL in data staat
        if (base.PNL !== undefined && base.PnL === undefined) {
          base.PnL = base.PNL;
        }

        return base;
      });

      setRows(mapped);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] md:h-screen md:ml-16 pt-16 md:pt-0">
        <div className="flex flex-col items-center">
          <svg
            className="animate-spin h-12 w-12 text-black"
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <p className="mt-4 text-lg font-semibold text-black">
            Loading trades...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-8 space-y-8 max-w-7xl mx-auto flex-1 min-h-0 w-full">
      <h1>Trades</h1>

      {/* Tabel */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <DynamicTable2 rows={rows} variables={variables} />
      </div>
    </div>
  );
}

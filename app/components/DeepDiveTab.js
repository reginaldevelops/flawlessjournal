import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DeepDiveTab({
  startDate,
  endDate,
  selectedVariable,
  selectedValues,
}) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      if (!selectedVariable || selectedVariable === "all") {
        setChartData([]);
        return;
      }

      let query = supabase.from("trades").select("data");
      if (startDate) query = query.gte("data->>Datum", startDate);
      if (endDate) query = query.lte("data->>Datum", endDate);
      if (selectedValues.length > 0) {
        query = query.in(`data->>${selectedVariable}`, selectedValues);
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        return;
      }

      // group by selectedVariable
      const groups = {};
      data.forEach((row) => {
        const key = row.data?.[selectedVariable];
        const pnl = parseFloat(row.data?.PNL);
        if (!key || isNaN(pnl)) return;

        if (!groups[key]) {
          groups[key] = { value: key, trades: 0, pnl: 0 };
        }
        groups[key].trades++;
        groups[key].pnl += pnl;
      });

      // convert to array for recharts
      const formatted = Object.values(groups).map((g) => ({
        name: g.value,
        Trades: g.trades,
        NetPnL: g.pnl,
      }));

      setChartData(formatted);
    }

    fetchData();
  }, [startDate, endDate, selectedVariable, selectedValues]);

  if (!selectedVariable || selectedVariable === "all") {
    return <div className="text-gray-500">Select a variable to deep-dive.</div>;
  }

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-30}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis />
          <Tooltip />
          <Bar dataKey="NetPnL" fill="#3b82f6" />
          {/* You could also show trades as another bar */}
          {/* <Bar dataKey="Trades" fill="#10b981" /> */}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

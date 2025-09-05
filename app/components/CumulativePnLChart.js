"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function CumulativePnLChart({ rows = [] }) {
  // 🔹 Bereken cumulative PnL obv Trade Number
  let cumulative = 0;
  const data = rows
    .filter((r) => r["Trade Number"] && r.PnL !== undefined)
    .sort((a, b) => a["Trade Number"] - b["Trade Number"])
    .map((r) => {
      const pnl = Number(r.PnL) || 0;
      cumulative += pnl;
      return { trade: r["Trade Number"], pnl: cumulative };
    });

  const netPnl = data.length ? data[data.length - 1].pnl : 0;
  const lineColor = netPnl >= 0 ? "#16a34a" : "#dc2626";

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex flex-col items-start mb-3">
        <p className="text-sm text-gray-500 ">Net cumulative P&amp;L</p>
        <p
          className={`text-2xl font-bold ${
            netPnl < 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          {netPnl < 0 ? "-" : ""}${Math.abs(netPnl).toLocaleString()}
        </p>
      </div>

      {/* Chart */}
      <div className="flex-1 w-full">
        {" "}
        {/* h-48 = 192px */}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#f3f4f6" vertical={false} />
            <XAxis fontSize={0} tickLine={false} axisLine={false} dy={6} />
            <YAxis fontSize={0} tickLine={false} axisLine={false} width={0} />
            <Tooltip
              formatter={(value) => [`$${value.toLocaleString()}`, "PnL"]}
              contentStyle={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
                padding: "2px 4px",
              }}
            />
            <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke={lineColor}
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

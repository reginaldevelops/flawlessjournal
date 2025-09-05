"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function ProfitFactorCard({ value }) {
  const data = [
    { name: "Profit", value: Math.max(value, 0) },
    { name: "Loss", value: Math.max(1 - value, 0) },
  ];
  const COLORS = ["#16a34a", "#dc2626"];

  return (
    <div className="flex w-full h-full items-center justify-between">
      {/* Tekst links */}
      <div className="flex flex-col items-start">
        <p className="text-sm text-gray-500">Profit factor</p>
        <p className="text-2xl font-bold text-gray-900">{value.toFixed(2)}</p>
      </div>

      {/* Chart rechts */}
      <div style={{ width: "100%", maxWidth: 100, height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius="60%"
              outerRadius="100%"
              startAngle={90}
              endAngle={450}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

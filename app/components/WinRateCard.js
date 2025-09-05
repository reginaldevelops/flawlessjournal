"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function WinRateCard({ rows = [] }) {
  const pnlValues = rows.map((r) => Number(r.PnL) || 0);
  const wins = pnlValues.filter((p) => p > 0).length;
  const losses = pnlValues.filter((p) => p < 0).length;
  const total = wins + losses;

  const winRate = total > 0 ? (wins / total) * 100 : 0;

  const data = [
    { name: "Wins", value: wins },
    { name: "Losses", value: losses },
  ];
  const COLORS = ["#16a34a", "#dc2626"];

  return (
    <div className="flex w-full h-full items-center justify-between">
      {/* Tekst links */}
      <div className="flex flex-col items-start">
        <p className="text-sm text-gray-500">Trade win %</p>
        <p className="text-2xl font-bold text-gray-900">
          {winRate.toFixed(0)}%
        </p>
      </div>

      {/* Chart + legend rechts */}
      <div className="flex flex-col items-center leading-tight">
        <div className="w-24 h-20">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                startAngle={180}
                endAngle={0}
                innerRadius="60%"
                outerRadius="100%"
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
        <div className="flex gap-3 text-xs mt-[-20px]">
          <span className="text-green-600">Wins: {wins}</span>
          <span className="text-red-600">Losses: {losses}</span>
        </div>
      </div>
    </div>
  );
}

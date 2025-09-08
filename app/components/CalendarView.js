"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { eachDayOfInterval, format } from "date-fns";

export default function CalendarView({
  startDate,
  endDate,
  selectedVariable,
  selectedValues,
}) {
  const [dailyStats, setDailyStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [dayMetrics, setDayMetrics] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      let query = supabase.from("trades").select("data");
      if (startDate) query = query.gte("data->>Datum", startDate);
      if (endDate) query = query.lte("data->>Datum", endDate);
      if (selectedVariable !== "all" && selectedValues.length > 0) {
        query = query.in(`data->>${selectedVariable}`, selectedValues);
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const daily = {};
      data.forEach((row) => {
        const datum = row.data?.Datum;
        const pnlRaw = row.data?.PNL;
        if (datum && pnlRaw && pnlRaw !== "-") {
          const pnl = parseFloat(pnlRaw);
          if (!isNaN(pnl)) {
            const day = format(new Date(datum), "yyyy-MM-dd");
            if (!daily[day]) daily[day] = { pnl: 0, count: 0, wins: 0 };

            daily[day].pnl += pnl;
            daily[day].count++;
            if (pnl > 0) daily[day].wins++;
          }
        }
      });

      // bereken dag metrics
      const dayKeys = Object.keys(daily);
      if (dayKeys.length > 0) {
        const pnlArr = dayKeys.map((d) => daily[d].pnl);
        const tradeCounts = dayKeys.map((d) => daily[d].count);

        const winningDays = pnlArr.filter((p) => p > 0);
        const losingDays = pnlArr.filter((p) => p < 0);

        const winningDayPct = (
          (winningDays.length / dayKeys.length) *
          100
        ).toFixed(1);
        const avgWinDay = winningDays.length
          ? (
              winningDays.reduce((a, b) => a + b, 0) / winningDays.length
            ).toFixed(0)
          : 0;
        const avgLossDay = losingDays.length
          ? (losingDays.reduce((a, b) => a + b, 0) / losingDays.length).toFixed(
              0
            )
          : 0;
        const avgPerDay = (
          pnlArr.reduce((a, b) => a + b, 0) / dayKeys.length
        ).toFixed(0);
        const biggestWin = Math.max(...pnlArr).toFixed(0);
        const biggestLoss = Math.min(...pnlArr).toFixed(0);
        const avgTradesPerDay = (
          tradeCounts.reduce((a, b) => a + b, 0) / dayKeys.length
        ).toFixed(1);

        setDayMetrics({
          winningDayPct,
          avgWinDay,
          avgLossDay,
          avgPerDay,
          biggestWin,
          biggestLoss,
          avgTradesPerDay,
        });
      } else {
        setDayMetrics(null);
      }

      setDailyStats(daily);
      setLoading(false);
    }

    fetchData();
  }, [startDate, endDate, selectedVariable, selectedValues]);

  if (loading) return <div>Loading calendar...</div>;

  const days = eachDayOfInterval({
    start: new Date(startDate),
    end: new Date(endDate),
  });

  return (
    <div>
      {/* Metrics bovenaan */}
      {dayMetrics && (
        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
          <div className="p-3 bg-white rounded border">
            Winning Days %: <b>{dayMetrics.winningDayPct}%</b>
          </div>
          <div className="p-3 bg-white rounded border">
            Avg $ Winning Day: <b>{dayMetrics.avgWinDay}</b>
          </div>
          <div className="p-3 bg-white rounded border">
            Avg $ Losing Day: <b>{dayMetrics.avgLossDay}</b>
          </div>
          <div className="p-3 bg-white rounded border">
            Avg $ per Day: <b>{dayMetrics.avgPerDay}</b>
          </div>
          <div className="p-3 bg-white rounded border">
            Biggest Win: <b>{dayMetrics.biggestWin}</b>
          </div>
          <div className="p-3 bg-white rounded border">
            Biggest Loss: <b>{dayMetrics.biggestLoss}</b>
          </div>
          <div className="p-3 bg-white rounded border">
            Avg Trades/Day: <b>{dayMetrics.avgTradesPerDay}</b>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const stats = dailyStats[dayKey] || { pnl: 0, count: 0, wins: 0 };

          const pnl = stats.pnl;
          const count = stats.count;
          const winrate =
            count > 0 ? Math.round((stats.wins / count) * 100) : 0;

          const isPositive = pnl > 0;
          const intensity = Math.min(Math.abs(pnl) / 2000, 1);
          const bgColor =
            pnl === 0 ? "bg-white" : isPositive ? "bg-green-200" : "bg-red-200";

          return (
            <div
              key={dayKey}
              className={`h-20 flex flex-col items-center justify-center border ${bgColor} bg-opacity-${Math.floor(
                intensity * 90
              )}`}
            >
              <div className="font-bold">{format(day, "d")}</div>
              <div>{pnl.toFixed(0)}</div>
              {count > 0 && (
                <div className="text-[10px]">
                  {count} trades ({winrate}% WR)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

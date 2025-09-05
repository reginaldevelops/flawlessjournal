"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import AccountValue from "../components/AccountValue";
import NotesArea from "../components/NotesArea";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import BalanceCard from "../components/BalanceCard";

// 📊 Percent van dag
const getPercentOfDay = (date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return ((hours * 60 + minutes) / (24 * 60)) * 100;
};

// 📅 Weeknummer in lokale tijd
function getWeekNumber(d = new Date()) {
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
}

// ⏱ Formatter voor NL-tijd
function formatLocal(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function utcHourToLocal(utcHour) {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.getHours();
}

// 🌍 Sessies
const sessionsUTC = [
  { name: "Tokyo", start: 0, end: 5, color: "#aec6cf" },
  { name: "London", start: 6, end: 10, color: "#991b1b" },
  { name: "New York", start: 12, end: 19, color: "#ffb347" },
  { name: "PH", start: 19, end: 20, color: "#ffb347" },
];

const sessions = sessionsUTC.map((s) => ({
  ...s,
  start: utcHourToLocal(s.start),
  end: utcHourToLocal(s.end),
}));

export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  const [news, setNews] = useState([]);
  const [weeklyPNL, setWeeklyPNL] = useState(null);
  const [trades, setTrades] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [avgWinner, setAvgWinner] = useState(0);
  const [avgLoser, setAvgLoser] = useState(0);
  const [p2g, setP2G] = useState(0);

  const [winners, setWinners] = useState([]);
  const [losers, setLosers] = useState([]);

  const [phantom, setPhantom] = useState(0);
  const [hyper, setHyper] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchBalances() {
      try {
        const resPhantom = await fetch("/api/portfolio", { cache: "no-store" });
        const dataPhantom = await resPhantom.json();
        setPhantom(dataPhantom?.totalUSD ?? 0);
        setLastUpdated(dataPhantom?.cachedAt ?? new Date());

        const resHyper = await fetch("/api/hyperliquid", { cache: "no-store" });
        const dataHyper = await resHyper.json();
        setHyper(dataHyper?.totalUSD ?? 0);
      } catch (err) {
        console.error("Balance fetch error:", err);
      }
    }
    fetchBalances();
  }, []);

  useEffect(() => {
    async function loadWeeklyStats() {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);
      sunday.setHours(23, 59, 59, 999);

      const mondayISO = monday.toISOString().split("T")[0];
      const sundayISO = sunday.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("trades")
        .select("data")
        .gte("data->>Datum", mondayISO)
        .lte("data->>Datum", sundayISO);

      if (error) {
        console.error("Weekly stats error:", error);
        return;
      }

      let totalPNL = 0;
      let totalTrades = 0;
      let wins = 0;
      let winsArr = [];
      let lossArr = [];

      data.forEach((row) => {
        const pnlRaw = row.data?.PNL;
        if (pnlRaw && pnlRaw !== "-") {
          const pnl = parseFloat(pnlRaw);
          if (!isNaN(pnl)) {
            totalTrades++;
            totalPNL += pnl;
            if (pnl > 0) {
              wins++;
              winsArr.push(pnl);
            } else if (pnl < 0) {
              lossArr.push(pnl);
            }
          }
        }
      });

      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const avgWinner =
        winsArr.length > 0
          ? winsArr.reduce((a, b) => a + b, 0) / winsArr.length
          : 0;
      const avgLoser =
        lossArr.length > 0
          ? Math.abs(lossArr.reduce((a, b) => a + b, 0)) / lossArr.length
          : 0;
      const p2gRatio = avgLoser > 0 ? avgWinner / avgLoser : 0;

      setWeeklyPNL(totalPNL);
      setTrades(totalTrades);
      setWinRate(winRate);
      setAvgWinner(avgWinner);
      setAvgLoser(avgLoser);
      setP2G(p2gRatio);
      setWinners(winsArr);
      setLosers(lossArr);
    }

    loadWeeklyStats();
  }, []);

  const currentPercent = getPercentOfDay(now);
  const totalBalance = phantom + hyper;
  const profitTargetPct = 2;
  const targetUSD = (profitTargetPct / 100) * totalBalance;
  const progress = totalBalance > 0 ? (weeklyPNL / targetUSD) * 100 : 0;

  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch("/api/ff-calendar");
        const data = await res.json();
        setNews(data);
      } catch (err) {
        console.error("Error fetching news:", err);
      }
    }
    loadNews();
  }, []);

  return (
    <div className="px-2 py-6 sm:py-8 font-inter text-gray-700 w-full max-w-[1150px] mx-auto rounded-lg">
      <h2 className="text-lg sm:text-xl font-semibold text-slate-800 mb-3">
        WEEK {getWeekNumber(now)}
      </h2>

      {/* 📅 Calendar */}
      <div className="flex justify-between gap-2 sm:gap-3 mb-4">
        {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day, idx) => {
          const today = new Date().getDay();
          const isToday = idx === (today + 6) % 7;

          const monday = new Date(now);
          monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          const thisDay = new Date(monday);
          thisDay.setDate(monday.getDate() + idx);
          const isoDate = thisDay.toISOString().split("T")[0];

          const dayEvents = news.filter((ev) => ev.date === isoDate);

          return (
            <div
              key={idx}
              className={`flex-1 text-center p-2 sm:p-3 rounded-lg flex flex-col items-center min-h-[90px] max-h-[140px] overflow-y-auto no-scrollbar shadow-sm ${
                isToday
                  ? "border border-blue-300 bg-blue-100 text-blue-900 shadow-md"
                  : "border border-gray-200 bg-white text-gray-500"
              }`}
            >
              <div className="mb-1 text-xs sm:text-sm">
                {day} {thisDay.getDate()}
              </div>
              {dayEvents.length > 0 && (
                <div className="text-[0.7rem] sm:text-xs text-left w-full">
                  {dayEvents.map((ev, i) => (
                    <div
                      key={i}
                      className="mt-1 px-2 py-1 rounded bg-slate-100 flex flex-col items-start"
                    >
                      <span className="font-semibold text-green-600 text-[0.65rem] sm:text-[0.7rem]">
                        {ev.datetime
                          ? new Date(ev.datetime).toLocaleTimeString("nl-NL", {
                              timeZone: "Europe/Amsterdam",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ev.time}
                      </span>
                      <span className="text-[0.6rem] sm:text-[0.75rem] leading-tight text-gray-800 break-all">
                        {ev.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 📊 Sessions bar */}
      <div className="mb-4">
        <h2 className="mb-2 text-base sm:text-lg text-slate-800">Sessions</h2>
        <div className="w-full mx-auto relative h-12 bg-slate-100 rounded-lg">
          {sessions.map((s, idx) => {
            let start = s.start * 60;
            let end = s.end * 60;
            if (end <= start) end += 24 * 60;

            const left = (start / (24 * 60)) * 100;
            const width = ((end - start) / (24 * 60)) * 100;

            return (
              <div
                key={idx}
                className="absolute top-2 h-[30px] sm:h-[34px] rounded-md flex items-center justify-center text-[0.65rem] sm:text-xs font-semibold text-gray-800"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: `${s.color}aa`,
                }}
              >
                {s.name}
              </div>
            );
          })}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-amber-500"
            style={{ left: `${currentPercent}%` }}
          />
        </div>
      </div>

      {/* 📈 Stats + Cards */}
      <div className="grid gap-4">
        {/* Weekly Stats + Balance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold text-sm sm:text-base">
              Weekly Stats
            </h3>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col items-center p-1 bg-slate-50 rounded-lg border border-gray-200">
                <span>💰</span>
                <span className="text-[0.65rem] sm:text-xs text-gray-500">
                  PnL
                </span>
                <span className="font-semibold text-xs sm:text-sm">
                  {weeklyPNL !== null ? weeklyPNL.toFixed(0) : "--"}
                </span>
              </div>
              <div className="flex flex-col items-center p-1 bg-slate-50 rounded-lg border border-gray-200">
                <span>📊</span>
                <span className="text-[0.65rem] sm:text-xs text-gray-500">
                  Trades
                </span>
                <span className="font-semibold text-xs sm:text-sm">
                  {trades}
                </span>
              </div>
              <div className="flex flex-col items-center p-1 bg-slate-50 rounded-lg border border-gray-200">
                <span>✅</span>
                <span className="text-[0.65rem] sm:text-xs text-gray-500">
                  WR
                </span>
                <span className="font-semibold text-xs sm:text-sm">
                  {winRate.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* P2G bar */}
            <div className="mt-4">
              <h3 className="mb-1 text-slate-800 font-semibold text-sm sm:text-base">
                P2G Ratio
              </h3>
              <div className="relative h-10 mt-2">
                <div className="absolute top-1/2 left-0 right-0 h-[6px] rounded bg-gradient-to-r from-red-500 via-amber-500 to-green-500" />
                {[0.0, 0.5, 1.0].map((mark, i) => (
                  <div
                    key={i}
                    className="absolute top-7 text-[0.65rem] sm:text-xs text-gray-700"
                    style={{
                      left: `${mark * 100}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {mark.toFixed(1)}
                  </div>
                ))}
                <div
                  className="absolute top-1/2 w-[2px] h-5 bg-gray-900"
                  style={{
                    left: `${Math.min(Math.max((p2g / 1) * 100, 0), 100)}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold text-sm sm:text-base">
              Total Balance
            </h3>
            <BalanceCard
              phantom={phantom}
              hyper={hyper}
              lastUpdated={formatLocal(lastUpdated ?? undefined)}
            />
          </div>
        </div>

        {/* Winners + Losers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold text-sm sm:text-base">
              Weekly Winners
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={winners.map((val, i) => ({ trade: i + 1, value: val }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="trade" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#00ca7d" radius={[4, 4, 0, 0]} />
                <ReferenceLine
                  y={avgWinner}
                  stroke="#000"
                  strokeDasharray="3 3"
                  label={{
                    value: `Avg: $${avgWinner.toFixed(0)}`,
                    position: "top",
                  }}
                />
                <ReferenceLine
                  y={2000}
                  stroke="#166534"
                  strokeWidth={3}
                  ifOverflow="extendDomain"
                  label={{ value: "Target $2000", position: "insideTopRight" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold text-sm sm:text-base">
              Weekly Losers
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={losers.map((val, i) => ({
                  trade: i + 1,
                  value: Math.abs(val),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="trade" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#d4154b" radius={[4, 4, 0, 0]} />
                <ReferenceLine
                  y={avgLoser}
                  stroke="#000"
                  strokeDasharray="3 3"
                  label={{
                    value: `Avg: $${avgLoser.toFixed(0)}`,
                    position: "top",
                  }}
                />
                <ReferenceLine
                  y={2000}
                  stroke="#690202"
                  strokeWidth={3}
                  ifOverflow="extendDomain"
                  label={{ value: "Target $2000", position: "insideTopRight" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Goals + Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold text-sm sm:text-base">
              Weekly Profit Target {profitTargetPct}%
            </h3>
            <div className="relative w-full h-[26px] sm:h-[30px] bg-gray-200 rounded-xl mt-2">
              <div
                className="h-full rounded-xl bg-gradient-to-r from-blue-900 to-green-400 transition-all"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
              <div
                className="absolute top-[6px] sm:top-[7px] text-[0.65rem] sm:text-xs font-semibold text-gray-900"
                style={{
                  left: `${Math.min(Math.max(progress, 0), 100)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {progress.toFixed(0)}%
              </div>
            </div>

            <h3 className="mt-3 mb-2 text-slate-800 font-semibold text-sm sm:text-base">
              Weekly Goals
            </h3>
            <ul className="flex flex-col gap-2">
              <li className="flex items-center gap-2 bg-slate-50 border border-gray-200 p-2 sm:p-3 rounded-lg text-[0.75rem] sm:text-sm text-gray-800 font-medium">
                🎯 Risk <strong>1200$ / 2400$</strong> on B- and B+ setups
              </li>
              <li className="flex items-center gap-2 bg-slate-50 border border-gray-200 p-2 sm:p-3 rounded-lg text-[0.75rem] sm:text-sm text-gray-800 font-medium">
                ⛔ Aim for 15M/1H Highs/lows. Make sure RR is{" "}
                <strong>higher than 0.7 else use a Limit order!</strong>
              </li>
              <li className="flex items-center gap-2 bg-slate-50 border border-gray-200 p-2 sm:p-3 rounded-lg text-[0.75rem] sm:text-sm text-gray-800 font-medium">
                🎯 <strong>Wacht op goede USDT.D bias</strong> en kies coin die
                meest aligned.
              </li>
            </ul>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl shadow">
            <h3 className="mb-2 text-slate-800 font-semibold text-sm sm:text-base">
              Quick Notes
            </h3>
            <NotesArea />
          </div>
        </div>
      </div>
    </div>
  );
}

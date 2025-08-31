"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import Link from "next/link";
import LayoutWrapper from "../components/LayoutWrapper";
import { supabase } from "../lib/supabaseClient";
import AccountValue from "../components/AccountValue";
import NotesArea from "../components/NotesArea";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Line,
} from "recharts";

import BalanceCard from "../components/BalanceCard";

// ⏰ Greeting
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

// 📊 Percent van dag
const getPercentOfDay = (date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return ((hours * 60 + minutes) / (24 * 60)) * 100;
};

function getWeekNumber(d = new Date()) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7; // zondag = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// 📅 Sessie data
const sessions = [
  { name: "Tokyo", start: 1, end: 7, color: "#aec6cf" },
  { name: "London", start: 8, end: 13, color: "#991b1b" },
  { name: "New York", start: 14, end: 20, color: "#ffb347" },
  { name: "PH", start: 21, end: 22, color: "#ffb347" },
];

export default function Dashboard() {
  const greeting = getGreeting();
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
        setLastUpdated(dataPhantom?.cachedAt ?? new Date().toISOString());

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
        if (
          pnlRaw !== undefined &&
          pnlRaw !== null &&
          pnlRaw !== "" &&
          pnlRaw !== "-"
        ) {
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
  const profitTargetPct = 2; // target = 2% van total balance
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
    <LayoutWrapper>
      <Wrapper>
        <Header>
          <h1>{greeting}, Regi.</h1>
        </Header>

        {/* 📅 Weekly Calendar + Nieuws */}
        <SectionTitle>WEEK {getWeekNumber(now)}</SectionTitle>

        <Calendar>
          {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day, idx) => {
            const today = new Date().getDay(); // 0 = zondag
            const isToday = idx === (today + 6) % 7; // maandag=0

            const now = new Date();
            const monday = new Date(now);
            monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            const thisDay = new Date(monday);
            thisDay.setDate(monday.getDate() + idx);
            const isoDate = thisDay.toISOString().split("T")[0];

            const dayEvents = news.filter((ev) => ev.date === isoDate);

            return (
              <Day key={idx} $today={isToday}>
                <div className="day-label">
                  {day} {thisDay.getDate()}
                </div>

                {dayEvents.length > 0 && (
                  <EventsForDay>
                    {dayEvents.map((ev, i) => (
                      <EventItem key={i}>
                        <span className="time">{ev.time}</span>
                        <span className="title">{ev.title}</span>
                      </EventItem>
                    ))}
                  </EventsForDay>
                )}
              </Day>
            );
          })}
        </Calendar>

        {/* 📊 Sessions bar */}
        <Sessions>
          <h2>Sessions</h2>
          <SessionBarWrapper>
            <SessionBar>
              {sessions.map((s, idx) => {
                // start/end zijn in uren → omzetten naar minuten
                const left = ((s.start * 60) / (24 * 60)) * 100;
                const width = ((s.end * 60 - s.start * 60) / (24 * 60)) * 100;

                return (
                  <SessionBlock
                    key={idx}
                    $left={`${left}%`}
                    $width={`${width}%`}
                    $color={s.color}
                  >
                    {s.name}
                  </SessionBlock>
                );
              })}
              <CurrentTime style={{ left: `${currentPercent}%` }} />
            </SessionBar>
          </SessionBarWrapper>
        </Sessions>

        {/* 📈 Summary Stats */}
        <Sections>
          <TwoCol>
            <Card>
              <h3>Weekly Stats</h3>
              <StatsGrid>
                <StatItem>
                  <span className="icon">💰</span>
                  <span className="label">PnL</span>
                  <span className="value">
                    {weeklyPNL !== null
                      ? `$${weeklyPNL.toFixed(0)} | ${((weeklyPNL / totalBalance) * 100).toFixed(1)}%`
                      : "--"}
                  </span>
                </StatItem>
                <StatItem>
                  <span className="icon">📊</span>
                  <span className="label">Trades Taken</span>
                  <span className="value">{trades}</span>
                </StatItem>
                <StatItem>
                  <span className="icon">✅</span>
                  <span className="label">Win Rate</span>
                  <span className="value">{winRate.toFixed(0)}%</span>
                </StatItem>
              </StatsGrid>
              <P2Gsection>
                <h3>P2G Ratio</h3>
                <div
                  style={{
                    position: "relative",
                    height: "40px",
                    marginTop: "10px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      right: 0,
                      height: "6px",
                      borderRadius: "6px",
                      background:
                        "linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)",
                    }}
                  />
                  {[0.5, 1, 1.5].map((mark, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: "28px",
                        left: `${((mark - 0.5) / 1) * 100}%`,
                        transform: "translateX(-50%)",
                        fontSize: "0.8rem",
                        color: "#374151",
                      }}
                    >
                      {mark}
                    </div>
                  ))}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: `${Math.min(((p2g - 0.5) / 1) * 100, 100)}%`,
                      transform: "translate(-50%, -50%)",
                      width: "2px",
                      height: "18px",
                      background: "#111827",
                      boxShadow: "0 0 6px rgba(0, 0, 0, 0.08)",
                    }}
                  />
                </div>
              </P2Gsection>
            </Card>
            <Card>
              <h3>Total Balance</h3>
              <BalanceCard
                phantom={phantom}
                hyper={hyper}
                lastUpdated={lastUpdated}
              />
            </Card>
          </TwoCol>

          {/* 🔥 Nieuwe kaarten */}
          <TwoCol>
            <Card>
              <h3>Weekly Winners</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={winners.map((val, i) => ({ trade: i + 1, value: val }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="trade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#00ca7dff" radius={[4, 4, 0, 0]} />

                  {/* gemiddelde lijn */}
                  <ReferenceLine
                    y={avgWinner}
                    stroke="#000000ff"
                    strokeDasharray="3 3"
                    label={{
                      value: `Avg: $${avgWinner.toFixed(0)}`,
                      position: "top",
                      fill: "#000000ff",
                      fontWeight: "bold",
                      fontSize: 13,
                    }}
                  />

                  {/* target lijn (dik & solid) */}
                  <ReferenceLine
                    y={2500}
                    stroke="#166534"
                    strokeWidth={4}
                    ifOverflow="extendDomain"
                    label={{
                      value: `Target $2500`,
                      position: "insideTopRight",
                      fill: "#166534",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3>Weekly Losers</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={losers.map((val, i) => ({
                    trade: i + 1,
                    value: Math.abs(val),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="trade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#d4154bff" radius={[4, 4, 0, 0]} />

                  {/* gemiddelde lijn */}
                  <ReferenceLine
                    y={avgLoser}
                    stroke="#000000ff"
                    strokeDasharray="3 3"
                    label={{
                      value: `Avg: $${avgLoser.toFixed(0)}`,
                      position: "top",
                      fill: "#000000ff",
                      fontWeight: "bold",
                      fontSize: 13,
                    }}
                  />

                  {/* target lijn (dik & solid) */}
                  <ReferenceLine
                    y={3000}
                    stroke="#991b1b"
                    strokeWidth={4}
                    ifOverflow="extendDomain"
                    label={{
                      value: `Target $3000`,
                      position: "insideTopRight",
                      fill: "#991b1b",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TwoCol>

          {/* 📅 Weekly goals + Notes */}
          <TwoCol>
            <Card>
              <h3>Weekly Profit Target {profitTargetPct}%</h3>
              <ProgressTrack>
                <ProgressFill
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
                <ProgressLabel style={{ left: `${Math.min(progress, 100)}%` }}>
                  {progress.toFixed(0)}%
                </ProgressLabel>
              </ProgressTrack>

              <h3>Weekly Goals</h3>
              <GoalsList>
                <GoalItem>
                  <span className="icon">🎯</span>
                  <span>
                    Risk <strong>1200$ / 2400$</strong> on B- and B+ setups
                  </span>
                </GoalItem>
                <GoalItem>
                  <span className="icon">⛔</span>
                  <span>
                    Aim for 15M/1H Highs/lows . Make sure RR is
                    <strong>higher than 0.5 else use Limit order!</strong>
                  </span>
                </GoalItem>
              </GoalsList>
            </Card>

            <Card>
              <h3>Quick Notes</h3>
              <NotesArea />
            </Card>
          </TwoCol>
        </Sections>
      </Wrapper>
    </LayoutWrapper>
  );
}
/* ---------------- styled ---------------- */
const Wrapper = styled.div`
  padding: 2rem;
  font-family: "Inter", sans-serif;
  color: #374151; /* donkergrijs */
  background: transparent;
  min-height: 96vh;
  max-width: 1256px;
  margin: auto;
`;

const Header = styled.div`
  margin-bottom: 2rem;
  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    color: #1e293b;
  }
`;

const Calendar = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 0.75rem;
`;

const Day = styled.div`
  flex: 1;
  text-align: center;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$today ? "#93c5fd" : "#e5e7eb")};
  background: ${(p) => (p.$today ? "#dbeafe" : "#ffffff")};
  color: ${(p) => (p.$today ? "#1e3a8a" : "#6b7280")};
  font-weight: ${(p) => (p.$today ? "600" : "400")};
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100px;
  box-shadow: ${(p) =>
    p.$today ? "0 2px 6px rgba(59,130,246,0.2)" : "0 1px 3px rgba(0,0,0,0.05)"};

  .day-label {
    margin-bottom: 0.25rem;
    font-size: 0.95rem;
  }
`;

const EventsForDay = styled.div`
  font-size: 0.75rem;
  color: #374151;
  text-align: left;
  width: 100%;
`;

const EventItem = styled.div`
  margin-top: 0.3rem;
  padding: 4px 6px;
  border-radius: 6px;
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  .time {
    font-weight: 600;
    color: #16a34a;
    font-size: 0.7rem;
  }

  .title {
    font-size: 0.75rem;
    line-height: 1.1rem;
    color: #1f2937;
  }
`;

const Sessions = styled.div`
  margin-bottom: 2rem;

  h2 {
    margin-bottom: 0.5rem;
    font-size: 1.2rem;
    color: #1e293b;
  }
`;

const SessionBar = styled.div`
  position: relative;
  height: 50px;
  background: #f3f4f6;
  border-radius: 8px;
`;

const SessionBlock = styled.div`
  position: absolute;
  top: 8px;
  height: 34px;
  border-radius: 6px;
  background: ${(p) => p.$color}aa; /* pastel met transparantie */
  left: ${(p) => p.$left};
  width: ${(p) => p.$width};
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f2937;
`;

const CurrentTime = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #f59e0b; /* amber accent */
`;

const Sections = styled.div`
  display: grid;
  gap: 1.2rem;
`;

const Card = styled.div`
  background: #ffffff;
  padding: 1rem 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  h3 {
    margin-bottom: 0.5rem;
    color: #1e293b;
    font-size: 1.1rem;
  }

  a {
    color: #3b82f6;
    font-weight: 500;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.3rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
`;

const SessionBarWrapper = styled.div`
  width: 100%;
  margin: 0 auto; /* centreren */
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 1rem;
  margin-top: 0.75rem;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem 0.4rem;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  text-align: center;
  transition: all 0.2s;

  &:hover {
    background: #f3f4f6;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }

  .icon {
    font-size: 1.2rem;
    margin-bottom: 0.4rem;
  }

  .label {
    font-size: 0.8rem;
    color: #6b7280;
  }

  .value {
    font-size: 0.9rem;
    font-weight: 600;
    color: #111827;
  }
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const ProgressTrack = styled.div`
  position: relative;
  width: 100%;
  height: 30px;
  background: #e5e7eb;
  border-radius: 12px;
  margin-top: 8px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #0a1cddff, #06eb5aff);
  border-radius: 12px;
  transition: width 0.4s ease;
`;

const ProgressLabel = styled.div`
  position: absolute;
  top: 7px;
  padding-left: 30px;
  transform: translateX(-50%);
  color: #0c0c0cff;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  z-index: 99;
`;

const P2Gsection = styled.div`
  margin-top: 3em;
`;

const GoalsList = styled.ul`
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const GoalItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  font-size: 0.9rem;
  color: #1f2937;
  font-weight: 500;
  transition: all 0.2s;

  .icon {
    font-size: 1.1rem;
  }

  &:hover {
    background: #f3f4f6;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }
`;

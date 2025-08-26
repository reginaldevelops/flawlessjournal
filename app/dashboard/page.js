"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import Link from "next/link";

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

// 📅 Sessie data
const sessions = [
  { name: "Tokyo", start: 1, end: 8, color: "#aec6cf" },
  { name: "London", start: 8, end: 14, color: "#cfcfc4" },
  { name: "New York", start: 14, end: 22, color: "#ffb347" },
];

export default function Dashboard() {
  const greeting = getGreeting();
  const [now, setNow] = useState(new Date());
  const [news, setNews] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const currentPercent = getPercentOfDay(now);

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
    <Wrapper>
      <Header>
        <h1>{greeting}, Regi.</h1>
      </Header>

      {/* 📅 Weekly Calendar + Nieuws */}
      <Calendar>
        {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day, idx) => {
          const today = new Date().getDay(); // 0 = zondag
          const isToday = idx === (today + 6) % 7; // maandag=0

          // bereken ISO date voor deze dag van deze week
          const now = new Date();
          const monday = new Date(now);
          monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          const thisDay = new Date(monday);
          thisDay.setDate(monday.getDate() + idx);
          const isoDate = thisDay.toISOString().split("T")[0];

          const dayEvents = news.filter((ev) => ev.date === isoDate);

          return (
            <Day key={idx} $today={isToday}>
              <div className="day-label">{day}</div>
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
        <h2>Sessies</h2>
        <TimeAxis>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i}>{i * 2}h</span>
          ))}
        </TimeAxis>
        <SessionBar>
          {sessions.map((s, idx) => (
            <SessionBlock
              key={idx}
              $left={`${(s.start / 24) * 100}%`}
              $width={`${((s.end - s.start) / 24) * 100}%`}
              $color={s.color}
            >
              {s.name}
            </SessionBlock>
          ))}
          <CurrentTime style={{ left: `${currentPercent}%` }} />
        </SessionBar>
      </Sessions>

      {/* 📂 Sections */}
      <Sections>
        <Card>
          <h3>Trades</h3>
          <Link href="/trade-data">Ga naar Trade Data</Link>
        </Card>

        <Card>
          <h3>Journal</h3>
          <Link href="/journal">Ga naar Journal</Link>
          <QuickEntry
            placeholder="Snelle journal entry..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                console.log("Save quick entry:", e.target.value);
                e.target.value = "";
              }
            }}
          />
        </Card>
      </Sections>
    </Wrapper>
  );
}

/* ---------------- styled ---------------- */
const Wrapper = styled.div`
  padding: 2rem;
  font-family: "Inter", sans-serif;
  color: #e5e7eb;
  background: #0b0b0d;
  min-height: 100vh;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Calendar = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 0.5rem;
`;

const Day = styled.div`
  flex: 1;
  text-align: center;
  padding: 0.5rem;
  border-radius: 6px;
  background: ${(p) => (p.$today ? "#2563eb" : "#212020ff")};
  color: ${(p) => (p.$today ? "white" : "#d1d5db")};
  font-weight: ${(p) => (p.$today ? "bold" : "normal")};
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 80px;

  .day-label {
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }
`;

const EventsForDay = styled.div`
  font-size: 0.7rem;
  color: #f3f4f6;
  text-align: left;
  width: 100%;
`;

const EventItem = styled.div`
  margin-top: 0.2rem;
  padding: 2px 4px;
  border-radius: 4px;
  background: #111827;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  .time {
    font-weight: bold;
    color: #22c55e;
    font-size: 0.7rem;
  }

  .title {
    font-size: 0.7rem;
    line-height: 1.1rem;
  }
`;

const Sessions = styled.div`
  margin-bottom: 2rem;
`;

const TimeAxis = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  color: #9ca3af;
`;

const SessionBar = styled.div`
  position: relative;
  height: 60px;
  background: #1a1a1f;
  border-radius: 6px;
`;

const SessionBlock = styled.div`
  position: absolute;
  top: 10px;
  height: 40px;
  border-radius: 4px;
  background: ${(p) => p.$color};
  left: ${(p) => p.$left};
  width: ${(p) => p.$width};
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111;
`;

const CurrentTime = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #22c55e;
`;

const Sections = styled.div`
  display: grid;
  gap: 1rem;
`;

const Card = styled.div`
  background: #1a1a1f;
  padding: 1.5rem;
  border-radius: 8px;

  h3 {
    margin-bottom: 0.5rem;
  }

  a {
    color: #3b82f6;
    text-decoration: underline;
  }
`;

const QuickEntry = styled.textarea`
  margin-top: 1rem;
  width: 100%;
  background: #0b0b0d;
  border: 1px solid #333;
  color: #f3f4f6;
  border-radius: 6px;
  padding: 0.5rem;
  min-height: 80px;
  resize: none;
`;

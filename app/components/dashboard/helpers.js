/**
 * Pure helpers behind the dashboard widgets: market-session geometry, heatmap
 * intensity buckets and the goal-progress inference used by the goals card.
 */

import { toNumber } from "../../lib/format";

/* ------------------------------------------------------------------ */
/* Market sessions                                                     */
/* ------------------------------------------------------------------ */

const DAY_MINUTES = 24 * 60;

/**
 * Session windows are defined in UTC (the only stable way to express them) and
 * projected into the viewer's local timezone for rendering.
 * `aliases` map the user's own session labels onto these windows.
 */
export const MARKET_SESSIONS = [
  { name: "Sydney", startUtc: 21, endUtc: 6, tone: "info", aliases: ["sydney", "pacific", "oceania"] },
  { name: "Tokyo", startUtc: 0, endUtc: 9, tone: "brand", aliases: ["tokyo", "asia", "asian", "japan"] },
  { name: "London", startUtc: 7, endUtc: 16, tone: "profit", aliases: ["london", "europe", "frankfurt"] },
  { name: "New York", startUtc: 12, endUtc: 21, tone: "warn", aliases: ["new york", "newyork", "ny", "us "] },
];

/** Pairs whose overlap actually matters to a discretionary trader. */
const OVERLAPS = [
  { a: "London", b: "New York", label: "London / New York" },
  { a: "Tokyo", b: "London", label: "Tokyo / London" },
];

const mod = (n, m) => ((n % m) + m) % m;

function windowMinutes(session) {
  const start = session.startUtc * 60;
  const end = session.endUtc * 60;
  const duration = mod(end - start, DAY_MINUTES) || DAY_MINUTES;
  return { start, duration };
}

/** Splits a [start, start+duration) window into segments inside a single day. */
function toSegments(startMin, duration) {
  const start = mod(startMin, DAY_MINUTES);
  if (start + duration <= DAY_MINUTES) return [{ from: start, to: start + duration }];
  return [
    { from: start, to: DAY_MINUTES },
    { from: 0, to: start + duration - DAY_MINUTES },
  ];
}

function intersect(a, b) {
  const from = Math.max(a.from, b.from);
  const to = Math.min(a.to, b.to);
  return to - from > 1 ? { from, to } : null;
}

/**
 * @returns {{
 *  offsetLabel: string,
 *  nowMinutes: number,
 *  sessions: { name, tone, open, segments, opensInMin, closesInMin }[],
 *  overlaps: { label, from, to, active }[]
 * }}
 */
export function sessionTimeline(now) {
  const localOffsetMin = -now.getTimezoneOffset();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const utcNowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const sessions = MARKET_SESSIONS.map((session) => {
    const { start, duration } = windowMinutes(session);
    const sinceOpen = mod(utcNowMinutes - start, DAY_MINUTES);
    const open = sinceOpen < duration;

    return {
      name: session.name,
      tone: session.tone,
      aliases: session.aliases,
      open,
      segments: toSegments(start + localOffsetMin, duration),
      opensInMin: open ? 0 : DAY_MINUTES - sinceOpen,
      closesInMin: open ? duration - sinceOpen : 0,
      localStart: mod(start + localOffsetMin, DAY_MINUTES),
      localEnd: mod(start + localOffsetMin + duration, DAY_MINUTES),
    };
  });

  const byName = Object.fromEntries(sessions.map((s) => [s.name, s]));
  const overlaps = [];
  for (const pair of OVERLAPS) {
    const a = byName[pair.a];
    const b = byName[pair.b];
    if (!a || !b) continue;
    for (const segA of a.segments) {
      for (const segB of b.segments) {
        const hit = intersect(segA, segB);
        if (hit) {
          overlaps.push({
            ...hit,
            label: pair.label,
            active: a.open && b.open && nowMinutes >= hit.from && nowMinutes < hit.to,
          });
        }
      }
    }
  }

  return { nowMinutes, sessions, overlaps, offsetMinutes: localOffsetMin };
}

/** "07:30" for a minutes-from-midnight value. */
export function minutesToClock(minutes) {
  const m = mod(Math.round(minutes), DAY_MINUTES);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function shortDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Matches a user's session label (e.g. "London close") to a session window. */
export function matchSessionKey(label, session) {
  const value = String(label ?? "").toLowerCase();
  if (!value) return false;
  return session.aliases.some((alias) => value.includes(alias.trim()));
}

/* ------------------------------------------------------------------ */
/* Heatmap intensity                                                   */
/* ------------------------------------------------------------------ */

const MIN_ALPHA = 0.07;
const MAX_ALPHA = 0.34;

/**
 * Continuous heat intensity as an inline style.
 *
 * It has to be inline rather than a Tailwind class: opacity modifiers are
 * resolved at build time, so a computed `bg-profit/[x]` would never be
 * generated. The colour itself still comes from the theme tokens, so the grid
 * stays correct in both themes.
 *
 * A square-root ramp is used so mid-sized days remain distinguishable instead
 * of all collapsing into the faintest tint.
 */
export function heatStyle(pnl, max) {
  const value = toNumber(pnl) ?? 0;
  if (!value) return { backgroundColor: "rgb(var(--surface-sunken))" };
  const ratio = max > 0 ? Math.min(1, Math.abs(value) / max) : 0;
  const alpha = MIN_ALPHA + Math.sqrt(ratio) * (MAX_ALPHA - MIN_ALPHA);
  const token = value > 0 ? "--profit" : "--loss";
  return { backgroundColor: `rgb(var(${token}) / ${alpha.toFixed(3)})` };
}

/** Back-compat class helper for dashboard cells still wired through className. */
export function heatTint(pnl, max) {
  const value = toNumber(pnl) ?? 0;
  if (!value) return "bg-surface-sunken";
  const ratio = max > 0 ? Math.min(1, Math.abs(value) / max) : 0;
  const bucket = ratio > 0.72 ? "30" : ratio > 0.38 ? "20" : "10";
  return value > 0 ? `bg-profit/${bucket}` : `bg-loss/${bucket}`;
}

/** Matching legend swatch so the key and the grid can never drift apart. */
export function heatLegendStyle(sign, ratio) {
  const alpha = MIN_ALPHA + Math.sqrt(ratio) * (MAX_ALPHA - MIN_ALPHA);
  return { backgroundColor: `rgb(var(${sign > 0 ? "--profit" : "--loss"}) / ${alpha.toFixed(3)})` };
}

/* ------------------------------------------------------------------ */
/* Goal progress inference                                             */
/* ------------------------------------------------------------------ */

function parseAmount(text) {
  const match = /(?:\$|usd\s*)\s*([\d][\d.,]*)\s*(k|m)?/i.exec(text) ?? /([\d][\d.,]*)\s*(k|m)?\s*(?:\$|usd)/i.exec(text);
  if (!match) return null;
  const digits = match[1].replace(/,/g, "");
  let value = Number.parseFloat(digits);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") value *= 1000;
  if (suffix === "m") value *= 1_000_000;
  return value;
}

/**
 * Reads a free-text goal and, where the wording allows it, attaches a live
 * measurement so the goal shows real progress instead of just sitting there.
 *
 * @param {string} content
 * @param {{ netPnl:number, equity:number|null, maxDrawdownPct:number, cleanStreakDays:number }} context
 * @returns {null | { kind:"amount"|"limit"|"count", current:number, target:number, progress:number, tone:string, caption:string }}
 */
export function inferGoalProgress(content, context) {
  const text = String(content ?? "");
  const lower = text.toLowerCase();

  // "Keep max drawdown under 8%"
  if (/draw\s?down|dd\b/.test(lower)) {
    const pct = /(\d+(?:\.\d+)?)\s*%/.exec(lower);
    if (pct) {
      const target = Number.parseFloat(pct[1]);
      const current = context.maxDrawdownPct ?? 0;
      const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
      return {
        kind: "limit",
        current,
        target,
        progress,
        tone: current > target ? "loss" : current > target * 0.75 ? "warn" : "profit",
        caption: `${current.toFixed(1)}% used of ${target.toFixed(0)}% limit`,
      };
    }
  }

  // "Reach $10,000 account equity"
  const amount = parseAmount(text);
  if (amount && amount > 0) {
    const usesEquity = /equity|balance|account|portfolio/.test(lower) && context.equity != null;
    const current = usesEquity ? context.equity : context.netPnl;
    const progress = Math.max(0, Math.min(100, (current / amount) * 100));
    return {
      kind: "amount",
      current,
      target: amount,
      progress,
      tone: progress >= 100 ? "profit" : current < 0 ? "loss" : "brand",
      caption: usesEquity ? "Account equity" : "Net P&L to date",
    };
  }

  // "Zero rule violations for 20 consecutive sessions"
  const count = /(\d+)\s*(?:consecutive\s+|straight\s+)?(sessions?|days?|trades?)/i.exec(lower);
  if (count && /violation|rule|clean|discipline|mistake|error/.test(lower)) {
    const target = Number.parseInt(count[1], 10);
    const current = context.cleanStreakDays ?? 0;
    const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    return {
      kind: "count",
      current,
      target,
      progress,
      tone: progress >= 100 ? "profit" : "brand",
      caption: `${current} clean session${current === 1 ? "" : "s"} in a row`,
    };
  }

  return null;
}

/**
 * Consecutive most-recent trading days where no trade recorded a mistake.
 * Used to measure discipline goals.
 */
export function cleanSessionStreak(days = {}) {
  const keys = Object.keys(days).sort().reverse();
  let streak = 0;
  for (const key of keys) {
    const trades = days[key]?.trades ?? [];
    const clean = trades.every((t) => {
      const value = String(t.mistakes ?? "").trim().toLowerCase();
      return value === "" || value === "none" || value === "no" || value === "-";
    });
    if (!clean) break;
    streak += 1;
  }
  return streak;
}

/* ------------------------------------------------------------------ */
/* Economic events                                                     */
/* ------------------------------------------------------------------ */

export const IMPACT_META = {
  high: { label: "High", tone: "loss", dot: "bg-loss", order: 0 },
  medium: { label: "Medium", tone: "warn", dot: "bg-warn", order: 1 },
  low: { label: "Low", tone: "neutral", dot: "bg-content-subtle", order: 2 },
  holiday: { label: "Holiday", tone: "info", dot: "bg-info", order: 3 },
};

export const MAJOR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];

/**
 * `event.date` is the absolute instant (ISO) and `event.dateKey` is the day in
 * ForexFactory's own timezone. All-day rows have no instant, so they fall back
 * to the source day.
 */
function eventDate(event) {
  if (!event?.date) return null;
  const d = new Date(event.date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local date key (YYYY-MM-DD) for an event, honouring the viewer's timezone. */
export function eventLocalDateKey(event) {
  const d = eventDate(event);
  if (!d) return event?.dateKey ?? null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function eventLocalTime(event) {
  const d = eventDate(event);
  if (!d) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function eventTimestamp(event) {
  return eventDate(event)?.getTime() ?? null;
}

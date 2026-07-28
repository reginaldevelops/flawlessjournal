import { dateKey, parseDate } from "../../lib/format";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n) => String(n).padStart(2, "0");

/** Local YYYY-MM-DD for a Date, without any timezone round-trip. */
export function keyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Adds `days` to a YYYY-MM-DD key and returns the new key. */
export function shiftKey(key, days) {
  const d = parseDate(key);
  if (!d) return key;
  d.setDate(d.getDate() + days);
  return keyOf(d);
}

export function monthOf(key) {
  return String(key ?? "").slice(0, 7);
}

/** ISO-8601 week number (Monday-first, week 1 contains the first Thursday). */
export function isoWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 86400000));
}

/**
 * Monday-first calendar matrix for a month, padded with the leading/trailing
 * days needed to fill whole weeks.
 */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const weekCount = Math.ceil((leading + daysInMonth) / 7);

  const weeks = [];
  for (let w = 0; w < weekCount; w += 1) {
    const cells = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(year, month, 1 - leading + w * 7 + d);
      cells.push({
        date,
        key: keyOf(date),
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }
    weeks.push({ week: isoWeek(cells[0].date), cells });
  }
  return weeks;
}

/** 85th percentile of |value| so one outlier day cannot flatten the heat scale. */
export function tintScale(values) {
  const finite = values.filter((v) => Number.isFinite(v) && v !== 0).map(Math.abs);
  if (!finite.length) return 1;
  const sorted = finite.sort((a, b) => a - b);
  const idx = Math.floor(0.85 * (sorted.length - 1));
  return Math.max(sorted[idx], 1);
}

/**
 * Heat tint for a day cell. Returned as an inline style because the alpha is
 * continuous — `bg-profit/[0.23]` style classes cannot be generated at runtime.
 */
export function heatStyle(pnl, scale) {
  if (!Number.isFinite(pnl) || pnl === 0) return undefined;
  const ratio = Math.min(1, Math.abs(pnl) / (scale || 1));
  const alpha = (0.07 + 0.27 * Math.sqrt(ratio)).toFixed(3);
  return { backgroundColor: `rgb(var(--${pnl > 0 ? "profit" : "loss"}) / ${alpha})` };
}

/**
 * Journalling coverage over the most recent trading sessions.
 * A "session" is a day that actually has trades — the days a review matters.
 */
export function journalCoverage(dayStats, entryCountByDay, window = 20) {
  const sessions = Object.keys(dayStats)
    .sort()
    .slice(-window)
    .map((key) => ({ key, journalled: (entryCountByDay[key] ?? 0) > 0 }));

  let streak = 0;
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    if (!sessions[i].journalled) break;
    streak += 1;
  }

  let best = 0;
  let run = 0;
  for (const s of sessions) {
    run = s.journalled ? run + 1 : 0;
    if (run > best) best = run;
  }

  return {
    sessions,
    total: sessions.length,
    journalled: sessions.filter((s) => s.journalled).length,
    streak,
    best,
  };
}

export function countWords(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits text into `{ text, match }` runs for search highlighting.
 * Returns a single non-matching run when there is no query.
 */
export function highlightParts(text, query) {
  const source = String(text ?? "");
  const q = String(query ?? "").trim();
  if (!q) return [{ text: source, match: false }];

  const rx = new RegExp(escapeRegExp(q), "gi");
  const out = [];
  let last = 0;
  let m;
  while ((m = rx.exec(source)) !== null) {
    if (m.index > last) out.push({ text: source.slice(last, m.index), match: false });
    out.push({ text: m[0], match: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) rx.lastIndex += 1;
  }
  if (last < source.length) out.push({ text: source.slice(last), match: false });
  return out.length ? out : [{ text: source, match: false }];
}

/** Compact signed money for tight calendar cells: 1240 -> "+1.2k". */
export function compactSigned(value) {
  if (!Number.isFinite(value) || value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

export { dateKey };

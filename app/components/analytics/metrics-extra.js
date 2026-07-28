/**
 * Analytics-only derivations that sit on top of `app/lib/trades.js`.
 *
 * Everything here is pure and works on already-normalized trades, so the page
 * can memoize aggressively and never re-query the database per tab.
 */

import {
  closedTrades,
  computeMetrics,
  groupStats,
  mean,
  median,
  stdDev,
  sum,
  WEEKDAY_LABELS,
} from "../../lib/trades";
import { dateKey, parseDate, toNumber } from "../../lib/format";

/* ------------------------------------------------------------------ */
/* Dimensions                                                          */
/* ------------------------------------------------------------------ */

export const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const DURATION_BUCKETS = [
  "< 5 min",
  "5 – 15 min",
  "15 – 30 min",
  "30 – 60 min",
  "1 – 2 h",
  "2 – 4 h",
  "> 4 h",
];

export const RISK_BUCKETS = ["Under-sized", "Planned risk", "1.5 – 2× plan", "> 2× plan"];

export const R_BUCKETS = ["≤ -2R", "-2 to -1R", "-1 to 0R", "0 to 1R", "1 to 2R", "2 to 3R", "> 3R"];

export const CONFIDENCE_BUCKETS = ["Low (1-4)", "Medium (5-7)", "High (8-10)"];

const HOUR_BLOCKS = [
  "00:00 – 04:00",
  "04:00 – 08:00",
  "08:00 – 12:00",
  "12:00 – 16:00",
  "16:00 – 20:00",
  "20:00 – 24:00",
];

/** Raw value of a user-defined field, normalised to a string or null. */
export function fieldValue(trade, key) {
  const raw = trade?.data?.[key];
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" || s === "-" ? null : s;
}

export function durationBucket(trade) {
  const d = trade?.durationMin;
  if (d === null || d === undefined || d < 0) return null;
  if (d < 5) return DURATION_BUCKETS[0];
  if (d < 15) return DURATION_BUCKETS[1];
  if (d < 30) return DURATION_BUCKETS[2];
  if (d < 60) return DURATION_BUCKETS[3];
  if (d < 120) return DURATION_BUCKETS[4];
  if (d < 240) return DURATION_BUCKETS[5];
  return DURATION_BUCKETS[6];
}

export function riskBucket(trade, plannedRisk) {
  const r = trade?.risk;
  if (!r || !plannedRisk) return null;
  const ratio = r / plannedRisk;
  if (ratio < 0.8) return RISK_BUCKETS[0];
  if (ratio <= 1.5) return RISK_BUCKETS[1];
  if (ratio <= 2) return RISK_BUCKETS[2];
  return RISK_BUCKETS[3];
}

export function rBucket(trade) {
  const r = trade?.rMultiple;
  if (r === null || r === undefined || !Number.isFinite(r)) return null;
  if (r <= -2) return R_BUCKETS[0];
  if (r <= -1) return R_BUCKETS[1];
  if (r < 0) return R_BUCKETS[2];
  if (r <= 1) return R_BUCKETS[3];
  if (r <= 2) return R_BUCKETS[4];
  if (r <= 3) return R_BUCKETS[5];
  return R_BUCKETS[6];
}

export function confidenceBucket(trade) {
  const c = trade?.confidence;
  if (c === null || c === undefined) return null;
  if (c <= 4) return CONFIDENCE_BUCKETS[0];
  if (c <= 7) return CONFIDENCE_BUCKETS[1];
  return CONFIDENCE_BUCKETS[2];
}

export function hourBlock(trade) {
  if (trade?.hour === null || trade?.hour === undefined) return null;
  return HOUR_BLOCKS[Math.min(5, Math.floor(trade.hour / 4))];
}

/**
 * The dimensions a user can group, filter and compare by.
 * Dropdown variables come from the user's own schema; the rest are derived
 * from the normalized trade so they work for every journal.
 */
export function buildDimensions(variables = [], trades = [], { plannedRisk } = {}) {
  const dims = [];
  const seen = new Set();

  for (const v of variables) {
    if (v?.varType !== "dropdown" || !v?.name) continue;
    if (v.visible === false) continue;
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    dims.push({
      id: v.name,
      label: v.name,
      field: v.name,
      filterable: true,
      accessor: (t) => fieldValue(t, v.name),
      options: Array.isArray(v.options) ? v.options : null,
    });
  }

  const derived = [
    {
      id: "__weekday",
      label: "Day of week",
      accessor: (t) => (t.weekday === null ? null : WEEKDAY_FULL[t.weekday]),
      order: WEEKDAY_ORDER,
    },
    {
      id: "__hourblock",
      label: "Time of day",
      accessor: hourBlock,
      order: HOUR_BLOCKS,
    },
    {
      id: "__duration",
      label: "Hold time",
      accessor: durationBucket,
      order: DURATION_BUCKETS,
    },
    {
      id: "__rbucket",
      label: "R outcome",
      accessor: rBucket,
      order: R_BUCKETS,
    },
    {
      id: "__risk",
      label: "Position size",
      accessor: (t) => riskBucket(t, plannedRisk),
      order: RISK_BUCKETS,
    },
    {
      id: "__confidence",
      label: "Confidence",
      accessor: confidenceBucket,
      order: CONFIDENCE_BUCKETS,
    },
    {
      id: "__month",
      label: "Month",
      accessor: (t) => (t.dateKey ? t.dateKey.slice(0, 7) : null),
    },
  ];

  for (const d of derived) {
    // Skip derived dimensions the dataset cannot populate.
    const hasData = trades.some((t) => d.accessor(t) !== null && d.accessor(t) !== undefined);
    if (hasData) dims.push({ ...d, filterable: false });
  }

  return dims;
}

/** Distinct values of a dimension with their trade counts, most common first. */
export function dimensionValues(trades = [], dim) {
  if (!dim) return [];
  const counts = new Map();
  for (const t of trades) {
    const v = dim.accessor(t);
    if (v === null || v === undefined || v === "") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const list = [...counts.entries()].map(([value, count]) => ({ value, count }));
  if (dim.order) {
    list.sort((a, b) => dim.order.indexOf(a.value) - dim.order.indexOf(b.value));
  } else {
    list.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  }
  return list;
}

/** Bucket stats for a dimension, respecting the dimension's natural order. */
export function dimensionStats(trades = [], dim, { minCount = 1 } = {}) {
  if (!dim) return [];
  const rows = groupStats(trades, dim.accessor, { minCount, sortBy: "pnl" });
  if (dim.order) {
    rows.sort((a, b) => dim.order.indexOf(a.key) - dim.order.indexOf(b.key));
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

/**
 * The trader's habitual risk, used as the reference for "oversized".
 * Median is deliberate: a handful of blown-out tickets must not move it.
 */
export function plannedRiskOf(trades = []) {
  const risks = trades.map((t) => t.risk).filter((r) => r !== null && r > 0);
  if (risks.length < 5) return null;
  return median(risks);
}

export function isOversized(trade, plannedRisk) {
  if (!plannedRisk || !trade?.risk) return false;
  return trade.risk > plannedRisk * 1.5;
}

export function hasMistake(trade) {
  const raw = trade?.mistakes;
  if (raw === null || raw === undefined) return false;
  const s = String(raw).trim().toLowerCase();
  return s !== "" && s !== "none" && s !== "-" && s !== "n/a";
}

export const QUICK_FILTERS = [
  { id: "winners", label: "Winners only" },
  { id: "losers", label: "Losers only" },
  { id: "mistakes", label: "Has mistake" },
  { id: "oversized", label: "Oversized risk" },
];

/**
 * Single source of truth for turning the filter state into a trade list.
 * Kept local (rather than extending `filterTrades`) so the quick filters and
 * the per-dimension `custom` map behave identically everywhere.
 */
export function applyFilters(trades = [], filters = {}, { plannedRisk } = {}) {
  const { start, end, search, custom, quick } = filters;
  const q = search?.trim().toLowerCase();
  const customEntries = Object.entries(custom ?? {}).filter(([, v]) => v?.length);

  return trades.filter((t) => {
    if (start) {
      if (!t.dateKey || t.dateKey < start) return false;
    }
    if (end) {
      if (!t.dateKey || t.dateKey > end) return false;
    }
    for (const [key, values] of customEntries) {
      const v = fieldValue(t, key);
      if (v === null || !values.includes(v)) return false;
    }
    if (quick?.winners && !t.isWin) return false;
    if (quick?.losers && !t.isLoss) return false;
    if (quick?.mistakes && !hasMistake(t)) return false;
    if (quick?.oversized && !isOversized(t, plannedRisk)) return false;
    if (q) {
      const hay = `${JSON.stringify(t.data ?? {})} ${t.tradeNumber ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Earliest / latest date present in the dataset, as date keys. */
export function dataBounds(trades = []) {
  let min = null;
  let max = null;
  for (const t of trades) {
    if (!t.dateKey) continue;
    if (min === null || t.dateKey < min) min = t.dateKey;
    if (max === null || t.dateKey > max) max = t.dateKey;
  }
  return { start: min, end: max };
}

/* ------------------------------------------------------------------ */
/* Series                                                             */
/* ------------------------------------------------------------------ */

/** Equity + drawdown in one dataset so a single chart can render both. */
export function equityWithDrawdown(metrics) {
  const eq = metrics?.equity ?? [];
  return eq.map((p) => ({
    index: p.index,
    date: p.date,
    equity: p.equity,
    peak: p.peak,
    drawdown: p.drawdown,
    pnl: p.pnl,
  }));
}

/** Session-level equity curve — far more readable than per-trade over long ranges. */
export function dailyEquity(days = {}) {
  const keys = Object.keys(days).sort();
  let acc = 0;
  let peak = 0;
  return keys.map((k, i) => {
    acc += days[k].pnl;
    peak = Math.max(peak, acc);
    return {
      index: i + 1,
      date: k,
      equity: acc,
      peak,
      drawdown: -(peak - acc),
      pnl: days[k].pnl,
      count: days[k].count,
    };
  });
}

export function cumulativeR(trades = []) {
  const closed = closedTrades(trades).filter(
    (t) => t.rMultiple !== null && Number.isFinite(t.rMultiple)
  );
  let acc = 0;
  return closed.map((t, i) => {
    acc += t.rMultiple;
    return { index: i + 1, date: t.dateKey, r: acc, delta: t.rMultiple };
  });
}

/** Rolling window of the three metrics traders actually watch. */
export function rollingSeries(trades = [], window = 30) {
  const closed = closedTrades(trades);
  if (closed.length < window) return [];
  const out = [];
  for (let i = window - 1; i < closed.length; i += 1) {
    const slice = closed.slice(i - window + 1, i + 1);
    const pnls = slice.map((t) => t.pnl);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const gl = Math.abs(sum(losses));
    out.push({
      index: i + 1,
      date: closed[i].dateKey,
      winRate: (wins.length / slice.length) * 100,
      expectancy: mean(pnls),
      profitFactor: gl > 0 ? Math.min(5, sum(wins) / gl) : sum(wins) > 0 ? 5 : 0,
    });
  }
  return out;
}

export function monthlyStats(trades = []) {
  const closed = closedTrades(trades);
  const map = new Map();
  for (const t of closed) {
    if (!t.dateKey) continue;
    const key = t.dateKey.slice(0, 7);
    if (!map.has(key)) {
      map.set(key, { month: key, pnl: 0, count: 0, wins: 0, losses: 0, gross: 0, loss: 0, days: new Set() });
    }
    const m = map.get(key);
    m.pnl += t.pnl;
    m.count += 1;
    m.days.add(t.dateKey);
    if (t.pnl > 0) {
      m.wins += 1;
      m.gross += t.pnl;
    } else if (t.pnl < 0) {
      m.losses += 1;
      m.loss += Math.abs(t.pnl);
    }
  }
  let cumulative = 0;
  return [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      cumulative += m.pnl;
      return {
        month: m.month,
        label: monthLabel(m.month),
        pnl: m.pnl,
        count: m.count,
        wins: m.wins,
        losses: m.losses,
        winRate: m.count ? (m.wins / m.count) * 100 : 0,
        profitFactor: m.loss > 0 ? m.gross / m.loss : m.gross > 0 ? Infinity : 0,
        tradingDays: m.days.size,
        cumulative,
      };
    });
}

export function monthLabel(monthKey) {
  const d = parseDate(`${monthKey}-01`);
  if (!d) return monthKey;
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export function monthTitle(monthKey) {
  const d = parseDate(`${monthKey}-01`);
  if (!d) return monthKey;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Weekday x hour heatmap                                             */
/* ------------------------------------------------------------------ */

export function weekdayHourMatrix(trades = []) {
  const closed = closedTrades(trades);
  const cells = new Map();
  let minHour = 23;
  let maxHour = 0;
  let maxAbs = 0;

  for (const t of closed) {
    if (t.weekday === null || t.hour === null || t.hour === undefined) continue;
    minHour = Math.min(minHour, t.hour);
    maxHour = Math.max(maxHour, t.hour);
    const key = `${t.weekday}-${t.hour}`;
    if (!cells.has(key)) cells.set(key, { pnl: 0, count: 0, wins: 0 });
    const c = cells.get(key);
    c.pnl += t.pnl;
    c.count += 1;
    if (t.pnl > 0) c.wins += 1;
  }

  if (!cells.size) return { rows: [], hours: [], maxAbs: 0 };

  const hours = [];
  for (let h = minHour; h <= maxHour; h += 1) hours.push(h);

  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const activeDays = weekdayOrder.filter((d) =>
    hours.some((h) => cells.has(`${d}-${h}`))
  );

  const rows = activeDays.map((d) => {
    const rowCells = hours.map((h) => {
      const c = cells.get(`${d}-${h}`);
      if (!c) return { hour: h, weekday: d, count: 0, pnl: 0, winRate: null };
      maxAbs = Math.max(maxAbs, Math.abs(c.pnl));
      return {
        hour: h,
        weekday: d,
        count: c.count,
        pnl: c.pnl,
        winRate: (c.wins / c.count) * 100,
      };
    });
    return {
      weekday: d,
      label: WEEKDAY_LABELS[d],
      full: WEEKDAY_FULL[d],
      cells: rowCells,
      pnl: sum(rowCells.map((c) => c.pnl)),
      count: sum(rowCells.map((c) => c.count)),
    };
  });

  return { rows, hours, maxAbs };
}

/* ------------------------------------------------------------------ */
/* Calendar                                                           */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, "0");

export function monthKeyOf(date) {
  const d = date instanceof Date ? date : parseDate(date);
  if (!d) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/**
 * Monday-first month grid with leading/trailing blanks and a summary per week.
 * `days` is the map produced by `groupByDay`.
 */
export function calendarMonthGrid(monthKey, days = {}) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leading; i += 1) cells.push({ blank: true, key: `lead-${i}` });
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = `${year}-${pad(month)}-${pad(d)}`;
    const day = days[key];
    const date = new Date(year, month - 1, d);
    cells.push({
      blank: false,
      key,
      dayOfMonth: d,
      weekday: date.getDay(),
      pnl: day?.pnl ?? 0,
      count: day?.count ?? 0,
      wins: day?.wins ?? 0,
      winRate: day?.winRate ?? null,
      trades: day?.trades ?? [],
      hasTrades: Boolean(day?.count),
    });
  }
  while (cells.length % 7 !== 0) cells.push({ blank: true, key: `trail-${cells.length}` });

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    const slice = cells.slice(i, i + 7);
    const active = slice.filter((c) => !c.blank && c.hasTrades);
    weeks.push({
      key: `w-${monthKey}-${i / 7}`,
      cells: slice,
      pnl: sum(active.map((c) => c.pnl)),
      count: sum(active.map((c) => c.count)),
      days: active.length,
    });
  }

  const monthCells = cells.filter((c) => !c.blank && c.hasTrades);
  return {
    monthKey,
    weeks,
    maxAbs: monthCells.length ? Math.max(...monthCells.map((c) => Math.abs(c.pnl))) : 0,
    pnl: sum(monthCells.map((c) => c.pnl)),
    count: sum(monthCells.map((c) => c.count)),
    tradingDays: monthCells.length,
  };
}

/** 7 x N grid of every day in a year, for the contribution-style strip. */
export function yearHeatmap(year, days = {}) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const cursor = new Date(start);
  cursor.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const weeks = [];
  let maxAbs = 0;
  while (cursor <= end || (cursor.getDay() + 6) % 7 !== 0) {
    const week = { key: dateKey(cursor), cells: [], month: cursor.getMonth() };
    for (let i = 0; i < 7; i += 1) {
      const key = dateKey(cursor);
      const inYear = cursor.getFullYear() === year;
      const day = inYear ? days[key] : null;
      if (day) maxAbs = Math.max(maxAbs, Math.abs(day.pnl));
      week.cells.push({
        key,
        inYear,
        month: cursor.getMonth(),
        pnl: day?.pnl ?? 0,
        count: day?.count ?? 0,
        hasTrades: Boolean(day?.count),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor > end && (cursor.getDay() + 6) % 7 === 0) break;
  }
  return { weeks, maxAbs };
}

/* ------------------------------------------------------------------ */
/* Discipline scorecard                                               */
/* ------------------------------------------------------------------ */

const clamp01 = (n) => Math.max(0, Math.min(100, n));

/**
 * Grades *behaviour* rather than outcome: the things a trader controls.
 * Each component returns 0-100 plus a human-readable detail line.
 */
export function disciplineReport(trades = [], metrics, { plannedRisk } = {}) {
  const closed = metrics?.closed ?? closedTrades(trades);
  if (!closed.length) return null;

  const components = [];

  // 1. Rule adherence — how often a mistake was logged.
  const tagged = closed.filter((t) => t.mistakes !== null && t.mistakes !== undefined);
  if (tagged.length) {
    const withMistake = tagged.filter(hasMistake);
    const rate = (withMistake.length / tagged.length) * 100;
    components.push({
      id: "rules",
      label: "Rule adherence",
      score: clamp01(100 - rate * 1.35),
      value: `${(100 - rate).toFixed(0)}% clean`,
      detail: `${withMistake.length} of ${tagged.length} trades carry a logged mistake.`,
      hint: "Share of trades you journalled without a rule violation. Weighted so a 25% violation rate already costs a full grade.",
    });
  }

  // 2. Risk consistency — dispersion of position size around the plan.
  const risks = closed.map((t) => t.risk).filter((r) => r !== null && r > 0);
  if (risks.length >= 5) {
    const cv = mean(risks) > 0 ? stdDev(risks) / mean(risks) : 0;
    components.push({
      id: "risk",
      label: "Risk consistency",
      score: clamp01(100 - (cv / 0.5) * 100),
      value: `±${(cv * 100).toFixed(0)}%`,
      detail: `Typical risk ${Math.round(plannedRisk ?? median(risks))}, spread ±${Math.round(stdDev(risks))}.`,
      hint: "Coefficient of variation of your risk per trade. Under 20% is a trader sizing off a rule, over 50% is sizing off a feeling.",
    });
  }

  // 3. Oversized damage — how much of the bleeding comes from big tickets.
  if (plannedRisk) {
    const over = closed.filter((t) => isOversized(t, plannedRisk));
    const overLoss = Math.abs(sum(over.filter((t) => t.pnl < 0).map((t) => t.pnl)));
    const share = metrics.grossLoss > 0 ? (overLoss / metrics.grossLoss) * 100 : 0;
    components.push({
      id: "oversized",
      label: "Oversized-loss share",
      score: clamp01(100 - share * 1.6),
      value: `${share.toFixed(0)}% of losses`,
      detail: `${over.length} oversized trades (${((over.length / closed.length) * 100).toFixed(0)}% of volume) caused ${share.toFixed(0)}% of all losses.`,
      hint: "Portion of your gross loss produced by trades risking more than 1.5× your usual size. This is the fastest leak to close.",
    });
  }

  // 4. Loss control — outliers beyond twice the average loss.
  if (metrics.losses >= 4 && metrics.avgLoss > 0) {
    const outliers = closed.filter((t) => t.pnl < 0 && Math.abs(t.pnl) > metrics.avgLoss * 2);
    const cost = Math.abs(sum(outliers.map((t) => t.pnl)));
    const share = metrics.grossLoss > 0 ? (cost / metrics.grossLoss) * 100 : 0;
    components.push({
      id: "losscontrol",
      label: "Loss control",
      score: clamp01(100 - share * 1.5),
      value: `${outliers.length} outliers`,
      detail: `Losses beyond 2× your average cost ${Math.round(cost)} (${share.toFixed(0)}% of gross loss).`,
      hint: "Whether your stop actually holds. Outsized losses mean the stop moved, the size was wrong, or there was no stop at all.",
    });
  }

  // 5. Execution quality — self-graded trades.
  const graded = closed.filter((t) => t.grade);
  if (graded.length >= 5) {
    const good = graded.filter((t) => /^a|^b/i.test(String(t.grade).trim()));
    const rate = (good.length / graded.length) * 100;
    components.push({
      id: "execution",
      label: "Execution grade",
      score: clamp01(rate),
      value: `${rate.toFixed(0)}% A/B`,
      detail: `${good.length} of ${graded.length} trades self-graded A or B.`,
      hint: "Your own grade on execution quality. If this is high while P&L is negative, the plan is the problem, not the discipline.",
    });
  }

  // 6. Day-level consistency.
  if (metrics.tradingDays >= 5) {
    components.push({
      id: "consistency",
      label: "Green-day rate",
      score: clamp01(metrics.winningDayRate * 1.5),
      value: `${metrics.winningDayRate.toFixed(0)}% green`,
      detail: `${metrics.winningDays} green of ${metrics.tradingDays} sessions.`,
      hint: "How often you finish a session up. A profitable trader with a low green-day rate is relying on a few outliers.",
    });
  }

  const score = components.length ? mean(components.map((c) => c.score)) : 0;
  return { score, grade: letterGrade(score), components };
}

export function letterGrade(score) {
  if (score >= 90) return "A+";
  if (score >= 82) return "A";
  if (score >= 74) return "B+";
  if (score >= 66) return "B";
  if (score >= 58) return "C+";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function scoreTone(score) {
  if (score >= 74) return "profit";
  if (score >= 55) return "warn";
  return "loss";
}

/* ------------------------------------------------------------------ */
/* Leak ranking                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ranks removable leaks by what dropping them would have done to the bottom
 * line. Each candidate is a concrete, actionable subset of trades.
 */
export function leakReport(trades = [], metrics, dims = [], { plannedRisk, limit = 6 } = {}) {
  const closed = metrics?.closed ?? closedTrades(trades);
  if (closed.length < 10) return [];

  const minCount = Math.max(3, Math.round(closed.length * 0.02));
  const candidates = [];

  for (const dim of dims) {
    if (dim.id === "__month") continue;
    const rows = dimensionStats(closed, dim, { minCount });
    for (const row of rows) {
      if (row.pnl >= 0) continue;
      candidates.push({
        id: `${dim.id}:${row.key}`,
        scope: dim.label,
        label: row.key,
        cost: -row.pnl,
        count: row.count,
        winRate: row.winRate,
        ids: new Set(row.trades.map((t) => t.id)),
        action: `Stop trading ${row.key.toLowerCase()} ${dim.id === "__weekday" ? "" : `(${dim.label.toLowerCase()})`}`.trim(),
      });
    }
  }

  if (plannedRisk) {
    const over = closed.filter((t) => isOversized(t, plannedRisk));
    const overPnl = sum(over.map((t) => t.pnl));
    if (over.length >= 3 && overPnl < 0) {
      candidates.push({
        id: "__oversized",
        scope: "Risk management",
        label: "Oversized positions",
        cost: -overPnl,
        count: over.length,
        winRate: (over.filter((t) => t.pnl > 0).length / over.length) * 100,
        ids: new Set(over.map((t) => t.id)),
        action: `Cap every ticket at ${Math.round(plannedRisk * 1.5)} risk`,
      });
    }
  }

  const mistakeTrades = closed.filter(hasMistake);
  const mistakePnl = sum(mistakeTrades.map((t) => t.pnl));
  if (mistakeTrades.length >= 3 && mistakePnl < 0) {
    candidates.push({
      id: "__mistakes",
      scope: "Discipline",
      label: "Trades with a logged mistake",
      cost: -mistakePnl,
      count: mistakeTrades.length,
      winRate: (mistakeTrades.filter((t) => t.pnl > 0).length / mistakeTrades.length) * 100,
      ids: new Set(mistakeTrades.map((t) => t.id)),
      action: "Treat your own mistake list as a hard pre-trade checklist",
    });
  }

  const deduped = [];
  const usedSignature = new Set();
  for (const c of [...candidates].sort((a, b) => b.cost - a.cost)) {
    const signature = [...c.ids].sort().join("|");
    if (usedSignature.has(signature)) continue;
    usedSignature.add(signature);
    deduped.push(c);
    if (deduped.length >= limit) break;
  }

  return deduped.map((c) => {
    const without = computeMetrics(closed.filter((t) => !c.ids.has(t.id)));
    return {
      ...c,
      ids: undefined,
      share: metrics.grossLoss > 0 ? (c.cost / metrics.grossLoss) * 100 : 0,
      netWithout: without.netPnl,
      profitFactorWithout: without.profitFactor,
      winRateWithout: without.winRate,
      netDelta: without.netPnl - metrics.netPnl,
    };
  });
}

/**
 * Percentage deltas for the headline tiles. Win rate is already a percentage so
 * it is reported in points; everything else is relative.
 */
export function headlineDeltas(current, previous) {
  if (!current || !previous || !previous.totalTrades) return {};
  const rel = (a, b) => {
    if (b === 0 || b === null || b === undefined) return null;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return ((a - b) / Math.abs(b)) * 100;
  };
  return {
    netPnl: rel(current.netPnl, previous.netPnl),
    winRate: current.winRate - previous.winRate,
    profitFactor: rel(current.profitFactor, previous.profitFactor),
    expectancy: rel(current.expectancy, previous.expectancy),
    payoffRatio: rel(current.payoffRatio, previous.payoffRatio),
    maxDrawdown: rel(current.maxDrawdown, previous.maxDrawdown),
    totalTrades: rel(current.totalTrades, previous.totalTrades),
    avgTrade: rel(current.avgTrade, previous.avgTrade),
    avgR: rel(current.avgR, previous.avgR),
    winningDayRate: current.winningDayRate - previous.winningDayRate,
  };
}

/* ------------------------------------------------------------------ */
/* Comparison table                                                   */
/* ------------------------------------------------------------------ */

/** The metric rows used by the deep-dive comparison and A/B diff tables. */
export const COMPARE_METRICS = [
  { id: "totalTrades", label: "Trades", kind: "int", higherIsBetter: null },
  { id: "netPnl", label: "Net P&L", kind: "currency", higherIsBetter: true },
  { id: "winRate", label: "Win rate", kind: "percent", higherIsBetter: true },
  { id: "profitFactor", label: "Profit factor", kind: "ratio", higherIsBetter: true },
  { id: "expectancy", label: "Expectancy / trade", kind: "currency", higherIsBetter: true },
  { id: "avgWin", label: "Average win", kind: "currency", higherIsBetter: true },
  { id: "avgLoss", label: "Average loss", kind: "currency", higherIsBetter: false },
  { id: "payoffRatio", label: "Payoff ratio", kind: "ratio", higherIsBetter: true },
  { id: "avgR", label: "Average R", kind: "r", higherIsBetter: true },
  { id: "maxDrawdown", label: "Max drawdown", kind: "currency", higherIsBetter: false },
  { id: "sqn", label: "SQN", kind: "number", higherIsBetter: true },
  { id: "avgDurationMin", label: "Average hold", kind: "duration", higherIsBetter: null },
];

/** Merges per-series cumulative curves into one index-keyed dataset. */
export function mergeCumulative(series = []) {
  const maxLen = Math.max(0, ...series.map((s) => s.points.length));
  const rows = [];
  for (let i = 0; i < maxLen; i += 1) {
    const row = { index: i + 1 };
    for (const s of series) {
      const p = s.points[i];
      if (p) row[s.id] = p.value;
    }
    rows.push(row);
  }
  return rows;
}

export function cumulativeFor(trades = []) {
  const closed = closedTrades(trades);
  let acc = 0;
  return closed.map((t, i) => {
    acc += t.pnl;
    return { index: i + 1, value: acc, date: t.dateKey };
  });
}

/* ------------------------------------------------------------------ */
/* CSV export                                                         */
/* ------------------------------------------------------------------ */

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns = [], rows = []) {
  const head = columns.map((c) => csvCell(c.label ?? c.id)).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvCell(c.value ? c.value(row) : row[c.id])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename, csv) {
  if (typeof window === "undefined") return;
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Flattens the filtered trades, keeping the user's own field names. */
export function tradesToCsv(trades = [], variables = []) {
  const varNames = variables
    .filter((v) => v?.name && v.varType !== "chart")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((v) => v.name);
  const extra = new Set();
  for (const t of trades) {
    for (const k of Object.keys(t.data ?? {})) {
      if (!varNames.includes(k)) extra.add(k);
    }
  }
  const keys = [...varNames, ...extra];
  const columns = [
    { id: "tradeNumber", label: "Trade #", value: (t) => t.tradeNumber ?? "" },
    ...keys.map((k) => ({ id: k, label: k, value: (t) => t.data?.[k] ?? "" })),
  ];
  return toCsv(columns, trades);
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                      */
/* ------------------------------------------------------------------ */

export function safeNumber(value, fallback = 0) {
  const n = toNumber(value);
  return n === null || !Number.isFinite(n) ? fallback : n;
}

export function pct(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

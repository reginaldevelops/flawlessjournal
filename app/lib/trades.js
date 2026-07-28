/**
 * Trade normalisation + the analytics engine.
 *
 * Trades are stored as `{ id, trade_number, data: { ...dynamicKeys } }` where the
 * keys come from the user-defined `variables` table. Field names therefore vary
 * per user (and historically per page: `PnL` vs `PNL`, `Datum` vs `Date`).
 * Everything in the app funnels through `normalizeTrades` so downstream code can
 * rely on a stable shape.
 */

import { dateKey, parseDate, toNumber } from "./format";

/* ------------------------------------------------------------------ */
/* Field detection                                                     */
/* ------------------------------------------------------------------ */

const ALIASES = {
  pnl: ["pnl", "p&l", "netpnl", "net pnl", "profit", "result", "resultaat", "winst"],
  date: ["datum", "date", "tradedate", "trade date", "day", "dag"],
  symbol: ["symbol", "ticker", "pair", "coin", "coins", "asset", "instrument", "market"],
  side: ["side", "direction", "richting", "type", "long/short", "positie", "bias"],
  setup: ["setup", "strategy", "strategie", "playbook", "model", "pattern", "system"],
  session: ["session", "sessie", "market session", "killzone"],
  risk: ["risk", "risico", "risk$", "risk amount", "riskamount", "$risk"],
  rMultiple: ["r", "rmultiple", "r multiple", "r-multiple", "rr", "r:r", "rrr", "risk reward", "riskreward", "reward"],
  entryTime: ["entreetijd", "entry time", "entrytime", "entry", "open time", "time in", "tijd"],
  exitTime: ["exittijd", "exit time", "exittime", "exit", "close time", "time out"],
  duration: ["duration", "duur", "holdtime", "hold time", "time in trade"],
  quantity: ["quantity", "qty", "size", "volume", "lots", "contracts", "position size"],
  entryPrice: ["entry price", "entryprice", "entry", "instapprijs", "open price"],
  exitPrice: ["exit price", "exitprice", "close price", "uitstapprijs"],
  stopLoss: ["stop", "stop loss", "stoploss", "sl"],
  takeProfit: ["target", "take profit", "takeprofit", "tp"],
  fees: ["fees", "commission", "commissie", "kosten"],
  mistakes: ["mistake", "mistakes", "fout", "fouten", "error", "errors"],
  emotion: ["emotion", "emotie", "mood", "feeling", "psychology", "mental"],
  grade: ["grade", "rating", "score", "cijfer", "quality"],
  tags: ["tags", "tag", "labels"],
  notes: ["notes", "note", "evaluation", "evaluatie", "notities", "comment", "journal"],
  confidence: ["confidence", "conviction", "vertrouwen"],
  timeframe: ["timeframe", "tf", "interval"],
};

const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s_\-.]/g, "");

/**
 * Builds a map of canonical field -> actual key present in the data.
 * Exact alias matches win; otherwise falls back to a substring match.
 */
export function detectFields(rows = [], variables = []) {
  const keys = new Set();
  for (const v of variables) if (v?.name) keys.add(v.name);
  for (const row of rows) {
    const data = row?.data ?? row ?? {};
    for (const k of Object.keys(data)) keys.add(k);
  }
  const keyList = [...keys];

  const map = {};
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    const normalized = aliases.map(norm);
    let match = keyList.find((k) => normalized.includes(norm(k)));
    if (!match) {
      match = keyList.find((k) => normalized.some((a) => a.length > 3 && norm(k).includes(a)));
    }
    if (match) map[canonical] = match;
  }
  return map;
}

function pick(data, fields, canonical, extra = []) {
  const key = fields?.[canonical];
  if (key && data[key] !== undefined && data[key] !== "") return data[key];
  for (const alt of extra) {
    if (data[alt] !== undefined && data[alt] !== "") return data[alt];
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return String(value)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function minutesFromTime(value) {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value).trim());
  if (!m) return null;
  return +m[1] * 60 + +m[2];
}

function normalizeSide(value) {
  const s = norm(value);
  if (!s) return null;
  if (s.includes("long") || s === "buy" || s === "b" || s.includes("bull")) return "long";
  if (s.includes("short") || s === "sell" || s === "s" || s.includes("bear")) return "short";
  return null;
}

/**
 * @returns {{
 *  id, tradeNumber, raw, data, date, dateKey, pnl, isWin, isLoss, isScratch,
 *  symbol, side, setup, session, tags, rMultiple, risk, fees,
 *  entryTime, exitTime, entryMinutes, durationMin, hour, weekday, grade,
 *  emotion, mistakes, notes, hasResult
 * }[]}
 */
export function normalizeTrades(rows = [], variables = [], fieldsOverride) {
  const fields = fieldsOverride ?? detectFields(rows, variables);

  return rows.map((row) => {
    const data = row?.data && typeof row.data === "object" ? row.data : row ?? {};

    const rawPnl = pick(data, fields, "pnl", ["PnL", "PNL", "Pnl", "pnl"]);
    const pnl = toNumber(rawPnl);

    const rawDate = pick(data, fields, "date", ["Datum", "Date", "date"]);
    const date = parseDate(rawDate);

    const entryTime = pick(data, fields, "entryTime", ["Entreetijd"]);
    const exitTime = pick(data, fields, "exitTime");
    const entryMinutes = minutesFromTime(entryTime);
    const exitMinutes = minutesFromTime(exitTime);

    let durationMin = toNumber(pick(data, fields, "duration"));
    if (durationMin === null && entryMinutes !== null && exitMinutes !== null) {
      durationMin = exitMinutes >= entryMinutes
        ? exitMinutes - entryMinutes
        : exitMinutes + 24 * 60 - entryMinutes;
    }

    const risk = toNumber(pick(data, fields, "risk"));
    let rMultiple = toNumber(pick(data, fields, "rMultiple"));
    if (rMultiple === null && pnl !== null && risk && risk > 0) {
      rMultiple = pnl / risk;
    }

    const hour = entryMinutes !== null ? Math.floor(entryMinutes / 60) : date ? date.getHours() : null;

    return {
      id: row?.id ?? null,
      tradeNumber: row?.trade_number ?? toNumber(data["Trade Number"] ?? data["Trade number"]),
      raw: row,
      data,
      date,
      dateKey: date ? dateKey(date) : null,
      timestamp: date ? date.getTime() : null,
      pnl,
      hasResult: pnl !== null,
      isWin: pnl !== null && pnl > 0,
      isLoss: pnl !== null && pnl < 0,
      isScratch: pnl === 0,
      symbol: pick(data, fields, "symbol", ["Coins", "Coin", "Symbol", "Pair"]) ?? null,
      side: normalizeSide(pick(data, fields, "side")),
      setup: pick(data, fields, "setup") ?? null,
      session: pick(data, fields, "session") ?? null,
      timeframe: pick(data, fields, "timeframe") ?? null,
      emotion: pick(data, fields, "emotion") ?? null,
      mistakes: pick(data, fields, "mistakes") ?? null,
      grade: pick(data, fields, "grade") ?? null,
      confidence: toNumber(pick(data, fields, "confidence")),
      tags: parseTags(pick(data, fields, "tags")),
      notes: pick(data, fields, "notes", ["Notes", "Evaluation"]) ?? null,
      risk,
      rMultiple,
      fees: toNumber(pick(data, fields, "fees")) ?? 0,
      quantity: toNumber(pick(data, fields, "quantity")),
      entryPrice: toNumber(pick(data, fields, "entryPrice")),
      exitPrice: toNumber(pick(data, fields, "exitPrice")),
      entryTime: entryTime ?? null,
      exitTime: exitTime ?? null,
      entryMinutes,
      durationMin,
      hour,
      weekday: date ? date.getDay() : null,
      fields,
    };
  });
}

/** Trades that actually have a P&L, ordered chronologically. */
export function closedTrades(trades = []) {
  return trades
    .filter((t) => t.hasResult)
    .sort((a, b) => {
      const at = a.timestamp ?? 0;
      const bt = b.timestamp ?? 0;
      if (at !== bt) return at - bt;
      return (a.tradeNumber ?? 0) - (b.tradeNumber ?? 0);
    });
}

/* ------------------------------------------------------------------ */
/* Statistics primitives                                               */
/* ------------------------------------------------------------------ */

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map((x) => (x - m) ** 2)) / (arr.length - 1));
}

export function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/* ------------------------------------------------------------------ */
/* Core metrics                                                        */
/* ------------------------------------------------------------------ */

/**
 * Full performance report for a set of normalized trades.
 * Every value is safe to render (no NaN / Infinity leaks — those become null).
 */
export function computeMetrics(trades = [], { startingBalance = 0 } = {}) {
  const closed = closedTrades(trades);
  const pnls = closed.map((t) => t.pnl);

  const winners = closed.filter((t) => t.pnl > 0);
  const losers = closed.filter((t) => t.pnl < 0);
  const scratches = closed.filter((t) => t.pnl === 0);

  const winPnls = winners.map((t) => t.pnl);
  const lossPnls = losers.map((t) => t.pnl);

  const grossProfit = sum(winPnls);
  const grossLoss = Math.abs(sum(lossPnls));
  const netPnl = grossProfit - grossLoss;
  const totalTrades = closed.length;

  const winRate = totalTrades ? (winners.length / totalTrades) * 100 : 0;
  const lossRate = totalTrades ? (losers.length / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgWin = winners.length ? grossProfit / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const avgTrade = totalTrades ? netPnl / totalTrades : 0;

  const expectancy = totalTrades
    ? (winRate / 100) * avgWin - (lossRate / 100) * avgLoss
    : 0;

  // Equity + drawdown
  const equity = [];
  let cumulative = startingBalance;
  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let maxRunup = 0;
  let trough = startingBalance;

  closed.forEach((t, i) => {
    cumulative += t.pnl;
    if (cumulative > peak) {
      peak = cumulative;
      trough = cumulative;
    }
    if (cumulative < trough) trough = cumulative;

    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
    const denom = Math.abs(peak) || Math.abs(startingBalance) || null;
    if (denom) {
      const ddPct = (dd / denom) * 100;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    }
    const runup = cumulative - trough;
    if (runup > maxRunup) maxRunup = runup;

    equity.push({
      index: i + 1,
      tradeId: t.id,
      date: t.dateKey,
      pnl: t.pnl,
      equity: cumulative,
      peak,
      drawdown: -(peak - cumulative),
    });
  });

  // Streaks
  const streaks = computeStreaks(closed);

  // Risk-adjusted
  const sd = stdDev(pnls);
  const sharpe = sd > 0 ? (mean(pnls) / sd) * Math.sqrt(Math.min(totalTrades, 252)) : 0;
  const downside = pnls.filter((p) => p < 0);
  const downsideDev = downside.length ? Math.sqrt(mean(downside.map((p) => p ** 2))) : 0;
  const sortino = downsideDev > 0 ? (mean(pnls) / downsideDev) * Math.sqrt(Math.min(totalTrades, 252)) : 0;
  const sqn = sd > 0 && totalTrades > 1 ? (Math.sqrt(totalTrades) * mean(pnls)) / sd : 0;
  const recoveryFactor = maxDrawdown > 0 ? netPnl / maxDrawdown : netPnl > 0 ? Infinity : 0;

  // Kelly criterion (fraction of capital)
  const w = winRate / 100;
  const kelly = payoffRatio > 0 && Number.isFinite(payoffRatio)
    ? (w - (1 - w) / payoffRatio) * 100
    : 0;

  // R-multiples
  const rTrades = closed.filter((t) => t.rMultiple !== null && Number.isFinite(t.rMultiple));
  const rValues = rTrades.map((t) => t.rMultiple);
  const totalR = sum(rValues);
  const avgR = rTrades.length ? totalR / rTrades.length : null;
  const expectancyR = rTrades.length
    ? (rValues.filter((r) => r > 0).length / rValues.length) * mean(rValues.filter((r) => r > 0) || [0]) -
      (rValues.filter((r) => r < 0).length / rValues.length) *
        Math.abs(mean(rValues.filter((r) => r < 0) || [0]))
    : null;

  // Daily aggregation
  const days = groupByDay(closed);
  const dayPnls = Object.values(days).map((d) => d.pnl);
  const winningDays = dayPnls.filter((p) => p > 0);
  const losingDays = dayPnls.filter((p) => p < 0);

  const durations = closed.map((t) => t.durationMin).filter((d) => d !== null && d >= 0);

  return {
    // volume
    totalTrades,
    totalLogged: trades.length,
    openTrades: trades.length - totalTrades,
    wins: winners.length,
    losses: losers.length,
    scratches: scratches.length,

    // money
    netPnl,
    grossProfit,
    grossLoss,
    avgTrade,
    avgWin,
    avgLoss,
    largestWin: winPnls.length ? Math.max(...winPnls) : 0,
    largestLoss: lossPnls.length ? Math.min(...lossPnls) : 0,
    medianWin: median(winPnls),
    medianLoss: median(lossPnls),
    totalFees: sum(closed.map((t) => t.fees || 0)),

    // ratios
    winRate,
    lossRate,
    profitFactor: safe(profitFactor),
    payoffRatio: safe(payoffRatio),
    expectancy,
    kelly: clamp(kelly, -100, 100),

    // risk
    maxDrawdown,
    maxDrawdownPct,
    maxRunup,
    recoveryFactor: safe(recoveryFactor),
    stdDev: sd,
    sharpe,
    sortino,
    sqn,
    ulcerIndex: ulcerIndex(equity),

    // R
    totalR: rTrades.length ? totalR : null,
    avgR,
    expectancyR,
    rTradeCount: rTrades.length,

    // streaks
    ...streaks,

    // days
    tradingDays: Object.keys(days).length,
    winningDays: winningDays.length,
    losingDays: losingDays.length,
    breakevenDays: dayPnls.filter((p) => p === 0).length,
    winningDayRate: dayPnls.length ? (winningDays.length / dayPnls.length) * 100 : 0,
    avgDailyPnl: mean(dayPnls),
    avgWinningDay: mean(winningDays),
    avgLosingDay: mean(losingDays),
    bestDay: dayPnls.length ? Math.max(...dayPnls) : 0,
    worstDay: dayPnls.length ? Math.min(...dayPnls) : 0,
    avgTradesPerDay: dayPnls.length ? totalTrades / dayPnls.length : 0,

    // time
    avgDurationMin: durations.length ? mean(durations) : null,
    avgWinDurationMin: durationsFor(winners),
    avgLossDurationMin: durationsFor(losers),

    // series
    equity,
    days,
    closed,
  };
}

function durationsFor(list) {
  const d = list.map((t) => t.durationMin).filter((x) => x !== null && x >= 0);
  return d.length ? mean(d) : null;
}

function safe(n) {
  if (n === Infinity) return Infinity;
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(hi, Math.max(lo, n));
}

function ulcerIndex(equity) {
  if (!equity.length) return 0;
  const squares = equity.map((p) => {
    const denom = Math.abs(p.peak) || 1;
    const pct = (p.drawdown / denom) * 100;
    return pct ** 2;
  });
  return Math.sqrt(mean(squares));
}

export function computeStreaks(closed = []) {
  let currentStreak = 0;
  let currentType = null;
  let longestWin = 0;
  let longestLoss = 0;
  let runWin = 0;
  let runLoss = 0;

  for (const t of closed) {
    if (t.pnl > 0) {
      runWin += 1;
      runLoss = 0;
      longestWin = Math.max(longestWin, runWin);
    } else if (t.pnl < 0) {
      runLoss += 1;
      runWin = 0;
      longestLoss = Math.max(longestLoss, runLoss);
    } else {
      runWin = 0;
      runLoss = 0;
    }
  }

  if (runWin > 0) {
    currentStreak = runWin;
    currentType = "win";
  } else if (runLoss > 0) {
    currentStreak = runLoss;
    currentType = "loss";
  }

  return { currentStreak, currentStreakType: currentType, longestWinStreak: longestWin, longestLossStreak: longestLoss };
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

export function groupByDay(trades = []) {
  const out = {};
  for (const t of trades) {
    if (!t.dateKey) continue;
    if (!out[t.dateKey]) {
      out[t.dateKey] = { date: t.dateKey, pnl: 0, count: 0, wins: 0, losses: 0, trades: [], rTotal: 0 };
    }
    const d = out[t.dateKey];
    d.pnl += t.pnl ?? 0;
    d.count += 1;
    if (t.pnl > 0) d.wins += 1;
    else if (t.pnl < 0) d.losses += 1;
    if (t.rMultiple !== null) d.rTotal += t.rMultiple;
    d.trades.push(t);
  }
  for (const d of Object.values(out)) {
    d.winRate = d.count ? (d.wins / d.count) * 100 : 0;
  }
  return out;
}

/** Groups closed trades by an arbitrary dimension and computes per-bucket stats. */
export function groupStats(trades = [], keyFn, { minCount = 1, sortBy = "pnl" } = {}) {
  const buckets = new Map();

  for (const t of trades) {
    if (!t.hasResult) continue;
    const raw = typeof keyFn === "function" ? keyFn(t) : t[keyFn];
    const keys = Array.isArray(raw) ? raw : [raw];
    for (const k of keys) {
      if (k === null || k === undefined || k === "") continue;
      const key = String(k);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(t);
    }
  }

  const rows = [...buckets.entries()]
    .filter(([, list]) => list.length >= minCount)
    .map(([key, list]) => {
      const pnls = list.map((t) => t.pnl);
      const wins = pnls.filter((p) => p > 0);
      const losses = pnls.filter((p) => p < 0);
      const gp = sum(wins);
      const gl = Math.abs(sum(losses));
      const rs = list.map((t) => t.rMultiple).filter((r) => r !== null && Number.isFinite(r));
      return {
        key,
        count: list.length,
        pnl: sum(pnls),
        wins: wins.length,
        losses: losses.length,
        winRate: list.length ? (wins.length / list.length) * 100 : 0,
        profitFactor: gl > 0 ? gp / gl : gp > 0 ? Infinity : 0,
        avgPnl: mean(pnls),
        avgWin: wins.length ? mean(wins) : 0,
        avgLoss: losses.length ? Math.abs(mean(losses)) : 0,
        expectancy: list.length ? sum(pnls) / list.length : 0,
        avgR: rs.length ? mean(rs) : null,
        totalR: rs.length ? sum(rs) : null,
        best: pnls.length ? Math.max(...pnls) : 0,
        worst: pnls.length ? Math.min(...pnls) : 0,
        trades: list,
      };
    });

  const sorters = {
    pnl: (a, b) => b.pnl - a.pnl,
    count: (a, b) => b.count - a.count,
    winRate: (a, b) => b.winRate - a.winRate,
    expectancy: (a, b) => b.expectancy - a.expectancy,
    key: (a, b) => a.key.localeCompare(b.key),
  };
  rows.sort(sorters[sortBy] ?? sorters.pnl);
  return rows;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function byWeekday(trades = []) {
  const base = WEEKDAY_LABELS.map((label, i) => ({
    key: label,
    weekday: i,
    count: 0,
    pnl: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
  }));
  for (const t of trades) {
    if (!t.hasResult || t.weekday === null) continue;
    const b = base[t.weekday];
    b.count += 1;
    b.pnl += t.pnl;
    if (t.pnl > 0) b.wins += 1;
    else if (t.pnl < 0) b.losses += 1;
  }
  for (const b of base) b.winRate = b.count ? (b.wins / b.count) * 100 : 0;
  // Monday-first ordering
  return [...base.slice(1), base[0]];
}

export function byHour(trades = []) {
  const base = Array.from({ length: 24 }, (_, h) => ({
    key: `${String(h).padStart(2, "0")}:00`,
    hour: h,
    count: 0,
    pnl: 0,
    wins: 0,
    winRate: 0,
  }));
  for (const t of trades) {
    if (!t.hasResult || t.hour === null || t.hour === undefined) continue;
    const b = base[t.hour];
    if (!b) continue;
    b.count += 1;
    b.pnl += t.pnl;
    if (t.pnl > 0) b.wins += 1;
  }
  for (const b of base) b.winRate = b.count ? (b.wins / b.count) * 100 : 0;
  return base;
}

/** Histogram of P&L (or R) outcomes. */
export function distribution(trades = [], { bins = 12, key = "pnl" } = {}) {
  const values = trades
    .map((t) => t[key])
    .filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: min.toFixed(0), from: min, to: max, count: values.length, isPositive: min >= 0 }];
  }

  const step = (max - min) / bins;
  const out = Array.from({ length: bins }, (_, i) => {
    const from = min + i * step;
    const to = from + step;
    return {
      from,
      to,
      mid: (from + to) / 2,
      label: `${Math.round(from)}`,
      count: 0,
      isPositive: (from + to) / 2 >= 0,
    };
  });

  for (const v of values) {
    let idx = Math.floor((v - min) / step);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    out[idx].count += 1;
  }
  return out;
}

/** Rolling window metric series, e.g. 20-trade rolling win rate. */
export function rolling(trades = [], window = 20, fn) {
  const closed = closedTrades(trades);
  const out = [];
  for (let i = 0; i < closed.length; i += 1) {
    if (i + 1 < window) continue;
    const slice = closed.slice(i + 1 - window, i + 1);
    out.push({
      index: i + 1,
      date: closed[i].dateKey,
      value: fn(slice),
    });
  }
  return out;
}

export function cumulativeSeries(trades = [], { key = "pnl", startingValue = 0 } = {}) {
  const closed = closedTrades(trades);
  let acc = startingValue;
  return closed.map((t, i) => {
    acc += t[key] ?? 0;
    return { index: i + 1, date: t.dateKey, value: acc, delta: t[key] ?? 0, id: t.id };
  });
}

/** Aggregates daily buckets into a monthly summary for calendars/heatmaps. */
export function monthlySummary(days = {}) {
  const out = {};
  for (const d of Object.values(days)) {
    const monthKey = d.date.slice(0, 7);
    if (!out[monthKey]) {
      out[monthKey] = { month: monthKey, pnl: 0, count: 0, wins: 0, losses: 0, days: 0 };
    }
    out[monthKey].pnl += d.pnl;
    out[monthKey].count += d.count;
    out[monthKey].wins += d.wins;
    out[monthKey].losses += d.losses;
    out[monthKey].days += 1;
  }
  return out;
}

/**
 * Compares two metric objects, returning percentage deltas for headline stats.
 * Used for "vs previous period" chips.
 */
export function compareMetrics(current, previous) {
  if (!previous) return {};
  const delta = (a, b) => {
    if (b === 0 || b === null || b === undefined) return null;
    return ((a - b) / Math.abs(b)) * 100;
  };
  return {
    netPnl: delta(current.netPnl, previous.netPnl),
    winRate: current.winRate - previous.winRate,
    profitFactor: delta(current.profitFactor, previous.profitFactor),
    totalTrades: delta(current.totalTrades, previous.totalTrades),
    avgTrade: delta(current.avgTrade, previous.avgTrade),
    expectancy: delta(current.expectancy, previous.expectancy),
  };
}

/* ------------------------------------------------------------------ */
/* Insight generation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Produces prioritised, plain-language observations about a trader's edge.
 * Each insight: { id, tone, title, detail, metric }
 */
export function generateInsights(trades = [], metrics) {
  const m = metrics ?? computeMetrics(trades);
  const out = [];
  const closed = m.closed ?? closedTrades(trades);
  if (closed.length < 5) return out;

  const dimensions = [
    ["setup", "setup"],
    ["session", "session"],
    ["symbol", "symbol"],
    ["side", "direction"],
    ["timeframe", "timeframe"],
  ];

  for (const [field, label] of dimensions) {
    const groups = groupStats(closed, field, { minCount: Math.max(3, Math.floor(closed.length * 0.06)) });
    if (groups.length < 2) continue;

    const best = groups[0];
    const worst = groups[groups.length - 1];

    if (best.pnl > 0 && best.pnl > (m.grossProfit || 0) * 0.12) {
      out.push({
        id: `best-${field}`,
        tone: "profit",
        title: `${best.key} is your strongest ${label}`,
        detail: `${best.count} trades · ${best.winRate.toFixed(0)}% win rate · ${
          Number.isFinite(best.profitFactor) ? best.profitFactor.toFixed(2) : "∞"
        } profit factor.`,
        metric: best.pnl,
        weight: Math.abs(best.pnl),
      });
    }

    const leakThreshold = Math.max((m.grossProfit || 0) * 0.06, Math.abs(m.avgLoss) * 3);
    if (worst.pnl < 0 && Math.abs(worst.pnl) > leakThreshold) {
      out.push({
        id: `worst-${field}`,
        tone: "loss",
        title: `${worst.key} is bleeding your account`,
        detail: `${worst.count} trades cost you ${Math.abs(worst.pnl).toFixed(0)}. Cutting this ${label} alone would change your net result.`,
        metric: worst.pnl,
        weight: Math.abs(worst.pnl) * 1.2,
      });
    }
  }

  // Overtrading: days with far more trades than average perform worse
  const dayList = Object.values(m.days ?? {});
  if (dayList.length >= 6) {
    const avgCount = mean(dayList.map((d) => d.count));
    const heavy = dayList.filter((d) => d.count > avgCount * 1.5);
    const light = dayList.filter((d) => d.count <= avgCount);
    if (heavy.length >= 2 && light.length >= 2) {
      const heavyAvg = mean(heavy.map((d) => d.pnl));
      const lightAvg = mean(light.map((d) => d.pnl));
      if (heavyAvg < lightAvg && heavyAvg < 0) {
        out.push({
          id: "overtrading",
          tone: "warn",
          title: "High-volume days destroy your edge",
          detail: `Days with more than ${Math.ceil(avgCount * 1.5)} trades average ${heavyAvg.toFixed(0)} vs ${lightAvg.toFixed(0)} on normal days.`,
          metric: heavyAvg - lightAvg,
          weight: Math.abs(heavyAvg - lightAvg) * 3,
        });
      }
    }
  }

  // Risk consistency: outsized losses
  if (m.losses >= 4 && m.avgLoss > 0) {
    const bigLosses = closed.filter((t) => t.pnl < 0 && Math.abs(t.pnl) > m.avgLoss * 2);
    if (bigLosses.length) {
      const cost = Math.abs(sum(bigLosses.map((t) => t.pnl)));
      out.push({
        id: "outsized-losses",
        tone: "loss",
        title: `${bigLosses.length} outsized ${bigLosses.length === 1 ? "loss" : "losses"} broke your risk model`,
        detail: `They cost ${cost.toFixed(0)} — ${((cost / (m.grossLoss || 1)) * 100).toFixed(0)}% of all losses — from just ${((bigLosses.length / m.totalTrades) * 100).toFixed(0)}% of trades.`,
        metric: -cost,
        weight: cost * 1.5,
      });
    }
  }

  // Win rate vs payoff sanity
  if (m.totalTrades >= 20) {
    if (m.winRate < 40 && Number.isFinite(m.payoffRatio) && m.payoffRatio < 1.6) {
      out.push({
        id: "payoff-mismatch",
        tone: "warn",
        title: "Your payoff ratio can't support this win rate",
        detail: `At ${m.winRate.toFixed(0)}% wins you need winners ~${((100 - m.winRate) / m.winRate).toFixed(1)}× your losers; you're at ${m.payoffRatio.toFixed(2)}×.`,
        metric: m.payoffRatio,
        weight: 900,
      });
    }
    if (m.winRate > 60 && Number.isFinite(m.payoffRatio) && m.payoffRatio < 0.7) {
      out.push({
        id: "cutting-winners",
        tone: "warn",
        title: "You're cutting winners too early",
        detail: `${m.winRate.toFixed(0)}% of trades win but the average winner is only ${(m.payoffRatio * 100).toFixed(0)}% of the average loser.`,
        metric: m.payoffRatio,
        weight: 800,
      });
    }
  }

  // Weekday edge
  const weekdays = byWeekday(closed).filter((d) => d.count >= 3);
  if (weekdays.length >= 3) {
    const worstDay = [...weekdays].sort((a, b) => a.pnl - b.pnl)[0];
    if (worstDay.pnl < 0 && Math.abs(worstDay.pnl) > Math.abs(m.netPnl) * 0.2) {
      out.push({
        id: "worst-weekday",
        tone: "warn",
        title: `${worstDay.key} is consistently your worst day`,
        detail: `${worstDay.count} trades, ${worstDay.winRate.toFixed(0)}% win rate, ${worstDay.pnl.toFixed(0)} net.`,
        metric: worstDay.pnl,
        weight: Math.abs(worstDay.pnl),
      });
    }
  }

  // Streak / drawdown warning
  if (m.currentStreakType === "loss" && m.currentStreak >= 3) {
    out.push({
      id: "loss-streak",
      tone: "loss",
      title: `You're on a ${m.currentStreak}-trade losing streak`,
      detail: "Historically the highest-value action here is to reduce size until you print a green day.",
      metric: -m.currentStreak,
      weight: 1200,
    });
  }

  if (m.netPnl > 0 && Number.isFinite(m.profitFactor) && m.profitFactor >= 1.5) {
    out.push({
      id: "healthy-edge",
      tone: "profit",
      title: "Your edge is statistically healthy",
      detail: `Profit factor ${m.profitFactor.toFixed(2)}, expectancy ${m.expectancy.toFixed(0)} per trade across ${m.totalTrades} trades.`,
      metric: m.profitFactor,
      weight: 300,
    });
  }

  return out.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export function filterTrades(trades = [], filters = {}) {
  const { start, end, symbols, setups, sessions, sides, tags, search, minPnl, maxPnl, custom } = filters;

  return trades.filter((t) => {
    if (start && t.dateKey && t.dateKey < start) return false;
    if (end && t.dateKey && t.dateKey > end) return false;
    if ((start || end) && !t.dateKey) return false;
    if (symbols?.length && !symbols.includes(t.symbol)) return false;
    if (setups?.length && !setups.includes(t.setup)) return false;
    if (sessions?.length && !sessions.includes(t.session)) return false;
    if (sides?.length && !sides.includes(t.side)) return false;
    if (tags?.length && !tags.some((tag) => t.tags.includes(tag))) return false;
    if (minPnl != null && (t.pnl ?? 0) < minPnl) return false;
    if (maxPnl != null && (t.pnl ?? 0) > maxPnl) return false;
    if (custom) {
      for (const [key, values] of Object.entries(custom)) {
        if (!values?.length) continue;
        if (!values.includes(String(t.data?.[key] ?? ""))) return false;
      }
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = JSON.stringify(t.data ?? {}).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Common preset ranges, returned as { start, end } local date keys. */
export function dateRangePreset(preset, now = new Date()) {
  const d = (dt) => dateKey(dt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  switch (preset) {
    case "today":
      return { start: d(today), end: d(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      return { start: d(y), end: d(y) };
    }
    case "week":
      return { start: d(startOfWeek), end: d(today) };
    case "lastWeek": {
      const s = new Date(startOfWeek);
      s.setDate(s.getDate() - 7);
      const e = new Date(startOfWeek);
      e.setDate(e.getDate() - 1);
      return { start: d(s), end: d(e) };
    }
    case "month":
      return { start: d(new Date(now.getFullYear(), now.getMonth(), 1)), end: d(today) };
    case "lastMonth":
      return {
        start: d(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: d(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return { start: d(new Date(now.getFullYear(), q * 3, 1)), end: d(today) };
    }
    case "ytd":
      return { start: d(new Date(now.getFullYear(), 0, 1)), end: d(today) };
    case "30d": {
      const s = new Date(today);
      s.setDate(today.getDate() - 29);
      return { start: d(s), end: d(today) };
    }
    case "90d": {
      const s = new Date(today);
      s.setDate(today.getDate() - 89);
      return { start: d(s), end: d(today) };
    }
    case "12m": {
      const s = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);
      return { start: d(s), end: d(today) };
    }
    case "all":
    default:
      return { start: null, end: null };
  }
}

/** The equivalent window immediately before the supplied one. */
export function previousRange(start, end) {
  if (!start || !end) return { start: null, end: null };
  const s = parseDate(start);
  const e = parseDate(end);
  const span = Math.max(1, Math.round((e - s) / 86400000) + 1);
  const prevEnd = new Date(s);
  prevEnd.setDate(s.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (span - 1));
  return { start: dateKey(prevStart), end: dateKey(prevEnd) };
}

export const RANGE_PRESETS = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "30d", label: "Last 30 days" },
  { value: "quarter", label: "This quarter" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

/**
 * Stable system fields — accessed by key, not by guessing user-defined names.
 *
 * Each system field maps to one variables row (`type: "system"`, `system_key`).
 * The row's `name` is the trade.data column. Migration may promote an existing
 * custom variable (e.g. "exit tijd") onto a system key and remap trade data
 * so the journal stays on a single column.
 */

export const SYSTEM_FIELD_KEYS = {
  pnl: "pnl",
  date: "date",
  entryTime: "entryTime",
  exitTime: "exitTime",
  coin: "coin",
};

/** @type {Record<string, {
 *   key: string,
 *   defaultName: string,
 *   label: string,
 *   varType: string,
 *   phase: "pre"|"post",
 *   migrateAliases: string[],
 * }>} */
export const SYSTEM_FIELDS = {
  pnl: {
    key: SYSTEM_FIELD_KEYS.pnl,
    defaultName: "PnL",
    label: "PnL",
    varType: "number",
    phase: "post",
    migrateAliases: ["pnl", "p&l", "netpnl", "net pnl", "profit", "result", "resultaat", "winst"],
  },
  date: {
    key: SYSTEM_FIELD_KEYS.date,
    defaultName: "Datum",
    label: "Date",
    varType: "date",
    phase: "pre",
    migrateAliases: ["datum", "date", "tradedate", "trade date", "day", "dag"],
  },
  entryTime: {
    key: SYSTEM_FIELD_KEYS.entryTime,
    defaultName: "Entreetijd",
    label: "Entry time",
    varType: "datetime",
    phase: "pre",
    migrateAliases: [
      "entreetijd",
      "entry time",
      "entrytime",
      "entrytijd",
      "open time",
      "opentime",
      "time in",
      "start time",
      "starttijd",
    ],
  },
  exitTime: {
    key: SYSTEM_FIELD_KEYS.exitTime,
    defaultName: "Exittijd",
    label: "Exit time",
    varType: "datetime",
    phase: "post",
    migrateAliases: [
      "exittijd",
      "exit time",
      "exittime",
      "exit tijd",
      "close time",
      "closetime",
      "time out",
      "end time",
      "eindtijd",
    ],
  },
  coin: {
    key: SYSTEM_FIELD_KEYS.coin,
    defaultName: "Coin",
    label: "Coin",
    varType: "text",
    phase: "pre",
    migrateAliases: ["coin", "coins", "symbol", "ticker", "pair", "asset"],
  },
};

/** Always ensure these exist. Coin stays a normal custom dropdown (user-defined). */
export const REQUIRED_SYSTEM_KEYS = [
  SYSTEM_FIELD_KEYS.pnl,
  SYSTEM_FIELD_KEYS.entryTime,
  SYSTEM_FIELD_KEYS.exitTime,
];

/** True when value is bare HH:MM (legacy time field). */
export function isTimeOnlyValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (raw.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(raw)) return false;
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw);
}

/**
 * Resolve a fallback calendar day for legacy HH:MM values.
 * Accepts Date, YYYY-MM-DD, or datetime strings — never invents "today".
 */
export function resolveFallbackDate(fallbackDate) {
  if (!fallbackDate) return null;
  if (fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())) {
    return new Date(fallbackDate);
  }
  const raw = String(fallbackDate).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const day = raw.slice(0, 10);
    const d = new Date(`${day}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeFieldToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s_\-./&:#]+/g, "");
}

export function getSystemFieldDef(key) {
  return SYSTEM_FIELDS[key] ?? null;
}

export function readSystemKey(variable) {
  if (!variable || typeof variable !== "object") return null;
  const raw = variable.system_key ?? variable.systemKey ?? null;
  return raw ? String(raw) : null;
}

export function getSystemVariable(variables = [], systemKey) {
  if (!systemKey) return null;
  const list = Array.isArray(variables) ? variables : [];

  const byKey = list.find((v) => readSystemKey(v) === systemKey);
  if (byKey) return byKey;

  const def = getSystemFieldDef(systemKey);
  if (!def) return null;

  return (
    list.find(
      (v) =>
        v?.type === "system" &&
        normalizeFieldToken(v.name) === normalizeFieldToken(def.defaultName)
    ) ?? null
  );
}

export function getSystemDataKey(variables = [], systemKey) {
  const v = getSystemVariable(variables, systemKey);
  if (v?.name) return v.name;
  return getSystemFieldDef(systemKey)?.defaultName ?? null;
}

export function getTradeSystemValue(tradeOrData, variables = [], systemKey) {
  if (!tradeOrData) return undefined;
  const data =
    tradeOrData.data && typeof tradeOrData.data === "object"
      ? tradeOrData.data
      : tradeOrData;
  const key = getSystemDataKey(variables, systemKey);
  if (!key) return undefined;
  const value = data[key];
  if (value !== undefined && value !== "") return value;
  return undefined;
}

export function matchesSystemAlias(name, systemKey) {
  const def = getSystemFieldDef(systemKey);
  if (!def || !name) return false;
  const token = normalizeFieldToken(name);
  if (!token) return false;
  if (token === normalizeFieldToken(def.defaultName)) return true;
  return def.migrateAliases.some((alias) => {
    const a = normalizeFieldToken(alias);
    return a && token === a;
  });
}

export function findMigrationCandidate(variables = [], systemKey) {
  const list = Array.isArray(variables) ? variables : [];
  const def = getSystemFieldDef(systemKey);
  if (!def) return null;

  const unbound = list.filter((v) => {
    const sk = readSystemKey(v);
    return !sk || sk === systemKey;
  });

  const exact = unbound.find(
    (v) => normalizeFieldToken(v.name) === normalizeFieldToken(def.defaultName)
  );
  if (exact) return exact;

  return unbound.find((v) => matchesSystemAlias(v.name, systemKey)) ?? null;
}

export function systemFieldMap(variables = []) {
  const map = {};
  for (const key of Object.keys(SYSTEM_FIELDS)) {
    const bound = getSystemVariable(variables, key);
    if (bound?.name) map[key] = bound.name;
    else {
      const fallback = getSystemFieldDef(key)?.defaultName;
      if (fallback) map[key] = fallback;
    }
  }
  return map;
}

/**
 * Parse a trade timestamp that may be:
 * - datetime-local: 2026-08-01T14:30
 * - ISO: 2026-08-01T14:30:00.000Z
 * - date: 2026-08-01
 * - time-only: 14:30 (combined with fallbackDate)
 *
 * @returns {Date|null}
 */
export function parseTradeDateTime(value, fallbackDate = null) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // datetime-local or ISO-ish with T
  if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(raw)) {
    const d = new Date(raw.length === 16 ? `${raw}:00` : raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // date only
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // time only HH:MM — require an explicit calendar day (never invent today)
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (tm) {
    const base = resolveFallbackDate(fallbackDate);
    if (!base) return null;
    base.setHours(+tm[1], +tm[2], tm[3] ? +tm[3] : 0, 0);
    return base;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Format a Date for <input type="datetime-local"> */
export function toDatetimeLocalValue(value, fallbackDate = null) {
  const d = value instanceof Date ? value : parseTradeDateTime(value, fallbackDate);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** YYYY-MM-DD from a datetime/date value (for legacy Datum mirrors). */
export function toDateOnlyValue(value, fallbackDate = null) {
  const d = value instanceof Date ? value : parseTradeDateTime(value, fallbackDate);
  if (!d) {
    const base = resolveFallbackDate(fallbackDate);
    if (!base) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Upgrade legacy HH:MM entry/exit values to datetime using Datum.
 * Returns null when nothing changed.
 */
export function upgradeLegacyTimesInTradeData(data = {}) {
  if (!data || typeof data !== "object") return null;
  const datum = data.Datum || data.Date || data.date || null;
  if (!datum) return null;

  let next = null;
  const ensure = () => {
    if (!next) next = { ...data };
    return next;
  };

  if (isTimeOnlyValue(data.Entreetijd)) {
    const upgraded = toDatetimeLocalValue(data.Entreetijd, datum);
    if (upgraded) ensure().Entreetijd = upgraded;
  }
  if (isTimeOnlyValue(data.Exittijd)) {
    let upgraded = toDatetimeLocalValue(data.Exittijd, datum);
    if (upgraded && isTimeOnlyValue(data.Entreetijd || next?.Entreetijd)) {
      // overnight: exit clock before entry clock → next calendar day
      const entryAt = parseTradeDateTime(data.Entreetijd || next?.Entreetijd, datum);
      const exitAt = parseTradeDateTime(data.Exittijd, datum);
      if (entryAt && exitAt && exitAt < entryAt) {
        exitAt.setDate(exitAt.getDate() + 1);
        upgraded = toDatetimeLocalValue(exitAt);
      }
    }
    if (upgraded) ensure().Exittijd = upgraded;
  }

  return next;
}

/**
 * Hold duration in minutes from entry/exit values (supports multi-day).
 * Legacy same-day HH:MM overnight wrap kept as fallback when no dates exist.
 */
export function computeHoldMinutes({
  entryValue,
  exitValue,
  tradeDate = null,
} = {}) {
  const baseDate = resolveFallbackDate(tradeDate);
  const entryIsTimeOnly = isTimeOnlyValue(entryValue);
  const exitIsTimeOnly = isTimeOnlyValue(exitValue);

  // Both legacy HH:MM without calendar day → clock diff / overnight wrap only
  if (entryIsTimeOnly && exitIsTimeOnly && !baseDate) {
    const em = /^(\d{1,2}):(\d{2})/.exec(String(entryValue).trim());
    const xm = /^(\d{1,2}):(\d{2})/.exec(String(exitValue).trim());
    if (!em || !xm) return null;
    const entryMin = +em[1] * 60 + +em[2];
    const exitMin = +xm[1] * 60 + +xm[2];
    return exitMin >= entryMin ? exitMin - entryMin : exitMin + 24 * 60 - entryMin;
  }

  const entryAt = parseTradeDateTime(entryValue, baseDate);
  const exitAt = parseTradeDateTime(exitValue, baseDate);
  if (!entryAt || !exitAt) return null;

  // If both are time-only on the same trade date and exit < entry → next day
  if (entryIsTimeOnly && exitIsTimeOnly && baseDate && exitAt < entryAt) {
    exitAt.setDate(exitAt.getDate() + 1);
  }

  const diff = (exitAt.getTime() - entryAt.getTime()) / 60000;
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

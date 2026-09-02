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

/** Always ensure these exist for every journal. */
export const REQUIRED_SYSTEM_KEYS = [
  SYSTEM_FIELD_KEYS.pnl,
  SYSTEM_FIELD_KEYS.date,
  SYSTEM_FIELD_KEYS.entryTime,
  SYSTEM_FIELD_KEYS.exitTime,
  SYSTEM_FIELD_KEYS.coin,
];

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

  // time only HH:MM
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (tm) {
    const base =
      fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())
        ? new Date(fallbackDate)
        : new Date();
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

/**
 * Hold duration in minutes from entry/exit values (supports multi-day).
 * Legacy same-day HH:MM overnight wrap kept as fallback when no dates exist.
 */
export function computeHoldMinutes({
  entryValue,
  exitValue,
  tradeDate = null,
} = {}) {
  const baseDate = parseTradeDateTime(tradeDate) || (tradeDate instanceof Date ? tradeDate : null);

  const entryAt = parseTradeDateTime(entryValue, baseDate);
  const exitAt = parseTradeDateTime(exitValue, baseDate);
  if (!entryAt || !exitAt) return null;

  const entryIsTimeOnly = /^\d{1,2}:\d{2}/.test(String(entryValue ?? "").trim()) &&
    !String(entryValue).includes("T") &&
    !/^\d{4}-\d{2}-\d{2}/.test(String(entryValue));
  const exitIsTimeOnly = /^\d{1,2}:\d{2}/.test(String(exitValue ?? "").trim()) &&
    !String(exitValue).includes("T") &&
    !/^\d{4}-\d{2}-\d{2}/.test(String(exitValue));

  // Both legacy HH:MM without absolute dates → overnight wrap if needed
  if (entryIsTimeOnly && exitIsTimeOnly && !baseDate) {
    const entryMin = entryAt.getHours() * 60 + entryAt.getMinutes();
    const exitMin = exitAt.getHours() * 60 + exitAt.getMinutes();
    return exitMin >= entryMin ? exitMin - entryMin : exitMin + 24 * 60 - entryMin;
  }

  // If both are time-only on the same trade date and exit < entry → next day
  if (entryIsTimeOnly && exitIsTimeOnly && baseDate && exitAt < entryAt) {
    exitAt.setDate(exitAt.getDate() + 1);
  }

  const diff = (exitAt.getTime() - entryAt.getTime()) / 60000;
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

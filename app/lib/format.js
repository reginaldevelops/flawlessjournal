/**
 * Formatting helpers shared by every page so numbers, dates and currency
 * render identically across the app.
 */

export const DEFAULT_CURRENCY = "USD";

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "CHF ",
  AUD: "A$",
  CAD: "C$",
};

export function currencySymbol(currency = DEFAULT_CURRENCY) {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

export function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "" || value === "-")
    return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value)
    .replace(/[\s\u00a0]/g, "")
    .replace(/[$€£¥]/g, "")
    .replace(/,/g, ".")
    // keep a single leading minus and digits/dot
    .replace(/(?!^-)[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

/** 1234.5 -> "$1,234.50" ; compact: "$1.2K" */
export function formatCurrency(
  value,
  {
    currency = DEFAULT_CURRENCY,
    decimals,
    compact = false,
    signed = false,
    fallback = "—",
  } = {}
) {
  const n = toNumber(value);
  if (n === null) return fallback;

  const abs = Math.abs(n);
  const dp =
    decimals != null ? decimals : abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;

  const sym = currencySymbol(currency);
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";

  if (compact && abs >= 1000) {
    return `${sign}${sym}${compactNumber(abs)}`;
  }

  return `${sign}${sym}${abs.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

export function compactNumber(value) {
  const n = Math.abs(toNumber(value) ?? 0);
  if (n >= 1e9) return `${trimZeros(n / 1e9)}B`;
  if (n >= 1e6) return `${trimZeros(n / 1e6)}M`;
  if (n >= 1e3) return `${trimZeros(n / 1e3)}K`;
  return trimZeros(n);
}

function trimZeros(n) {
  const s = n.toFixed(n < 10 ? 2 : 1);
  return s.replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
}

export function formatNumber(value, { decimals = 2, signed = false, fallback = "—" } = {}) {
  const n = toNumber(value);
  if (n === null) return fallback;
  const sign = signed && n > 0 ? "+" : "";
  return (
    sign +
    n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

export function formatPercent(
  value,
  { decimals = 1, signed = false, fallback = "—" } = {}
) {
  const n = toNumber(value);
  if (n === null) return fallback;
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatR(value, { fallback = "—" } = {}) {
  const n = toNumber(value);
  if (n === null) return fallback;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

export function formatRatio(value, { fallback = "—", infinity = "∞" } = {}) {
  const n = toNumber(value);
  if (n === null) return fallback;
  if (!Number.isFinite(n)) return infinity;
  return n.toFixed(2);
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** Parses the many date shapes stored in trade JSON without TZ drift. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();
  if (!s) return null;

  // YYYY-MM-DD (treat as local midnight, not UTC)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // DD-MM-YYYY or DD/MM/YYYY
  const euro = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (euro) return new Date(+euro[3], +euro[2] - 1, +euro[1]);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local YYYY-MM-DD key (never shifts across timezones). */
export function dateKey(value) {
  const d = parseDate(value);
  if (!d) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDate(value, style = "medium") {
  const d = parseDate(value);
  if (!d) return "—";
  const opts = {
    short: { day: "numeric", month: "short" },
    medium: { day: "numeric", month: "short", year: "numeric" },
    long: { weekday: "short", day: "numeric", month: "long", year: "numeric" },
    monthYear: { month: "long", year: "numeric" },
    weekday: { weekday: "short" },
    numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
  }[style] ?? { day: "numeric", month: "short", year: "numeric" };
  return d.toLocaleDateString("en-GB", opts);
}

export function formatTime(value, { seconds = false } = {}) {
  const d = parseDate(value);
  if (!d) {
    // Bare "HH:MM" strings
    const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ""));
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "—";
  }
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
}

export function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return "—";
  return `${formatDate(d, "medium")} · ${formatTime(d)}`;
}

export function formatRelative(value) {
  const d = parseDate(value);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (abs < 45_000) return "just now";
  if (abs < hour) return rel(Math.round(diff / min), "minute");
  if (abs < day) return rel(Math.round(diff / hour), "hour");
  if (abs < 7 * day) return rel(Math.round(diff / day), "day");
  return formatDate(d, "medium");
}

function rel(delta, unit) {
  const n = Math.abs(delta);
  const plural = n === 1 ? unit : `${unit}s`;
  return delta > 0 ? `${n} ${plural} ago` : `in ${n} ${plural}`;
}

export function formatDuration(minutes) {
  const m = toNumber(minutes);
  if (m === null || m < 0) return "—";
  if (m < 1) return "<1m";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/* ------------------------------------------------------------------ */
/* Tone helpers                                                        */
/* ------------------------------------------------------------------ */

/** Returns "profit" | "loss" | "neutral" for a numeric value. */
export function tone(value, { neutralAt = 0 } = {}) {
  const n = toNumber(value);
  if (n === null || n === neutralAt) return "neutral";
  return n > neutralAt ? "profit" : "loss";
}

export function toneTextClass(value, { neutralAt = 0 } = {}) {
  const t = tone(value, { neutralAt });
  return t === "profit"
    ? "text-profit"
    : t === "loss"
      ? "text-loss"
      : "text-content-muted";
}

export function toneBgClass(value, { neutralAt = 0 } = {}) {
  const t = tone(value, { neutralAt });
  return t === "profit"
    ? "bg-profit-soft text-profit-fg"
    : t === "loss"
      ? "bg-loss-soft text-loss-fg"
      : "bg-neutralish-soft text-content-muted";
}

export function truncateMiddle(str, head = 6, tail = 6) {
  const s = String(str ?? "");
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

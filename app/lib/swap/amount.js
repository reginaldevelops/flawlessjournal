/**
 * Parse user-entered amounts — supports 1234.56, 1234,56, 1.234,56 and 1,234.56.
 */
export function parseLocaleAmount(raw) {
  let s = String(raw ?? "").trim().replace(/\s/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 9) {
      s = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Plain dot-decimal string for controlled inputs after preset clicks. */
export function formatAmountInput(value, maxDecimals = 6) {
  const n = typeof value === "number" ? value : parseLocaleAmount(value);
  if (n == null || n <= 0) return "";
  const factor = 10 ** maxDecimals;
  const rounded = Math.floor(n * factor) / factor;
  const fixed = rounded.toFixed(maxDecimals).replace(/\.?0+$/, "");
  return fixed;
}

export function toRawAmount(human, decimals) {
  const n =
    typeof human === "number" ? human : parseLocaleAmount(human);
  if (n == null || n <= 0) return null;
  const str = String(n);
  const [i, f = ""] = str.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  const raw = BigInt(i || "0") * BigInt(10 ** decimals) + BigInt(frac || "0");
  return raw.toString();
}

export function fromRawAmount(raw, decimals) {
  const s = String(raw ?? "0");
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  const out = frac ? `${whole}.${frac}` : whole;
  return Number(neg ? `-${out}` : out);
}

export function rawAmountFromPercent(rawBalance, percent) {
  const total = BigInt(rawBalance || "0");
  if (total <= 0n) return "0";
  const pct = Math.min(100, Math.max(0, Number(percent)));
  if (pct >= 100) return total.toString();
  return ((total * BigInt(Math.round(pct * 100))) / 10000n).toString();
}

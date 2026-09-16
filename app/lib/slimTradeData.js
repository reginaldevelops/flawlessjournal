/**
 * Strip bulky media from a trades.data JSON blob so list views (dashboard,
 * /trades, analytics) do not download chart screenshots or fill OHLC snapshots.
 *
 * Chart screenshots are stored as `data:image…` strings (up to ~1.8MB each).
 * Fetching every trade with those attached is why /trades can take many seconds.
 * The trade detail page still loads the full row for that one id.
 */

const DATA_IMAGE_PREFIX = "data:image";

function slimFills(fills) {
  if (!Array.isArray(fills)) return fills;
  return fills.map((fill) => {
    if (!fill || typeof fill !== "object") return fill;
    if (!("ohlcSnapshot" in fill)) return fill;
    const { ohlcSnapshot: _omit, ...rest } = fill;
    return rest;
  });
}

function slimPosition(fj) {
  if (!fj || typeof fj !== "object") return fj;
  const imageUrl =
    typeof fj.imageUrl === "string" && fj.imageUrl.startsWith(DATA_IMAGE_PREFIX)
      ? ""
      : fj.imageUrl;
  return {
    ...fj,
    imageUrl,
    fills: slimFills(fj.fills),
  };
}

function slimValue(key, value) {
  if (typeof value === "string" && value.startsWith(DATA_IMAGE_PREFIX)) return "";
  if (key === "_fj") return slimPosition(value);
  return value;
}

export function slimTradeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data ?? {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = slimValue(key, value);
  }
  return out;
}

export function slimTradeRow(row) {
  if (!row || typeof row !== "object") return row;
  if (!row.data) return row;
  return { ...row, data: slimTradeData(row.data) };
}

export function slimTradeRows(rows = []) {
  return rows.map(slimTradeRow);
}

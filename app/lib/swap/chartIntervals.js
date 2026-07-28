/**
 * Chart interval helpers — safe for client + server.
 */

export const CHART_TIMEFRAMES = [
  { id: "1m", timeframe: "minute", aggregate: 1, label: "1m", seconds: 60 },
  { id: "5m", timeframe: "minute", aggregate: 5, label: "5m", seconds: 300 },
  { id: "15m", timeframe: "minute", aggregate: 15, label: "15m", seconds: 900 },
  { id: "1h", timeframe: "hour", aggregate: 1, label: "1h", seconds: 3600 },
  { id: "4h", timeframe: "hour", aggregate: 4, label: "4h", seconds: 14400 },
  { id: "1d", timeframe: "day", aggregate: 1, label: "1d", seconds: 86400 },
];

/** Segmented control options for the entry chart. */
export const CHART_INTERVAL_OPTIONS = [
  { value: "auto", label: "Auto" },
  ...CHART_TIMEFRAMES.map((t) => ({ value: t.id, label: t.label })),
];

export function resolveChartTimeframe(id) {
  if (!id || id === "auto") return null;
  const key = String(id).toLowerCase();
  return CHART_TIMEFRAMES.find((t) => t.id === key || t.label === key) || null;
}

export function pickTimeframe(windowMinutes) {
  const w = Math.max(15, Number(windowMinutes) || 60);
  if (w <= 90) return CHART_TIMEFRAMES[0];
  if (w <= 400) return CHART_TIMEFRAMES[1];
  if (w <= 1200) return CHART_TIMEFRAMES[2];
  if (w <= 60 * 72) return CHART_TIMEFRAMES[3];
  if (w <= 60 * 24 * 21) return CHART_TIMEFRAMES[4];
  return CHART_TIMEFRAMES[5];
}

export function pickTimeframeForTarget(spanSeconds, target = 100) {
  const span = Math.max(60, spanSeconds);
  for (const tf of CHART_TIMEFRAMES) {
    if (span / tf.seconds <= target * 1.6) return tf;
  }
  return CHART_TIMEFRAMES[CHART_TIMEFRAMES.length - 1];
}

/**
 * Suggest interval from trade duration (first→last fill), before padding.
 */
export function suggestIntervalFromTradeDuration(spanSeconds) {
  const s = Math.max(0, Number(spanSeconds) || 0);
  if (s <= 90 * 60) return "1m";
  if (s <= 8 * 3600) return "5m";
  if (s <= 36 * 3600) return "15m";
  if (s <= 10 * 86400) return "1h";
  if (s <= 45 * 86400) return "4h";
  return "1d";
}

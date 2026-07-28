/**
 * In-memory volume history for spike detection across scanner polls.
 * Survives within a warm serverless/node process; cold starts simply reset.
 */

const history = new Map(); // pairAddress -> { ts, volumes: { h1, h6, h24 } }
const MAX_ENTRIES = 2_000;
const STALE_MS = 2 * 60 * 60 * 1000;

export function rememberVolumes(pairs, now = Date.now()) {
  for (const pair of pairs) {
    if (!pair?.pairAddress) continue;
    history.set(pair.pairAddress, {
      ts: now,
      volumes: {
        h1: Number(pair.volume?.h1) || 0,
        h6: Number(pair.volume?.h6) || 0,
        h24: Number(pair.volume?.h24) || 0,
      },
    });
  }
  prune(now);
}

export function previousVolumes(pairAddress) {
  return history.get(pairAddress) ?? null;
}

export function spikeMeta(pair, windowField, { spikePct = 50 } = {}) {
  const prev = history.get(pair.pairAddress);
  const current = Number(pair.volume?.[windowField]) || 0;
  if (!prev) {
    return { isSpike: false, prevVolume: null, liftPct: null, firstSeen: true };
  }
  const previous = Number(prev.volumes?.[windowField]) || 0;
  if (previous <= 0) {
    return {
      isSpike: current > 0,
      prevVolume: previous,
      liftPct: null,
      firstSeen: false,
    };
  }
  const liftPct = ((current - previous) / previous) * 100;
  return {
    isSpike: liftPct >= spikePct,
    prevVolume: previous,
    liftPct,
    firstSeen: false,
  };
}

function prune(now) {
  if (history.size <= MAX_ENTRIES) {
    for (const [key, row] of history) {
      if (now - row.ts > STALE_MS) history.delete(key);
    }
    return;
  }
  const entries = [...history.entries()].sort((a, b) => a[1].ts - b[1].ts);
  const drop = history.size - MAX_ENTRIES + 100;
  for (let i = 0; i < drop; i += 1) history.delete(entries[i][0]);
}

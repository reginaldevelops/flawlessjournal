/**
 * Best-effort pump.fun launch / migration estimates for Solana heat.
 * Samples newest coins until ~30–60 minutes of history, then extrapolates to 24h.
 */

const PUMP_API = "https://frontend-api-v3.pump.fun";
const PAGE = 50;
const MAX_PAGES = 12; // 600 coins max
const TARGET_SPAN_MS = 45 * 60 * 1000; // ~45 minutes of creates

async function fetchCoins({ offset = 0, limit = PAGE, complete = false, signal } = {}) {
  const url = new URL(`${PUMP_API}/coins`);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "created_timestamp");
  url.searchParams.set("order", "DESC");
  url.searchParams.set("includeNsfw", "false");
  if (complete) url.searchParams.set("complete", "true");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": "FlawlessJournal/1.0",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`pump.fun ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function collectSample({ complete = false, signal } = {}) {
  const coins = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await fetchCoins({
      offset: page * PAGE,
      limit: PAGE,
      complete,
      signal,
    });
    if (!batch.length) break;
    coins.push(...batch);
    const newest = Number(coins[0]?.created_timestamp) || 0;
    const oldest = Number(coins[coins.length - 1]?.created_timestamp) || 0;
    if (newest && oldest && newest - oldest >= TARGET_SPAN_MS) break;
    if (batch.length < PAGE) break;
  }
  return coins;
}

function estimateFromSample(coins, windowMs = 24 * 3600 * 1000) {
  if (!coins?.length) {
    return { estimate: null, sampleSize: 0, sampleHours: null, reliable: false };
  }
  const times = coins
    .map((c) => Number(c?.created_timestamp) || 0)
    .filter((t) => t > 0)
    .sort((a, b) => b - a);
  if (times.length < 10) {
    return {
      estimate: null,
      sampleSize: times.length,
      sampleHours: null,
      reliable: false,
    };
  }
  const newest = times[0];
  const oldest = times[times.length - 1];
  const span = Math.max(1, newest - oldest);
  const sampleHours = span / 3600000;
  // Need a meaningful span before extrapolating
  if (span < 10 * 60 * 1000) {
    return {
      estimate: null,
      sampleSize: times.length,
      sampleHours: Math.round(sampleHours * 100) / 100,
      reliable: false,
    };
  }
  const rate = times.length / span;
  const estimate = Math.round(rate * windowMs);
  return {
    estimate,
    sampleSize: times.length,
    sampleHours: Math.round(sampleHours * 100) / 100,
    reliable: true,
  };
}

/**
 * @returns {{
 *  launches24h: number|null,
 *  migrations24h: number|null,
 *  method: string,
 *  note: string,
 * }}
 */
export async function fetchPumpLaunchStats({ signal } = {}) {
  try {
    const [fresh, graduated] = await Promise.all([
      collectSample({ complete: false, signal }),
      collectSample({ complete: true, signal }),
    ]);

    const launches = estimateFromSample(fresh);
    const migrations = estimateFromSample(graduated);

    return {
      launches24h: launches.reliable ? launches.estimate : null,
      migrations24h: migrations.reliable ? migrations.estimate : null,
      method: "rate-sample",
      note: "Estimated from recent pump.fun creates (rate × 24h), not a full census.",
      sample: {
        launches: launches.sampleSize,
        migrations: migrations.sampleSize,
        launchSampleHours: launches.sampleHours,
        migrationSampleHours: migrations.sampleHours,
        launchesReliable: launches.reliable,
        migrationsReliable: migrations.reliable,
      },
    };
  } catch (err) {
    return {
      launches24h: null,
      migrations24h: null,
      method: "unavailable",
      note: err?.message || "pump.fun unavailable",
      sample: null,
    };
  }
}

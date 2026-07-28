import { SOL_MINT } from "../chain/constants";
import { fetchJson } from "../chain/http";
import {
  DEFAULT_RPC,
  JITO_TIP_FLOOR_URL,
  JUPITER_PRICE_API,
  MAX_JITO_TIP_USD,
  MAX_PRIORITY_FEE_USD,
  SWAP_CU_ESTIMATE,
} from "./constants";

/** Linear percentile (0–100) over a sorted numeric array. */
export function percentile(sorted, p) {
  if (!sorted?.length) return 0;
  const clamped = Math.min(100, Math.max(0, p));
  const idx = ((sorted.length - 1) * clamped) / 100;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function usdToLamports(usd, solPriceUsd) {
  const px = Number(solPriceUsd);
  if (!Number.isFinite(px) || px <= 0) return 0;
  return Math.max(0, Math.floor((Number(usd) / px) * 1e9));
}

export function lamportsToUsd(lamports, solPriceUsd) {
  const px = Number(solPriceUsd);
  if (!Number.isFinite(px) || px <= 0) return 0;
  return (Number(lamports) / 1e9) * px;
}

async function fetchSolPriceUsd() {
  try {
    const data = await fetchJson(`${JUPITER_PRICE_API}?ids=${SOL_MINT}`, {
      label: "SOL price",
      timeout: 8000,
    });
    const px = data?.[SOL_MINT]?.usdPrice;
    return Number.isFinite(px) && px > 0 ? px : null;
  } catch {
    return null;
  }
}

/**
 * p90 micro-lamports / CU from recent prioritization fees (non-zero samples).
 */
async function fetchPriorityMicroPerCuP90(rpcUrl) {
  try {
    const json = await fetchJson(rpcUrl, {
      label: "priority fees",
      method: "POST",
      timeout: 10_000,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getRecentPrioritizationFees",
        params: [[]],
      }),
    });
    const samples = Array.isArray(json?.result) ? json.result : [];
    const values = samples
      .map((s) => Number(s?.prioritizationFee) || 0)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (!values.length) return { microPerCu: 50_000, sampleSize: 0 };
    return {
      microPerCu: Math.ceil(percentile(values, 90)),
      sampleSize: values.length,
    };
  } catch (error) {
    console.warn("[fees] priority p90:", error.message);
    return { microPerCu: 50_000, sampleSize: 0, error: error.message };
  }
}

/**
 * Jito tip floor — interpolate ~p90 between landed 75th and 95th (SOL).
 */
async function fetchJitoTipSolP90() {
  try {
    const data = await fetchJson(JITO_TIP_FLOOR_URL, {
      label: "Jito tip floor",
      timeout: 8000,
    });
    const row = Array.isArray(data) ? data[0] : data;
    const p75 = Number(row?.landed_tips_75th_percentile) || 0;
    const p95 = Number(row?.landed_tips_95th_percentile) || 0;
    // 90 is 75% of the way from 75 → 95
    const p90 = p75 + (p95 - p75) * 0.75;
    return {
      tipSol: Math.max(p90, p75, 0.000001),
      p75,
      p95,
    };
  } catch (error) {
    console.warn("[fees] jito tip:", error.message);
    return { tipSol: 0.0001, p75: null, p95: null, error: error.message };
  }
}

/**
 * Live fee quote used by /api/swap/fees and enforced again in /api/swap/build.
 */
export async function estimateSwapFees({
  rpcUrl = DEFAULT_RPC,
  feeMode = "priority",
} = {}) {
  const [solPriceUsd, priority, jito] = await Promise.all([
    fetchSolPriceUsd(),
    fetchPriorityMicroPerCuP90(rpcUrl),
    fetchJitoTipSolP90(),
  ]);

  const solPx = solPriceUsd ?? 100;
  const maxPriorityLamports = usdToLamports(MAX_PRIORITY_FEE_USD, solPx);
  const maxJitoLamports = usdToLamports(MAX_JITO_TIP_USD, solPx);

  const rawPriorityLamports = Math.ceil(
    (priority.microPerCu * SWAP_CU_ESTIMATE) / 1_000_000
  );
  const priorityLamports = Math.min(
    Math.max(rawPriorityLamports, 1_000),
    maxPriorityLamports
  );

  const rawJitoLamports = Math.ceil((jito.tipSol || 0) * 1e9);
  const jitoLamports = Math.min(
    Math.max(rawJitoLamports, 1_000),
    maxJitoLamports
  );

  return {
    solPriceUsd,
    feeMode,
    priority: {
      percentile: 90,
      microLamportsPerCu: priority.microPerCu,
      estimatedCu: SWAP_CU_ESTIMATE,
      lamports: priorityLamports,
      usd: lamportsToUsd(priorityLamports, solPx),
      uncappedLamports: rawPriorityLamports,
      maxUsd: MAX_PRIORITY_FEE_USD,
      capped: rawPriorityLamports > maxPriorityLamports,
      sampleSize: priority.sampleSize,
    },
    jito: {
      percentile: 90,
      tipSol: jito.tipSol,
      lamports: jitoLamports,
      usd: lamportsToUsd(jitoLamports, solPx),
      uncappedLamports: rawJitoLamports,
      maxUsd: MAX_JITO_TIP_USD,
      capped: rawJitoLamports > maxJitoLamports,
      p75Sol: jito.p75,
      p95Sol: jito.p95,
    },
    fetchedAt: new Date().toISOString(),
  };
}

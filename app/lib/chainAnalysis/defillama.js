/**
 * DefiLlama free API helpers for chain heat / volume research.
 * Docs: https://api.llama.fi
 */

export const LLAMA_API = "https://api.llama.fi";

export const CHAINS = {
  solana: {
    id: "solana",
    label: "Solana",
    llamaDex: "Solana",
    llamaTvl: "Solana",
    llamaFees: "Solana",
    focus: "DEX + launchpads",
  },
  hyperliquid: {
    id: "hyperliquid",
    label: "Hyperliquid",
    llamaDex: "Hyperliquid",
    llamaTvl: "Hyperliquid L1",
    llamaFees: "Hyperliquid",
    focus: "Perps / spot venue scale",
  },
};

async function llamaGet(path, { searchParams, signal } = {}) {
  const url = new URL(path.startsWith("http") ? path : `${LLAMA_API}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DefiLlama ${res.status}: ${text.slice(0, 160) || res.statusText}`);
  }
  return res.json();
}

function pctChange(curr, prev) {
  if (!(curr > 0) || !(prev > 0)) return null;
  return ((curr - prev) / prev) * 100;
}

function normalizeChart(raw = []) {
  // Llama returns either [[ts, value], ...] or [{date, tvl|volume}, ...]
  return raw
    .map((row) => {
      if (Array.isArray(row)) {
        return { t: Number(row[0]), v: Number(row[1]) };
      }
      const t = Number(row?.date ?? row?.t ?? 0);
      const v = Number(row?.tvl ?? row?.volume ?? row?.v ?? row?.value ?? 0);
      return { t, v };
    })
    .filter((p) => Number.isFinite(p.t) && p.t > 0 && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);
}

function trimChart(points, days) {
  if (!points?.length) return [];
  if (!days) return points;
  const lastT = points[points.length - 1].t;
  // Llama charts use unix seconds
  const cutoff = lastT - days * 86400;
  return points.filter((p) => p.t >= cutoff);
}

function mapProtocols(list = [], { limit = 12 } = {}) {
  return [...list]
    .filter((p) => (p?.total24h ?? 0) > 0)
    .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
    .slice(0, limit)
    .map((p) => ({
      name: p.displayName || p.name,
      slug: p.slug || null,
      category: p.category || null,
      logo: p.logo || null,
      total24h: p.total24h ?? null,
      total7d: p.total7d ?? null,
      change1d: p.change_1d ?? null,
      change7d: p.change_7d ?? null,
    }));
}

/**
 * Heat score from recent volume / fee momentum.
 * Positive = hotter than usual; negative = cooling.
 */
export function computeHeat({ change1d, change7d, volume24h, volume7dAvg } = {}) {
  const c1 = Number(change1d);
  const c7 = Number(change7d);
  let score = 0;
  if (Number.isFinite(c1)) score += Math.max(-40, Math.min(40, c1 * 0.45));
  if (Number.isFinite(c7)) score += Math.max(-30, Math.min(30, c7 * 0.35));
  if (volume24h > 0 && volume7dAvg > 0) {
    const vsAvg = ((volume24h - volume7dAvg) / volume7dAvg) * 100;
    score += Math.max(-25, Math.min(25, vsAvg * 0.25));
  }
  let label = "Neutral";
  let tone = "neutral";
  if (score >= 25) {
    label = "Hot";
    tone = "profit";
  } else if (score >= 8) {
    label = "Warm";
    tone = "brand";
  } else if (score <= -25) {
    label = "Cold";
    tone = "loss";
  } else if (score <= -8) {
    label = "Cooling";
    tone = "warn";
  }
  return { score: Math.round(score * 10) / 10, label, tone };
}

export async function fetchChainSnapshot(chainId, { signal } = {}) {
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`Unknown chain: ${chainId}`);

  const [chains, tvlHist, dex, fees, revenue] = await Promise.all([
    llamaGet("/v2/chains", { signal }),
    llamaGet(`/v2/historicalChainTvl/${encodeURIComponent(cfg.llamaTvl)}`, { signal }).catch(
      () => []
    ),
    llamaGet(`/overview/dexs/${encodeURIComponent(cfg.llamaDex)}`, {
      signal,
      searchParams: {
        excludeTotalDataChart: "false",
        excludeTotalDataChartBreakdown: "true",
      },
    }),
    llamaGet(`/overview/fees/${encodeURIComponent(cfg.llamaFees)}`, {
      signal,
      searchParams: {
        excludeTotalDataChart: "false",
        excludeTotalDataChartBreakdown: "true",
        dataType: "dailyFees",
      },
    }),
    llamaGet(`/overview/fees/${encodeURIComponent(cfg.llamaFees)}`, {
      signal,
      searchParams: {
        excludeTotalDataChart: "false",
        excludeTotalDataChartBreakdown: "true",
        dataType: "dailyRevenue",
      },
    }),
  ]);

  const chainRow = (Array.isArray(chains) ? chains : []).find(
    (c) => String(c?.name || "").toLowerCase() === cfg.llamaTvl.toLowerCase()
  );

  const tvlChart = normalizeChart(tvlHist);
  const dexChart = normalizeChart(dex?.totalDataChart);
  const feesChart = normalizeChart(fees?.totalDataChart);
  const revenueChart = normalizeChart(revenue?.totalDataChart);

  const tvlNow = Number(chainRow?.tvl ?? tvlChart.at(-1)?.v ?? 0) || 0;
  const tvlPrev = tvlChart.length >= 2 ? tvlChart[tvlChart.length - 2].v : null;

  const volume24h = Number(dex?.total24h) || 0;
  const volume7d = Number(dex?.total7d) || 0;
  const volume7dAvg = volume7d > 0 ? volume7d / 7 : null;

  const heat = computeHeat({
    change1d: dex?.change_1d,
    change7d: dex?.change_7d,
    volume24h,
    volume7dAvg,
  });

  // Launchpad-ish names for Solana activity context
  const launchProtocols = mapProtocols(revenue?.protocols || fees?.protocols || [], {
    limit: 40,
  }).filter((p) =>
    /pump|launch|bonk\.fun|bags|moonshot|letsbonk|believe/i.test(
      `${p.name} ${p.category || ""} ${p.slug || ""}`
    )
  );

  return {
    chain: cfg,
    fetchedAt: new Date().toISOString(),
    heat,
    stats: {
      tvl: tvlNow,
      tvlChange1d: pctChange(tvlNow, tvlPrev),
      dexVolume24h: volume24h,
      dexVolumeChange1d: dex?.change_1d ?? null,
      dexVolumeChange7d: dex?.change_7d ?? null,
      dexVolume7d: volume7d || null,
      fees24h: Number(fees?.total24h) || 0,
      feesChange1d: fees?.change_1d ?? null,
      revenue24h: Number(revenue?.total24h) || 0,
      revenueChange1d: revenue?.change_1d ?? null,
    },
    topDexs: mapProtocols(dex?.protocols),
    topFees: mapProtocols(fees?.protocols),
    topRevenue: mapProtocols(revenue?.protocols),
    launchpads: launchProtocols.slice(0, 10),
    charts: {
      tvl: {
        "30d": trimChart(tvlChart, 30),
        "90d": trimChart(tvlChart, 90),
        "365d": trimChart(tvlChart, 365),
      },
      dexVolume: {
        "30d": trimChart(dexChart, 30),
        "90d": trimChart(dexChart, 90),
        "365d": trimChart(dexChart, 365),
      },
      fees: {
        "30d": trimChart(feesChart, 30),
        "90d": trimChart(feesChart, 90),
        "365d": trimChart(feesChart, 365),
      },
      revenue: {
        "30d": trimChart(revenueChart, 30),
        "90d": trimChart(revenueChart, 90),
        "365d": trimChart(revenueChart, 365),
      },
    },
  };
}

/** Lightweight strip for chain switcher cards (avoids full double snapshot). */
export async function fetchCompareStrip({ signal } = {}) {
  const [chains, ...dexRows] = await Promise.all([
    llamaGet("/v2/chains", { signal }),
    ...Object.values(CHAINS).map((cfg) =>
      llamaGet(`/overview/dexs/${encodeURIComponent(cfg.llamaDex)}`, {
        signal,
        searchParams: {
          excludeTotalDataChart: "true",
          excludeTotalDataChartBreakdown: "true",
        },
      }).catch((err) => ({ error: err?.message || "Failed", chain: cfg.id }))
    ),
  ]);

  const chainList = Array.isArray(chains) ? chains : [];

  return Object.values(CHAINS).map((cfg, i) => {
    const dex = dexRows[i];
    if (dex?.error) {
      return { id: cfg.id, label: cfg.label, error: dex.error };
    }
    const chainRow = chainList.find(
      (c) => String(c?.name || "").toLowerCase() === cfg.llamaTvl.toLowerCase()
    );
    const volume24h = Number(dex?.total24h) || 0;
    const volume7d = Number(dex?.total7d) || 0;
    const heat = computeHeat({
      change1d: dex?.change_1d,
      change7d: dex?.change_7d,
      volume24h,
      volume7dAvg: volume7d > 0 ? volume7d / 7 : null,
    });
    return {
      id: cfg.id,
      label: cfg.label,
      heat,
      tvl: Number(chainRow?.tvl) || null,
      dexVolume24h: volume24h,
      dexVolumeChange1d: dex?.change_1d ?? null,
    };
  });
}

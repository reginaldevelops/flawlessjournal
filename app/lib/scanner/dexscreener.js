/**
 * DexScreener client for the Flawless Scanner.
 *
 * Strategy (realistic + free, no API key):
 *  1. Discover active tokens via boosts + profiles + trending metas
 *  2. Enrich with pair metrics (volume / liquidity / mcap / age)
 *  3. Filter + sort server-side against user thresholds
 *
 * Going deeper to raw DEX RPCs (Raydium/Uniswap) would need paid infra
 * (Helius/Moralis/Birdeye). DexScreener already aggregates that source data.
 */

import { fetchJson } from "../chain/http";
import { DEX_API, SCANNER_CHAINS } from "./constants";
import { previousVolumes, rememberVolumes, spikeMeta } from "./history";

const META_LIMIT = 6;
const BATCH = 30;

function num(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

async function safeGet(path, label) {
  try {
    return await fetchJson(`${DEX_API}${path}`, {
      label,
      timeout: 10_000,
      retries: 1,
    });
  } catch (error) {
    console.warn(`[scanner] ${label}:`, error.message);
    return null;
  }
}

/** Collect { chainId, tokenAddress } discovery candidates. */
async function discoverTokens(chains) {
  const chainSet = new Set(chains);
  const byKey = new Map();

  const add = (chainId, tokenAddress, source) => {
    if (!chainId || !tokenAddress) return;
    if (chainSet.size && !chainSet.has(chainId)) return;
    const key = `${chainId}:${tokenAddress.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, { chainId, tokenAddress, sources: new Set([source]) });
    else byKey.get(key).sources.add(source);
  };

  const [boosts, profiles, metas] = await Promise.all([
    safeGet("/token-boosts/latest/v1", "dex-boosts"),
    safeGet("/token-profiles/latest/v1", "dex-profiles"),
    safeGet("/metas/trending/v1", "dex-metas"),
  ]);

  for (const row of Array.isArray(boosts) ? boosts : []) {
    add(row.chainId, row.tokenAddress, "boost");
  }
  for (const row of Array.isArray(profiles) ? profiles : []) {
    add(row.chainId, row.tokenAddress, "profile");
  }

  // Trending metas → pair lists (already rich; also harvest token addresses)
  const metaList = Array.isArray(metas) ? metas.slice(0, META_LIMIT) : [];
  const metaPayloads = await Promise.all(
    metaList.map((m) =>
      m?.slug
        ? safeGet(`/metas/meta/v1/${encodeURIComponent(m.slug)}`, `dex-meta:${m.slug}`)
        : null
    )
  );

  const earlyPairs = [];
  for (const payload of metaPayloads) {
    for (const pair of payload?.pairs ?? []) {
      if (chainSet.size && !chainSet.has(pair.chainId)) continue;
      earlyPairs.push(pair);
      add(pair.chainId, pair.baseToken?.address, "meta");
    }
  }

  return { tokens: [...byKey.values()], earlyPairs };
}

async function enrichTokens(tokens) {
  const byChain = new Map();
  for (const t of tokens) {
    if (!byChain.has(t.chainId)) byChain.set(t.chainId, []);
    byChain.get(t.chainId).push(t.tokenAddress);
  }

  const pairs = [];
  const jobs = [];

  for (const [chainId, addresses] of byChain) {
    const unique = [...new Set(addresses)];
    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);
      jobs.push(
        safeGet(
          `/tokens/v1/${encodeURIComponent(chainId)}/${chunk.join(",")}`,
          `dex-tokens:${chainId}`
        ).then((data) => {
          if (Array.isArray(data)) pairs.push(...data);
        })
      );
    }
  }

  await Promise.all(jobs);
  return pairs;
}

function pickBestPair(pairs) {
  // One row per base token+chain — keep the highest-liquidity pool.
  const best = new Map();
  for (const pair of pairs) {
    if (!pair?.pairAddress || !pair?.baseToken?.address) continue;
    const key = `${pair.chainId}:${pair.baseToken.address.toLowerCase()}`;
    const liq = num(pair.liquidity?.usd);
    const prev = best.get(key);
    if (!prev || liq > num(prev.liquidity?.usd)) best.set(key, pair);
  }
  return [...best.values()];
}

function pairAgeHours(pair, now = Date.now()) {
  const created = num(pair.pairCreatedAt, 0);
  if (!created) return null;
  return Math.max(0, (now - created) / 3_600_000);
}

function normalizeHit(pair, { volumeWindow, spikePct }, now = Date.now()) {
  const windowField = volumeWindow || "h1";
  const volume = {
    m5: num(pair.volume?.m5),
    h1: num(pair.volume?.h1),
    h6: num(pair.volume?.h6),
    h24: num(pair.volume?.h24),
  };
  const priceChange = {
    m5: num(pair.priceChange?.m5, null),
    h1: num(pair.priceChange?.h1, null),
    h6: num(pair.priceChange?.h6, null),
    h24: num(pair.priceChange?.h24, null),
  };
  const txns = pair.txns?.[windowField] ?? pair.txns?.h1 ?? {};
  const spike = spikeMeta(pair, windowField, { spikePct });
  const ageHours = pairAgeHours(pair, now);

  return {
    id: `${pair.chainId}:${pair.pairAddress}`,
    pairAddress: pair.pairAddress,
    chainId: pair.chainId,
    dexId: pair.dexId,
    url: pair.url,
    baseToken: {
      address: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
    },
    quoteToken: {
      symbol: pair.quoteToken?.symbol ?? null,
    },
    priceUsd: num(pair.priceUsd, null),
    volume,
    volumeWindow: windowField,
    volumeActive: volume[windowField] ?? 0,
    priceChange,
    changeActive: priceChange[windowField],
    liquidityUsd: num(pair.liquidity?.usd, null),
    marketCap: num(pair.marketCap ?? pair.fdv, null),
    fdv: num(pair.fdv, null),
    pairCreatedAt: pair.pairCreatedAt ?? null,
    ageHours,
    buys: num(txns.buys),
    sells: num(txns.sells),
    imageUrl: pair.info?.imageUrl ?? null,
    boosts: num(pair.boosts?.active, null),
    spike: {
      isSpike: spike.isSpike,
      liftPct: spike.liftPct,
      prevVolume: spike.prevVolume,
      firstSeen: spike.firstSeen,
    },
  };
}

function passesFilters(hit, filters) {
  if (filters.chains?.length && !filters.chains.includes(hit.chainId)) return false;

  const vol = hit.volumeActive;
  if (filters.minVolume > 0 && vol < filters.minVolume) return false;

  if (filters.minLiquidity > 0) {
    if (hit.liquidityUsd == null || hit.liquidityUsd < filters.minLiquidity) return false;
  }

  if (filters.minMcap > 0) {
    if (hit.marketCap == null || hit.marketCap < filters.minMcap) return false;
  }
  if (filters.maxMcap > 0) {
    if (hit.marketCap == null || hit.marketCap > filters.maxMcap) return false;
  }

  if (filters.maxAgeHours > 0) {
    if (hit.ageHours == null || hit.ageHours > filters.maxAgeHours) return false;
  }
  if (filters.minAgeHours > 0) {
    if (hit.ageHours == null || hit.ageHours < filters.minAgeHours) return false;
  }

  if (filters.mode === "spike" && !hit.spike.isSpike && !hit.spike.firstSeen) {
    // First sighting still shown if it clears absolute volume — spike needs prior sample.
    // After we have history, require an actual spike.
    const prev = previousVolumes(hit.pairAddress);
    if (prev) return hit.spike.isSpike;
  }

  return true;
}

function sortHits(hits, sort) {
  const copy = [...hits];
  switch (sort) {
    case "change":
      return copy.sort((a, b) => (b.changeActive ?? -Infinity) - (a.changeActive ?? -Infinity));
    case "liquidity":
      return copy.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
    case "mcap":
      return copy.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    case "age":
      return copy.sort((a, b) => (a.ageHours ?? Infinity) - (b.ageHours ?? Infinity));
    case "txns":
      return copy.sort((a, b) => b.buys + b.sells - (a.buys + a.sells));
    case "volume":
    default:
      return copy.sort((a, b) => b.volumeActive - a.volumeActive);
  }
}

export function parseScannerFilters(searchParams) {
  const chainsRaw = searchParams.get("chains");
  const known = new Set(SCANNER_CHAINS.map((c) => c.id));
  const chains = chainsRaw
    ? chainsRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((id) => known.has(id))
    : ["solana", "base", "ethereum"];

  const volumeWindow = ["h1", "h6", "h24"].includes(searchParams.get("volumeWindow"))
    ? searchParams.get("volumeWindow")
    : "h1";

  const mode = searchParams.get("mode") === "spike" ? "spike" : "threshold";

  const numParam = (key, fallback) => {
    const raw = searchParams.get(key);
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const sort = ["volume", "change", "liquidity", "mcap", "age", "txns"].includes(
    searchParams.get("sort")
  )
    ? searchParams.get("sort")
    : "volume";

  return {
    chains,
    volumeWindow,
    minVolume: numParam("minVolume", 25_000),
    minLiquidity: numParam("minLiquidity", 10_000),
    minMcap: numParam("minMcap", 0),
    maxMcap: numParam("maxMcap", 0),
    maxAgeHours: numParam("maxAgeHours", 72),
    minAgeHours: numParam("minAgeHours", 0),
    mode,
    spikePct: numParam("spikePct", 50),
    sort,
    limit: Math.min(120, Math.max(10, numParam("limit", 60))),
  };
}

/**
 * Run a full scanner pass against DexScreener.
 */
export async function runScanner(filters) {
  const now = Date.now();
  const { tokens, earlyPairs } = await discoverTokens(filters.chains);
  const enriched = await enrichTokens(tokens);
  const merged = pickBestPair([...earlyPairs, ...enriched]);

  // Snapshot volumes AFTER computing spikes against the previous poll.
  const hits = merged.map((pair) =>
    normalizeHit(pair, { volumeWindow: filters.volumeWindow, spikePct: filters.spikePct }, now)
  );

  rememberVolumes(merged, now);

  const filtered = hits.filter((h) => passesFilters(h, filters));
  const sorted = sortHits(filtered, filters.sort).slice(0, filters.limit);

  return {
    hits: sorted,
    meta: {
      discoveredTokens: tokens.length,
      pairsScanned: merged.length,
      matched: filtered.length,
      returned: sorted.length,
      filters,
      source: "dexscreener",
      fetchedAt: new Date(now).toISOString(),
    },
  };
}

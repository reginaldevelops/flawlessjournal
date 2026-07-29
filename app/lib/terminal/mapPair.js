/** Normalize DexScreener pair payload for terminal UI + storage. */

function num(v) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

export function pairAgeHours(pairCreatedAt) {
  const ts = num(pairCreatedAt);
  if (ts == null) return null;
  const ms = ts > 1e12 ? ts : ts * 1000;
  return Math.max(0, (Date.now() - ms) / 3_600_000);
}

export function pairCreatedIso(pairCreatedAt) {
  const ts = num(pairCreatedAt);
  if (ts == null) return null;
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function pickBestSolanaPair(pairsPayload, mint) {
  const pairs = (pairsPayload?.pairs ?? pairsPayload ?? [])
    .filter((p) => p?.chainId === "solana" && p?.pairAddress);
  if (!pairs.length) return null;
  return pairs.sort(
    (a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0)
  )[0];
}

export function mapPairToTerminalToken(mint, pair, meta = null) {
  const base = pair?.baseToken;
  const quote = pair?.quoteToken;
  const info = pair?.info ?? {};
  const symbol =
    (base?.address === mint ? base?.symbol : null) ??
    (quote?.address === mint ? quote?.symbol : null) ??
    meta?.symbol ??
    "TOKEN";
  const name =
    (base?.address === mint ? base?.name : null) ??
    (quote?.address === mint ? quote?.name : null) ??
    meta?.name ??
    "Token";

  return {
    address: mint,
    symbol,
    name,
    imageUrl: info.imageUrl ?? meta?.logo ?? null,
    headerImageUrl: info.header ?? null,
    pairAddress: pair?.pairAddress ?? null,
    url: pair?.url ?? `https://dexscreener.com/solana/${mint}`,
    dexId: pair?.dexId ?? null,
    labels: Array.isArray(pair?.labels) ? pair.labels : [],
    chainId: "solana",
    priceUsd: num(pair?.priceUsd),
    priceNative: num(pair?.priceNative),
    liquidity: {
      usd: num(pair?.liquidity?.usd),
      base: num(pair?.liquidity?.base),
      quote: num(pair?.liquidity?.quote),
    },
    volume: {
      h24: num(pair?.volume?.h24),
      h6: num(pair?.volume?.h6),
      h1: num(pair?.volume?.h1),
      m5: num(pair?.volume?.m5),
    },
    priceChange: {
      h24: num(pair?.priceChange?.h24),
      h6: num(pair?.priceChange?.h6),
      h1: num(pair?.priceChange?.h1),
      m5: num(pair?.priceChange?.m5),
    },
    marketCap: num(pair?.marketCap),
    fdv: num(pair?.fdv),
    pairCreatedAt: pairCreatedIso(pair?.pairCreatedAt),
    ageHours: pairAgeHours(pair?.pairCreatedAt),
    quoteToken: quote
      ? { symbol: quote.symbol, name: quote.name, address: quote.address }
      : null,
    baseToken: base
      ? { symbol: base.symbol, name: base.name, address: base.address }
      : null,
    websites: Array.isArray(info.websites) ? info.websites : [],
    socials: Array.isArray(info.socials) ? info.socials : [],
    description:
      (typeof info.description === "string" && info.description.trim()) ||
      (typeof meta?.description === "string" && meta.description.trim()) ||
      null,
    txns: pair?.txns ?? null,
    changeH1: num(pair?.priceChange?.h1),
    viewedAt: new Date().toISOString(),
  };
}

/** Slim snapshot for watchlist / recent lists. */
export function tokenListEntry(token) {
  if (!token?.address) return null;
  return {
    address: token.address,
    symbol: token.symbol ?? "TOKEN",
    name: token.name ?? "Token",
    imageUrl: token.imageUrl ?? null,
    pairAddress: token.pairAddress ?? null,
    url: token.url ?? null,
    priceUsd: token.priceUsd ?? null,
    viewedAt: token.viewedAt ?? new Date().toISOString(),
  };
}

export function mergeRecent(list, entry, max = 20) {
  if (!entry?.address) return list ?? [];
  const prev = Array.isArray(list) ? list : [];
  const next = [entry, ...prev.filter((r) => r.address !== entry.address)];
  return next.slice(0, max);
}

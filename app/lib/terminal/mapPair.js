/** Normalize DexScreener pair payload for terminal UI + storage. */

function num(v) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

export function normalizeTerminalAddress(address, chainId = "solana") {
  const raw = String(address ?? "").trim();
  if (!raw) return raw;
  if (chainId !== "solana" || raw.startsWith("0x")) {
    return raw.toLowerCase();
  }
  return raw;
}

export function addressesEqual(a, b, chainId = "solana") {
  return normalizeTerminalAddress(a, chainId) === normalizeTerminalAddress(b, chainId);
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

function pairIncludesToken(pair, tokenAddress) {
  const chainId = pair?.chainId ?? "solana";
  const base = pair?.baseToken?.address;
  const quote = pair?.quoteToken?.address;
  return (
    addressesEqual(base, tokenAddress, chainId) ||
    addressesEqual(quote, tokenAddress, chainId)
  );
}

/**
 * Best pool for a token across DexScreener chains (Solana, Robinhood, EVM, …).
 */
export function pickBestPairForToken(pairsPayload, tokenAddress, { preferChains } = {}) {
  const prefer = preferChains?.length ? preferChains : null;
  const pairs = (pairsPayload?.pairs ?? pairsPayload ?? []).filter(
    (p) => p?.pairAddress && pairIncludesToken(p, tokenAddress)
  );
  if (!pairs.length) return null;

  const ranked = pairs.sort((a, b) => {
    const liqA = Number(a.liquidity?.usd) || 0;
    const liqB = Number(b.liquidity?.usd) || 0;
    if (prefer) {
      const prefA = prefer.indexOf(String(a.chainId).toLowerCase());
      const prefB = prefer.indexOf(String(b.chainId).toLowerCase());
      const boostA = prefA >= 0 ? 1_000_000_000 - prefA * 1000 : 0;
      const boostB = prefB >= 0 ? 1_000_000_000 - prefB * 1000 : 0;
      return liqB + boostB - (liqA + boostA);
    }
    return liqB - liqA;
  });

  return ranked[0];
}

/** @deprecated use pickBestPairForToken */
export function pickBestSolanaPair(pairsPayload, mint) {
  const pairs = (pairsPayload?.pairs ?? pairsPayload ?? [])
    .filter((p) => p?.chainId === "solana" && p?.pairAddress);
  if (!pairs.length) return null;
  return pairs.sort(
    (a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0)
  )[0];
}

export function mapPairToTerminalToken(tokenAddress, pair, meta = null) {
  const chainId = String(pair?.chainId ?? "solana").toLowerCase();
  const mint = normalizeTerminalAddress(tokenAddress, chainId);
  const base = pair?.baseToken;
  const quote = pair?.quoteToken;
  const info = pair?.info ?? {};
  const symbol =
    (addressesEqual(base?.address, mint, chainId) ? base?.symbol : null) ??
    (addressesEqual(quote?.address, mint, chainId) ? quote?.symbol : null) ??
    meta?.symbol ??
    "TOKEN";
  const name =
    (addressesEqual(base?.address, mint, chainId) ? base?.name : null) ??
    (addressesEqual(quote?.address, mint, chainId) ? quote?.name : null) ??
    meta?.name ??
    "Token";

  const defaultUrl = `https://dexscreener.com/${chainId}/${pair?.pairAddress ?? mint}`;

  return {
    address: mint,
    symbol,
    name,
    imageUrl: info.imageUrl ?? meta?.logo ?? null,
    headerImageUrl: info.header ?? null,
    pairAddress: pair?.pairAddress ?? null,
    url: pair?.url ?? defaultUrl,
    dexId: pair?.dexId ?? null,
    labels: Array.isArray(pair?.labels) ? pair.labels : [],
    chainId,
    swapEnabled: chainId === "solana",
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
      ? {
          symbol: quote.symbol,
          name: quote.name,
          address: normalizeTerminalAddress(quote.address, chainId),
        }
      : null,
    baseToken: base
      ? {
          symbol: base.symbol,
          name: base.name,
          address: normalizeTerminalAddress(base.address, chainId),
        }
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
    chainId: token.chainId ?? "solana",
    priceUsd: token.priceUsd ?? null,
    viewedAt: token.viewedAt ?? new Date().toISOString(),
  };
}

export function mergeRecent(list, entry, max = 20) {
  if (!entry?.address) return list ?? [];
  const prev = Array.isArray(list) ? list : [];
  const next = [
    entry,
    ...prev.filter(
      (r) =>
        !(
          r.address === entry.address &&
          (r.chainId ?? "solana") === (entry.chainId ?? "solana")
        )
    ),
  ];
  return next.slice(0, max);
}

export function preferredChainsForInput(address) {
  const raw = String(address ?? "").trim();
  if (raw.startsWith("0x")) {
    return ["robinhood", "base", "ethereum", "bsc", "arbitrum"];
  }
  return ["solana"];
}

/**
 * Scanner constants — DexScreener public API surface.
 *
 * DexScreener exposes volume buckets for m5 / h1 / h6 / h24 (no native 4h).
 * We surface 1h / 6h / 24h in the UI; 6h is the closest stand-in for a ~4h window.
 */

export const DEX_API = "https://api.dexscreener.com";

export const VOLUME_WINDOWS = [
  { id: "h1", label: "1h", field: "h1", hint: "Volume in the last hour" },
  {
    id: "h6",
    label: "6h",
    field: "h6",
    hint: "Nearest DexScreener window to ~4h",
  },
  { id: "h24", label: "24h", field: "h24", hint: "Volume in the last day" },
];

export const SCANNER_CHAINS = [
  { id: "solana", label: "Solana", short: "SOL" },
  { id: "ethereum", label: "Ethereum", short: "ETH" },
  { id: "base", label: "Base", short: "BASE" },
  { id: "bsc", label: "BNB Chain", short: "BSC" },
  { id: "arbitrum", label: "Arbitrum", short: "ARB" },
  { id: "polygon", label: "Polygon", short: "POL" },
  { id: "avalanche", label: "Avalanche", short: "AVAX" },
  { id: "optimism", label: "Optimism", short: "OP" },
];

export const DEFAULT_FILTERS = {
  chains: ["solana", "base", "ethereum"],
  volumeWindow: "h1",
  minVolume: 25_000,
  minLiquidity: 10_000,
  minMcap: 0,
  maxMcap: 0, // 0 = no max
  maxAgeHours: 72, // 0 = no max
  minAgeHours: 0,
  mode: "threshold", // threshold | spike
  spikePct: 50, // for mode=spike: % lift vs previous poll
  sort: "volume",
  limit: 60,
};

export const FILTER_STORAGE_KEY = "flawless.scanner.filters";

export const SORT_OPTIONS = [
  { id: "volume", label: "Volume" },
  { id: "change", label: "Price change" },
  { id: "liquidity", label: "Liquidity" },
  { id: "mcap", label: "Market cap" },
  { id: "age", label: "Newest" },
  { id: "txns", label: "Txns" },
];

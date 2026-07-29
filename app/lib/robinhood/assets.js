/** Robinhood asset_code → CoinGecko id for USD pricing. */
export const RH_ASSET_TO_COINGECKO = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ETC: "ethereum-classic",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOT: "polkadot",
  UNI: "uniswap",
  AAVE: "aave",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  USDC: "usd-coin",
  USDT: "tether",
};

export function rhAssetMint(code) {
  return `rh:${String(code ?? "").toUpperCase()}`;
}

export function coingeckoIdForRhAsset(code) {
  const upper = String(code ?? "").toUpperCase();
  if (upper === "USD") return null;
  return RH_ASSET_TO_COINGECKO[upper] ?? upper.toLowerCase();
}

import { SOL_MINT, USDC_MINT } from "../chain/constants";

/** User's preferred quote / payment mint (not a trade instrument). */
export const FARTCOIN_MINT = "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump";

export const JUPITER_SWAP_API = "https://lite-api.jup.ag/swap/v1";
export const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";
export const JUPITER_TOKEN_API = "https://lite-api.jup.ag/tokens/v2/search";

export const DEFAULT_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/** Jito JSON-RPC for tip-mode broadcasts. */
export const JITO_TX_URL =
  process.env.NEXT_PUBLIC_JITO_TX_URL ||
  "https://mainnet.block-engine.jito.wtf/api/v1/transactions";

export const QUOTE_TOKENS = [
  {
    mint: FARTCOIN_MINT,
    symbol: "Fartcoin",
    decimals: 6,
    isQuote: true,
  },
  {
    mint: SOL_MINT,
    symbol: "SOL",
    decimals: 9,
    isNative: true,
    isQuote: true,
  },
  {
    mint: USDC_MINT,
    symbol: "USDC",
    decimals: 6,
    isQuote: true,
  },
];

export const SWAP_SETTINGS_KEY = "flawless.swap.settings";

export const DEFAULT_SWAP_SETTINGS = {
  /** Exact user amounts; no dynamic slippage from Jupiter. */
  manualMode: true,
  slippageBps: 100, // 1%
  /** 'priority' | 'jito' — mutually exclusive on Jupiter /swap */
  feeMode: "priority",
  priorityLevel: "high", // medium | high | veryHigh
  maxPriorityLamports: 1_000_000,
  jitoTipLamports: 1_000_000,
  defaultQuoteMint: FARTCOIN_MINT,
};

export const POSITION_KIND = "solana_position";

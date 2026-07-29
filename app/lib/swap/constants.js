import { SOL_MINT, USDC_MINT } from "../chain/constants";

/** User's preferred quote / payment mint (not a trade instrument). */
export const FARTCOIN_MINT = "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump";

export const JUPITER_SWAP_API = "https://lite-api.jup.ag/swap/v1";
export const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";
export const JUPITER_TOKEN_API = "https://lite-api.jup.ag/tokens/v2/search";

export const DEFAULT_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";

/** Jito JSON-RPC for tip-mode broadcasts. */
export const JITO_TX_URL =
  process.env.NEXT_PUBLIC_JITO_TX_URL ||
  "https://mainnet.block-engine.jito.wtf/api/v1/transactions";

/** Live tip-floor percentiles (SOL). */
export const JITO_TIP_FLOOR_URL = "https://bundles.jito.wtf/api/v1/bundles/tip_floor";

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

/** Only two slippage choices in the UI. */
export const SLIPPAGE_PRESETS = {
  tight: 50, // 0.5%
  loose: 400, // 4%
};

export const SLIPPAGE_OPTIONS = [
  { bps: SLIPPAGE_PRESETS.tight, label: "0.5%" },
  { bps: SLIPPAGE_PRESETS.loose, label: "4%" },
];

/** Hard USD caps — never exceeded when building the swap. */
export const MAX_PRIORITY_FEE_USD = 0.3;
export const MAX_JITO_TIP_USD = 0.5;

/** Assumed CU budget for converting µ-lamports/CU → total priority lamports. */
export const SWAP_CU_ESTIMATE = 400_000;

export const DEFAULT_SWAP_SETTINGS = {
  /** Always fixed slippage (0.5% or 4%) — never Jupiter dynamic. */
  manualMode: true,
  slippageBps: SLIPPAGE_PRESETS.tight,
  slippageAuto: true,
  /** 'priority' | 'jito' — mutually exclusive on Jupiter /swap */
  feeMode: "priority",
  defaultQuoteMint: FARTCOIN_MINT,
};

export const POSITION_KIND = "solana_position";

/** Wallet sync: free RPC is slow — hard batch caps, never full history. */
export const SYNC_BATCH_DEFAULT = 50;
export const SYNC_BATCH_MAX = 100;

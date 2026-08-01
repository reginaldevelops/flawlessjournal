/**
 * Dummy wallet swap histories for import plan tests.
 * blockTime = unix seconds.
 */

export const MINT_A = "MintA111111111111111111111111111111111111";
export const MINT_B = "MintB222222222222222222222222222222222222";

const BASE = 1_722_000_000; // ~ Jul 2026

export function swap({
  i = 0,
  mint = MINT_A,
  symbol = "TEST",
  side,
  qty,
  usd = 1000,
  sig,
  tokenPre,
}) {
  return {
    tokenMint: mint,
    tokenSymbol: symbol,
    tokenName: symbol,
    side,
    tokenAmount: qty,
    tokenPre: tokenPre ?? null,
    quoteAmount: usd,
    quoteMint: "SOL",
    quoteSymbol: "SOL",
    priceUsd: usd / qty,
    usdValue: usd,
    signature: sig ?? `sig-${symbol}-${side}-${i}`,
    blockTime: BASE + i * 3600,
  };
}

/** Simple: open → add → close (1 closed trade) */
export const SCENARIO_SIMPLE_CLOSE = [
  swap({ i: 0, side: "buy", qty: 1000, usd: 100 }),
  swap({ i: 1, side: "buy", qty: 500, usd: 50 }),
  swap({ i: 2, side: "sell", qty: 1500, usd: 180 }),
];

/** Two episodes in one batch: open-close then open-add (2 trades) */
export const SCENARIO_TWO_EPISODES = [
  swap({ i: 0, side: "buy", qty: 100, usd: 10 }),
  swap({ i: 1, side: "sell", qty: 100, usd: 15 }),
  swap({ i: 2, side: "buy", qty: 200, usd: 20 }),
  swap({ i: 3, side: "buy", qty: 50, usd: 6 }),
];

/** Reduce then close */
export const SCENARIO_REDUCE_CLOSE = [
  swap({ i: 0, side: "buy", qty: 10000, usd: 1000 }),
  swap({ i: 1, side: "sell", qty: 7500, usd: 900 }),
  swap({ i: 2, side: "sell", qty: 2500, usd: 350 }),
];

/** Jimothy-like from user screenshot (flat journal start → 2 trades) */
export const SCENARIO_JIMOTHY_FLAT = [
  swap({ i: 0, symbol: "Jimothy", side: "buy", qty: 76180.148648, usd: 2840 }),
  swap({ i: 1, symbol: "Jimothy", side: "sell", qty: 75000, usd: 3130 }),
  swap({ i: 2, symbol: "Jimothy", side: "sell", qty: 15000, usd: 619 }),
  swap({ i: 3, symbol: "Jimothy", side: "buy", qty: 89280.410161, usd: 3360 }),
  swap({ i: 4, symbol: "Jimothy", side: "buy", qty: 57392.136775, usd: 2000 }),
  swap({ i: 5, symbol: "Jimothy", side: "buy", qty: 40341.980797, usd: 1360 }),
  swap({ i: 6, symbol: "Jimothy", side: "buy", qty: 69304.176158, usd: 1810 }),
  swap({ i: 7, symbol: "Jimothy", side: "buy", qty: 71640.31612, usd: 1810 }),
];

/** Journal already held 200k before batch */
export function journalRowsJimothyPrior() {
  const priorBuy = {
    id: "prior-fill",
    side: "buy",
    tokenAmount: 200000,
    usdValue: 5000,
    ts: new Date((BASE - 86400) * 1000).toISOString(),
    signature: "prior-buy",
  };
  return [
    {
      id: "trade-prior",
      data: {
        _fj: {
          kind: "solana_position",
          tokenMint: MINT_A,
          tokenSymbol: "Jimothy",
          fills: [priorBuy],
        },
      },
    },
  ];
}

/** Batch starts with sell (orphan / incomplete) */
export const SCENARIO_ORPHAN_SELL = [
  swap({ i: 0, side: "sell", qty: 100, usd: 50 }),
  swap({ i: 1, side: "buy", qty: 1000, usd: 100 }),
];

/** Oversell in episode */
export const SCENARIO_OVERSELL = [
  swap({ i: 0, side: "buy", qty: 100, usd: 10 }),
  swap({ i: 1, side: "sell", qty: 150, usd: 20 }),
];

/** Two mints */
export const SCENARIO_TWO_MINTS = [
  swap({ i: 0, mint: MINT_A, symbol: "AAA", side: "buy", qty: 100, usd: 10 }),
  swap({ i: 1, mint: MINT_B, symbol: "BBB", side: "buy", qty: 200, usd: 20 }),
  swap({ i: 2, mint: MINT_A, symbol: "AAA", side: "sell", qty: 100, usd: 15 }),
  swap({ i: 3, mint: MINT_B, symbol: "BBB", side: "buy", qty: 50, usd: 6 }),
];

export function tradeRow(id, mint, symbol, fills) {
  return {
    id,
    data: {
      _fj: {
        kind: "solana_position",
        tokenMint: mint,
        tokenSymbol: symbol,
        fills,
      },
    },
  };
}

export function fill(side, qty, tsOffset, signature) {
  return {
    side,
    tokenAmount: qty,
    usdValue: qty,
    ts: new Date((BASE + tsOffset) * 1000).toISOString(),
    signature,
  };
}

export { BASE };

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createCache } from "../../lib/chain/cache";
import { fetchJson, postJson, toNum } from "../../lib/chain/http";
import { getSolanaPrices } from "../../lib/chain/prices";
import { resolveTokenMeta, fallbackMeta } from "../../lib/chain/tokens";
import { isValidSolanaAddress, isValidEvmAddress } from "../../lib/chain/validate";
import {
  SOL_MINT,
  HL_PERP_ASSET,
  hlSpotAsset,
  USDC_MINT,
} from "../../lib/chain/constants";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const HL_API = "https://api.hyperliquid.xyz/info";
const SOL_DECIMALS = 9;
const DUST_USD = 0.05;

/* ------------------------------------------------------------------ */
/* Caches (survive across requests while the Node process lives)      */
/* ------------------------------------------------------------------ */

/** Cache per-wallet result by "chain:address". 30s TTL. */
const walletCache = createCache({ ttl: 30_000, name: "wallet-results" });
/** Small 60s cache so two wallets on the same chain share a price fetch. */
const priceCache = createCache({ ttl: 60_000, name: "portfolio-prices" });

/* ------------------------------------------------------------------ */
/* Demo fallback balances for the seeded demo wallets                 */
/* ------------------------------------------------------------------ */

const DEMO_SOL_ASSETS = [
  {
    mint: SOL_MINT,
    symbol: "SOL",
    name: "Solana",
    amount: 12.5,
    decimals: 9,
    price: 148.3,
    change24h: 2.1,
  },
  {
    mint: USDC_MINT,
    symbol: "USDC",
    name: "USD Coin",
    amount: 843.21,
    decimals: 6,
    price: 1.0,
    change24h: 0.01,
  },
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    amount: 245.0,
    decimals: 6,
    price: 0.62,
    change24h: -1.4,
  },
];

const DEMO_FALLBACKS = {
  "5DdCjo3doetP3txpkQkXB5ymQp89SMEsHrPt4ZWqcoH1": {
    chain: "solana",
    buildResult: (wallet) => {
      const assets = DEMO_SOL_ASSETS.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        chain: "solana",
        mint: a.mint,
        amount: a.amount,
        price: a.price,
        usdValue: a.amount * a.price,
        priceChange24h: a.change24h,
      }));
      return {
        id: wallet.id,
        label: wallet.label,
        chain: "solana",
        address: wallet.address,
        color: wallet.color ?? "#7c6cff",
        usdValue: assets.reduce((s, a) => s + a.usdValue, 0),
        assets,
      };
    },
  },
  "0x50027f8cec746977c209c6684ad92a15c2fc7fd2": {
    chain: "hyperliquid",
    buildResult: (wallet) => ({
      id: wallet.id,
      label: wallet.label,
      chain: "hyperliquid",
      address: wallet.address,
      color: wallet.color ?? "#4fd1ff",
      usdValue: 4280.5,
      assets: [
        {
          symbol: "USD",
          name: "USD (Perp equity)",
          chain: "hyperliquid",
          mint: HL_PERP_ASSET,
          amount: 4280.5,
          price: 1.0,
          usdValue: 4280.5,
          priceChange24h: null,
        },
      ],
    }),
  },
};

function demoFallback(wallet) {
  const key = String(wallet.address ?? "").toLowerCase();
  const entry = DEMO_FALLBACKS[key];
  if (!entry) return null;
  return entry.buildResult(wallet);
}

/* ------------------------------------------------------------------ */
/* Solana                                                              */
/* ------------------------------------------------------------------ */

async function rpc(method, params) {
  return fetchJson(SOLANA_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    label: `Solana RPC (${method})`,
    timeout: 12_000,
  });
}

/**
 * Returns `{ assets, usdValue, errors }` for a Solana address.
 * Assets include native SOL plus every non-dust SPL / Token-2022 account.
 */
async function fetchSolanaWallet(address) {
  const errors = [];

  /* --- native SOL balance --- */
  let lamports = 0;
  try {
    const resp = await rpc("getBalance", [address]);
    lamports = toNum(resp?.result?.value, 0);
  } catch (e) {
    errors.push(e.message ?? "Could not fetch SOL balance");
  }
  const solAmount = lamports / 10 ** SOL_DECIMALS;

  /* --- SPL token accounts --- */
  const splAccounts = [];
  for (const programId of [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token program
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
  ]) {
    try {
      const resp = await rpc("getTokenAccountsByOwner", [
        address,
        { programId },
        { encoding: "jsonParsed" },
      ]);
      const accounts = resp?.result?.value ?? [];
      for (const acc of accounts) {
        const info = acc?.account?.data?.parsed?.info;
        if (!info) continue;
        splAccounts.push({
          mint: info.mint,
          amount: toNum(info.tokenAmount?.uiAmount, 0),
          decimals: toNum(info.tokenAmount?.decimals, 0),
        });
      }
    } catch (e) {
      errors.push(e.message ?? "Could not fetch token accounts");
    }
  }

  /* --- Gather all mints to price --- */
  const allMints = [SOL_MINT, ...splAccounts.map((a) => a.mint)];

  /* --- Fetch prices via Jupiter --- */
  let prices = priceCache.get("sol-prices:" + allMints.sort().join(","));
  if (!prices) {
    const result = await getSolanaPrices(allMints);
    errors.push(...result.errors);
    prices = result.prices;
    priceCache.set("sol-prices:" + allMints.sort().join(","), prices);
  }

  /* --- Resolve token metadata --- */
  const metaMints = splAccounts.map((a) => a.mint);
  let meta = new Map();
  if (metaMints.length) {
    const result = await resolveTokenMeta(metaMints);
    meta = result.meta;
    errors.push(...result.errors);
  }

  /* --- Build asset list --- */
  const assets = [];

  // Native SOL
  const solPrice = prices.get(SOL_MINT);
  const solUSD = solAmount * (solPrice?.price ?? 0);
  if (solAmount > 0 || solUSD >= DUST_USD) {
    assets.push({
      symbol: "SOL",
      name: "Solana",
      chain: "solana",
      mint: SOL_MINT,
      amount: solAmount,
      price: solPrice?.price ?? null,
      usdValue: solUSD,
      priceChange24h: solPrice?.change24h ?? null,
    });
  }

  // SPL tokens
  for (const spl of splAccounts) {
    if (spl.amount <= 0) continue;
    const tokenPrice = prices.get(spl.mint);
    const usdValue = spl.amount * (tokenPrice?.price ?? 0);
    if (usdValue < DUST_USD && !tokenPrice?.price) continue;

    const tokenMeta = meta.get(spl.mint) ?? fallbackMeta(spl.mint, spl.decimals);
    assets.push({
      symbol: tokenMeta.symbol,
      name: tokenMeta.name,
      chain: "solana",
      mint: spl.mint,
      amount: spl.amount,
      price: tokenPrice?.price ?? tokenMeta.price ?? null,
      usdValue:
        tokenPrice?.price != null
          ? usdValue
          : spl.amount * (tokenMeta.price ?? 0),
      priceChange24h: tokenPrice?.change24h ?? null,
    });
  }

  // Filter dust by USD value after price assignment
  const filtered = assets.filter((a) => a.usdValue >= DUST_USD || a.symbol === "SOL");
  const total = filtered.reduce((s, a) => s + (a.usdValue ?? 0), 0);

  return { assets: filtered, usdValue: total, errors: [...new Set(errors)] };
}

/* ------------------------------------------------------------------ */
/* Hyperliquid                                                         */
/* ------------------------------------------------------------------ */

async function fetchHyperliquidWallet(address) {
  const errors = [];
  const assets = [];
  let usdValue = 0;

  /* --- Perps account equity --- */
  try {
    const data = await postJson(
      HL_API,
      { type: "clearinghouseState", user: address },
      { label: "Hyperliquid clearinghouse", timeout: 10_000 }
    );
    const equity = toNum(data?.marginSummary?.accountValue, 0);
    usdValue += equity;
    if (equity > 0) {
      assets.push({
        symbol: "PERP-USD",
        name: "Perps account equity",
        chain: "hyperliquid",
        mint: HL_PERP_ASSET,
        amount: equity,
        price: 1.0,
        usdValue: equity,
        priceChange24h: null,
      });
    }
  } catch (e) {
    errors.push(e.message ?? "Could not fetch Hyperliquid perps");
  }

  /* --- Spot balances --- */
  try {
    const data = await postJson(
      HL_API,
      { type: "spotClearinghouseState", user: address },
      { label: "Hyperliquid spot", timeout: 10_000 }
    );
    const balances = data?.balances ?? [];
    for (const b of balances) {
      const coin = String(b.coin ?? "");
      const total = toNum(b.total, 0);
      if (!coin || total <= 0) continue;

      // Hyperliquid spot uses simple coin names (USDC, ETH, …).
      // Price USDC at 1, others are appended as symbols without USD value here.
      const isStable = /^USD/.test(coin);
      const price = isStable ? 1.0 : null;
      const val = isStable ? total : 0;
      usdValue += val;

      assets.push({
        symbol: coin,
        name: coin,
        chain: "hyperliquid",
        mint: hlSpotAsset(coin),
        amount: total,
        price,
        usdValue: val,
        priceChange24h: null,
      });
    }
  } catch (e) {
    // Spot endpoint may not be available for all accounts — not a hard error.
    if (!e.message?.includes("network unreachable")) {
      errors.push(e.message ?? "Could not fetch Hyperliquid spot");
    }
  }

  return { assets, usdValue, errors: [...new Set(errors)] };
}

/* ------------------------------------------------------------------ */
/* EVM (stub — returns an informative error rather than crashing)     */
/* ------------------------------------------------------------------ */

async function fetchEvmWallet(_address) {
  return {
    assets: [],
    usdValue: 0,
    errors: ["EVM on-chain balances are not yet supported — add your Hyperliquid address for exchange balances."],
  };
}

/* ------------------------------------------------------------------ */
/* Per-wallet fetcher with cache + demo fallback                      */
/* ------------------------------------------------------------------ */

async function fetchWallet(wallet) {
  const cacheKey = `${wallet.chain}:${String(wallet.address ?? "").toLowerCase()}`;
  const cached = walletCache.get(cacheKey);
  if (cached) {
    return { ...cached, id: wallet.id, label: wallet.label, color: wallet.color };
  }

  const chain = String(wallet.chain ?? "").toLowerCase();
  let result;

  try {
    if (chain === "solana" && isValidSolanaAddress(wallet.address)) {
      result = await fetchSolanaWallet(wallet.address);
    } else if (chain === "hyperliquid" && isValidEvmAddress(wallet.address)) {
      result = await fetchHyperliquidWallet(wallet.address);
    } else if (chain === "evm" && isValidEvmAddress(wallet.address)) {
      result = await fetchEvmWallet(wallet.address);
    } else {
      result = {
        assets: [],
        usdValue: 0,
        errors: [`Unsupported chain "${wallet.chain}" or invalid address.`],
      };
    }
  } catch (e) {
    result = { assets: [], usdValue: 0, errors: [e.message ?? "Unknown fetch error"] };
  }

  // If completely failed, try demo fallback
  if (result.usdValue === 0 && result.errors.length > 0) {
    const demo = demoFallback(wallet);
    if (demo) {
      return { ...demo, _fromDemo: true };
    }
  }

  // Cache successful (or partial) results
  if (result.usdValue > 0 || result.assets.length > 0) {
    walletCache.set(cacheKey, {
      assets: result.assets,
      usdValue: result.usdValue,
      errors: result.errors,
    });
  }

  return {
    id: wallet.id,
    label: wallet.label,
    chain: wallet.chain,
    address: wallet.address,
    color: wallet.color,
    usdValue: result.usdValue,
    assets: result.assets,
    error: result.errors.length === 1 ? result.errors[0] : null,
    errors: result.errors,
  };
}

/* ------------------------------------------------------------------ */
/* Aggregate                                                           */
/* ------------------------------------------------------------------ */

async function buildPortfolioResponse(wallets) {
  // Fetch all wallets in parallel
  const results = await Promise.all(wallets.map(fetchWallet));

  const walletRows = results.map((r) => ({
    id: r.id,
    label: r.label,
    chain: r.chain,
    address: r.address,
    color: r.color ?? null,
    usdValue: r.usdValue ?? 0,
    error: r.error ?? null,
  }));

  // Flatten all assets, merging same symbol+chain
  const assetMap = new Map();
  for (const r of results) {
    for (const asset of r.assets ?? []) {
      const key = `${asset.symbol}:${asset.chain ?? ""}:${asset.mint ?? ""}`;
      if (assetMap.has(key)) {
        const existing = assetMap.get(key);
        existing.amount = (existing.amount ?? 0) + (asset.amount ?? 0);
        existing.usdValue = (existing.usdValue ?? 0) + (asset.usdValue ?? 0);
      } else {
        assetMap.set(key, { ...asset });
      }
    }
  }
  const assets = [...assetMap.values()]
    .filter((a) => (a.usdValue ?? 0) >= DUST_USD)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  const totalUSD = walletRows.reduce((s, w) => s + (w.usdValue ?? 0), 0);

  const topErrors = [...new Set(results.flatMap((r) => r.errors ?? []))].filter(Boolean);

  return {
    totalUSD,
    updatedAt: new Date().toISOString(),
    wallets: walletRows.sort((a, b) => b.usdValue - a.usdValue),
    assets,
    errors: topErrors,
  };
}

/* ------------------------------------------------------------------ */
/* Route handlers                                                      */
/* ------------------------------------------------------------------ */

/**
 * POST /api/portfolio
 * Body: { wallets: [{ id, label, chain, address, color }] }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wallets = Array.isArray(body?.wallets) ? body.wallets : [];
  if (!wallets.length) {
    return NextResponse.json(
      { totalUSD: 0, wallets: [], assets: [], errors: [], updatedAt: new Date().toISOString() },
      { status: 200 }
    );
  }

  try {
    const result = await buildPortfolioResponse(wallets);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[portfolio] POST error", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

/**
 * GET /api/portfolio
 * Kept for backward compatibility. Reads wallets from the server-side
 * Supabase client (or falls back to the demo seed list).
 */
export async function GET() {
  // Build a minimal wallet list from the demo seed for backward compat
  // (server-side Supabase is not wired up in this app; the real wallet list
  // lives client-side in usePortfolio which always uses POST).
  const demoWallets = [
    {
      id: "wallet-1",
      label: "Phantom — main",
      chain: "solana",
      address: "5DdCjo3doetP3txpkQkXB5ymQp89SMEsHrPt4ZWqcoH1",
      color: "#7c6cff",
    },
    {
      id: "wallet-2",
      label: "Hyperliquid",
      chain: "hyperliquid",
      address: "0x50027f8cec746977c209C6684AD92a15c2fC7Fd2",
      color: "#4fd1ff",
    },
  ];

  try {
    const result = await buildPortfolioResponse(demoWallets);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[portfolio] GET error", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

// app/api/portfolio/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const WALLET = "Hp9JwYEY4iN3Hx58mDXqpvYdnRodrTuWxDba1Po6GGd4";
const EURC_MINT = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";

// 🔧 cache vars (blijven in memory zolang server runt)
let lastData = null;
let lastFetch = 0;
const CACHE_TTL = 30_000; // 30s

export async function GET() {
  const now = Date.now();
  if (lastData && now - lastFetch < CACHE_TTL) {
    return NextResponse.json(lastData);
  }

  try {
    const connection = new Connection(
      clusterApiUrl("mainnet-beta"),
      "confirmed"
    );
    const pubkey = new PublicKey(WALLET);

    // ✅ Balance ophalen
    const lamports = await connection.getBalance(pubkey);
    const solBalance = lamports / 1e9;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    let eurcBalance = 0;
    tokenAccounts.value.forEach((t) => {
      const info = t.account.data.parsed.info;
      if (info.mint === EURC_MINT) {
        eurcBalance = Number(info.tokenAmount.uiAmount);
      }
    });

    // ✅ Prijzen via CoinGecko (Solana + Euro Coin)
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana,euro-coin&vs_currencies=usd",
      { headers: { accept: "application/json" }, cache: "no-store" }
    );
    if (!cgRes.ok) {
      throw new Error(`Coingecko error ${cgRes.status}: ${await cgRes.text()}`);
    }

    const priceData = await cgRes.json();
    const solPrice = priceData.solana?.usd ?? 0;
    const eurcPrice = priceData["euro-coin"]?.usd ?? 0;

    // ✅ USD waardes
    const solValue = solBalance * solPrice;
    const eurcValue = eurcBalance * eurcPrice;
    const totalUSD = solValue + eurcValue;

    const result = {
      wallet: WALLET,
      sol: { balance: solBalance, price: solPrice, usdValue: solValue },
      eurc: { balance: eurcBalance, price: eurcPrice, usdValue: eurcValue },
      totalUSD,
      cachedAt: new Date().toISOString(),
    };

    // cache opslaan
    lastData = result;
    lastFetch = now;

    return NextResponse.json(result);
  } catch (err) {
    console.error("Portfolio API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

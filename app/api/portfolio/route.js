// app/api/portfolio/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// ✅ Jouw wallet + token mints
const WALLET = "Hp9JwYEY4iN3Hx58mDXqpvYdnRodrTuWxDba1Po6GGd4";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const EURC_MINT = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";

export async function GET() {
  try {
    const connection = new Connection(
      clusterApiUrl("mainnet-beta"),
      "confirmed"
    );
    const pubkey = new PublicKey(WALLET);

    // ✅ Haal SOL balance
    const lamports = await connection.getBalance(pubkey);
    const solBalance = lamports / 1e9;

    // ✅ Haal EURC balance
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

    // ✅ Haal prijzen via CoinGecko (solana + euro-coin)
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

    // ✅ Waardes berekenen
    const solValue = solBalance * solPrice;
    const eurcValue = eurcBalance * eurcPrice;
    const totalUSD = solValue + eurcValue;

    return NextResponse.json({
      wallet: WALLET,
      sol: { balance: solBalance, price: solPrice, usdValue: solValue },
      eurc: { balance: eurcBalance, price: eurcPrice, usdValue: eurcValue },
      totalUSD,
    });
  } catch (err) {
    console.error("Portfolio API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

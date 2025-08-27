// app/api/hyperliquid/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const WALLET = "0x50027f8cec746977c209C6684AD92a15c2fC7Fd2";

export async function GET() {
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: WALLET,
      }),
    });

    if (!res.ok) {
      throw new Error(`Hyperliquid error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const accountValue = parseFloat(data?.marginSummary?.accountValue ?? 0);

    return NextResponse.json({
      wallet: WALLET,
      totalUSD: accountValue,
      raw: data, // optioneel, voor debug
    });
  } catch (err) {
    console.error("Hyperliquid API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

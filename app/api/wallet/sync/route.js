import { NextResponse } from "next/server";
import { DEFAULT_RPC } from "../../../lib/swap/constants";
import { syncWalletSwaps } from "../../../lib/swap/walletSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/wallet/sync
 * Body: { address, limit?, untilSignature? }
 *
 * Free public-RPC scan of recent txs → classified buy/sell swaps.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim();
    if (!address || address.length < 32) {
      return NextResponse.json({ error: "Valid Solana address required" }, { status: 400 });
    }

    const limit = Number(body.limit) > 0 ? Number(body.limit) : 40;
    const untilSignature = body.untilSignature || null;

    const result = await syncWalletSwaps({
      address,
      limit: Math.min(80, limit),
      untilSignature,
      rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[wallet/sync]", error);
    return NextResponse.json(
      { error: error?.message ?? "Wallet sync failed" },
      { status: 502 }
    );
  }
}

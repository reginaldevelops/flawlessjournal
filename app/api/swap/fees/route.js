import { NextResponse } from "next/server";
import { DEFAULT_RPC } from "../../../lib/swap/constants";
import { estimateSwapFees } from "../../../lib/swap/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/swap/fees?feeMode=priority|jito
 * Returns p90 priority fee + Jito tip estimates, already USD-capped.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const feeMode = searchParams.get("feeMode") === "jito" ? "jito" : "priority";
    const fees = await estimateSwapFees({
      rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC,
      feeMode,
    });
    return NextResponse.json(fees, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[swap/fees]", error);
    return NextResponse.json(
      { error: error?.message ?? "Fee estimate failed" },
      { status: 502 }
    );
  }
}

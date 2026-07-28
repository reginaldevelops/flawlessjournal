import { NextResponse } from "next/server";
import { fetchJson } from "../../../lib/chain/http";
import { DEFAULT_RPC, JUPITER_SWAP_API } from "../../../lib/swap/constants";
import { estimateSwapFees } from "../../../lib/swap/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/swap/build
 * Body: { quoteResponse, userPublicKey, settings }
 *
 * Priority / Jito amounts are always taken from live p90 estimates and
 * hard-capped ($0.30 priority, $0.50 Jito) — client values are ignored.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { quoteResponse, userPublicKey, settings = {} } = body ?? {};

    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        { error: "quoteResponse and userPublicKey are required" },
        { status: 400 }
      );
    }

    const feeMode = settings.feeMode === "jito" ? "jito" : "priority";
    const fees = await estimateSwapFees({
      rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC,
      feeMode,
    });

    const payload = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: false,
    };

    if (feeMode === "jito") {
      payload.prioritizationFeeLamports = {
        jitoTipLamports: fees.jito.lamports,
      };
    } else {
      // Exact lamports from p90 × CU estimate, capped at $0.30
      payload.prioritizationFeeLamports = fees.priority.lamports;
    }

    const result = await fetchJson(`${JUPITER_SWAP_API}/swap`, {
      label: "Jupiter swap build",
      method: "POST",
      timeout: 15_000,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(
      { ...result, feeEstimate: fees },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[swap/build]", error);
    return NextResponse.json(
      { error: error?.message ?? "Build failed" },
      { status: 502 }
    );
  }
}

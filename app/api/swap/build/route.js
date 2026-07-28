import { NextResponse } from "next/server";
import { fetchJson } from "../../../lib/chain/http";
import { JUPITER_SWAP_API } from "../../../lib/swap/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/swap/build
 * Body: { quoteResponse, userPublicKey, settings }
 * Returns Jupiter { swapTransaction, lastValidBlockHeight, ... }
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

    const payload = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: settings.manualMode === false,
    };

    if (settings.feeMode === "jito") {
      payload.prioritizationFeeLamports = {
        jitoTipLamports: Math.max(1000, Number(settings.jitoTipLamports) || 1_000_000),
      };
    } else {
      payload.prioritizationFeeLamports = {
        priorityLevelWithMaxLamports: {
          maxLamports: Math.max(1000, Number(settings.maxPriorityLamports) || 1_000_000),
          priorityLevel: ["medium", "high", "veryHigh"].includes(settings.priorityLevel)
            ? settings.priorityLevel
            : "high",
        },
      };
    }

    const result = await fetchJson(`${JUPITER_SWAP_API}/swap`, {
      label: "Jupiter swap build",
      method: "POST",
      timeout: 15_000,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[swap/build]", error);
    return NextResponse.json(
      { error: error?.message ?? "Build failed" },
      { status: 502 }
    );
  }
}

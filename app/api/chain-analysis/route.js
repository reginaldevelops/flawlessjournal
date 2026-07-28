import { NextResponse } from "next/server";
import {
  CHAINS,
  fetchChainSnapshot,
  fetchCompareStrip,
} from "../../lib/chainAnalysis/defillama";
import { fetchPumpLaunchStats } from "../../lib/chainAnalysis/pumpfun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chain-analysis?chain=solana|hyperliquid&compare=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = String(searchParams.get("chain") || "solana").toLowerCase();
    const wantCompare = searchParams.get("compare") !== "0";

    if (!CHAINS[chain]) {
      return NextResponse.json(
        { error: `Unknown chain. Use: ${Object.keys(CHAINS).join(", ")}` },
        { status: 400 }
      );
    }

    const [snapshot, compare, pump] = await Promise.all([
      fetchChainSnapshot(chain),
      wantCompare ? fetchCompareStrip() : Promise.resolve(null),
      chain === "solana" ? fetchPumpLaunchStats() : Promise.resolve(null),
    ]);

    return NextResponse.json(
      {
        ...snapshot,
        compare,
        pump,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[chain-analysis]", error);
    return NextResponse.json(
      { error: error?.message || "Chain analysis failed" },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { fetchFillChartWindow } from "../../../lib/swap/fillChart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/trade/chart
 * ?mint=...&around=<iso|unix>&window=60&pair=optional&pairUrl=optional
 *
 * Returns a candle snippet centered on the fill timestamp.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = String(searchParams.get("mint") || "").trim();
    const around = searchParams.get("around");
    const pair = String(searchParams.get("pair") || "").trim() || null;
    const pairUrl = String(searchParams.get("pairUrl") || "").trim() || null;
    const windowMinutes = Number(searchParams.get("window") || 60);

    if (!mint && !pair && !pairUrl) {
      return NextResponse.json(
        { error: "mint or pair required" },
        { status: 400 }
      );
    }
    if (!around) {
      return NextResponse.json(
        { error: "around timestamp required" },
        { status: 400 }
      );
    }

    const result = await fetchFillChartWindow({
      mint: mint || null,
      pairAddress: pair,
      pairUrl,
      aroundTs: around,
      windowMinutes: Number.isFinite(windowMinutes) ? windowMinutes : 60,
    });

    return NextResponse.json(result, {
      headers: {
        // Short cache — same fill chart is stable historical data
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[trade/chart]", error);
    return NextResponse.json(
      { error: error?.message ?? "Chart fetch failed" },
      { status: 502 }
    );
  }
}

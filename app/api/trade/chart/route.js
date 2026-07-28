import { NextResponse } from "next/server";
import {
  fetchFillChartWindow,
  fetchPositionChartWindow,
} from "../../../lib/swap/fillChart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/trade/chart
 *
 * Range (preferred):
 *   ?mint=...&from=<iso|unix>&to=<iso|unix>&pad=30&pairUrl=optional
 *
 * Single-center (legacy):
 *   ?mint=...&around=<iso|unix>&window=60
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = String(searchParams.get("mint") || "").trim();
    const pair = String(searchParams.get("pair") || "").trim() || null;
    const pairUrl = String(searchParams.get("pairUrl") || "").trim() || null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const around = searchParams.get("around");
    const windowMinutes = Number(searchParams.get("window") || 60);
    const pad = searchParams.get("pad");

    if (!mint && !pair && !pairUrl) {
      return NextResponse.json(
        { error: "mint or pair required" },
        { status: 400 }
      );
    }

    let result;
    if (from || to) {
      result = await fetchPositionChartWindow({
        mint: mint || null,
        pairAddress: pair,
        pairUrl,
        fromTs: from || to,
        toTs: to || from,
        padMinutes: pad != null ? Number(pad) : undefined,
      });
    } else if (around) {
      result = await fetchFillChartWindow({
        mint: mint || null,
        pairAddress: pair,
        pairUrl,
        aroundTs: around,
        windowMinutes: Number.isFinite(windowMinutes) ? windowMinutes : 60,
      });
    } else {
      return NextResponse.json(
        { error: "from/to or around timestamp required" },
        { status: 400 }
      );
    }

    return NextResponse.json(result, {
      headers: {
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

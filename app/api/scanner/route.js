import { NextResponse } from "next/server";
import { publicApiError } from "../../lib/api/publicError";
import { parseScannerFilters, runScanner } from "../../lib/scanner/dexscreener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scanner
 *
 * Query params mirror the Flawless Scanner filters:
 *   chains, volumeWindow (h1|h6|h24), minVolume, minLiquidity,
 *   minMcap, maxMcap, maxAgeHours, minAgeHours, mode (threshold|spike),
 *   spikePct, sort, limit
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseScannerFilters(searchParams);
    const result = await runScanner(filters);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[scanner]", error);
    return NextResponse.json(
      {
        hits: [],
        meta: {
          error: publicApiError("Scanner failed").error,
          fetchedAt: new Date().toISOString(),
        },
      },
      { status: 502 }
    );
  }
}

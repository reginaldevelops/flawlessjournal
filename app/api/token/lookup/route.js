import { NextResponse } from "next/server";
import { fetchJson } from "../../../lib/chain/http";
import { resolveTokenMeta } from "../../../lib/chain/tokens";
import { isValidSolanaAddress } from "../../../lib/chain/validate";
import { publicApiError } from "../../../lib/api/publicError";
import {
  mapPairToTerminalToken,
  pickBestSolanaPair,
} from "../../../lib/terminal/mapPair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/token/lookup?mint=<solana-address>
 * DexScreener pair stats + token meta for terminal / swap.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = String(searchParams.get("mint") || "").trim();

    if (!isValidSolanaAddress(mint)) {
      return NextResponse.json({ error: "Enter a valid Solana token address" }, { status: 400 });
    }

    const [pairsPayload, metaResult] = await Promise.all([
      fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        label: "DexScreener token",
        timeout: 10_000,
        retries: 1,
      }).catch(() => null),
      resolveTokenMeta([mint]),
    ]);

    const best = pickBestSolanaPair(pairsPayload, mint);
    const meta = metaResult.meta.get(mint);

    if (!best) {
      return NextResponse.json(
        {
          address: mint,
          symbol: meta?.symbol ?? "TOKEN",
          name: meta?.name ?? "Token",
          imageUrl: meta?.logo ?? null,
          chainId: "solana",
          error: "No Solana pool found on DexScreener",
        },
        { status: 404 }
      );
    }

    const token = mapPairToTerminalToken(mint, best, meta);

    return NextResponse.json(token, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[token/lookup]", error);
    return NextResponse.json(publicApiError("Token lookup failed"), { status: 502 });
  }
}

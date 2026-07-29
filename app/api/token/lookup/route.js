import { NextResponse } from "next/server";
import { fetchJson } from "../../../lib/chain/http";
import { resolveTokenMeta } from "../../../lib/chain/tokens";
import { isValidEvmAddress, isValidSolanaAddress } from "../../../lib/chain/validate";
import { publicApiError } from "../../../lib/api/publicError";
import {
  mapPairToTerminalToken,
  normalizeTerminalAddress,
  pickBestPairForToken,
  preferredChainsForInput,
} from "../../../lib/terminal/mapPair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/token/lookup?mint=<address>
 * Solana mint or EVM contract (Robinhood chain, etc.) via DexScreener.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = String(searchParams.get("mint") || "").trim();
    const isEvm = raw.startsWith("0x");
    const mint = isEvm ? raw.toLowerCase() : raw;

    if (isEvm) {
      if (!isValidEvmAddress(mint)) {
        return NextResponse.json({ error: "Enter a valid EVM token address (0x…)" }, { status: 400 });
      }
    } else if (!isValidSolanaAddress(mint)) {
      return NextResponse.json({ error: "Enter a valid Solana token address" }, { status: 400 });
    }

    const pairsPayload = await fetchJson(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
      { label: "DexScreener token", timeout: 10_000, retries: 1 }
    ).catch(() => null);

    const metaResult =
      !isEvm ? await resolveTokenMeta([mint]) : { meta: new Map() };

    const best = pickBestPairForToken(pairsPayload, mint, {
      preferChains: preferredChainsForInput(mint),
    });
    const meta = metaResult.meta.get(mint);

    if (!best) {
      return NextResponse.json(
        {
          address: mint,
          symbol: meta?.symbol ?? "TOKEN",
          name: meta?.name ?? "Token",
          imageUrl: meta?.logo ?? null,
          chainId: isEvm ? "robinhood" : "solana",
          swapEnabled: !isEvm,
          error: "No pool found on DexScreener for this token",
        },
        { status: 404 }
      );
    }

    const token = mapPairToTerminalToken(
      normalizeTerminalAddress(mint, best.chainId),
      best,
      meta
    );

    return NextResponse.json(token, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[token/lookup]", error);
    return NextResponse.json(publicApiError("Token lookup failed"), { status: 502 });
  }
}

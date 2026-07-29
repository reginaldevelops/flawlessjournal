import { NextResponse } from "next/server";
import { fetchJson } from "../../../lib/chain/http";
import { resolveTokenMeta } from "../../../lib/chain/tokens";
import { isValidSolanaAddress } from "../../../lib/chain/validate";
import { publicApiError } from "../../../lib/api/publicError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pairAgeHours(pair) {
  const created = pair?.pairCreatedAt ? Date.parse(pair.pairCreatedAt) : NaN;
  if (!Number.isFinite(created)) return null;
  return Math.max(0, (Date.now() - created) / 3_600_000);
}

/**
 * GET /api/token/lookup?mint=<solana-address>
 * Resolves token metadata for the swap picker (DexScreener + Jupiter).
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

    const pairs = (pairsPayload?.pairs ?? []).filter((p) => p.chainId === "solana");
    const best = pairs.sort(
      (a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0)
    )[0];

    const meta = metaResult.meta.get(mint);
    const base = best?.baseToken;
    const quote = best?.quoteToken;
    const symbol =
      (base?.address === mint ? base?.symbol : null) ??
      (quote?.address === mint ? quote?.symbol : null) ??
      meta?.symbol ??
      "TOKEN";
    const name =
      (base?.address === mint ? base?.name : null) ??
      meta?.name ??
      "Token";

    return NextResponse.json(
      {
        address: mint,
        symbol,
        name,
        pairAddress: best?.pairAddress ?? null,
        url: best?.url ?? `https://dexscreener.com/solana/${mint}`,
        imageUrl: best?.info?.imageUrl ?? meta?.logo ?? null,
        chainId: "solana",
        ageHours: best ? pairAgeHours(best) : null,
        changeH1: best?.priceChange?.h1 ?? null,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      }
    );
  } catch (error) {
    console.error("[token/lookup]", error);
    return NextResponse.json(publicApiError("Token lookup failed"), { status: 502 });
  }
}

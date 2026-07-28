import { NextResponse } from "next/server";
import { fetchJson } from "../../../lib/chain/http";
import { JUPITER_SWAP_API } from "../../../lib/swap/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/swap/quote
 * Proxies Jupiter lite quote API.
 *
 * Query: inputMint, outputMint, amount (raw integer string), slippageBps, swapMode?
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const inputMint = searchParams.get("inputMint");
    const outputMint = searchParams.get("outputMint");
    const amount = searchParams.get("amount");
    const slippageBps = searchParams.get("slippageBps") || "100";
    const swapMode = searchParams.get("swapMode") || "ExactIn";

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: "inputMint, outputMint and amount are required" },
        { status: 400 }
      );
    }

    const url = new URL(`${JUPITER_SWAP_API}/quote`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount);
    url.searchParams.set("slippageBps", String(slippageBps));
    url.searchParams.set("swapMode", swapMode);

    const quote = await fetchJson(url.toString(), {
      label: "Jupiter quote",
      timeout: 12_000,
    });

    return NextResponse.json(quote, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[swap/quote]", error);
    return NextResponse.json(
      { error: error?.message ?? "Quote failed" },
      { status: 502 }
    );
  }
}

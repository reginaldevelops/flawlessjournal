import { NextResponse } from "next/server";
import { fetchJson } from "../../../lib/chain/http";
import { isValidSolanaAddress } from "../../../lib/chain/validate";
import { publicApiError } from "../../../lib/api/publicError";
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

    if (!isValidSolanaAddress(inputMint) || !isValidSolanaAddress(outputMint)) {
      return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
    }

    if (!/^\d+$/.test(String(amount)) || BigInt(amount) <= 0n) {
      return NextResponse.json(
        { error: "amount must be a positive integer (raw token units)" },
        { status: 400 }
      );
    }

    const slippage = Number(slippageBps);
    if (!Number.isFinite(slippage) || slippage < 1 || slippage > 5000) {
      return NextResponse.json(
        { error: "slippageBps must be between 1 and 5000" },
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
    return NextResponse.json(publicApiError("Quote failed"), { status: 502 });
  }
}

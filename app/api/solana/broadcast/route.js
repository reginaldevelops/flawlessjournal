import { NextResponse } from "next/server";
import { parseRpcErrorMessage } from "../../../lib/swap/rpc";
import { getServerRpcUrl } from "../../../lib/swap/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/solana/broadcast
 * Body: { transaction: base64, mode?: "priority" | "jito" }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tx = String(body?.transaction || "").trim();
  const mode = body?.mode === "jito" ? "jito" : "priority";
  if (!tx) {
    return NextResponse.json({ error: "transaction (base64) required" }, { status: 400 });
  }

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [tx, { encoding: "base64", skipPreflight: false, maxRetries: 3 }],
  };

  const tryJito = async () => {
    const res = await fetch(JITO_TX_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const json = await res.json();
    if (json?.error) throw new Error(json.error.message || "Jito broadcast failed");
    if (!json?.result) throw new Error("Jito broadcast failed");
    return json.result;
  };

  const tryRpc = async () => {
    const rpcUrl = getServerRpcUrl();
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const json = await res.json();
    if (json?.error) {
      throw new Error(parseRpcErrorMessage(json, "Transaction broadcast failed"));
    }
    if (!json?.result) throw new Error("Transaction broadcast failed");
    return json.result;
  };

  try {
    const signature =
      mode === "jito"
        ? await tryJito().catch(async (jitoErr) => {
            console.warn("[solana/broadcast] Jito failed, falling back to RPC:", jitoErr.message);
            return tryRpc();
          })
        : await tryRpc();

    return NextResponse.json({ signature });
  } catch (error) {
    console.error("[solana/broadcast]", error);
    const message = parseRpcErrorMessage(error?.message, "Transaction broadcast failed");
    const friendly =
      /403|forbidden|access forbidden/i.test(message)
        ? "Solana RPC rejected the transaction. Set SOLANA_RPC_URL (Helius/QuickNode) in Vercel env, or retry in a moment."
        : /0x1771|6001|slippage/i.test(message)
          ? "Slippage tolerance exceeded — price moved before the swap landed. Retry with the live quote or raise slippage in Swap settings."
          : message;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import {
  ALLOWED_RPC_METHODS,
  getServerRpcUrl,
  parseRpcErrorMessage,
} from "../../../lib/swap/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/solana/rpc
 * Proxies whitelisted Solana JSON-RPC from the browser (public RPC blocks direct calls).
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Invalid JSON" }, id: null },
      { status: 400 }
    );
  }

  const method = String(body?.method || "");
  if (!ALLOWED_RPC_METHODS.has(method)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32601, message: `Method not allowed: ${method}` },
        id: body?.id ?? null,
      },
      { status: 403 }
    );
  }

  const rpcUrl = getServerRpcUrl();

  try {
    const upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    const text = await upstream.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Invalid RPC response" },
          id: body?.id ?? null,
        },
        { status: 502 }
      );
    }

    if (!upstream.ok && json?.error) {
      console.error("[solana/rpc]", method, upstream.status, json.error);
    }

    return NextResponse.json(json, {
      status: json?.error ? 200 : upstream.ok ? 200 : upstream.status,
    });
  } catch (error) {
    console.error("[solana/rpc]", method, error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: parseRpcErrorMessage(error?.message, "Solana RPC unavailable"),
        },
        id: body?.id ?? null,
      },
      { status: 502 }
    );
  }
}

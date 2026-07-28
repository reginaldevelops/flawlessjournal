import { NextResponse } from "next/server";
import {
  DEFAULT_RPC,
  SYNC_BATCH_DEFAULT,
  SYNC_BATCH_MAX,
} from "../../../lib/swap/constants";
import { syncWalletSwaps } from "../../../lib/swap/walletSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/wallet/sync
 * Body: { address, limit?, untilSignature?, before? }
 *
 * Streams NDJSON progress events, ending with { type: "result", ...scan }.
 * Free public-RPC scan — one capped batch per request (never full history).
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const address = String(body.address ?? "").trim();
  if (!address || address.length < 32) {
    return NextResponse.json(
      { error: "Valid Solana address required" },
      { status: 400 }
    );
  }

  const limit =
    Number(body.limit) > 0 ? Number(body.limit) : SYNC_BATCH_DEFAULT;
  const untilSignature = body.untilSignature || null;
  const before = body.before || null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          /* closed */
        }
      };
      try {
        const result = await syncWalletSwaps({
          address,
          limit: Math.min(SYNC_BATCH_MAX, limit),
          untilSignature,
          before,
          rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC,
          onProgress: send,
        });
        send({ type: "result", ...result });
      } catch (error) {
        console.error("[wallet/sync]", error);
        send({
          type: "error",
          error: error?.message ?? "Wallet sync failed",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

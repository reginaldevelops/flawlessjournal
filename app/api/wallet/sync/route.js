import { NextResponse } from "next/server";
import { isValidSolanaAddress } from "../../../lib/chain/validate";
import { publicApiError } from "../../../lib/api/publicError";
import { getServerRpcUrl } from "../../../lib/swap/rpc";
import {
  SYNC_BATCH_DEFAULT,
  SYNC_BATCH_MAX,
} from "../../../lib/swap/constants";
import { syncWalletSwaps } from "../../../lib/swap/walletSync";

/** Solana tx signatures are base58, typically 87–88 chars. */
function isValidTxSignature(value) {
  if (value == null || value === "") return true;
  const s = String(value);
  return s.length >= 64 && s.length <= 128 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json(
      { error: "Valid Solana address required" },
      { status: 400 }
    );
  }

  const limit =
    Number(body.limit) > 0 ? Number(body.limit) : SYNC_BATCH_DEFAULT;
  const untilSignature = body.untilSignature || null;
  const before = body.before || null;

  if (!isValidTxSignature(untilSignature) || !isValidTxSignature(before)) {
    return NextResponse.json(
      { error: "Invalid transaction signature cursor" },
      { status: 400 }
    );
  }

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
          rpcUrl: getServerRpcUrl(),
          onProgress: send,
        });
        send({ type: "result", ...result });
      } catch (error) {
        console.error("[wallet/sync]", error);
        send({
          type: "error",
          error: publicApiError("Wallet sync failed").error,
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

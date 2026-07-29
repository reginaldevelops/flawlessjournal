export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { fetchRobinhoodHoldings, fetchRobinhoodOrders } from "../../../lib/robinhood/client";
import { normalizeRobinhoodOrder, sortRobinhoodOrders } from "../../../lib/robinhood/orders";

/**
 * POST /api/robinhood/transactions
 * Body: { apiKey, privateKeyBase64, limit?, maxPages?, state? }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = String(body?.apiKey ?? "").trim();
  const privateKeyBase64 = String(body?.privateKeyBase64 ?? "").trim();
  const limit = Number(body?.limit) || 50;
  const maxPages = Number(body?.maxPages) || 6;
  const state = body?.state ? String(body.state) : null;

  if (!apiKey.startsWith("rh-api-")) {
    return NextResponse.json({ error: "Invalid Robinhood API key." }, { status: 400 });
  }
  if (!privateKeyBase64) {
    return NextResponse.json({ error: "Private key is required." }, { status: 400 });
  }

  try {
    const creds = { apiKey, privateKeyBase64 };
    const [holdings, rawOrders] = await Promise.all([
      fetchRobinhoodHoldings(creds),
      fetchRobinhoodOrders({ ...creds, limit, maxPages, state }),
    ]);

    const orders = sortRobinhoodOrders(
      rawOrders.map(normalizeRobinhoodOrder).filter(Boolean)
    );

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      holdings: holdings.map((h) => ({
        asset: String(h.asset_code ?? "").toUpperCase(),
        quantity: Number(h.total_quantity) || 0,
        available: Number(h.quantity_available_for_trading) || 0,
      })),
      orders,
      orderCount: orders.length,
    });
  } catch (err) {
    console.error("[robinhood/transactions]", err);
    return NextResponse.json(
      { error: err.message ?? "Could not fetch Robinhood transactions." },
      { status: 502 }
    );
  }
}

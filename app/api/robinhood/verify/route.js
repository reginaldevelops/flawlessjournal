export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { fetchRobinhoodAccount, fetchRobinhoodHoldings } from "../../../lib/robinhood/client";

/**
 * POST /api/robinhood/verify
 * Body: { apiKey, privateKeyBase64 }
 * Validates Robinhood API credentials and returns account metadata.
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

  if (!apiKey.startsWith("rh-api-")) {
    return NextResponse.json({ error: "Invalid Robinhood API key format." }, { status: 400 });
  }
  if (!privateKeyBase64) {
    return NextResponse.json({ error: "Private key is required." }, { status: 400 });
  }

  try {
    const account = await fetchRobinhoodAccount({ apiKey, privateKeyBase64 });
    const holdings = await fetchRobinhoodHoldings({ apiKey, privateKeyBase64 });
    const accountNumber = account.account_number || account.id;

    return NextResponse.json({
      ok: true,
      accountNumber: String(accountNumber),
      status: account.status ?? null,
      holdingCount: holdings.filter((h) => Number(h.total_quantity) > 0).length,
    });
  } catch (err) {
    console.error("[robinhood/verify]", err);
    return NextResponse.json(
      { error: err.message ?? "Could not verify Robinhood credentials." },
      { status: 502 }
    );
  }
}

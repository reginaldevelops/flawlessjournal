import nacl from "tweetnacl";
import { fetchJson } from "../chain/http";

export const ROBINHOOD_API_BASE = "https://trading.robinhood.com";

function signingKeyFromSeedBase64(privateKeyBase64) {
  const seed = Buffer.from(String(privateKeyBase64 ?? "").trim(), "base64");
  if (seed.length !== 32) {
    throw new Error("Robinhood private key must be a 32-byte Ed25519 seed (base64).");
  }
  return nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
}

export function signRobinhoodMessage(privateKeyBase64, message) {
  const keyPair = signingKeyFromSeedBase64(privateKeyBase64);
  const sig = nacl.sign.detached(new TextEncoder().encode(message), keyPair.secretKey);
  return Buffer.from(sig).toString("base64");
}

export function buildRobinhoodHeaders({ apiKey, privateKeyBase64, method, path, body = "" }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ?? "";
  const message = `${apiKey}${timestamp}${path}${method}${bodyStr}`;
  return {
    "x-api-key": apiKey,
    "x-timestamp": timestamp,
    "x-signature": signRobinhoodMessage(privateKeyBase64, message),
    accept: "application/json",
  };
}

export async function robinhoodRequest({
  apiKey,
  privateKeyBase64,
  method = "GET",
  path,
  body,
  label = "Robinhood API",
}) {
  const bodyStr = body != null ? JSON.stringify(body) : "";
  const headers = buildRobinhoodHeaders({
    apiKey,
    privateKeyBase64,
    method,
    path,
    body: bodyStr,
  });

  return fetchJson(`${ROBINHOOD_API_BASE}${path}`, {
    method,
    headers: {
      ...headers,
      ...(bodyStr ? { "content-type": "application/json" } : {}),
    },
    body: bodyStr || undefined,
    label,
    timeout: 12_000,
    retries: 1,
  });
}

export async function fetchRobinhoodAccount({ apiKey, privateKeyBase64 }) {
  const data = await robinhoodRequest({
    apiKey,
    privateKeyBase64,
    path: "/api/v1/crypto/trading/accounts/",
    label: "Robinhood accounts",
  });
  const account = data?.results?.[0] ?? data?.[0] ?? null;
  if (!account?.account_number && !account?.id) {
    throw new Error("Could not read Robinhood crypto account.");
  }
  return account;
}

export async function fetchRobinhoodHoldings({ apiKey, privateKeyBase64 }) {
  const data = await robinhoodRequest({
    apiKey,
    privateKeyBase64,
    path: "/api/v1/crypto/trading/holdings/",
    label: "Robinhood holdings",
  });
  return Array.isArray(data?.results) ? data.results : [];
}

function extractCursor(nextUrl) {
  if (!nextUrl || typeof nextUrl !== "string") return null;
  try {
    const url = new URL(nextUrl, ROBINHOOD_API_BASE);
    return url.searchParams.get("cursor");
  } catch {
    return null;
  }
}

/**
 * One page of Robinhood crypto orders (newest first).
 */
export async function fetchRobinhoodOrdersPage({
  apiKey,
  privateKeyBase64,
  limit = 50,
  cursor = null,
  state = null,
}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(Math.min(100, Math.max(1, limit))));
  if (cursor) params.set("cursor", cursor);
  if (state) params.set("state", state);
  const qs = params.toString();
  const path = `/api/v1/crypto/trading/orders/${qs ? `?${qs}` : ""}`;

  const data = await robinhoodRequest({
    apiKey,
    privateKeyBase64,
    path,
    label: "Robinhood orders",
  });

  return {
    results: Array.isArray(data?.results) ? data.results : [],
    nextCursor: extractCursor(data?.next),
    previous: data?.previous ?? null,
  };
}

/** Walk cursor pages up to `maxPages`. */
export async function fetchRobinhoodOrders({
  apiKey,
  privateKeyBase64,
  limit = 50,
  maxPages = 6,
  state = null,
}) {
  const all = [];
  let cursor = null;
  let pages = 0;

  while (pages < maxPages) {
    const page = await fetchRobinhoodOrdersPage({
      apiKey,
      privateKeyBase64,
      limit,
      cursor,
      state,
    });
    all.push(...page.results);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
    pages += 1;
  }

  return all;
}

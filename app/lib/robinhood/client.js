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

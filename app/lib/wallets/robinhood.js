import { supabase } from "../supabaseClient";

/** Attach Robinhood API credentials for portfolio fetches (never shown in wallet list UI). */
export async function attachRobinhoodCredentials(wallets) {
  const rows = Array.isArray(wallets) ? wallets : [];
  const rhIds = rows.filter((w) => w?.chain === "robinhood").map((w) => w.id);
  if (!rhIds.length) return rows;

  const { data, error } = await supabase
    .from("wallets")
    .select("id, credentials")
    .in("id", rhIds);

  if (error) throw error;

  const credMap = new Map((data ?? []).map((r) => [String(r.id), r.credentials]));
  return rows.map((w) =>
    w?.chain === "robinhood"
      ? { ...w, credentials: credMap.get(String(w.id)) ?? null }
      : w
  );
}

export async function verifyRobinhoodCredentials(apiKey, privateKeyBase64) {
  const res = await fetch("/api/robinhood/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey, privateKeyBase64 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Robinhood verify failed (${res.status})`);
  }
  return data;
}

const RH_TX_CACHE_KEY = "flawless.robinhoodTx.cache";

export function loadRobinhoodTxCache(walletId) {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(RH_TX_CACHE_KEY) || "{}");
    return all[String(walletId)] ?? null;
  } catch {
    return null;
  }
}

export function saveRobinhoodTxCache(walletId, payload) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(RH_TX_CACHE_KEY) || "{}");
    all[String(walletId)] = { ...payload, cachedAt: new Date().toISOString() };
    localStorage.setItem(RH_TX_CACHE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export async function fetchRobinhoodTransactions(credentials, opts = {}) {
  const res = await fetch("/api/robinhood/transactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey: credentials.apiKey,
      privateKeyBase64: credentials.privateKeyBase64,
      limit: opts.limit ?? 50,
      maxPages: opts.maxPages ?? 6,
      state: opts.state ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Robinhood transactions failed (${res.status})`);
  }
  return data;
}

export async function fetchRobinhoodTransactionsForWallet(wallet, opts = {}) {
  const withCreds = (await attachRobinhoodCredentials([wallet]))[0];
  if (!withCreds?.credentials?.apiKey) {
    throw new Error("Robinhood credentials missing — reconnect this wallet.");
  }
  return fetchRobinhoodTransactions(withCreds.credentials, opts);
}

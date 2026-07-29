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

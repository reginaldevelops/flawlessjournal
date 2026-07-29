import { supabase } from "../supabaseClient";

/** Create an empty manual journal trade and return the new row id. */
export async function createJournalTrade(client = supabase) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const payload = {
    data: {
      Datum: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      Entreetijd: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    },
  };

  let { data, error } = await client.from("trades").insert([payload]).select("id");

  if (error && /trade_number|null value|not-null/i.test(error.message ?? "")) {
    ({ data, error } = await client.from("trades").insert([payload]).select("id"));
  }

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

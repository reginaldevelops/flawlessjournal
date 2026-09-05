import { supabase } from "../supabaseClient";
import { invalidateTradesCache } from "../supabaseTrades";
import { toDateOnlyValue, toDatetimeLocalValue } from "../systemFields";

/** Create an empty manual journal trade and return the new row id. */
export async function createJournalTrade(client = supabase) {
  const now = new Date();
  const entry = toDatetimeLocalValue(now);
  const payload = {
    data: {
      // Datum kept as mirror for legacy filters; Entry time is source of truth
      Datum: toDateOnlyValue(now),
      Entreetijd: entry,
    },
  };

  let { data, error } = await client.from("trades").insert([payload]).select("id");

  if (error && /trade_number|null value|not-null/i.test(error.message ?? "")) {
    ({ data, error } = await client.from("trades").insert([payload]).select("id"));
  }

  if (error) throw error;
  invalidateTradesCache();
  return data?.[0]?.id ?? null;
}

import { createClient } from "@supabase/supabase-js";
import { createMockClient } from "./demo/mockClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * When Supabase credentials are absent the app falls back to a seeded in-memory
 * database so it stays fully usable for local development and previews.
 * Set NEXT_PUBLIC_DEMO_MODE=true to force demo mode even with credentials.
 */
const forceDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const hasCredentials = Boolean(supabaseUrl && supabaseKey);

export const isDemoMode = forceDemo || !hasCredentials;

export const supabase = isDemoMode
  ? createMockClient()
  : createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });

if (isDemoMode && typeof window !== "undefined" && !window.__flawlessDemoNotice) {
  window.__flawlessDemoNotice = true;
  // eslint-disable-next-line no-console
  console.info(
    "%cFlawless Journal — demo mode",
    "color:#7c6cff;font-weight:600",
    "\nNo Supabase credentials found, using a seeded local dataset.",
    "\nAdd NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect your database."
  );
}

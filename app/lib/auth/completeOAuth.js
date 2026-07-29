import { supabase } from "../supabaseClient";

function urlHasOAuthHash() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  return hash.includes("access_token=") || hash.includes("error=");
}

function clearOAuthHashFromUrl() {
  if (typeof window === "undefined" || !urlHasOAuthHash()) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Finish Google OAuth whether Supabase returns PKCE (?code=) or implicit (#access_token=).
 * Returns { session, error }.
 */
export async function completeOAuthFromUrl() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const code = params.get("code");
  const authError = params.get("error_description") || params.get("error");

  if (authError) {
    return { session: null, error: new Error(authError) };
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { session: null, error };
    return { session: data.session, error: null };
  }

  if (urlHasOAuthHash()) {
    // detectSessionInUrl parses the hash asynchronously on load
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error };

  if (data.session) {
    clearOAuthHashFromUrl();
    return { session: data.session, error: null };
  }

  return { session: null, error: null };
}

export function subscribeOAuthSignIn(onSignedIn) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      clearOAuthHashFromUrl();
      onSignedIn(session);
    }
  });
  return subscription;
}

import { supabase } from "../supabaseClient";

export function urlHasOAuthReturn() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("code") || params.get("error") || params.get("error_description")) {
    return true;
  }

  const hash = window.location.hash;
  return hash.includes("access_token=") || hash.includes("error=");
}

function clearOAuthParamsFromUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  url.hash = url.hash.includes("access_token=") || url.hash.includes("error=") ? "" : url.hash;
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
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
    // Supabase client init may already exchange the PKCE code on load.
    const existing = await supabase.auth.getSession();
    if (existing.data.session) {
      clearOAuthParamsFromUrl();
      return { session: existing.data.session, error: null };
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { session: null, error };
    clearOAuthParamsFromUrl();
    return { session: data.session, error: null };
  }

  if (typeof window !== "undefined" && window.location.hash.includes("access_token=")) {
    // Give detectSessionInUrl time to parse implicit hash tokens.
    for (let i = 0; i < 20; i += 1) {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { session: null, error };
      if (data.session) {
        clearOAuthParamsFromUrl();
        return { session: data.session, error: null };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error };

  if (data.session) {
    clearOAuthParamsFromUrl();
    return { session: data.session, error: null };
  }

  return { session: null, error: null };
}

export function subscribeOAuthSignIn(onSignedIn) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      clearOAuthParamsFromUrl();
      onSignedIn(session);
    }
  });
  return subscription;
}

export function oauthRedirectMisconfiguredMessage() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.get("code")) return null;
  if (window.location.hostname !== "localhost") return null;
  return (
    "Login redirected to localhost instead of your live site. " +
    "In Supabase → Authentication → URL Configuration, set Site URL to " +
    "https://flawlessjournal.com and add https://flawlessjournal.com/auth/callback " +
    "under Redirect URLs."
  );
}

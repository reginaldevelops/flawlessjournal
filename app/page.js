"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isDemoMode } from "./lib/supabaseClient";
import {
  completeOAuthFromUrl,
  oauthRedirectMisconfiguredMessage,
  subscribeOAuthSignIn,
  urlHasOAuthReturn,
} from "./lib/auth/completeOAuth";
import styled, { keyframes } from "styled-components";

export default function HomePage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [finishingOAuth, setFinishingOAuth] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function tryFinishOAuth() {
      if (!urlHasOAuthReturn()) return;

      const misconfigured = oauthRedirectMisconfiguredMessage();
      if (misconfigured) {
        setError(misconfigured);
        return;
      }

      setFinishingOAuth(true);
      const { session, error: oauthError } = await completeOAuthFromUrl();
      if (cancelled) return;

      if (oauthError) {
        setError(oauthError.message);
        setFinishingOAuth(false);
        return;
      }

      if (session) {
        router.replace("/dashboard");
        return;
      }

      setFinishingOAuth(false);
    }

    tryFinishOAuth();

    const subscription = subscribeOAuthSignIn(() => {
      if (!cancelled) router.replace("/dashboard");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      router.push("/dashboard");
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
    }
  };

  return (
    <Hero>
      <FormWrapper>
        <div className="bg-black/60 backdrop-blur-md p-6 rounded-xl shadow-lg w-full max-w-sm">
          {error && (
            <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
          )}

          <GlitchButton
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || finishingOAuth}
          >
            {finishingOAuth
              ? "Signing you in…"
              : loading
                ? "Redirecting…"
                : "Continue with Google"}
          </GlitchButton>

          <p className="mt-4 text-center text-xs text-gray-400">
            Sign in with your Google account to open your journal.
          </p>
        </div>
      </FormWrapper>
    </Hero>
  );
}

/* ----- styles ----- */
const Hero = styled.div`
  height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: url("/flawless-logo.png") no-repeat center center;
  background-size: cover;
  position: relative;
`;

const FormWrapper = styled.div`
  margin-bottom: 3rem;
`;

const glitch = keyframes`
  0% { text-shadow: 2px 0 #0ea5e9, -2px 0 #ff0080; }
  20% { text-shadow: -2px 0 #0ea5e9, 2px 0 #ff0080; }
  40% { text-shadow: 2px 0 #ff0080, -2px 0 #0ea5e9; }
  60% { text-shadow: -2px 0 #ff0080, 2px 0 #0ea5e9; }
  80% { text-shadow: 2px 0 #0ea5e9, -2px 0 #ff0080; }
  100% { text-shadow: none; }
`;

const GlitchButton = styled.button`
  width: 100%;
  padding: 1rem 2.5rem;
  border: 2px solid #0ea5e9;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 1px;
  text-decoration: none;
  position: relative;
  box-shadow:
    0 0 12px rgba(14, 165, 233, 0.6),
    0 0 6px rgba(255, 0, 128, 0.5);
  transition: all 0.25s ease;

  &:disabled {
    opacity: 0.65;
    cursor: wait;
    transform: none;
  }

  &:hover:not(:disabled) {
    animation: ${glitch} 0.6s infinite;
    border-color: #ff0080;
    box-shadow:
      0 0 16px rgba(255, 0, 128, 0.8),
      0 0 8px rgba(14, 165, 233, 0.8);
    transform: scale(1.05);
  }
`;

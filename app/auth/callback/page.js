"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { LogoMark } from "../../components/shell/Logo";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const authError = params.get("error_description") || params.get("error");

      if (authError) {
        if (!cancelled) {
          setMessage(authError);
          setTimeout(() => router.replace("/"), 2500);
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setMessage(error.message);
          setTimeout(() => router.replace("/"), 2500);
          return;
        }
        router.replace("/dashboard");
        return;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error) {
        setMessage(error.message);
        setTimeout(() => router.replace("/"), 2500);
        return;
      }

      if (session) {
        router.replace("/dashboard");
        return;
      }

      setMessage("Could not complete sign-in.");
      setTimeout(() => router.replace("/"), 2500);
    }

    finishSignIn();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4">
      <div className="relative">
        <span className="absolute inset-0 animate-pulse-ring rounded-xl" aria-hidden />
        <LogoMark size={40} />
      </div>
      <p className="text-sm font-medium text-content-muted">{message}</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeOAuthFromUrl,
  subscribeOAuthSignIn,
} from "../../lib/auth/completeOAuth";
import { LogoMark } from "../../components/shell/Logo";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      const { session, error } = await completeOAuthFromUrl();
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

    const subscription = subscribeOAuthSignIn(() => {
      if (!cancelled) router.replace("/dashboard");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
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

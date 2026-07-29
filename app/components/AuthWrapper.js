"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { LogoMark } from "./shell/Logo";

const PUBLIC_ROUTES = ["/", "/auth/callback"];

async function userHasVariables(userId) {
  // Prefer scoped rows, but legacy databases often left user_id NULL.
  const owned = await supabase.from("variables").select("id").eq("user_id", userId).limit(1);
  if (!owned.error && (owned.data?.length ?? 0) > 0) return true;

  if (owned.error && !/user_id|column|schema cache|42703/i.test(owned.error.message ?? "")) {
    return { error: owned.error };
  }

  const any = await supabase.from("variables").select("id").limit(1);
  if (any.error) return { error: any.error };
  return (any.data?.length ?? 0) > 0;
}

export default function AuthWrapper({ children }) {
  const [state, setState] = useState("checking");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (PUBLIC_ROUTES.includes(pathname)) {
        setState("ready");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        router.replace("/");
        return;
      }

      const result = await userHasVariables(user.id);
      if (cancelled) return;

      if (result && typeof result === "object" && result.error) {
        console.error("Could not verify onboarding state:", result.error.message);
        setState("ready");
        return;
      }

      const configured = result === true;

      if (!configured && pathname !== "/onboarding") {
        router.replace("/onboarding");
      } else if (configured && pathname === "/onboarding") {
        router.replace("/dashboard");
      } else {
        setState("ready");
      }
    }

    setState("checking");
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
        <div className="relative">
          <span className="absolute inset-0 animate-pulse-ring rounded-xl" aria-hidden />
          <LogoMark size={40} />
        </div>
        <p className="text-xs font-medium tracking-wide text-content-subtle">
          Loading your journal…
        </p>
      </div>
    );
  }

  return children;
}

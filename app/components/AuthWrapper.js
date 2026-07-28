"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { LogoMark } from "./shell/Logo";

const PUBLIC_ROUTES = ["/"];

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

      // A journal is only usable once variables exist, so unconfigured accounts
      // are routed through onboarding first.
      const { data: variables, error: varsError } = await supabase
        .from("variables")
        .select("id")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (varsError) {
        // Never hard-block the app on a schema/RLS hiccup.
        console.error("Could not verify onboarding state:", varsError.message);
        setState("ready");
        return;
      }

      const configured = (variables ?? []).length > 0;

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

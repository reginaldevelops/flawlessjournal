"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export function useOnboardingCheck() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkUserVariables() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.warn("Geen ingelogde gebruiker gevonden:", userError);
        setLoading(false);
        return;
      }

      // Haal variabelen op voor de ingelogde gebruiker
      const { data: variables, error } = await supabase
        .from("variables")
        .select("id")
        .eq("user_id", user.id);

      if (error) {
        // Uitgebreidere log om exact de boodschap en code te zien:
        console.error("❌ Fout bij ophalen variabelen:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      const hasVariables = variables && variables.length > 0;

      if (!hasVariables && pathname !== "/onboarding") {
        router.replace("/onboarding");
      } else if (hasVariables && pathname === "/onboarding") {
        router.replace("/trades");
      } else {
        setLoading(false);
      }
    }

    checkUserVariables();
  }, [pathname, router]);

  return { loading };
}

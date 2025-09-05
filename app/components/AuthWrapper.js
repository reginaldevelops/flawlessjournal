"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function AuthWrapper({ children }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkUser() {
      // homepage (login) is altijd vrij
      if (pathname === "/") {
        setLoading(false);
        return;
      }

      // check Supabase user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/"); // terug naar login
      } else {
        setLoading(false);
      }
    }

    checkUser();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <p className="text-gray-700">Checking auth…</p>
      </div>
    );
  }

  return <>{children}</>;
}

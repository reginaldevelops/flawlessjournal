"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "../ui/Overlays";
import AuthWrapper from "../AuthWrapper";
import AppShell from "./AppShell";
import ScrollToTop from "../ScrolToTop";
import SolanaWalletProvider from "../swap/WalletProvider";

/** Routes that render without the app chrome. */
const BARE_ROUTES = ["/", "/onboarding"];

export default function RootProviders({ children }) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.includes(pathname);

  return (
    <ThemeProvider>
      <ToastProvider>
        <SolanaWalletProvider>
          <AuthWrapper>
            {bare ? (
              <main className="min-h-screen">{children}</main>
            ) : (
              <AppShell>{children}</AppShell>
            )}
          </AuthWrapper>
        </SolanaWalletProvider>
      </ToastProvider>
      <ScrollToTop />
    </ThemeProvider>
  );
}

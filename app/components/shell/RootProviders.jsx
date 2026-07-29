"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "../ui/Overlays";
import AuthWrapper from "../AuthWrapper";
import AppShell from "./AppShell";
import ScrollToTop from "../ScrolToTop";
import SolanaWalletProvider from "../swap/WalletProvider";
import WalletSyncScheduler from "../swap/WalletSyncScheduler";
import { SwapFlowProvider } from "../swap/SwapFlowContext";

/** Routes that render without the app chrome. */
const BARE_ROUTES = ["/", "/onboarding"];

export default function RootProviders({ children }) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.includes(pathname);

  return (
    <ThemeProvider>
      <ToastProvider>
        <SolanaWalletProvider>
          <SwapFlowProvider>
            <AuthWrapper>
              {bare ? (
                <main className="min-h-screen">{children}</main>
              ) : (
                <AppShell>{children}</AppShell>
              )}
            </AuthWrapper>
            {!bare && <WalletSyncScheduler />}
          </SwapFlowProvider>
        </SolanaWalletProvider>
      </ToastProvider>
      <ScrollToTop />
    </ThemeProvider>
  );
}

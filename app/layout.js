"use client";

import StyledComponentsRegistry from "./lib/registry";
import { GlobalStyles } from "./lib/GlobalStyles";
import { Poppins } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrolToTop";
import AuthWrapper from "./components/AuthWrapper";
import { usePathname } from "next/navigation";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const metadata = {
  title: "Flawless Journal",
  description: "Custom trading journal",
};

export default function RootLayout({ children }) {
  const pathname = usePathname?.(); // 👈 belangrijk: client hook

  const hideLayout = pathname === "/"; // waar header/footer niet moet komen

  return (
    <html lang="en">
      <body className={poppins.className}>
        <StyledComponentsRegistry>
          <GlobalStyles />
          <AuthWrapper>
            <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-[#e1c4f4] to-[#a8c5ff]">
              {!hideLayout && <Header />}
              <main className="flex-1 flex flex-col min-h-screen">
                {children}
              </main>
              {!hideLayout && <Footer />}
            </div>
          </AuthWrapper>
        </StyledComponentsRegistry>
        <ScrollToTop />
      </body>
    </html>
  );
}

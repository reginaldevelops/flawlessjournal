// app/layout.js
import StyledComponentsRegistry from "./lib/registry";
import { GlobalStyles } from "./lib/GlobalStyles";
import { Poppins } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrolToTop";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Flawless Journal",
  description: "Custom trading journal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <StyledComponentsRegistry>
          <GlobalStyles />
          <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-[#e1c4f4] to-[#a8c5ff]">
            <Header />
            <main className="flex-1 flex flex-col min-h-screen">
              {children}
            </main>
            <Footer />
          </div>
        </StyledComponentsRegistry>
        <ScrollToTop />
      </body>
    </html>
  );
}

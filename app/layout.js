// app/layout.js
import StyledComponentsRegistry from "./lib/registry";
import { GlobalStyles } from "./lib/GlobalStyles";
import { Poppins } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // welke varianten je nodig hebt
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
          <Header />
          {children}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}

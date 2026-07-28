import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "./lib/registry";
import RootProviders from "./components/shell/RootProviders";
import { themeScript } from "./components/shell/themeScript";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata = {
  title: {
    default: "Flawless Journal",
    template: "%s · Flawless Journal",
  },
  description:
    "A trading journal built for edge discovery: dynamic trade logging, deep analytics, playbooks and on-chain balances.",
  applicationName: "Flawless Journal",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090a0e" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable}`}
    >
      <head>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StyledComponentsRegistry>
          <RootProviders>{children}</RootProviders>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}

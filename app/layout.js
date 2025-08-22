// app/layout.js
import StyledComponentsRegistry from "./lib/registry";
import { GlobalStyles } from "./lib/GlobalStyles";

export const metadata = {
  title: "Flawless Journal",
  description: "Custom trading journal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <GlobalStyles />
          {children}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}

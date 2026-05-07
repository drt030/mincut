import "@xyflow/react/dist/style.css";
import "./globals.css";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SkipToContent } from "@/components/SkipToContent";

export const metadata: Metadata = {
  title: "Capability Graph Explorer",
  description: "Graph-based research tool for product and capability maturity.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          {/*
           * Per iter-45 a11y audit (MINOR): the header has 5 interactive
           * elements (brand link + 4 nav links + language switcher) before
           * <main>. KB-only users had to Tab through every header link on
           * every page. The skip-to-content link is the first focusable
           * element on the page; it is visually hidden until focused.
           */}
          <SkipToContent />
          <AppHeader />
          <main id="main">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}

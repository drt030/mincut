import "@xyflow/react/dist/style.css";
import "./globals.css";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { LanguageProvider } from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "Capability Graph Explorer",
  description: "Graph-based research tool for product and capability maturity.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AppHeader />
          <main>{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}

import "@xyflow/react/dist/style.css";
import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppHeader } from "@/components/AppHeader";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SkipToContent } from "@/components/SkipToContent";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://drt030.com";
const siteTitle = "Capability Graph Explorer";
const siteDescription =
  "Interactive bottleneck maps of real supply chains. A cited research tool for tracing maturity, exposure, and chokepoints; not investment advice.";
const defaultOgImage = "/og/default.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteTitle} - interactive bottleneck maps of real supply chains`,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${siteTitle} - interactive bottleneck maps of real supply chains`,
    description: siteDescription,
    url: "/",
    siteName: siteTitle,
    type: "website",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: "Capability Graph Explorer bottleneck map preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteTitle} - interactive bottleneck maps`,
    description: siteDescription,
    images: [defaultOgImage],
  },
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
          <footer className="site-disclaimer">
            Research and educational tool. Nothing here is investment advice. ·
            本站为产业研究工具，不构成任何投资建议。
          </footer>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}

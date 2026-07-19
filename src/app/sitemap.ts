import type { MetadataRoute } from "next";
import { DOMAIN_ROUTES } from "@/lib/domains";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://drt030.com";

function sitemapEntry(path: string, priority: number): MetadataRoute.Sitemap[number] {
  return {
    url: new URL(path, siteUrl).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    sitemapEntry("/", 1),
    sitemapEntry("/policies", 0.3),
    ...DOMAIN_ROUTES.map((domain) => sitemapEntry(`/d/${domain.slug}`, domain.slug === "ai-compute" ? 0.95 : 0.8)),
  ];
}

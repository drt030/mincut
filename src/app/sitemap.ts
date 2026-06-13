import type { MetadataRoute } from "next";
import { DOMAIN_ROUTES } from "@/lib/domains";
import { V0_TARGET_NODE_ID } from "@/lib/graphTraversal";

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
    sitemapEntry("/explore", 0.6),
    sitemapEntry("/graph", 0.8),
    sitemapEntry("/gate", 0.7),
    sitemapEntry("/tasks", 0.5),
    sitemapEntry(`/product/${V0_TARGET_NODE_ID}`, 0.7),
    ...DOMAIN_ROUTES.map((domain) => sitemapEntry(`/d/${domain.slug}`, domain.slug === "ai-compute" ? 0.95 : 0.8)),
  ];
}

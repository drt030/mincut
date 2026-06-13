import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOMAIN_ROUTES, domainBySlug } from "../src/lib/domains";
import { V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";
import { generateMetadata } from "../src/app/d/[slug]/page";
import sitemap from "../src/app/sitemap";

const SITE_URL = "https://drt030.com";
const DEFAULT_OG_IMAGE = "/og/default.png";

function pngSize(path: string): { width: number; height: number } {
  const file = readFileSync(path);
  assert.equal(file.toString("ascii", 1, 4), "PNG", `${path} should be a PNG file`);
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

test("domain pages publish per-domain canonical and social metadata", async () => {
  const domain = domainBySlug("ai-compute");
  assert.ok(domain, "ai-compute route should be registered");
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "ai-compute" }) });

  assert.equal(metadata.title, "AI compute chain");
  assert.equal(metadata.alternates?.canonical, "/d/ai-compute");
  assert.equal(metadata.openGraph?.url, "/d/ai-compute");
  assert.equal(metadata.openGraph?.title, "AI compute chain");
  assert.equal(metadata.openGraph?.description, domain.description);
  assert.deepEqual(metadata.openGraph?.images, [
    {
      url: DEFAULT_OG_IMAGE,
      width: 1200,
      height: 630,
      alt: "AI compute chain bottleneck map preview",
    },
  ]);
  assert.deepEqual(metadata.twitter, {
    card: "summary_large_image",
    title: "AI compute chain",
    description: domain.description,
    images: [DEFAULT_OG_IMAGE],
  });
});

test("sitemap covers public app routes, registered domains, and current parcel product page", () => {
  const urls = new Set(sitemap().map((entry) => entry.url));

  for (const path of ["/", "/explore", "/graph", "/gate", "/tasks", `/product/${V0_TARGET_NODE_ID}`]) {
    assert.ok(urls.has(`${SITE_URL}${path}`), `sitemap should include ${path}`);
  }

  for (const domain of DOMAIN_ROUTES) {
    assert.ok(urls.has(`${SITE_URL}/d/${domain.slug}`), `sitemap should include /d/${domain.slug}`);
  }
  assert.equal(urls.has(`${SITE_URL}/d/humanoid`), false, "sitemap should not include unregistered humanoid route");
  assert.equal(urls.has(`${SITE_URL}/d/power`), false, "sitemap should not include unregistered power route");
});

test("default Open Graph fallback is a 1200x630 PNG", () => {
  assert.deepEqual(pngSize("public/og/default.png"), { width: 1200, height: 630 });
});

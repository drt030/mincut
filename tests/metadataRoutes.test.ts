import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOMAIN_ROUTES, domainBySlug } from "../src/lib/domains";
import { generateMetadata } from "../src/app/d/[slug]/page";
import robots from "../src/app/robots";
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

test("sitemap covers public app routes and registered domains without internal parcel surfaces", () => {
  const urls = new Set(sitemap().map((entry) => entry.url));

  for (const path of ["/", "/policies"]) {
    assert.ok(urls.has(`${SITE_URL}${path}`), `sitemap should include ${path}`);
  }

  for (const domain of DOMAIN_ROUTES) {
    assert.ok(urls.has(`${SITE_URL}/d/${domain.slug}`), `sitemap should include /d/${domain.slug}`);
  }
  for (const path of ["/explore", "/graph", "/gate", "/tasks", "/d/parcel-robot"]) {
    assert.equal(urls.has(`${SITE_URL}${path}`), false, `sitemap should not include ${path}`);
  }
  assert.equal([...urls].some((url) => url.includes("/product/")), false, "sitemap should not include product routes");
  assert.equal(urls.has(`${SITE_URL}/d/humanoid`), false, "sitemap should not include unregistered humanoid route");
  assert.equal(urls.has(`${SITE_URL}/d/power`), false, "sitemap should not include unregistered power route");
});

test("robots allows public research while excluding operator and checkout-return routes", () => {
  const result = robots();
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  const disallowed = new Set(Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow]);

  assert.equal(rule.allow, "/");
  for (const path of ["/explore", "/gate", "/graph", "/product/", "/tasks", "/unlock"]) {
    assert.equal(disallowed.has(path), true, `robots should disallow ${path}`);
  }
  assert.equal(result.sitemap, `${SITE_URL}/sitemap.xml`);
});

test("default Open Graph fallback is a 1200x630 PNG", () => {
  assert.deepEqual(pngSize("public/og/default.png"), { width: 1200, height: 630 });
});

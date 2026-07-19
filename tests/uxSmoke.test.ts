import test from "node:test";
import assert from "node:assert/strict";

/**
 * HTTP smoke tour — substitute for the chrome-devtools-driven UX tour
 * spec'd in slice 4 acceptance. Each test fetches a golden-path route
 * and asserts that the HTML contains markers indicating the slice's UI
 * landed. If UX_SMOKE_BASE_URL is not set, or the configured dev server
 * is not running, each test skips with a note rather than failing.
 *
 * These are shallow — they verify markup is present in the SSR'd HTML.
 * Client-side state machine behaviour (ESC handler, click-to-focus,
 * compact-mode class toggle) needs a real browser. Run the 7-step
 * manual tour from the morning hand-off for that.
 */

const BASE = process.env.UX_SMOKE_BASE_URL?.replace(/\/$/, "");
const EXPECT_PAID_CHECKOUT = process.env.EXPECT_PAID_CHECKOUT === "1";

async function serverIsUp(): Promise<boolean> {
  if (!BASE) return false;
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchHtml(path: string): Promise<string> {
  assert.ok(BASE, "UX_SMOKE_BASE_URL is required for ux smoke tests");
  const res = await fetch(`${BASE}${path}`);
  assert.ok(res.ok, `${path} returned ${res.status}`);
  return await res.text();
}

async function fetchStatus(path: string): Promise<number> {
  assert.ok(BASE, "UX_SMOKE_BASE_URL is required for ux smoke tests");
  const res = await fetch(`${BASE}${path}`);
  await res.arrayBuffer();
  return res.status;
}

test("ux smoke: home page renders the free AI compute map and founding access", async (t) => {
  if (!(await serverIsUp())) return t.skip("UX_SMOKE_BASE_URL not set or dev server not running");
  const html = await fetchHtml("/");
  const mainShell = html.slice(html.indexOf("<main"), html.indexOf("</main>") + "</main>".length);

  assert.match(html, /MinCut/);
  assert.match(html, /AI compute chain/);
  assert.match(html, /Full-free flagship/);
  assert.match(html, /id="private-beta"/);
  assert.match(html, /buttondown\.com\/api\/emails\/embed-subscribe\/drt030/);
  assert.doesNotMatch(mainShell, /\/d\/parcel-robot/);
  if (EXPECT_PAID_CHECKOUT) {
    assert.match(mainShell, /Buy founding access/);
    assert.match(mainShell, /buy\.stripe\.com/);
  } else {
    assert.doesNotMatch(mainShell, /Stripe|checkout|Checkout|landing-founding-cta|buy\.stripe\.com/);
  }
});

test("ux smoke: /d/ai-compute ships the public free graph", async (t) => {
  if (!(await serverIsUp())) return t.skip("UX_SMOKE_BASE_URL not set or dev server not running");
  const html = await fetchHtml("/d/ai-compute");

  assert.match(html, /data-testid="graph-controls"/);
  assert.match(html, /data-testid="graph-product-strip"/);
  assert.match(html, /sector-label-layer/);
  assert.match(html, /AI chip \/ GPU compute module/);
  assert.match(html, /Free reference map/);
  assert.doesNotMatch(html, /300,000 RMB parcel-sorting robot/);
});

test("ux smoke: audit-preview domain routes render without exposing parcel", async (t) => {
  if (!(await serverIsUp())) return t.skip("UX_SMOKE_BASE_URL not set or dev server not running");
  const routes = [
    ["/d/humanoid-robotics", /Humanoid robotics component stack/],
    ["/d/controlled-fusion", /Controlled fusion route portfolio/],
    ["/d/spacex-reusable-launch", /SpaceX reusable launch stack/],
    ["/d/spacex-orbital-data-center", /SpaceX orbital data center system/],
  ] as const;

  for (const [path, title] of routes) {
    const html = await fetchHtml(path);
    assert.match(html, title);
    assert.match(html, /data-testid="graph-controls"/);
    assert.doesNotMatch(html, /\/d\/parcel-robot/);
  }
});

test("ux smoke: parcel domain route is not public", async (t) => {
  if (!(await serverIsUp())) return t.skip("UX_SMOKE_BASE_URL not set or dev server not running");
  assert.equal(await fetchStatus("/d/parcel-robot"), 404);
});

test("ux smoke: sitemap includes only public launch domains", async (t) => {
  if (!(await serverIsUp())) return t.skip("UX_SMOKE_BASE_URL not set or dev server not running");
  const xml = await fetchHtml("/sitemap.xml");

  assert.match(xml, /\/d\/ai-compute/);
  assert.match(xml, /\/d\/humanoid-robotics/);
  assert.match(xml, /\/d\/spacex-reusable-launch/);
  assert.doesNotMatch(xml, /\/d\/parcel-robot/);
});

import test from "node:test";
import assert from "node:assert/strict";

/**
 * HTTP smoke tour — substitute for the chrome-devtools-driven UX tour
 * spec'd in slice 4 acceptance. Each test fetches a golden-path route
 * and asserts that the HTML contains markers indicating the slice's UI
 * landed. If the dev server isn't running, each test skips with a
 * note rather than failing.
 *
 * These are shallow — they verify markup is present in the SSR'd HTML.
 * Client-side state machine behaviour (ESC handler, click-to-focus,
 * compact-mode class toggle) needs a real browser. Run the 7-step
 * manual tour from the morning hand-off for that.
 */

const BASE = "http://localhost:3000";

async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`);
  assert.ok(res.ok, `${path} returned ${res.status}`);
  return await res.text();
}

test("ux smoke: home page renders north-star hero", async (t) => {
  if (!(await serverIsUp())) return t.skip("dev server not running on localhost:3000");
  const html = await fetchHtml("/");
  assert.match(html, /Capability Graph Explorer/);
  assert.match(html, /parcel-sorting robot/i);
});

test("ux smoke: /graph ships ColorModeSelect dropdown markup", async (t) => {
  if (!(await serverIsUp())) return t.skip("dev server not running on localhost:3000");
  const html = await fetchHtml("/graph");
  assert.match(html, /color-mode-select-wrapper/);
  assert.match(html, /value="bottleneck"/);
  assert.match(html, /value="cost"/);
  assert.match(html, /value="maturity"/);
  assert.match(html, /value="overall"/);
  assert.match(html, /value="relation"/);
});

test("ux smoke: /product page shows cost rollup section + new typical 283.5k + breakdown row", async (t) => {
  if (!(await serverIsUp())) return t.skip("dev server not running on localhost:3000");
  const html = await fetchHtml("/product/low_cost_parcel_sorting_robot_300k_rmb");
  // Slice 1 changed the typical rollup from 274.7k → 283.5k. Smoke-check
  // the new number is rendered so we know the new walker is in the
  // serving build (not just in tests).
  assert.match(html, /cost-rollup-card/);
  assert.match(html, /283,532/, "/product should show the new max-of rolled-up typical");
  // Slice-4 polish: ProductView now also shows the direct/children
  // breakdown row.
  assert.match(html, /cost-rollup-breakdown/);
});

test("ux smoke: /graph default selection surfaces flagship rolled-up in detail panel", async (t) => {
  if (!(await serverIsUp())) return t.skip("dev server not running on localhost:3000");
  const html = await fetchHtml("/graph");
  // NodeDetailPanel renders the flagship by default. cost-rollup-breakdown
  // appears whenever directOnly or fromChildren is non-null — flagship has
  // fromChildren so the row should be in the SSR'd HTML.
  assert.match(html, /cost-rollup-card/);
  assert.match(html, /cost-rollup-breakdown/);
});

test("ux smoke: /gate page renders gate report", async (t) => {
  if (!(await serverIsUp())) return t.skip("dev server not running on localhost:3000");
  const html = await fetchHtml("/gate");
  assert.ok(html.length > 1000, `/gate body is suspiciously small: ${html.length} bytes`);
});

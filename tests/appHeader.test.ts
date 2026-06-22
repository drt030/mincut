import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppHeader } from "../src/components/AppHeader";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("launch header links to registered domain maps", () => {
  const html = renderToStaticMarkup(React.createElement(AppHeader));

  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/d\/ai-compute"/);
  assert.match(html, /href="\/d\/parcel-robot"/);
});

test("launch header tracks client route changes through Next pathname state", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");

  assert.match(source, /usePathname/);
  assert.doesNotMatch(source, /window\.location\.pathname/);
});

test("launch header includes the registered domain portfolio without calling every route live", () => {
  const html = renderToStaticMarkup(React.createElement(AppHeader));

  assert.match(html, /Map portfolio/);
  assert.doesNotMatch(html, /Live maps/);
  assert.doesNotMatch(html, /Paid candidate preview/);
  assert.match(html, /data-testid="mobile-domain-select"/);
  assert.match(html, /href="\/d\/humanoid-robotics"/);
  assert.match(html, /<option value="\/d\/humanoid-robotics">Humanoid robotics component stack<\/option>/);
  assert.match(html, /href="\/d\/controlled-fusion"/);
  assert.match(html, /<option value="\/d\/controlled-fusion">Controlled fusion route portfolio<\/option>/);
  assert.match(html, /href="\/d\/spacex-reusable-launch"/);
  assert.match(html, /<option value="\/d\/spacex-reusable-launch">SpaceX reusable launch stack<\/option>/);
  assert.match(html, /href="\/d\/spacex-orbital-data-center"/);
  assert.match(html, /<option value="\/d\/spacex-orbital-data-center">SpaceX orbital data center system<\/option>/);
  assert.match(html, /Humanoid robotics component stack/);
  assert.match(html, /Controlled fusion route portfolio/);
  assert.match(html, /SpaceX reusable launch stack/);
  assert.match(html, /SpaceX orbital data center system/);
});

test("launch header does not expose legacy research routes as primary nav", () => {
  const html = renderToStaticMarkup(React.createElement(AppHeader));

  assert.doesNotMatch(html, /href="\/graph"/);
  assert.doesNotMatch(html, /href="\/tasks"/);
  assert.doesNotMatch(html, /href="\/product\//);
});

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

test("launch header includes live paid-candidate domain maps", () => {
  const html = renderToStaticMarkup(React.createElement(AppHeader));

  assert.match(html, /Live maps/);
  assert.match(html, /data-testid="mobile-domain-select"/);
  assert.match(html, /href="\/d\/humanoid-robotics"/);
  assert.match(html, /<option value="\/d\/humanoid-robotics">Humanoid robotics component stack<\/option>/);
  assert.match(html, /href="\/d\/controlled-fusion"/);
  assert.match(html, /<option value="\/d\/controlled-fusion">Controlled fusion route portfolio<\/option>/);
  assert.match(html, /Humanoid robotics component stack/);
  assert.match(html, /Controlled fusion route portfolio/);
});

test("launch header does not expose legacy research routes as primary nav", () => {
  const html = renderToStaticMarkup(React.createElement(AppHeader));

  assert.doesNotMatch(html, /href="\/graph"/);
  assert.doesNotMatch(html, /href="\/tasks"/);
  assert.doesNotMatch(html, /href="\/product\//);
});

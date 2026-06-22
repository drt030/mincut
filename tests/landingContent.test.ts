import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("root page renders the graph-first ai compute workspace", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /domainBySlug\("ai-compute"\)/);
  assert.match(source, /GraphExplorer/);
  assert.match(source, /HomeMapDock/);
  assert.doesNotMatch(source, /LandingContent/);
});

test("domain pages keep the same map dock as the graph-first home", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/app/d/[slug]/page.tsx", import.meta.url), "utf8");

  assert.match(source, /HomeMapDock/);
  assert.match(source, /<HomeMapDock activeSlug=\{domain\.slug\}/);
  assert.match(source, /graph-first-home/);
});

test("home map dock keeps collapsed shortcuts quiet", async () => {
  const { HomeMapDock } = await import("../src/components/HomeMapDock");
  const { LanguageProvider } = await import("../src/components/LanguageProvider");
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(HomeMapDock, { activeSlug: "ai-compute" }),
    ),
  );

  assert.match(html, /Maps/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /href="\/"/);
  assert.match(html, />AI</);
  assert.match(html, /PR/);
  assert.match(html, /SX/);
  assert.match(html, /HR/);
  assert.match(html, /CF/);
  assert.match(html, /home-map-shortcut-tooltip/);
  assert.doesNotMatch(html, /<h2>Domains<\/h2>/);
  assert.doesNotMatch(html, /Full-free flagship demo/);
  assert.doesNotMatch(html, /Preview; exposure locked/);
  assert.doesNotMatch(html, /green dot/i);
  assert.doesNotMatch(html, /red dot/i);
  assert.doesNotMatch(html, /琥珀点/);
});

test("home map dock opens the full menu only from the Maps trigger", async () => {
  const fs = await import("node:fs/promises");
  const component = await fs.readFile(new URL("../src/components/HomeMapDock.tsx", import.meta.url), "utf8");
  const css = await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /setOpen/);
  assert.match(component, /Escape/);
  assert.match(component, /home-map-shortcut-tooltip/);
  assert.doesNotMatch(css, /\.home-map-dock:hover\s+\.home-map-popover/);
});

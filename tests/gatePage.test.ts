import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GatePage from "../src/app/gate/page";

test("/gate latest report is computed from the current graph, not a stale saved snapshot", () => {
  const html = renderToStaticMarkup(React.createElement(GatePage));
  const latestStart = html.indexOf("Latest / current report");
  const historicalStart = html.indexOf("Historical Reports");

  assert.ok(latestStart >= 0, "latest gate report section must render");
  assert.ok(historicalStart > latestStart, "historical reports must render after the latest section");

  const latestSection = html.slice(latestStart, historicalStart);
  assert.match(
    latestSection,
    /Rolled-up cost \(RMB\): est\. \d+(?:\.\d)?k/,
    "latest gate report should use the same current estimated cost rollup as the product page",
  );
  assert.match(latestSection, /Coverage gap: \d+ node\(s\)/);
  assert.doesNotMatch(
    latestSection,
    /est\. 411\.7k/,
    "latest gate report must not come from the stale saved report snapshot",
  );
  assert.doesNotMatch(latestSection, /\bp50\b/i);
});

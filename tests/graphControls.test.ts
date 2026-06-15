import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraphControls } from "../src/components/GraphControls";

test("GraphControls exposes one compact lens control surface without static map controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "cost",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.match(html, /data-testid="graph-controls"/);
  assert.doesNotMatch(html, /Full system/i);
  assert.doesNotMatch(html, /完整系统/);
  // §2 vocabulary: exactly three lenses — System decomposition / Cost /
  // Chokepoint. The pre-ADR-0010 "Cost drivers", "Bottleneck risk", and
  // "Maturity" lens labels must be gone.
  assert.match(html, />Cost</);
  assert.match(html, /System decomposition/i);
  assert.match(html, /Chokepoint/i);
  assert.doesNotMatch(html, /Cost drivers/i);
  assert.doesNotMatch(html, /Bottleneck risk/i);
  assert.doesNotMatch(html, /Maturity/i);
  assert.doesNotMatch(html, /Overall/i);
  assert.doesNotMatch(html, />Relation</i);
  assert.equal((html.match(/data-analysis-mode=/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Display mode/i);
});

test("GraphControls explains the active chokepoint lens without Top 1-5 rank copy", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "bottleneck-risk",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.match(html, /data-testid="lens-legend"/);
  assert.match(html, /Edge color \+ width/i);
  // Chokepoint legend copy (ADR-0010 vocabulary): low (blue) → chokepoint (red).
  assert.match(html, /low \(blue\) → chokepoint \(red\)/i);
  assert.match(html, /block scale, cost, or adoption/i);
  assert.doesNotMatch(html, /Sector tint/i);
  assert.doesNotMatch(html, /structural grouping/i);
  assert.doesNotMatch(html, /Top 1-5/i);
  assert.equal((html.match(/data-testid="lens-legend-width-sample"/g) ?? []).length, 5);
});

test("GraphControls legend shows five edge-width samples without a duplicate colour ramp", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "cost",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.equal(
    (html.match(/data-testid="lens-legend-width-sample"/g) ?? []).length,
    5,
    `cost legend should render one visible width sample per band; got: ${html}`,
  );
  assert.match(
    html,
    /线条颜色 \+ 粗细|Edge color \+ width/,
    `legend copy should explicitly name both colour and width channels; got: ${html}`,
  );
  assert.equal(
    (html.match(/data-testid="lens-legend-swatch"/g) ?? []).length,
    0,
    "the flat colour ramp duplicates the width samples and should stay removed",
  );
});

test("GraphControls uses one shared lens icon across all analysis modes", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "cost",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.equal((html.match(/class="graph-control-icon lens"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /graph-control-icon route/);
  assert.doesNotMatch(html, /graph-control-icon system/);
});

test("GraphControls no longer offers a Maturity lens (folded into Barrier per ADR-0010)", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "maturity",
      onAnalysisModeChange: () => {},
    }),
  );

  // Maturity is no longer a selectable lens: no Maturity button, and the old
  // reversed-maturity legend copy is gone. The internal `maturity` ColorMode
  // (still carried for non-lens code) falls back to the cost legend rather
  // than crashing on a missing legend entry.
  assert.doesNotMatch(html, /data-analysis-mode="maturity"/);
  assert.doesNotMatch(html, /Maturity/i);
  assert.doesNotMatch(html, /maturity gap/i);
  assert.doesNotMatch(html, /less proven/i);
  assert.match(html, /data-lens-mode="cost"/);
  assert.match(html, /Wider = cost burden/i);
});

test("GraphControls adds a neutral system decomposition lens", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "relation",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.match(html, /data-analysis-mode="relation"/);
  assert.match(html, /System decomposition/i);
  assert.match(html, /structure only/i);
  assert.match(html, /no cost, risk, or maturity signal/i);
  assert.doesNotMatch(html, /Neutral edges/i);
  assert.doesNotMatch(html, /Sector tint/i);
  assert.equal((html.match(/data-testid="lens-legend-width-sample"/g) ?? []).length, 0);
});

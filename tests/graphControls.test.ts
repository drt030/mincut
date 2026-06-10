import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraphControls } from "../src/components/GraphControls";

test("GraphControls exposes one compact Full System + route control surface", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "cost",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.match(html, /data-testid="graph-controls"/);
  assert.match(html, /Full system/i);
  assert.match(html, /Cost drivers/i);
  assert.match(html, /System decomposition/i);
  assert.match(html, /Bottleneck risk/i);
  assert.match(html, /Maturity/i);
  assert.doesNotMatch(html, /Overall/i);
  assert.doesNotMatch(html, />Relation</i);
  assert.equal((html.match(/data-analysis-mode=/g) ?? []).length, 4);
  assert.doesNotMatch(html, /Display mode/i);
});

test("GraphControls explains the active risk lens without Top 1-5 rank copy", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "bottleneck-risk",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.match(html, /data-testid="lens-legend"/);
  assert.match(html, /Edge color \+ width/i);
  assert.match(html, /target node risk/i);
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

  assert.equal((html.match(/class="graph-control-icon lens"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /graph-control-icon route/);
  assert.doesNotMatch(html, /graph-control-icon system/);
});

test("GraphControls reverses the maturity legend so warm means least mature", () => {
  const html = renderToStaticMarkup(
    React.createElement(GraphControls, {
      routeMode: "cost-drivers",
      analysisMode: "maturity",
      onAnalysisModeChange: () => {},
    }),
  );

  assert.match(html, /least mature/i);
  assert.match(html, /uncertain/i);
  assert.match(html, /mature/i);
  assert.doesNotMatch(html, /Top 1-5/i);
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

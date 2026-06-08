import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductView } from "../src/components/ProductView";
import { loadGraphData } from "../src/lib/graphLoader";
import { nodeById } from "../src/lib/graphTraversal";

test("ProductView surfaces supplier candidates for material nodes", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "boron_and_iron_magnet_matrix_material");
  assert.ok(node);

  const html = renderToStaticMarkup(React.createElement(ProductView, { graph, product: node }));

  assert.match(html, /Candidate manufacturers \/ investable exposure/);
  assert.match(html, /product-candidate-organizations/);
  assert.match(html, /JL MAG/);
  assert.match(html, /Beijing Zhong Ke San Huan/);
  assert.match(html, /Ningbo Yunsheng/);
  assert.match(html, /Public listing/);
});

test("ProductView surfaces an investor answer summary for the active product", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  assert.ok(node);

  const html = renderToStaticMarkup(React.createElement(ProductView, { graph, product: node }));

  assert.match(html, /product-investor-answer-panel/);
  assert.match(html, /Investor answer panel/);
  assert.match(html, /Candidate exposure is graph-linked/);
  assert.match(html, /Top risk bottleneck/);
  assert.match(html, /Parcel pick-and-place execution subsystem/);
  assert.match(html, /Cost gap/);
  assert.match(html, /169,079 RMB/);
  assert.match(html, /Throughput constraints/);
  assert.match(html, /p50 is at or above target/);
  assert.match(html, /not a quantified shortfall attribution/);
  assert.match(html, /Top startup opportunities/);
  assert.match(html, /Reducer lubrication and life testing/);
  assert.match(html, /Cost coverage complete/);
  assert.doesNotMatch(html, /targetCost:/);
});

test("ProductView evidence card exposes provenance and review quality", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  assert.ok(node);

  const html = renderToStaticMarkup(React.createElement(ProductView, { graph, product: node }));

  assert.match(html, /Initial target definition for a 300,000 RMB parcel sorting cell/);
  assert.match(html, /Type.*internal note/);
  assert.match(html, /Status.*reviewed/);
  assert.match(html, /confidence.*medium/);
  assert.match(html, /Source.*Project initialization document/);
  assert.match(html, /Date.*2026-04-26/);
  assert.match(html, /Limitations.*Internal planning evidence only/);
  assert.match(html, /Status.*unreviewed/);
});

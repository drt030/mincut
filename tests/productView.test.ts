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

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductView } from "../src/components/ProductView";
import { ExposureLockProvider } from "../src/components/ExposureLockCta";
import { loadGraphData } from "../src/lib/graphLoader";
import { nodeById } from "../src/lib/graphTraversal";
import type { GraphData } from "../src/lib/schema";

test("ProductView surfaces supplier candidates for material nodes", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "boron_and_iron_magnet_matrix_material");
  assert.ok(node);

  const html = renderToStaticMarkup(React.createElement(ProductView, { graph, product: node }));

  assert.match(html, /Modeled manufacturer links/);
  assert.match(html, /product-candidate-organizations/);
  assert.match(html, /JL MAG/);
  assert.match(html, /Beijing Zhong Ke San Huan/);
  assert.match(html, /Ningbo Yunsheng/);
  assert.match(html, /Public listing/);
});

test("ProductView hides internal backfill notes in candidate organization cards", () => {
  const graph: GraphData = {
    graphVersion: "product-view-reader-note-test",
    nodes: [
      {
        id: "product",
        name: "Product",
        kind: "product",
        domain: ["test"],
        description: "Test product.",
      },
      {
        id: "org_candidate",
        name: "Candidate supplier",
        kind: "organization",
        domain: ["test"],
        notes: "Investor relevance: useful benchmark supplier. listing backfill 2026-06-10 (agent, needs review)",
      },
    ],
    edges: [
      {
        id: "e_product_org",
        source: "product",
        target: "org_candidate",
        relation: "manufactured_by",
      },
    ],
    evidence: [],
  };
  const product = nodeById(graph, "product");
  assert.ok(product);

  const html = renderToStaticMarkup(React.createElement(ProductView, { graph, product }));

  assert.match(html, /Investor relevance: useful benchmark supplier/i);
  assert.doesNotMatch(html, /listing backfill/i);
  assert.doesNotMatch(html, /needs review/i);
});

test("ProductView surfaces a reader-facing chokepoint readout for the active product", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  assert.ok(node);

  const html = renderToStaticMarkup(React.createElement(ProductView, { graph, product: node }));

  assert.match(html, /product-investor-answer-panel/);
  assert.match(html, /Chokepoint readout/);
  assert.doesNotMatch(html, /Investor answer panel/);
  assert.match(html, /Candidate exposure is graph-linked/);
  assert.match(html, /Top risk bottleneck/);
  assert.doesNotMatch(html, /Heat \d+\/100/);
  assert.doesNotMatch(
    html,
    /Risk \d+%/,
    `ProductView investor answer must not display risk scores as probability-like percentages; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Relative pressure signal:/,
    `ProductView reader-facing readout should not need an internal Heat tooltip; got: ${html}`,
  );
  assert.match(html, /Cost gap/);
  assert.match(html, /173,384 RMB/);
  assert.match(html, /Throughput constraints/);
  assert.match(html, /p50 is at or above target/);
  assert.match(html, /not a quantified shortfall attribution/);
  assert.match(html, /Top startup opportunities/);
  assert.match(html, /Reducer lubrication and life testing/);
  assert.match(html, /Modeled cost: [^<]+RMB/);
  assert.doesNotMatch(html, /Top blockers \(click to focus\)|🎯/);
  assert.doesNotMatch(
    html.match(/<section[^>]*data-testid="product-investor-answer-panel"[\s\S]*?<\/section>/)?.[0] ?? "",
    /<strong>Cost signal:<\/strong>\s*p50 RMB/i,
    `ProductView should not expose a naked p50 cost signal in the chokepoint readout; got: ${html}`,
  );
  assert.doesNotMatch(
    html.match(/<section[^>]*data-testid="product-investor-answer-panel"[\s\S]*?<\/section>/)?.[0] ?? "",
    /Opportunity score|<strong>Risk:<\/strong>/i,
    `ProductView should not expose internal opportunity score or risk labels by default; got: ${html}`,
  );
  assert.match(html, /Cost coverage complete/);
  assert.doesNotMatch(html, /targetCost:/);

  assert.ok(
    html.indexOf("Chokepoint readout") < html.indexOf("Rolled-up cost"),
    "ProductView should promote the chokepoint readout before rolled-up cost sections",
  );
  assert.ok(
    html.indexOf("Chokepoint readout") < html.indexOf("Required Modules"),
    "ProductView should promote the chokepoint readout before long product detail sections",
  );
});

test("ProductView evidence card exposes provenance without raw review state", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  assert.ok(node);

  const html = renderToStaticMarkup(React.createElement(ProductView, { graph, product: node }));
  const evidenceStart = html.indexOf('data-testid="evidence-list"');
  assert.ok(evidenceStart >= 0, `ProductView should render the evidence list; got: ${html}`);
  const evidenceHtml = html.slice(evidenceStart);

  assert.match(evidenceHtml, /Initial target definition for a 300,000 RMB parcel sorting cell/);
  assert.match(evidenceHtml, /Type.*internal note/);
  assert.match(evidenceHtml, /confidence.*medium/);
  assert.match(evidenceHtml, /Source.*Project initialization document/);
  assert.match(evidenceHtml, /Date.*2026-04-26/);
  assert.match(evidenceHtml, /Limitations.*Internal planning evidence only/);
  assert.doesNotMatch(evidenceHtml, /Status.*(?:reviewed|unreviewed)/i);
  assert.doesNotMatch(evidenceHtml, /reviewStatus/i);
});

test("ProductView shows the exposure lock prompt on a gated module /product page", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "humanoid_reducer_transmission_stack");
  assert.ok(node && node.kind !== "product", "fixture should be a gated non-product node");
  const locked = [{ domainTag: "humanoid_robotics", entitlement: "humanoid", hiddenOrgCount: 13 }];
  const html = renderToStaticMarkup(
    React.createElement(
      ExposureLockProvider,
      { locked },
      React.createElement(ProductView, { graph, product: node! }),
    ),
  );
  assert.match(html, /Who makes this/i, `gated module /product page must show the exposure lock prompt; got: ${html.slice(0, 200)}`);
  const open = renderToStaticMarkup(React.createElement(ProductView, { graph, product: node! }));
  assert.doesNotMatch(open, /Who makes this/i, "unlocked render must not show the lock prompt");
});

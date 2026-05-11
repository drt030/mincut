import test from "node:test";
import assert from "node:assert/strict";
import { nodeRisk } from "../src/lib/nodeRisk";
import { loadFixture } from "./fixtures/loader";

/**
 * Spec docs/superpowers/specs/2026-05-10-graph-redesign.md §5:
 *   risk(node, graph) = (1 - maturityScore/100) × cost_share(node, graph)
 *
 * cost_share is normalized inside the function so the result is in [0, 1].
 * Missing data falls back to 0 (= "we don't know, treat as safe") rather
 * than throwing — bottleneck-mode tinting calls this for every node.
 */

test("nodeRisk: high-cost low-maturity > low-cost high-maturity", () => {
  const graph = loadFixture("risk-mix.json");
  const high = nodeRisk(graph.nodes.find((n) => n.id === "high_risk_node")!, graph);
  const low = nodeRisk(graph.nodes.find((n) => n.id === "low_risk_node")!, graph);
  assert.ok(high > low, `expected high(${high}) > low(${low})`);
});

test("nodeRisk: result stays in [0, 1]", () => {
  const graph = loadFixture("risk-mix.json");
  for (const node of graph.nodes) {
    const risk = nodeRisk(node, graph);
    assert.ok(risk >= 0 && risk <= 1, `${node.id} risk ${risk} out of [0,1]`);
  }
});

test("nodeRisk: node with no maturity or cost returns 0", () => {
  const graph = loadFixture("risk-mix.json");
  const noData = graph.nodes.find((n) => n.id === "no_data_node")!;
  assert.equal(nodeRisk(noData, graph), 0);
});

test("nodeRisk: maturity 100 yields risk 0 regardless of cost share", () => {
  const graph = loadFixture("risk-mix.json");
  const fullyMature = { ...graph.nodes[0], maturityScore: 100 };
  assert.equal(nodeRisk(fullyMature, graph), 0);
});

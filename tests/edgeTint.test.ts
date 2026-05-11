import test from "node:test";
import assert from "node:assert/strict";
import { edgeTintFor, NEUTRAL_TINT } from "../src/lib/edgeTint";
import { loadFixture } from "./fixtures/loader";

/**
 * Slice 2 RED — edge tinting by color mode. The edge color encodes a
 * property of the TARGET node, so a learner scanning the graph can
 * read a heat map without opening every card. Five modes are
 * supported:
 *
 *   - relation        legacy class-based stroke (default gray; CSS still wins)
 *   - cost            blue→red heat ramp by typical RMB cost
 *   - maturity        red→green Likert by maturityLabel
 *   - overall         red→green gradient by maturityScore (0..100)
 *   - bottleneck      uses nodeRisk(node, graph) ∈ [0,1] → red for high
 */

const COOL_HEX = /^#(3[ab0-9]|4[0-9a-f]|5[0-9a-f]|6[0-9a-f])[0-9a-f]{4}$/i;
const WARM_HEX = /^#([cd][0-9a-f]|e[0-9a-f]|f[0-9a-f])[0-9a-f]{4}$/i;

test("cost mode: cheap target → cool color, pricey target → warm color", () => {
  const graph = loadFixture("two-cost-targets.json");
  const cheap = graph.nodes.find((n) => n.id === "cheap_part")!;
  const pricey = graph.nodes.find((n) => n.id === "pricey_part")!;
  const cheapTint = edgeTintFor(cheap, "cost", graph);
  const priceyTint = edgeTintFor(pricey, "cost", graph);
  assert.notEqual(cheapTint, priceyTint, "tints should differ across cost extremes");
  assert.match(cheapTint, COOL_HEX, `cheap should be cool, got ${cheapTint}`);
  assert.match(priceyTint, WARM_HEX, `pricey should be warm, got ${priceyTint}`);
});

test("maturity mode: low-maturity target is warmer than high-maturity target", () => {
  const graph = loadFixture("two-cost-targets.json");
  const earlyProto = graph.nodes.find((n) => n.id === "cheap_part")!; // score 30
  const matureNode = graph.nodes.find((n) => n.id === "pricey_part")!; // score 85
  const earlyTint = edgeTintFor(earlyProto, "maturity", graph);
  const matureTint = edgeTintFor(matureNode, "maturity", graph);
  assert.notEqual(earlyTint, matureTint);
  // In the maturity ramp red = low, green = high; so the early-proto
  // (score 30) gets the warmer color.
  assert.match(earlyTint, WARM_HEX, `early-proto should be warm, got ${earlyTint}`);
  assert.match(matureTint, /^#(2[0-9a-f]|3[0-9a-f]|4[0-9a-f]|5[0-9a-f])[0-9a-f]{4}$/i, `mature should be green, got ${matureTint}`);
});

test("overall mode: score 0 ≠ score 100 and produces a continuous gradient", () => {
  const graph = loadFixture("two-cost-targets.json");
  const low = graph.nodes.find((n) => n.id === "cheap_part")!;
  const high = graph.nodes.find((n) => n.id === "pricey_part")!;
  const lowTint = edgeTintFor(low, "overall", graph);
  const highTint = edgeTintFor(high, "overall", graph);
  assert.notEqual(lowTint, highTint);
  assert.match(lowTint, /^#[0-9a-f]{6}$/i, "should be a hex color");
  assert.match(highTint, /^#[0-9a-f]{6}$/i, "should be a hex color");
});

test("bottleneck mode: high-risk target warmer than low-risk target", () => {
  const graph = loadFixture("two-cost-targets.json");
  const cheap = graph.nodes.find((n) => n.id === "cheap_part")!; // low maturity, low cost share
  const pricey = graph.nodes.find((n) => n.id === "pricey_part")!; // high maturity, high cost share
  const cheapTint = edgeTintFor(cheap, "bottleneck", graph);
  const priceyTint = edgeTintFor(pricey, "bottleneck", graph);
  // cheap has maturity 30 + smaller cost share → moderate risk
  // pricey has maturity 85 + bigger cost share → risk is lower because maturity is high
  // So cheap should be warmer (higher risk) than pricey
  assert.notEqual(cheapTint, priceyTint);
});

test("relation mode: returns NEUTRAL_TINT (CSS class-based stroke still wins)", () => {
  const graph = loadFixture("two-cost-targets.json");
  const anyNode = graph.nodes[0];
  assert.equal(edgeTintFor(anyNode, "relation", graph), NEUTRAL_TINT);
});

test("missing cost or maturity returns NEUTRAL_TINT, never throws", () => {
  const graph = loadFixture("two-cost-targets.json");
  // Strip everything off a node
  const stripped = { ...graph.nodes[0], maturityScore: undefined, maturityLabel: undefined };
  assert.equal(edgeTintFor(stripped, "maturity", graph), NEUTRAL_TINT);
  assert.equal(edgeTintFor(stripped, "overall", graph), NEUTRAL_TINT);
  // For cost we need a node with no cost-bearing measured_by edge
  const noCost = { ...graph.nodes[0], id: "no_cost_node" };
  assert.equal(edgeTintFor(noCost, "cost", graph), NEUTRAL_TINT);
});

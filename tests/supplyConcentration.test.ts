import test from "node:test";
import assert from "node:assert/strict";
import type { GraphData } from "../src/lib/schema";
import {
  holdersForNode,
  isSupplyConcentrated,
  CONCENTRATION_THRESHOLD,
} from "../src/lib/supplyConcentration";

function graphWith(extra: Partial<GraphData>): GraphData {
  return {
    nodes: [],
    edges: [],
    evidence: [],
    ...extra,
  } as GraphData;
}

const node = (id: string, kind: string, overrides: object = {}) =>
  ({ id, name: id, kind, domain: ["t"], maturityLabel: "mature", ...overrides }) as never;

const edge = (id: string, source: string, target: string, relation: string, overrides: object = {}) =>
  ({ id, source, target, relation, ...overrides }) as never;

test("holdersForNode counts distinct orgs across manufactured_by and implemented_by", () => {
  const graph = graphWith({
    nodes: [
      node("kh", "engineering_method"),
      node("org_a", "organization", { listingStatus: "public", ticker: "AAA" }),
      node("org_b", "organization"),
    ],
    edges: [
      edge("e1", "kh", "org_a", "implemented_by"),
      edge("e2", "kh", "org_b", "manufactured_by"),
      edge("e3", "kh", "org_a", "manufactured_by"), // duplicate org via second relation
    ],
  });
  const holders = holdersForNode(graph, "kh");
  assert.equal(holders.total, 2);
  assert.equal(holders.listed, 1);
  assert.deepEqual(holders.organizationIds, ["org_a", "org_b"]);
});

test("holdersForNode excludes deprecated orgs and deprecated edges", () => {
  const graph = graphWith({
    nodes: [
      node("kh", "engineering_method"),
      node("org_dead", "organization", { reviewStatus: "deprecated" }),
      node("org_live", "organization"),
    ],
    edges: [
      edge("e1", "kh", "org_dead", "implemented_by"),
      edge("e2", "kh", "org_live", "implemented_by", { reviewStatus: "deprecated" }),
    ],
  });
  assert.equal(holdersForNode(graph, "kh").total, 0);
});

test("holders count `listed` via public_company tag fallback when listingStatus absent", () => {
  const graph = graphWith({
    nodes: [
      node("kh", "manufacturing_process"),
      node("org_tagged", "organization", { tags: ["public_company"] }),
    ],
    edges: [edge("e1", "kh", "org_tagged", "implemented_by")],
  });
  assert.equal(holdersForNode(graph, "kh").listed, 1);
});

test("isSupplyConcentrated true at or below threshold, false above", () => {
  const orgs = Array.from({ length: CONCENTRATION_THRESHOLD + 1 }, (_, i) =>
    node(`org_${i}`, "organization"),
  );
  const edgesAt = (n: number) =>
    Array.from({ length: n }, (_, i) => edge(`e${i}`, "kh", `org_${i}`, "manufactured_by"));
  const khNode = node("kh", "manufacturing_process");

  const atThreshold = graphWith({ nodes: [khNode, ...orgs], edges: edgesAt(CONCENTRATION_THRESHOLD) });
  assert.equal(isSupplyConcentrated(atThreshold, "kh"), true);

  const aboveThreshold = graphWith({ nodes: [khNode, ...orgs], edges: edgesAt(CONCENTRATION_THRESHOLD + 1) });
  assert.equal(isSupplyConcentrated(aboveThreshold, "kh"), false);
});

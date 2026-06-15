import test from "node:test";
import assert from "node:assert/strict";

import type { Edge, GraphData, Node } from "../src/lib/schema";
import {
  criticalityRaw,
  criticalityValue,
  dependentAncestors,
  directDependents,
} from "../src/lib/chokepointScore";

function node(id: string, extra: Partial<Node> = {}): Node {
  return { id, name: id, kind: "module", domain: ["test"], ...extra } as Node;
}
function edge(source: string, target: string, relation: Edge["relation"]): Edge {
  return { id: `${source}_${relation}_${target}`, source, target, relation } as Edge;
}
export function graph(nodes: Node[], edges: Edge[]): GraphData {
  return { nodes, edges, evidence: [] } as unknown as GraphData;
}

test("directDependents counts distinct decomposition parents pointing at a node", () => {
  // a and b both require shared; c requires a. shared has two direct parents.
  const g = graph(
    [node("a"), node("b"), node("c"), node("shared")],
    [
      edge("a", "shared", "requires"),
      edge("b", "shared", "requires"),
      edge("c", "a", "requires"),
      edge("a", "shared", "measured_by"), // non-decomposition edge: ignored
    ],
  );
  assert.deepEqual(directDependents(g, "shared").sort(), ["a", "b"]);
  assert.equal(criticalityRaw(g, "shared"), 2);
  assert.equal(criticalityRaw(g, "a"), 1);
});

test("dependentAncestors walks transitively up the decomposition DAG", () => {
  const g = graph(
    [node("root", { kind: "product" }), node("mid"), node("leaf")],
    [edge("root", "mid", "requires"), edge("mid", "leaf", "requires")],
  );
  assert.deepEqual([...dependentAncestors(g, "leaf")].sort(), ["mid", "root"]);
});

test("criticalityValue defaults demand weight to 1 when no demandScale, known when shared", () => {
  const g = graph(
    [node("root", { kind: "product" }), node("a"), node("shared")],
    [edge("root", "a", "requires"), edge("a", "shared", "requires"), edge("root", "shared", "requires")],
  );
  // shared has 2 parents (root, a), no demandScale -> value 2, weight unknown
  const r = criticalityValue(g, "shared");
  assert.equal(r.value, 2);
  assert.equal(r.known, true);
  assert.equal(r.demandKnown, false);
});

test("criticalityValue multiplies fan-in by ancestor product demandScale", () => {
  const g = graph(
    [node("root", { kind: "product", demandScale: 10 }), node("shared")],
    [edge("root", "shared", "requires")],
  );
  const r = criticalityValue(g, "shared");
  assert.equal(r.value, 10); // fan-in 1 × demandScale 10
  assert.equal(r.demandKnown, true);
});

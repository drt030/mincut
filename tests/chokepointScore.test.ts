import test from "node:test";
import assert from "node:assert/strict";

import type { Edge, GraphData, Node } from "../src/lib/schema";
import {
  barrierValue,
  concentrationValue,
  criticalityRaw,
  criticalityValue,
  dependentAncestors,
  directDependents,
  quantileNormalizer,
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

test("quantileNormalizer maps min->0, max->1 by empirical rank", () => {
  const norm = quantileNormalizer([1, 2, 3, 4, 5]);
  assert.equal(norm(1), 0);
  assert.equal(norm(5), 1);
  assert.equal(norm(3), 0.5);
});

test("quantileNormalizer is robust to one or zero values", () => {
  assert.equal(quantileNormalizer([])(7), 0);
  assert.equal(quantileNormalizer([42])(42), 0.5);
});

test("concentrationValue is 1.0 at zero holders and decreases as holders grow", () => {
  const g = graph(
    [
      node("part", { kind: "material" }),
      node("o1", { kind: "organization" }),
      node("o2", { kind: "organization" }),
    ],
    [edge("part", "o1", "manufactured_by"), edge("part", "o2", "manufactured_by")],
  );
  const lonely = graph([node("scarce", { kind: "material" })], []);
  assert.equal(concentrationValue(lonely, "scarce").value, 1); // 0 holders
  assert.equal(concentrationValue(g, "part").value, 1 / 3); // 2 holders -> 1/(1+2)
});

test("concentrationValue is unknown for non-supply-chain kinds", () => {
  const g = graph([node("cap", { kind: "capability" })], []);
  assert.equal(concentrationValue(g, "cap").known, false);
});

test("barrierValue is high for a must_build, hard, unproven node", () => {
  const g = graph(
    [
      node("hard", {
        kind: "engineering_method",
        transactability: "must_build",
        tags: ["hard_to_develop"],
        maturityScore: 20,
      }),
    ],
    [],
  );
  const r = barrierValue(g.nodes[0]);
  assert.equal(r.known, true);
  assert.ok(r.value > 0.8, `expected high barrier, got ${r.value}`);
});

test("barrierValue is low for a procurable, mature node", () => {
  const g = graph(
    [node("easy", { kind: "engineering_method", transactability: "procurable", maturityScore: 90 })],
    [],
  );
  const r = barrierValue(g.nodes[0]);
  assert.ok(r.value < 0.2, `expected low barrier, got ${r.value}`);
});

test("barrierValue is unknown when no barrier signal is present", () => {
  const g = graph([node("bare", { kind: "module" })], []);
  assert.equal(barrierValue(g.nodes[0]).known, false);
});

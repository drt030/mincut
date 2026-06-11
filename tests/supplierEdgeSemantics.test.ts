import test from "node:test";
import assert from "node:assert/strict";
import { edgeSchema, nodeSchema } from "../src/lib/schema";
import { validateGraphReferences } from "../src/lib/graphLoader";
import type { GraphData } from "../src/lib/schema";

test("ADR-0009 supplier-semantics relations parse", () => {
  for (const relation of [
    "qualified_supplier",
    "reported_capable_supplier",
    "strategic_supplier_to",
    "owned_by",
    "capacity_provider",
    "second_source_candidate",
    "allocation_locked_by",
  ] as const) {
    const edge = edgeSchema.parse({ id: `e_${relation}`, source: "a", target: "b", relation });
    assert.equal(edge.relation, relation);
  }
});

test("rejectedEvidenceIds parse on nodes and validate referentially", () => {
  const node = nodeSchema.parse({
    id: "n1",
    name: "N1",
    kind: "module",
    domain: ["test"],
    evidenceIds: ["ev_good"],
    rejectedEvidenceIds: ["ev_dead"],
  });
  assert.deepEqual(node.rejectedEvidenceIds, ["ev_dead"]);

  const graph: GraphData = {
    graphVersion: "test",
    nodes: [node],
    edges: [],
    evidence: [
      { id: "ev_good", type: "news", title: "ok" },
      { id: "ev_dead", type: "news", title: "404", limitations: "URL dead; cannot support claim" },
    ] as GraphData["evidence"],
  };
  assert.deepEqual(validateGraphReferences(graph), []);

  const missing: GraphData = { ...graph, nodes: [{ ...node, rejectedEvidenceIds: ["ev_ghost"] }] };
  assert.ok(validateGraphReferences(missing).some((e) => e.includes("rejected evidence does not exist")));

  const both: GraphData = {
    ...graph,
    nodes: [{ ...node, evidenceIds: ["ev_dead"], rejectedEvidenceIds: ["ev_dead"] }],
  };
  assert.ok(validateGraphReferences(both).some((e) => e.includes("both supporting and rejected")));
});

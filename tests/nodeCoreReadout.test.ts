import test from "node:test";
import assert from "node:assert/strict";

import { loadActiveGraphData } from "../src/lib/graphLoader";
import {
  coreReadoutForNode,
  type NodeCoreReadout,
} from "../src/lib/nodeCoreReadout";
import type { GraphData, Node } from "../src/lib/schema";

function nodeById(graph: GraphData, id: string): Node {
  const node = graph.nodes.find((candidate) => candidate.id === id);
  assert.ok(node, `fixture node ${id} must exist`);
  return node;
}

function readoutFor(graph: GraphData, nodeId: string): NodeCoreReadout {
  return coreReadoutForNode(graph, nodeById(graph, nodeId));
}

test("AI logic die fabrication readout uses product-scope, no-equivalent substitution, concrete blocking modes, and a 24-month status", () => {
  const graph = loadActiveGraphData("ai_accelerator_module_hbm_cowos");
  const readout = readoutFor(graph, "logic_die_fabrication");

  assert.equal(readout.scope.value, "product_mainline");
  assert.equal(readout.substitution.value, "no_equivalent_substitution");
  assert.equal(readout.substitution.performanceParityRequired, true);
  assert.deepEqual(readout.blocking.values, [
    "capacity_scale",
    "yield_ramp",
    "equipment_lead_time",
  ]);
  assert.equal(readout.status.value, "expansion_relief");
  assert.equal(readout.status.months, 24);
  assert.equal(readout.status.basis, "stored_override");
});

test("AI advanced packaging readout treats alternate suppliers as partial substitution, not full bypass", () => {
  const graph = loadActiveGraphData("ai_accelerator_module_hbm_cowos");
  const readout = readoutFor(graph, "advanced_packaging");

  assert.equal(readout.scope.value, "product_mainline");
  assert.equal(readout.substitution.value, "partial_substitution");
  assert.equal(readout.substitution.performanceParityRequired, true);
  assert.ok(readout.blocking.values.includes("capacity_scale"));
  assert.ok(readout.blocking.values.includes("integration_qualification"));
  assert.equal(readout.status.value, "expansion_relief");
  assert.equal(readout.status.months, 18);
});

test("supplier count alone never upgrades substitution feasibility", () => {
  const graph: GraphData = {
    graphVersion: "supplier-count-not-substitution",
    evidence: [],
    nodes: [
      { id: "product", name: "Product", kind: "product", domain: ["test"] },
      {
        id: "constraint",
        name: "Constraint",
        kind: "module",
        domain: ["test"],
        bottleneckOf: ["product"],
        tags: ["constraint_capacity_scale"],
      },
      ...Array.from({ length: 5 }, (_, index): Node => ({
        id: `org_${index}`,
        name: `Supplier ${index}`,
        kind: "organization",
        domain: ["test"],
      })),
    ],
    edges: [
      { id: "e_product_constraint", source: "product", target: "constraint", relation: "requires" },
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `e_constraint_supplier_${index}`,
        source: "constraint",
        target: `org_${index}`,
        relation: "manufactured_by" as const,
      })),
    ],
  };

  const readout = readoutFor(graph, "constraint");

  assert.equal(readout.scope.value, "product_mainline");
  assert.equal(readout.substitution.value, "not_assessed");
  assert.equal(readout.substitution.basis, "insufficient_signal");
});

test("textual secondary-source signals become partial substitution only when performance or qualification parity is constrained", () => {
  const graph: GraphData = {
    graphVersion: "partial-substitution-text",
    evidence: [],
    nodes: [
      { id: "product", name: "Product", kind: "product", domain: ["test"] },
      {
        id: "constraint",
        name: "Constraint",
        kind: "module",
        domain: ["test"],
        description:
          "A secondary source can handle lower-performance variants, but high-end product parity requires customer qualification and yield learning.",
        bottleneckOf: ["product"],
      },
    ],
    edges: [
      { id: "e_product_constraint", source: "product", target: "constraint", relation: "requires" },
    ],
  };

  const readout = readoutFor(graph, "constraint");

  assert.equal(readout.substitution.value, "partial_substitution");
  assert.equal(readout.substitution.performanceParityRequired, true);
  assert.equal(readout.substitution.basis, "text_inference");
});

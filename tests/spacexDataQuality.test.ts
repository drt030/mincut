import test from "node:test";
import assert from "node:assert/strict";
import { hasCostDisclosure } from "../src/lib/costDisclosure";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import type { GraphData, Node } from "../src/lib/schema";

function directEvidenceFor(graph: GraphData, node: Node): GraphData["evidence"] {
  const directIds = new Set(node.evidenceIds ?? []);
  const rejectedIds = new Set(node.rejectedEvidenceIds ?? []);
  return graph.evidence.filter((item) => {
    if (rejectedIds.has(item.id)) return false;
    return directIds.has(item.id) || item.supportsNodeIds?.includes(node.id);
  });
}

function isVendorSideEvidence(item: GraphData["evidence"][number]): boolean {
  return item.type === "vendor_claim" || item.sourceStatus === "vendor_marketing";
}

test("Starship tile bonding bottleneck has decision-grade disclosure fields", () => {
  const graph = loadActiveGraphData("spacex_reusable_launch_stack");
  const node = graph.nodes.find((candidate) => candidate.id === "starship_heat_shield_tile_bonding_process");
  assert.ok(node, "fixture should include the Starship tile bonding process node");

  assert.equal(node.kind, "manufacturing_process");
  assert.equal(node.transactability, "must_build");
  assert.equal(typeof node.capacityLeadTimeMonths, "number");
  assert.ok(node.capacityLeadTimeMonths! >= 24, "tile bonding should read as a long-cycle turnaround bottleneck");
  assert.ok(hasCostDisclosure(node), "tile bonding needs a cost disclosure instead of a blank cost driver");

  const tags = new Set(node.tags ?? []);
  assert.ok(tags.has("constraint_technical_maturity"), "tile bonding needs a technical maturity constraint");
  assert.ok(tags.has("constraint_maintenance_operations"), "tile bonding needs a maintenance/turnaround constraint");
  assert.ok(tags.has("constraint_integration_commissioning"), "tile bonding needs an integrated acceptance constraint");

  const costMetric = node.metrics?.find((metric) => metric.name === "Cost disclosure");
  assert.ok(costMetric, "tile bonding should expose a reader-facing cost disclosure metric");
  assert.match(
    costMetric.description ?? "",
    /inspection hours.*replacement rate.*reflight qualification/i,
    "cost disclosure should name the missing evidence a paid user needs",
  );

  const directEvidence = directEvidenceFor(graph, node);
  assert.ok(directEvidence.length > 0, "tile bonding needs direct evidence support");
  assert.ok(
    directEvidence.some((item) => !isVendorSideEvidence(item) && /NASA/.test(item.sourceName)),
    "tile bonding needs at least one direct independent non-vendor evidence record",
  );
  assert.ok(
    directEvidence.every((item) => item.reviewStatus !== "deprecated"),
    "tile bonding evidence should not rely on deprecated records",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import type { GraphData, Node } from "../src/lib/schema";

// Gate A8 (domain-expansion acceptance standard): pin decision-grade fields on the
// humanoid_robotics headline bottlenecks so a regression that strips maturity,
// bottleneck flags, or independent evidence fails CI instead of shipping silently.

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

const HEADLINE_BOTTLENECKS = [
  "humanoid_rare_earth_magnet_supply",
  "humanoid_strain_wave_reducer",
  "humanoid_planetary_roller_screw",
];

test("humanoid headline bottlenecks carry decision-grade fields + independent evidence", () => {
  const graph = loadActiveGraphData("humanoid_robot_key_component_stack");
  for (const id of HEADLINE_BOTTLENECKS) {
    const node = graph.nodes.find((candidate) => candidate.id === id);
    assert.ok(node, `${id} should exist in the humanoid graph`);

    assert.ok((node.tags ?? []).includes("bottleneck"), `${id} should be tagged a bottleneck`);
    assert.ok(
      typeof node.maturityLabel === "string" && node.maturityLabel.length > 0,
      `${id} needs a maturityLabel (decision-grade maturity)`,
    );
    assert.match(node.maturityAsOf ?? "", /^\d{4}-\d{2}$/, `${id} needs a dated maturityAsOf (YYYY-MM)`);

    const directEvidence = directEvidenceFor(graph, node);
    assert.ok(directEvidence.length > 0, `${id} needs direct evidence support`);
    assert.ok(
      directEvidence.every((item) => item.reviewStatus !== "deprecated"),
      `${id} must not rely on deprecated evidence`,
    );
    assert.ok(
      directEvidence.some((item) => !isVendorSideEvidence(item)),
      `${id} needs at least one independent (non-vendor) evidence record`,
    );
  }
});

test("humanoid rare-earth magnet chokepoint is wired as a motor-stack bottleneck with an independent source", () => {
  const graph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const node = graph.nodes.find((candidate) => candidate.id === "humanoid_rare_earth_magnet_supply");
  assert.ok(node, "rare-earth magnet supply node should exist");
  assert.equal(node.kind, "material");

  const bottleneckOf = Array.isArray(node.bottleneckOf)
    ? node.bottleneckOf
    : node.bottleneckOf
      ? [node.bottleneckOf]
      : [];
  assert.ok(
    bottleneckOf.includes("humanoid_motor_stack"),
    "the NdFeB magnet supply must read as a bottleneck of the motor stack",
  );

  // the China heavy-rare-earth export-control chokepoint needs a real independent (analyst/news) source,
  // not just vendor product pages.
  const directEvidence = directEvidenceFor(graph, node);
  assert.ok(
    directEvidence.some((item) => !isVendorSideEvidence(item) && item.type === "news"),
    "the magnet chokepoint needs an independent news/analyst source (e.g. the China export-control filing)",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import type { GraphData } from "../src/lib/schema";
import { stripExposureLayer } from "../src/lib/exposureGate";

const fixture: GraphData = {
  graphVersion: "test",
  nodes: [
    { id: "cowos", name: "CoWoS", kind: "module", domain: ["ai_compute_chain"] },
    { id: "tsmc", name: "TSMC", kind: "organization", domain: ["ai_compute_chain"] },
    { id: "fanuc", name: "FANUC", kind: "organization", domain: ["parcel_sorting_robot"] },
  ] as GraphData["nodes"],
  edges: [
    { id: "e1", source: "cowos", target: "tsmc", relation: "manufactured_by", evidenceIds: ["ev_org"] },
  ] as GraphData["edges"],
  evidence: [
    // Plan fixture said type "industry_report"; the evidence schema has no
    // such member, so use a valid one — the gate never reads `type`.
    { id: "ev_org", type: "expert_review", title: "CoWoS supply", supportsNodeIds: ["tsmc"] },
    { id: "ev_keep", type: "expert_review", title: "CoWoS process" },
  ] as GraphData["evidence"],
};

test("strips org nodes, manufactured_by edges, org-only evidence for locked domains", () => {
  const { graph, locked } = stripExposureLayer(fixture, [], [
    { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  ]);
  assert.ok(!graph.nodes.some((n) => n.id === "tsmc"));
  assert.ok(graph.nodes.some((n) => n.id === "fanuc"));          // other-domain org untouched
  assert.equal(graph.edges.length, 0);
  assert.ok(!graph.evidence.some((ev) => ev.id === "ev_org"));
  assert.ok(graph.evidence.some((ev) => ev.id === "ev_keep"));   // non-org evidence stays free
  assert.equal(locked[0].hiddenOrgCount, 1);
});

test("entitled viewer keeps everything", () => {
  const { graph } = stripExposureLayer(fixture, ["ai_compute"], [
    { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  ]);
  assert.equal(graph.nodes.length, fixture.nodes.length);
});

// Real imported org nodes mix chain tags with category labels in `domain`
// (e.g. ["ai_compute_chain","investable_supplier","semiconductor_equipment"])
// and carry a separate `tags` field. The gate must key on registered chain
// tags only — category labels must not exempt an org from stripping — and
// orgs tagged `free_teaser` stay visible (Decision 5).
const realShapeFixture: GraphData = {
  graphVersion: "test",
  nodes: [
    { id: "cowos", name: "CoWoS", kind: "module", domain: ["ai_compute_chain"] },
    {
      id: "org_amat",
      name: "Applied Materials",
      kind: "organization",
      domain: ["ai_compute_chain", "investable_supplier", "semiconductor_equipment"],
      tags: ["manufacturer", "public_company"],
    },
    {
      id: "org_tsmc_teaser",
      name: "TSMC",
      kind: "organization",
      domain: ["ai_compute_chain", "investable_supplier"],
      tags: ["manufacturer", "free_teaser"],
    },
    {
      id: "org_estun",
      name: "Estun",
      kind: "organization",
      domain: ["industrial_robot_arm", "robotics", "investable_supplier"],
      tags: ["manufacturer"],
    },
  ] as GraphData["nodes"],
  edges: [
    { id: "e_amat", source: "cowos", target: "org_amat", relation: "manufactured_by" },
    { id: "e_tsmc", source: "cowos", target: "org_tsmc_teaser", relation: "manufactured_by" },
  ] as GraphData["edges"],
  evidence: [] as GraphData["evidence"],
};

test("category labels in domain do not exempt locked-chain orgs (leak regression)", () => {
  const { graph, locked } = stripExposureLayer(realShapeFixture, [], [
    { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  ]);
  assert.ok(!graph.nodes.some((n) => n.id === "org_amat"), "non-teaser locked org must be stripped");
  assert.ok(!graph.edges.some((e) => e.id === "e_amat"), "its manufactured_by edge must go too");
  assert.equal(locked[0].hiddenOrgCount, 1);
});

test("free_teaser org survives the strip with its edge", () => {
  const { graph } = stripExposureLayer(realShapeFixture, [], [
    { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  ]);
  assert.ok(graph.nodes.some((n) => n.id === "org_tsmc_teaser"), "free_teaser org stays");
  assert.ok(graph.edges.some((e) => e.id === "e_tsmc"), "teaser org keeps its manufactured_by edge");
});

test("org with no locked chain tag is untouched regardless of labels", () => {
  const { graph } = stripExposureLayer(realShapeFixture, [], [
    { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  ]);
  assert.ok(graph.nodes.some((n) => n.id === "org_estun"));
});

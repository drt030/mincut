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

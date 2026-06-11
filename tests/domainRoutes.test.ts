import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_ROUTES, domainBySlug } from "../src/lib/domains";
import { loadGraphData } from "../src/lib/graphLoader";
import { V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";

test("every registered domain slug resolves to a product node that exists in data", () => {
  const graph = loadGraphData();
  const ids = new Set(graph.nodes.map((node) => node.id));
  for (const domain of DOMAIN_ROUTES) {
    assert.ok(ids.has(domain.rootId), `${domain.slug} → ${domain.rootId} missing from data`);
  }
});

test("the v0 closed-loop target stays the parcel robot (flagship switching is per-route, not global)", () => {
  assert.equal(V0_TARGET_NODE_ID, "low_cost_parcel_sorting_robot_300k_rmb");
  assert.equal(domainBySlug("parcel-robot")?.rootId, V0_TARGET_NODE_ID);
});

test("the AI-compute flagship has its own route", () => {
  assert.equal(domainBySlug("ai-compute")?.rootId, "ai_accelerator_module_hbm_cowos");
});

test("unknown slugs resolve to undefined", () => {
  assert.equal(domainBySlug("not-a-domain"), undefined);
});

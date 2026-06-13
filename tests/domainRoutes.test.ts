import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_ROUTES, domainBySlug } from "../src/lib/domains";
import { loadGraphData } from "../src/lib/graphLoader";
import { reachableNodeIdsFrom, V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";
import { resolveRouteExposureAccess } from "../src/lib/routeAccess";

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

test("the AI-compute flagship is a full-free route with no entitlement", () => {
  const domain = domainBySlug("ai-compute");
  assert.ok(domain, "ai-compute route should be registered");
  assert.equal(domain.domainTag, "ai_compute_chain");
  assert.equal(domain.entitlement, undefined);
  assert.equal(domain.portfolioState, "full-free-flagship");
});

test("the parcel robot route is a full-free depth demo", () => {
  const domain = domainBySlug("parcel-robot");
  assert.ok(domain, "parcel-robot route should be registered");
  assert.equal(domain.domainTag, "parcel_sorting_robot");
  assert.equal(domain.entitlement, undefined);
  assert.equal(domain.portfolioState, "full-free-depth-demo");
});

test("humanoid and controlled-fusion routes are live paid candidates", () => {
  const humanoid = domainBySlug("humanoid-robotics");
  const fusion = domainBySlug("controlled-fusion");
  assert.ok(humanoid, "humanoid route should be registered");
  assert.ok(fusion, "controlled-fusion route should be registered");

  assert.equal(humanoid.rootId, "humanoid_robot_key_component_stack");
  assert.equal(humanoid.domainTag, "humanoid_robotics");
  assert.equal(humanoid.entitlement, "humanoid");
  assert.equal(humanoid.portfolioState, "paid-candidate");

  assert.equal(fusion.rootId, "controlled_fusion_route_portfolio");
  assert.equal(fusion.domainTag, "controlled_fusion");
  assert.equal(fusion.entitlement, "power");
  assert.equal(fusion.portfolioState, "paid-candidate");
});

test("controlled-fusion route map does not reuse legacy commercial-fusion fixture nodes", () => {
  const graph = loadGraphData();
  const reachable = reachableNodeIdsFrom(graph, "controlled_fusion_route_portfolio");

  for (const id of [
    "tokamak_magnetic_confinement_route",
    "fusion_superconducting_magnet_system",
    "fusion_plasma_facing_components",
    "fusion_tritium_breeding_fuel_cycle",
    "fusion_remote_maintenance_system",
    "fusion_net_electric_gain",
    "fusion_availability_factor",
  ]) {
    assert.equal(reachable.has(id), false, `${id} should not be pulled into the controlled-fusion paid route`);
  }

  for (const id of [
    "controlled_tokamak_magnetic_confinement_route",
    "controlled_fusion_superconducting_magnet_system",
    "controlled_fusion_plasma_facing_components",
    "controlled_fusion_tritium_breeding_fuel_cycle",
    "controlled_fusion_remote_maintenance_system",
    "controlled_fusion_net_electric_gain",
    "controlled_fusion_availability_factor",
  ]) {
    assert.equal(reachable.has(id), true, `${id} should be part of the controlled-fusion paid route`);
  }
});

test("domain portfolio state model covers free, preview, waitlist, and paid candidate states", async () => {
  const domainsModule = await import("../src/lib/domains");
  const states = new Set(
    (domainsModule as { DOMAIN_PORTFOLIO_STATES?: readonly string[] }).DOMAIN_PORTFOLIO_STATES ?? [],
  );

  for (const state of [
    "full-free-flagship",
    "full-free-depth-demo",
    "waitlist",
    "preview",
    "paid-candidate",
  ]) {
    assert.ok(states.has(state), `portfolio state model should include ${state}`);
  }
});

test("portfolio entries expose four commercial domains and all candidate maps have registered routes", async () => {
  const domainsModule = await import("../src/lib/domains");
  const portfolio =
    (domainsModule as {
      DOMAIN_PORTFOLIO_ENTRIES?: readonly Array<{
        slug: string;
        portfolioState: string;
        liveGraphRoute: boolean;
        href: string;
        rootId?: string;
      }>;
    }).DOMAIN_PORTFOLIO_ENTRIES ?? [];

  assert.deepEqual(
    portfolio.map((entry) => entry.slug),
    ["ai-compute", "parcel-robot", "humanoid-robotics", "controlled-fusion"],
  );
  assert.deepEqual(
    portfolio.filter((entry) => entry.liveGraphRoute).map((entry) => entry.slug),
    ["ai-compute", "parcel-robot", "humanoid-robotics", "controlled-fusion"],
  );
  assert.deepEqual(
    portfolio.filter((entry) => !entry.liveGraphRoute).map((entry) => [entry.slug, entry.portfolioState]),
    [],
  );
  assert.equal(domainBySlug("humanoid-robotics")?.href, "/d/humanoid-robotics");
  assert.equal(domainBySlug("controlled-fusion")?.href, "/d/controlled-fusion");
});

test("AI-compute route access resolves full-free even if a stale locked summary is present", () => {
  const domain = domainBySlug("ai-compute");
  assert.ok(domain, "ai-compute route should be registered");
  assert.deepEqual(
    resolveRouteExposureAccess(domain, [
      { domainTag: "ai_compute_chain", entitlement: "ai_compute", hiddenOrgCount: 99 },
    ]),
    { status: "full-free" },
  );
});

test("future portfolio states do not resolve to full-free just because no entitlement is configured", () => {
  assert.deepEqual(
    resolveRouteExposureAccess(
      { slug: "humanoid-robotics", domainTag: "humanoid_robotics", portfolioState: "preview" },
      [],
    ),
    { status: "preview" },
  );
  assert.deepEqual(
    resolveRouteExposureAccess(
      { slug: "controlled-fusion", domainTag: "controlled_fusion", portfolioState: "waitlist" },
      [],
    ),
    { status: "waitlist" },
  );
  assert.deepEqual(
    resolveRouteExposureAccess(
      { slug: "future-paid-map", domainTag: "future_paid", portfolioState: "paid-candidate" },
      [],
    ),
    { status: "paid-candidate" },
  );
});

test("unknown slugs resolve to undefined", () => {
  assert.equal(domainBySlug("not-a-domain"), undefined);
});

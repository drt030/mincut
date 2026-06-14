import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_ROUTES, domainBySlug } from "../src/lib/domains";
import { loadActiveGraphData, loadGateReports, loadGraphData } from "../src/lib/graphLoader";
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

test("humanoid, controlled-fusion, and SpaceX maps stay audit previews until evidence and gate checks pass", () => {
  const humanoid = domainBySlug("humanoid-robotics");
  const fusion = domainBySlug("controlled-fusion");
  const reusableLaunch = domainBySlug("spacex-reusable-launch");
  const orbitalDataCenter = domainBySlug("spacex-orbital-data-center");
  assert.ok(humanoid, "humanoid route should be registered");
  assert.ok(fusion, "controlled-fusion route should be registered");
  assert.ok(reusableLaunch, "SpaceX reusable launch route should be registered");
  assert.ok(orbitalDataCenter, "SpaceX orbital data center route should be registered");

  assert.equal(humanoid.rootId, "humanoid_robot_key_component_stack");
  assert.equal(humanoid.domainTag, "humanoid_robotics");
  assert.equal(humanoid.entitlement, "humanoid");
  assert.equal(humanoid.portfolioState, "audit-preview");
  assert.equal(humanoid.statusLabel, "Future paid domain");
  assert.match(humanoid.detail, /supplier\/ticker exposure opens only when this paid domain launches/i);

  assert.equal(fusion.rootId, "controlled_fusion_route_portfolio");
  assert.equal(fusion.domainTag, "controlled_fusion");
  assert.equal(fusion.entitlement, "power");
  assert.equal(fusion.portfolioState, "audit-preview");
  assert.equal(fusion.statusLabel, "Future paid domain");
  assert.match(fusion.detail, /organization exposure opens only when this paid domain launches/i);

  assert.equal(reusableLaunch.rootId, "spacex_reusable_launch_stack");
  assert.equal(reusableLaunch.domainTag, "spacex_reusable_launch");
  assert.equal(reusableLaunch.entitlement, "space");
  assert.equal(reusableLaunch.portfolioState, "audit-preview");
  assert.equal(reusableLaunch.statusLabel, "Future paid domain");

  assert.equal(orbitalDataCenter.rootId, "spacex_orbital_data_center_system");
  assert.equal(orbitalDataCenter.domainTag, "spacex_orbital_data_center");
  assert.equal(orbitalDataCenter.entitlement, "space");
  assert.equal(orbitalDataCenter.portfolioState, "audit-preview");
  assert.equal(orbitalDataCenter.statusLabel, "Future paid domain");
  assert.match(
    orbitalDataCenter.description,
    /future-product map/i,
    "orbital data center should be framed as a future-product candidate, not a mature commercial service",
  );
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

test("SpaceX candidate maps stay conservative about listing and regulatory status", () => {
  const graph = loadGraphData();
  const spacex = graph.nodes.find((node) => node.id === "org_spacex");
  assert.ok(spacex, "SpaceX organization node should exist");
  assert.equal(spacex.listingStatus, "unknown");
  assert.equal(spacex.ticker, undefined);
  assert.equal(spacex.tags?.includes("public_company"), false);

  const fcc = graph.evidence.find((item) => item.id === "ev_space_fcc_orbital_data_center_2026");
  const faa = graph.evidence.find((item) => item.id === "ev_space_faa_starship_cadence");
  assert.ok(fcc, "FCC public notice evidence should exist");
  assert.ok(faa, "FAA review context evidence should exist");
  assert.notEqual(fcc.type, "regulatory_approval");
  assert.notEqual(faa.type, "regulatory_approval");

  const spaceEdges = graph.edges.filter((edge) => edge.id.startsWith("e_space_"));
  assert.equal(
    spaceEdges.some((edge) => edge.relation === "strategic_supplier_to"),
    false,
    "demand-side launch-customer exposure must not be modeled with supplier semantics",
  );
});

test("SpaceX orbital data-center economics expose blocking unknown metrics instead of blank placeholders", () => {
  const graph = loadGraphData();
  for (const id of [
    "orbital_compute_power_per_satellite_metric",
    "orbital_launch_cost_per_kw_metric",
  ]) {
    const node = graph.nodes.find((candidate) => candidate.id === id);
    assert.ok(node, `${id} should exist`);
    assert.ok(node.tags?.includes("audit_gap"), `${id} should be marked as an audit gap`);
    assert.ok(node.tags?.includes("blocking_unknown"), `${id} should be marked as a blocking unknown`);
    assert.equal(
      node.metrics?.some((metric) => metric.currentValue === "unknown - no reviewed public value"),
      true,
      `${id} should expose an explicit unknown value instead of an empty metric placeholder`,
    );
  }
});

test("domain portfolio state model covers free, audit preview, waitlist, and paid candidate states", async () => {
  const domainsModule = await import("../src/lib/domains");
  const states = new Set(
    (domainsModule as { DOMAIN_PORTFOLIO_STATES?: readonly string[] }).DOMAIN_PORTFOLIO_STATES ?? [],
  );

  for (const state of [
    "full-free-flagship",
    "full-free-depth-demo",
    "waitlist",
    "preview",
    "audit-preview",
    "paid-candidate",
  ]) {
    assert.ok(states.has(state), `portfolio state model should include ${state}`);
  }
});

test("portfolio entries expose six commercial domains and all candidate maps have registered routes", async () => {
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
    [
      "ai-compute",
      "parcel-robot",
      "humanoid-robotics",
      "controlled-fusion",
      "spacex-reusable-launch",
      "spacex-orbital-data-center",
    ],
  );
  assert.deepEqual(
    portfolio.filter((entry) => entry.liveGraphRoute).map((entry) => entry.slug),
    [
      "ai-compute",
      "parcel-robot",
      "humanoid-robotics",
      "controlled-fusion",
      "spacex-reusable-launch",
      "spacex-orbital-data-center",
    ],
  );
  assert.deepEqual(
    portfolio.filter((entry) => !entry.liveGraphRoute).map((entry) => [entry.slug, entry.portfolioState]),
    [],
  );
  assert.equal(domainBySlug("humanoid-robotics")?.href, "/d/humanoid-robotics");
  assert.equal(domainBySlug("controlled-fusion")?.href, "/d/controlled-fusion");
  assert.equal(domainBySlug("spacex-reusable-launch")?.href, "/d/spacex-reusable-launch");
  assert.equal(domainBySlug("spacex-orbital-data-center")?.href, "/d/spacex-orbital-data-center");
});

test("paid-candidate routes cannot be promoted without reviewed evidence and a local gate report", () => {
  const gateReports = loadGateReports();
  for (const domain of DOMAIN_ROUTES.filter((entry) => entry.portfolioState === "paid-candidate")) {
    const graph = loadActiveGraphData(domain.rootId);
    const reviewedEvidenceCount = graph.evidence.filter((item) => item.reviewStatus === "reviewed").length;
    assert.ok(
      reviewedEvidenceCount >= 5,
      `${domain.slug} cannot be paid-candidate with only ${reviewedEvidenceCount} reviewed evidence records`,
    );
    assert.ok(
      gateReports.some((report) => report.targetNodeId === domain.rootId),
      `${domain.slug} cannot be paid-candidate without a local gate report for ${domain.rootId}`,
    );
  }
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
      { slug: "spacex-reusable-launch", domainTag: "spacex_reusable_launch", portfolioState: "audit-preview" },
      [],
    ),
    { status: "audit-preview" },
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

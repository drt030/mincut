import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExposureLockProvider } from "../src/components/ExposureLockCta";
import { RouteDetailRail } from "../src/components/RouteDetailRail";
import { loadActiveGraphData, loadGraphData } from "../src/lib/graphLoader";
import { selectCostDriverRoute } from "../src/lib/routeHighlight";
import type { Edge, Evidence, GraphData, Node } from "../src/lib/schema";

function node(
  id: string,
  name: string,
  kind: Node["kind"] = "module",
  metrics?: Node["metrics"],
  extra: Partial<Node> = {},
): Node {
  return {
    id,
    name,
    kind,
    domain: ["test"],
    description: `${name} description.`,
    ...(metrics ? { metrics } : {}),
    ...extra,
  };
}

function costNode(id: string, name: string, typical: number, extra: Partial<Node> = {}): Node {
  return node(id, name, "module", [
    {
      name: "Cost",
      unit: "RMB",
      currency: "RMB",
      currentValue: { min: typical, typical, max: typical },
      costAsOf: "2025",
    },
  ], extra);
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, relation: "requires" };
}

function evidence(
  id: string,
  reviewStatus: Evidence["reviewStatus"],
  supportsNodeIds: string[],
): Evidence {
  return {
    id,
    type: "internal_note",
    title: `${id} source`,
    reviewStatus,
    supportsNodeIds,
  };
}

function graphFixture(): GraphData {
  return {
    graphVersion: "route-detail-rail-test",
    evidence: [],
    nodes: [
      node("root_product", "Sorting robot", "product"),
      node("arm", "Robot arm", "module", undefined, {
        maturityScore: 58,
        maturityLabel: "prototype",
      }),
      costNode("gearbox", "Precision gearbox", 80_000, {
        maturityScore: 42,
        maturityLabel: "lab_proven",
      }),
      costNode("motor", "Servo motor", 50_000, {
        maturityScore: 74,
        maturityLabel: "commercially_available",
      }),
    ],
    edges: [
      edge("e_root_arm", "root_product", "arm"),
      edge("e_arm_gearbox", "arm", "gearbox"),
      edge("e_arm_motor", "arm", "motor"),
    ],
  };
}

function readerGraphFixture(): GraphData {
  return {
    graphVersion: "route-detail-rail-reader-test",
    evidence: [
      evidence("ev_reviewed_1", "reviewed", ["arm"]),
      evidence("ev_reviewed_2", "reviewed", ["arm"]),
      evidence("ev_unreviewed_1", "unreviewed", ["arm"]),
    ],
    nodes: [
      node("root_product", "Sorting robot", "product", undefined, {
        domain: ["ai_compute_chain"],
        description: "Sorting robot decomposes a parcel handling cell.",
      }),
      node("arm", "Robot arm", "module", undefined, {
        domain: ["ai_compute_chain", "internal_tag_should_not_lead"],
        description: "Robot arm moves parcels into the sorter. It depends on motion components.",
        maturityScore: 58,
        maturityLabel: "prototype",
        bottleneckOf: ["root_product"],
        capacityLeadTimeMonths: 18,
        tags: ["constraint_capacity_scale", "constraint_component_availability"],
      }),
      costNode("gearbox", "Precision gearbox", 80_000, {
        domain: ["ai_compute_chain"],
        description: "Precision gearbox limits repeatable arm motion.",
        maturityScore: 42,
        maturityLabel: "lab_proven",
      }),
      costNode("motor", "Servo motor", 50_000, {
        domain: ["ai_compute_chain"],
        description: "Servo motor supplies controlled motion.",
        maturityScore: 74,
        maturityLabel: "commercially_available",
      }),
      costNode("vision", "Vision kit", 30_000, {
        domain: ["ai_compute_chain"],
        description: "Vision kit identifies parcel labels.",
      }),
      costNode("vacuum", "Vacuum end effector", 20_000, {
        domain: ["ai_compute_chain"],
        description: "Vacuum end effector grips parcels.",
      }),
    ],
    edges: [
      edge("e_root_arm", "root_product", "arm"),
      edge("e_arm_gearbox", "arm", "gearbox"),
      edge("e_arm_motor", "arm", "motor"),
      edge("e_arm_vision", "arm", "vision"),
      edge("e_arm_vacuum", "arm", "vacuum"),
    ],
  };
}

function parcelReaderGraphFixture(): GraphData {
  return {
    graphVersion: "route-detail-rail-parcel-reader-test",
    evidence: [
      evidence("parcel_ev_reviewed_1", "reviewed", ["parcel_arm"]),
    ],
    nodes: [
      node("low_cost_parcel_sorting_robot_300k_rmb", "Parcel sorting robot", "product", undefined, {
        domain: ["parcel_sorting_robot"],
        description: "Parcel sorting robot uses a robot arm and vision cell to sort parcels.",
      }),
      node("parcel_arm", "Parcel robot arm", "module", undefined, {
        domain: ["parcel_sorting_robot"],
        description: "Parcel robot arm moves packages into target bins.",
        maturityScore: 58,
        maturityLabel: "prototype",
        bottleneckOf: ["low_cost_parcel_sorting_robot_300k_rmb"],
      }),
      costNode("parcel_vacuum", "Vacuum end effector", 20_000, {
        domain: ["parcel_sorting_robot"],
        description: "Vacuum end effector grips parcels.",
      }),
    ],
    edges: [
      edge("e_parcel_root_arm", "low_cost_parcel_sorting_robot_300k_rmb", "parcel_arm"),
      edge("e_parcel_arm_vacuum", "parcel_arm", "parcel_vacuum"),
    ],
  };
}

function knowHowReaderGraphFixture(): GraphData {
  return {
    graphVersion: "route-detail-rail-knowhow-reader-test",
    evidence: [],
    nodes: [
      node("root_product", "Humanoid robot", "product", undefined, {
        description: "Humanoid robot needs coordinated manipulation and thermal systems.",
      }),
      node("drive_module", "Drive module", "module", undefined, {
        description: "Drive module turns control output into joint motion.",
      }),
      node("force_control_method", "Force control method", "engineering_method", undefined, {
        description: "Force control method keeps contact stable under uncertain loads.",
        bottleneckOf: ["drive_module"],
        transactability: "must_build",
      }),
      node("method_holder", "Method Holder Inc", "organization", undefined, {
        listingStatus: "public",
        ticker: "MTHD",
      }),
    ],
    edges: [
      edge("e_root_drive", "root_product", "drive_module"),
      edge("e_drive_method", "drive_module", "force_control_method"),
      { id: "e_method_holder", source: "force_control_method", target: "method_holder", relation: "implemented_by" },
    ],
  };
}

function selectedSummary(html: string): string {
  const match = html.match(/<section[^>]*data-testid="route-rail-selected-summary"[\s\S]*?<\/section>/);
  assert.ok(match, `selected summary card should be addressable; got: ${html}`);
  return match[0];
}

function routeCoreReadoutCard(html: string): string {
  const match = html.match(/<div[^>]*data-testid="route-selected-decision-brief"[\s\S]*?<\/div><div class="route-reader-thesis"/);
  assert.ok(match, `route core readout should be addressable; got: ${html}`);
  return match[0];
}

function textFromMarkup(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function startHereCard(html: string): string {
  const match = html.match(/<section[^>]*class="[^"]*route-rail-start[^"]*"[\s\S]*?<\/section>/);
  assert.ok(match, `start-here card should be addressable; got: ${html}`);
  return match[0];
}

function keyChokepointsCard(html: string): string {
  const match = html.match(
    /<section[^>]*class="[^"]*route-rail-route[^"]*"[\s\S]*?<div class="route-rail-section-title">Key chokepoints<\/div>[\s\S]*?<\/section>/,
  );
  assert.ok(match, `key chokepoints section should have a section wrapper; got: ${html}`);
  return match[0];
}

function directRequiresChildren(graph: GraphData, source: string): string[] {
  return graph.edges
    .filter((entry) => entry.relation === "requires" && entry.source === source)
    .map((entry) => entry.target);
}

test("RouteDetailRail keeps route guide separate from selected-node detail navigation", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-testid="route-detail-rail"/);
  assert.match(html, /Cost drivers/i);
  assert.match(html, /Start here/i);
  assert.match(html, /Precision gearbox/);
  assert.match(html, /Cost\/capex proxy: est\. RMB 80,000/);
  assert.match(
    html,
    /aria-label="Precision gearbox, module, 2 links, Cost\/capex proxy: est\. RMB 80,000"/,
    `route step button should expose a spaced accessible label instead of concatenated child text; got: ${html}`,
  );
  assert.match(html, /Selected/i);
  assert.match(html, /Robot arm/);
  assert.match(html, /data-testid="route-rail-detail-action"/);
  assert.doesNotMatch(html, /role="tablist"/);
  assert.doesNotMatch(html, /data-testid="route-rail-detail-tab"/);
});

test("RouteDetailRail selected summary uses rolled-up cost for aggregate nodes", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      onSelectNode: () => {},
    }),
  );

  assert.match(
    html,
    /Cost\/capex proxy: est\. RMB 149,500/,
    "selected aggregate node should show the same rolled-up cost signal used by graph edges and detail cards",
  );
});

test("RouteDetailRail cost lens labels the route as cost, not chokepoint ranking", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: null,
      analysisMode: "cost",
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /Primary cost chain/i);
  assert.match(html, /target-node cost percentile/i);
  assert.doesNotMatch(html, /Key chokepoints/i);
});

test("RouteDetailRail renders AI compute default state as a system overview", () => {
  const graph = loadActiveGraphData("ai_accelerator_module_hbm_cowos");
  const route = selectCostDriverRoute(graph, "ai_accelerator_module_hbm_cowos", { limit: 4 });

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: null,
      analysisMode: "bottleneck-risk",
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-testid="route-rail-system-overview"/);
  assert.match(html, /System overview/i);
  assert.match(html, /<section class="route-rail-system-read" data-testid="route-rail-system-overview">/);
  assert.doesNotMatch(html, /class="route-rail-card route-rail-system-read"/);
  assert.match(html, /System target/i);
  assert.match(html, /Production path/i);
  assert.match(html, /Constraint mechanism/i);
  assert.match(html, /Improvement path/i);
  assert.match(html, /Industry-chain impact/i);
  assert.match(html, /Main risks/i);
  assert.match(html, /Evidence support/i);
  assert.match(html, /whether leading-edge silicon, HBM, advanced packaging, substrates, and test can turn into shippable modules/i);
  assert.doesNotMatch(html, /System core readout/i);
  assert.doesNotMatch(html, /System read|System layer/i);
  assert.doesNotMatch(html, /Start here/i);
  assert.doesNotMatch(html, /TOC lens|MinCut|shown in node detail|click through/i);

  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const systemReadBlock = css.match(/\.route-rail-system-read\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(systemReadBlock, /border:\s*0/, `system overview should not render an outer card border; got: ${systemReadBlock}`);
  assert.match(systemReadBlock, /box-shadow:\s*none/, `system overview should not render an accent stripe; got: ${systemReadBlock}`);
});

test("RouteDetailRail treats the selected route root as the same system overview state", () => {
  const graph = loadActiveGraphData("ai_accelerator_module_hbm_cowos");
  const route = selectCostDriverRoute(graph, "ai_accelerator_module_hbm_cowos", { limit: 4 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "ai_accelerator_module_hbm_cowos")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-testid="route-rail-system-overview"/);
  assert.doesNotMatch(html, /data-testid="route-rail-selected-summary"/);
  assert.doesNotMatch(html, /data-testid="route-rail-detail-action"/);
});

test("RouteDetailRail renders a chokepoint lens summary instead of a cost route", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: null,
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "gearbox", rank: 1, band: 5 },
        { nodeId: "motor", rank: 2, band: 3 },
      ],
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /Key chokepoints/i);
  assert.match(html, /Start here/i);
  assert.match(html, /Key chokepoints/i);
  assert.match(html, /Precision gearbox/);
  assert.match(html, /Barrier 100\/100/i);
  assert.doesNotMatch(html, /Bottleneck risks/i);
  assert.doesNotMatch(html, /Heat \d+\/100/i);
  assert.doesNotMatch(html, /Secondary signals/i);
  assert.doesNotMatch(html, /Risk \d+%/i);
  assert.doesNotMatch(html, /Top 1-5/i);
  assert.doesNotMatch(html, /Primary cost chain/i);
});

test("RouteDetailRail selected summary leads with reader-first node summary", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "gearbox", rank: 1, band: 5 },
        { nodeId: "motor", rank: 2, band: 4 },
        { nodeId: "vision", rank: 3, band: 3 },
        { nodeId: "vacuum", rank: 4, band: 2 },
      ],
      exposureAccess: { status: "unlocked" },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);
  const coreReadout = routeCoreReadoutCard(summary);
  const thesis = summary.match(/<div class="route-reader-thesis"[\s\S]*?<\/div>/)?.[0] ?? "";

  assert.match(summary, /Node interpretation/i);
  assert.match(summary, /Robot arm moves parcels into the sorter\./);
  assert.doesNotMatch(summary, /depends on this constraint scaling/i);
  assert.match(summary, /Capacity \/ scale|Component availability/i);
  assert.doesNotMatch(summary, /Constraint type:|Relief:|Evidence:/i);
  assert.doesNotMatch(summary, /Current signal:/i);
  assert.doesNotMatch(summary, /it is marked as a bottleneck/i);
  assert.doesNotMatch(summary, /\{importance\}/);
  assert.doesNotMatch(summary, /sorter\.\./);
  assert.doesNotMatch(summary, /Where it is stuck|具体卡点/i);
  assert.match(summary, /Core readout/i);
  assert.match(summary, /Impact scope/i);
  assert.match(summary, /Substitution feasibility/i);
  assert.match(summary, /Blocking mode/i);
  assert.match(summary, /Current status/i);
  assert.match(summary, /Capacity \/ scale/i);
  assert.match(summary, /Component availability/i);
  assert.match(summary, /18 months/i);
  assert.doesNotMatch(coreReadout, /Cost-scale proxy|Leading reason|Relief timing/i);
  assert.doesNotMatch(summary, /Maturity 58\/100/i);
  assert.doesNotMatch(
    summary,
    /Maturity 58\/100/i,
    `summary should show constraint factors, not raw score; got: ${summary}`,
  );
  assert.doesNotMatch(
    thesis,
    /RMB|Not priceable/i,
    `node interpretation should not mix in cost or pricing audit gaps; got: ${thesis}`,
  );
  assert.match(summary, /Evidence trail/i);
  assert.match(summary, /3 sources/i);
  assert.doesNotMatch(summary, /Evidence status/i);
  assert.doesNotMatch(summary, /reviewed \/ .*total evidence records/i);
  assert.match(summary, /Inspect next/i);
  assert.match(summary, /Precision gearbox/);
  assert.match(summary, /Servo motor/);
  assert.match(summary, /Vision kit/);
  assert.doesNotMatch(summary, /Vacuum end effector/);

  const thesisIndex = summary.indexOf("Node interpretation");
  assert.ok(thesisIndex >= 0, `selected summary should start with a bottleneck thesis; got: ${summary}`);
  assert.doesNotMatch(summary, /Heat \d+\/100/i);
  assert.doesNotMatch(summary, /Secondary signals/i);
  assert.doesNotMatch(summary, /Full-free flagship demo/i);
});

test("RouteDetailRail root selection keeps the route entry in the start card without duplicate selected detail", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "root_product")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "arm", rank: 1, band: 5 },
        { nodeId: "gearbox", rank: 2, band: 4 },
        { nodeId: "motor", rank: 3, band: 3 },
      ],
      onSelectNode: () => {},
    }),
  );
  const start = startHereCard(html);

  assert.equal(
    html.indexOf('data-testid="route-rail-selected-summary"'),
    -1,
    `default/root route state should not duplicate the start card as selected-node detail; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Structural root · not itself a chokepoint|结构根 · 本身不是卡点/i,
    `default/root route state should not lead with a root-node detail verdict; got: ${html}`,
  );
  assert.match(start, /Start here/i);
  assert.match(start, /Robot arm/);
  assert.match(start, /Capacity \/ scale/i);
  assert.match(start, /Component availability/i);
  assert.match(start, /18 months/i);
  assert.doesNotMatch(start, /Constraint not classified yet/i);
  assert.doesNotMatch(start, /Not priceable from reviewed data/i);
});

test("RouteDetailRail selected summary omits internal Heat and access state by default", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "unlocked" },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);
  const thesisIndex = summary.indexOf("Node interpretation");

  assert.ok(thesisIndex >= 0, `selected summary should include a thesis; got: ${summary}`);
  assert.match(summary, /Evidence trail/i);
  assert.doesNotMatch(summary, /Heat/i);
  assert.doesNotMatch(summary, /route-reader-secondary-signals/i);
  assert.doesNotMatch(summary, /Full-free flagship demo/i);
  assert.doesNotMatch(summary, /Maturity/i);
  assert.doesNotMatch(summary, /maturity proxy/i);
});

test("RouteDetailRail keeps unknown cost out of core readout while interpretation carries estimated timing", () => {
  const graph: GraphData = {
    graphVersion: "route-detail-rail-audit-gap-test",
    evidence: [],
    nodes: [
      node("root_product", "Frontier product", "product"),
      node("unknown_constraint", "Unknown constraint", "module", undefined, {
        description: "Unknown constraint blocks commercialization.",
      }),
    ],
    edges: [
      edge("e_root_unknown", "root_product", "unknown_constraint"),
    ],
  };
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "unknown_constraint")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);
  const thesis = summary.match(/<div class="route-reader-thesis"[\s\S]*?<\/div>/)?.[0] ?? "";

  assert.match(summary, /Impact scope/i);
  assert.match(summary, /Current status/i);
  assert.match(thesis, /Estimated 12 months; proxy based on node type and deployment proxy/i);
  assert.doesNotMatch(summary, /Cost gap unknown/i);
  assert.doesNotMatch(summary, /Cost not modeled yet/i);
  assert.doesNotMatch(summary, /Lead time not modeled yet/i);
});

test("RouteDetailRail does not turn explicit cost disclosure gaps into core readout content", () => {
  const graph: GraphData = {
    graphVersion: "route-detail-rail-cost-disclosure-test",
    evidence: [],
    nodes: [
      node("root_product", "Frontier product", "product"),
      node("audited_unknown", "Audited unknown cost", "module", [
        {
          name: "Cost disclosure",
          unit: "audit status",
          currentValue: "not priceable from reviewed data",
          description: "No reviewed source prices the qualification and utilization reserve.",
        },
      ], {
        capacityLeadTimeMonths: 18,
        tags: ["constraint_technical_maturity"],
      }),
    ],
    edges: [
      edge("e_root_unknown_cost", "root_product", "audited_unknown"),
    ],
  };
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "audited_unknown")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);
  const thesis = summary.match(/<div class="route-reader-thesis"[\s\S]*?<\/div>/)?.[0] ?? "";

  assert.match(summary, /Impact scope/i);
  assert.match(summary, /Blocking mode/i);
  assert.match(summary, /Current status/i);
  assert.match(summary, /18 months/i);
  assert.doesNotMatch(summary, /Cost gap unknown|Needed evidence|public source prices|BOM|RMB/i);
  assert.doesNotMatch(thesis, /Cost gap unknown|Needed evidence|public source prices|BOM|RMB/i);
});

test("RouteDetailRail keeps heuristic route cost signals out of selected core readout", () => {
  const graph: GraphData = {
    graphVersion: "route-detail-rail-estimated-cost-test",
    evidence: [],
    nodes: [
      node("root_product", "Humanoid product", "product", undefined, {
        domain: ["humanoid_robotics"],
      }),
      node("factory_service_loop", "Factory service loop", "module", undefined, {
        domain: ["humanoid_robotics"],
        description: "Factory calibration and field service process.",
        capacityLeadTimeMonths: 18,
        tags: ["constraint_capacity_scale"],
      }),
    ],
    edges: [
      edge("e_root_service", "root_product", "factory_service_loop"),
    ],
  };
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "factory_service_loop")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);

  assert.match(summary, /Impact scope/i);
  assert.match(summary, /Blocking mode/i);
  assert.match(summary, /Current status/i);
  assert.match(summary, /18 months/i);
  assert.doesNotMatch(summary, /Estimated cost|supplier quote|BOM validation|RMB/i);
  assert.doesNotMatch(summary, /domain\/tag heuristic|Basis:/i);
  assert.doesNotMatch(summary, /\bp50\b/i);
});

test("RouteDetailRail relief timing explains the kind of unresolved constraint", () => {
  const graph: GraphData = {
    graphVersion: "route-detail-rail-relief-timing-test",
    evidence: [],
    nodes: [
      node("root_product", "Frontier product", "product"),
      node("economics", "Business model", "module", undefined, {
        tags: ["constraint_economic_validation", "constraint_regulatory_approval"],
        description: "Business model must prove demand, utilization, and economics.",
      }),
      node("material", "Tritium fuel cycle", "module", undefined, {
        tags: ["constraint_material_supply_chain", "constraint_regulatory_approval"],
        description: "Fuel cycle must scale scarce material and qualification.",
      }),
      node("component", "Qualified component", "module", undefined, {
        tags: ["constraint_component_availability"],
        description: "Qualified component supply is not yet broad enough.",
      }),
    ],
    edges: [
      edge("e_root_economics", "root_product", "economics"),
      edge("e_root_material", "root_product", "material"),
      edge("e_root_component", "root_product", "component"),
    ],
  };

  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });

  const renderSelected = (id: string) => selectedSummary(renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: graph.nodes.find((entry) => entry.id === id)!,
      analysisMode: "bottleneck-risk",
      onSelectNode: () => {},
    }),
  ));

  assert.match(renderSelected("economics"), /Estimated 36 months; proxy based on regulatory or safety approval cycle/i);
  assert.match(renderSelected("material"), /Estimated 36 months; proxy based on regulatory or safety approval cycle/i);
  assert.match(renderSelected("component"), /qualified components or alternate suppliers must scale/i);
});

test("RouteDetailRail selected summary does not lead with raw kind or domain tags", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "unlocked" },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);

  assert.doesNotMatch(summary, /internal_tag_should_not_lead/);
  assert.doesNotMatch(summary, />module</i);
  assert.match(summary, /Node interpretation/i);
  assert.doesNotMatch(summary, /Heat \d+\/100/i);
});

test("RouteDetailRail start-here and chokepoints explain why without exposing Heat", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: graph.nodes.find((entry) => entry.id === "arm")!,
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "gearbox", rank: 1, band: 5 },
        { nodeId: "motor", rank: 2, band: 4 },
      ],
      exposureAccess: { status: "full-free" },
      onSelectNode: () => {},
    }),
  );

  const start = startHereCard(html);
  const coreReadout = routeCoreReadoutCard(start);
  assert.match(start, /Node interpretation/i);
  assert.match(start, /Precision gearbox limits repeatable arm motion\./);
  assert.doesNotMatch(start, /depends on this constraint scaling/i);
  assert.match(start, /Constraint mechanism|Component availability|Capacity \/ scale|Technical maturity/i);
  assert.match(start, /Core readout/i);
  assert.match(start, /Impact scope/i);
  assert.match(start, /Substitution feasibility/i);
  assert.match(start, /Blocking mode/i);
  assert.match(start, /Current status/i);
  assert.doesNotMatch(coreReadout, /Cost-scale proxy|Leading reason|Relief timing/i);
  assert.equal(start.indexOf('data-testid="route-start-where-stuck"'), -1, `start-here should not add a separate stuck-factor block; got: ${start}`);
  assert.doesNotMatch(start, /Where it is stuck|具体卡点/i, `start-here should keep the sample-style summary hierarchy; got: ${start}`);
  assert.doesNotMatch(start, /Current signal:/i);
  assert.doesNotMatch(start, /it is marked as a bottleneck/i);
  assert.doesNotMatch(start, /\{importance\}/);
  assert.doesNotMatch(start, /motion\.\./);
  assert.doesNotMatch(start, /Heat \d+\/100/i);
  assert.doesNotMatch(start, /route-start-secondary-signals/i);
  assert.doesNotMatch(start, /Secondary signals/i);

  const chokepoints = keyChokepointsCard(html);
  assert.match(chokepoints, /Precision gearbox/);
  assert.match(chokepoints, /Precision gearbox limits repeatable arm motion\./);
  assert.doesNotMatch(chokepoints, /Maturity 42\/100/);
  assert.doesNotMatch(chokepoints, /\bp50\b/i);
  assert.match(chokepoints, /High barrier · hard to replicate/);
  assert.doesNotMatch(chokepoints, /Evidence coverage is still thin\./);
  assert.match(chokepoints, /class="route-step-signal"[\s\S]*(?:Barrier|Dependency|Concentration) \d+\/100/i);
  assert.doesNotMatch(chokepoints, /Heat \d+\/100/i);
});

test("RouteDetailRail filters non-top entries out of Key chokepoints", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: graph.nodes.find((entry) => entry.id === "arm")!,
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "gearbox", rank: 1, band: 5 },
        { nodeId: "motor", rank: 2, band: 4 },
        { nodeId: "vision", rank: 3, band: 3 },
      ],
      exposureAccess: { status: "full-free" },
      onSelectNode: () => {},
    }),
  );

  const chokepoints = keyChokepointsCard(html);
  assert.match(chokepoints, /Precision gearbox/);
  assert.doesNotMatch(chokepoints, /Servo motor/);
  assert.doesNotMatch(chokepoints, /Vision kit/);
});

test("RouteDetailRail selected summary suppresses duplicate role text in stuck reason", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      priorityEntries: [{ nodeId: "arm", rank: 1, band: 5 }],
      exposureAccess: { status: "full-free" },
      onSelectNode: () => {},
    }),
  );

  const summaryText = textFromMarkup(selectedSummary(html));
  const repeated = summaryText.match(/Robot arm moves parcels into the sorter\./gi) ?? [];
  assert.equal(
    repeated.length,
    1,
    `selected summary should not repeat the same role sentence across the primary copy; got: ${summaryText}`,
  );
});

test("RouteDetailRail know-how layer names the technical view and starts from selected know-how", () => {
  const graph = knowHowReaderGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "force_control_method")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      graphLayer: "knowhow",
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "force_control_method", rank: 1, band: 5 },
        { nodeId: "drive_module", rank: 2, band: 3 },
      ],
      onSelectNode: () => {},
    }),
  );
  const start = startHereCard(html);

  assert.match(html, /Barrier Sources view/);
  assert.match(html, /Methods and process barriers/);
  assert.match(html, /Barrier-source focus/);
  assert.match(start, /Diamonds are methods or manufacturing processes/);
  assert.match(start, /Force control method/);
  assert.ok(
    start.indexOf("Force control method") < start.indexOf("Drive module") || !start.includes("Drive module"),
    `know-how layer start card should lead from the selected technical node, not the product module; got: ${start}`,
  );
});

test("RouteDetailRail know-how layer defaults to a know-how node when selected node is still a product module", () => {
  const graph = knowHowReaderGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "drive_module")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      graphLayer: "knowhow",
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "drive_module", rank: 1, band: 4 },
        { nodeId: "force_control_method", rank: 2, band: 5 },
      ],
      onSelectNode: () => {},
    }),
  );
  const start = startHereCard(html);

  assert.match(start, /Force control method/);
  assert.doesNotMatch(
    start.slice(0, start.indexOf("Force control method")),
    /Drive module/,
    `know-how layer should not keep a product/module node as its Start card when a technical node is available; got: ${start}`,
  );
});

test("AI compute Start here prefers the HBM / advanced-packaging mainline over specialty foundry noise", () => {
  const graph = loadGraphData();
  const rootId = "ai_accelerator_module_hbm_cowos";
  const route = selectCostDriverRoute(graph, rootId, { limit: 4 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "specialty_analog_power_foundry")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "specialty_analog_power_foundry", rank: 1, band: 5 },
        { nodeId: "compound_foundry_specialty", rank: 2, band: 5 },
        { nodeId: "advanced_packaging", rank: 3, band: 4 },
        { nodeId: "high_bandwidth_memory", rank: 4, band: 4 },
      ],
      exposureAccess: { status: "locked", hiddenOrgCount: 77 },
      systemNodeIds: directRequiresChildren(graph, rootId),
      onSelectNode: () => {},
    }),
  );

  const start = startHereCard(html);
  assert.match(
    start,
    /High-bandwidth memory \(HBM\)|Advanced packaging \(2\.5D\/3D\)|HBM stack assembly and die bonding/,
    `AI compute start node should stay on the HBM / advanced packaging / CoWoS mainline; got: ${start}`,
  );
  assert.doesNotMatch(
    start,
    /Specialty\/analog\/compound power semiconductor foundry|Specialty compound semiconductor foundry/,
    `AI compute Start here should not default to the specialty or compound foundry branch; got: ${start}`,
  );
  assert.match(start, /Start with (?:HBM|advanced packaging|HBM stack assembly)/i);
  assert.match(start, /capacity, yield, and supplier concentration/i);
  assert.match(start, /Suppliers &amp; tickers/i);
  assert.match(start, /Evidence/i);
  assert.match(start, /Node interpretation/i);
  assert.ok(
    start.indexOf("Evidence") < start.indexOf("Suppliers &amp; tickers"),
    `Start here should send readers to evidence before supplier/ticker exposure; got: ${start}`,
  );
  assert.match(start, /Open Detail/i);
  assert.match(start, /Open Detail from here to inspect evidence and connected suppliers where modeled/i);
  assert.doesNotMatch(start, /included free/i);
  assert.match(
    start,
    /<button[^>]*class="[^"]*route-reader-next-step-button[^"]*"[\s\S]*Suppliers &amp; tickers[\s\S]*<\/button>/,
    `Start here should expose suppliers/tickers as a working Detail CTA; got: ${start}`,
  );
  assert.match(
    start,
    /<button[^>]*class="[^"]*route-reader-next-step-button[^"]*"[\s\S]*Evidence[\s\S]*<\/button>/,
    `Start here should expose evidence as a working Detail CTA; got: ${start}`,
  );
  assert.doesNotMatch(start, /route-start-secondary-signals/i);
  assert.doesNotMatch(start, /Heat \d+\/100/i);
  assert.doesNotMatch(start, /Evidence status/i);
  assert.doesNotMatch(start, /\d+ reviewed \/ \d+ total evidence records/i);
  assert.doesNotMatch(html, /77 suppliers hidden/i);
  assert.doesNotMatch(html, /paid exposure layer/i);
});

test("RouteDetailRail AI compute substrate summary uses concrete mechanisms instead of holder coverage as the reason", () => {
  const graph = loadGraphData();
  const rootId = "ai_accelerator_module_hbm_cowos";
  const route = selectCostDriverRoute(graph, rootId, { limit: 4 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "substrate_and_interposer")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "full-free" },
      systemNodeIds: directRequiresChildren(graph, rootId),
      onSelectNode: () => {},
    }),
  );
  const summary = textFromMarkup(selectedSummary(html));

  assert.doesNotMatch(
    summary,
    /Holder coverage gap|holder 覆盖缺口/,
    `selected substrate summary must not use holder coverage as the concrete reason; got: ${summary}`,
  );
  assert.match(
    summary,
    /Organic substrate build-up|Silicon interposer \/ RDL|Dense substrate PDN/,
    `selected substrate summary should expose concrete substrate/interposer mechanisms; got: ${summary}`,
  );
  assert.doesNotMatch(
    summary,
    /Where it is stuck\s+Constraint type not yet clear|具体卡点\s+约束类型尚不清楚/i,
    `selected summary should not present an unknown constraint type as the specific chokepoint; got: ${summary}`,
  );
  assert.doesNotMatch(summary, /Supply sources unverified|供应来源未验证|证据还比较薄/i);
});

test("RouteDetailRail AI compute logic die summary uses mechanisms instead of modeled holder count as the reason", () => {
  const graph = loadGraphData();
  const rootId = "ai_accelerator_module_hbm_cowos";
  const route = selectCostDriverRoute(graph, rootId, { limit: 4 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "logic_die_fabrication")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "full-free" },
      systemNodeIds: directRequiresChildren(graph, rootId),
      onSelectNode: () => {},
    }),
  );
  const summary = textFromMarkup(selectedSummary(html));

  assert.doesNotMatch(
    summary,
    /Modeled holders|供应方覆盖|Holder coverage gap|holder 覆盖缺口/,
    `selected logic-die summary must not use holder coverage as the concrete reason; got: ${summary}`,
  );
  assert.match(
    summary,
    /Leading-edge foundry allocation|EUV lithography\/tool cycles|Process yield ramp/,
    `selected logic-die summary should expose concrete manufacturing mechanisms; got: ${summary}`,
  );
});

test("RouteDetailRail treats AI compute locked access input as silently available", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "locked", hiddenOrgCount: 77 },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);

  assert.doesNotMatch(summary, /Full-free flagship demo/i);
  assert.doesNotMatch(summary, /exposure included/i);
  assert.doesNotMatch(summary, /Exposure layer locked/i);
  assert.doesNotMatch(summary, /77 suppliers hidden/i);
});

test("RouteDetailRail selected summary does not explain full-free access state", () => {
  const graph = readerGraphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "full-free" },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);

  assert.doesNotMatch(summary, /Full-free flagship demo/i);
  assert.doesNotMatch(summary, /exposure included/i);
  assert.doesNotMatch(summary, /Exposure layer locked/i);
});

test("RouteDetailRail locked supplier CTA advertises exposure at the point of need", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "locked", hiddenOrgCount: 77 },
      onSelectNode: () => {},
    }),
  );
  const start = startHereCard(html);

  assert.match(start, /data-testid="route-suppliers-tickers-button"/);
  assert.match(start, /Suppliers &amp; tickers/);
  assert.match(start, /Show locked exposure/);
});

test("RouteDetailRail keeps preview access state out of selected summary", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "preview" },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);

  assert.doesNotMatch(summary, /Preview only: graph route not live/i);
  assert.doesNotMatch(summary, /Supplier\/ticker exposure is not shown on this route yet/i);
  assert.doesNotMatch(summary, /Exposure layer unlocked/i);
});

test("RouteDetailRail renders audit previews without surfacing the exposure lock before point of need", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "audit-preview" },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);
  const start = startHereCard(html);

  assert.doesNotMatch(summary, /Company exposure locked/i);
  assert.doesNotMatch(summary, /Company identities and listing details are not open in this preview/i);
  assert.doesNotMatch(html, /Under review/i);
  assert.match(start, /Open Detail from here to inspect the thesis, evidence, cost signal, and next chokepoints/i);
  assert.doesNotMatch(summary, /paid access/i);
  assert.doesNotMatch(summary, /Supplier exposure/i);
  assert.doesNotMatch(summary, /tickers/i);
  assert.match(start, /data-testid="route-suppliers-tickers-button"/);
  assert.match(start, /Companies/i);
  assert.match(start, /Check availability/i);
  assert.doesNotMatch(start, /Paid exposure/i);
  assert.doesNotMatch(start, /Locked until launch/i);
  assert.doesNotMatch(start, /Company identities and listing details are not open in this preview/i);
  assert.doesNotMatch(start, /Show locked exposure/i);
  assert.doesNotMatch(html, /paid unlock/i);
  assert.doesNotMatch(summary, /graph route not live/i);
  assert.doesNotMatch(summary, /Exposure layer unlocked/i);
});

test("RouteDetailRail audit-preview detail keeps supplier exposure hidden until point of need", () => {
  const graph = graphFixture();
  const graphWithLockedDomain: GraphData = {
    ...graph,
    nodes: graph.nodes.map((entry) =>
      entry.id === "arm"
        ? { ...entry, domain: ["spacex_orbital_data_center"] }
        : entry,
    ),
  };
  const route = selectCostDriverRoute(graphWithLockedDomain, "root_product", { limit: 2 });
  const selectedNode = graphWithLockedDomain.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(
      ExposureLockProvider,
      {
        locked: [{
          domainTag: "spacex_orbital_data_center",
          entitlement: "space",
          hiddenOrgCount: 5,
        }],
      },
      React.createElement(RouteDetailRail, {
        graph: graphWithLockedDomain,
        route,
        selectedNode,
        initialPanel: "detail",
        exposureAccess: { status: "audit-preview" },
        onSelectNode: () => {},
      }),
    ),
  );

  assert.match(html, /Evidence trail/i);
  assert.doesNotMatch(html, /data-testid="route-detail-access-boundary"/);
  assert.doesNotMatch(html, /Company exposure locked/i);
  assert.doesNotMatch(html, /Company identities and listing details are not open in this preview/i);
  assert.match(html, /No direct evidence linked/i);
  assert.doesNotMatch(html, /paid-candidate route/i);
  assert.doesNotMatch(html, /Supplier\/ticker exposure is gated/i);
  assert.doesNotMatch(html, /Evidence, suppliers, tickers/i);
  assert.doesNotMatch(html, /Evidence and exposure policy/i);
  assert.doesNotMatch(html, /Exposure held back/i);
  assert.doesNotMatch(html, /organization records are modeled for QA/i);
  assert.doesNotMatch(html, /Company \/ ticker candidates/i);
  assert.doesNotMatch(html, /exposure-lock-cta/i);
});

test("RouteDetailRail parcel free route keeps access state silent", () => {
  const graph = parcelReaderGraphFixture();
  const route = selectCostDriverRoute(graph, "low_cost_parcel_sorting_robot_300k_rmb", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "parcel_arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      priorityEntries: [
        { nodeId: "parcel_arm", rank: 1, band: 5 },
        { nodeId: "parcel_vacuum", rank: 2, band: 4 },
      ],
      exposureAccess: { status: "full-free" },
      onSelectNode: () => {},
    }),
  );
  const start = startHereCard(html);
  const summary = selectedSummary(html);

  assert.match(start, /Open Detail from here to inspect evidence and connected suppliers where modeled/i);
  assert.doesNotMatch(start, /Full-free depth demo/i);
  assert.doesNotMatch(summary, /Full-free depth demo/i);
  assert.doesNotMatch(start, /included free/i);
  assert.doesNotMatch(start, /flagship/i);
  assert.doesNotMatch(summary, /flagship/i);
});

test("RouteDetailRail selected summary says when there is no direct evidence", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      analysisMode: "bottleneck-risk",
      exposureAccess: { status: "full-free" },
      onSelectNode: () => {},
    }),
  );
  const summary = selectedSummary(html);

  assert.match(summary, /Evidence trail/i);
  assert.match(summary, /No direct evidence/i);
});

test("RouteDetailRail maps stale maturity mode to the chokepoint summary", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: graph.nodes.find((entry) => entry.id === "gearbox")!,
      analysisMode: "maturity",
      priorityEntries: [
        { nodeId: "gearbox", rank: 1, band: 5 },
        { nodeId: "arm", rank: 2, band: 4 },
      ],
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /Key chokepoints/i);
  assert.match(html, /Barrier 100\/100/i);
  assert.doesNotMatch(html, /Maturity weak points/i);
  assert.doesNotMatch(html, /least mature/i);
  assert.match(html, /Selected/i);
  assert.doesNotMatch(html, /Primary cost chain/i);
});

test("RouteDetailRail renders a neutral system decomposition summary", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode: null,
      analysisMode: "relation",
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /System decomposition/i);
  assert.match(html, /Major subsystems/i);
  assert.match(html, /Robot arm/);
  assert.doesNotMatch(html, /Primary cost chain/i);
  assert.doesNotMatch(html, /Top 1-5/i);
});

test("RouteDetailRail can render the full selected-node detail view", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      initialPanel: "detail",
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-testid="route-rail-node-detail"/);
  assert.match(html, /Node detail/i);
  assert.match(html, /data-testid="route-rail-start-action"/);
  assert.doesNotMatch(html, /role="tablist"/);
  assert.match(html, /Robot arm description/);
  // ADR-0010 / §2: the readiness signal is surfaced as "Barrier" (which
  // absorbs the old "maturity"), e.g. the "Barrier gap N%" drill-in driver.
  assert.match(html, /Barrier/i);
  assert.doesNotMatch(html, /Maturity gap/i, `detail view must use "Barrier gap", not the deprecated "Maturity gap"; got: ${html}`);
  assert.doesNotMatch(
    html,
    /data-testid="set-root-node-button"|Map tools|Set as research root/i,
    `selected-node detail should stay in the detail workflow and not offer a root-switching control; got: ${html}`,
  );
});

test("RouteDetailRail keeps selected-node exploration in-place instead of offering a root switch", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      onSelectNode: () => {},
    }),
  );

  assert.doesNotMatch(html, /data-testid="set-root-node-button"/);
  assert.doesNotMatch(html, /Set as research root|Map tools|route-reader-research-controls/i);
  assert.match(html, /Robot arm/);
});

test("reset-root links keep href fallback but prevent hydrated navigation", () => {
  const graphExplorerSource = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "GraphExplorer.tsx"),
    "utf8",
  );

  assert.match(
    graphExplorerSource,
    /href=\{graphRootHref\(resetRootNode\.id\)\}[\s\S]*?onClick=\{\(event\) => \{\s*event\.preventDefault\(\);\s*onResetRoot\(\);[\s\S]*?\}\}/,
    "reset-root link should keep its current product-root href fallback but prevent hydrated navigation so returning to the product root can animate",
  );
});

test("mobile point-of-need exposure scrolls into view after the paid trigger", () => {
  const routeRailSource = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "RouteDetailRail.tsx"),
    "utf8",
  );

  assert.match(
    routeRailSource,
    /detailIntent !== "exposure"/,
    "the viewport correction should only run when the reader explicitly asks for supplier exposure",
  );
  assert.match(
    routeRailSource,
    /matchMedia\("\(max-width: 760px\)"\)/,
    "the viewport correction should be limited to mobile-width layouts",
  );
  assert.match(
    routeRailSource,
    /scrollIntoView\(\{ block: "center", inline: "nearest", behavior: "auto" \}\)/,
    "the paid exposure card should move into the mobile viewport instead of being clipped above it",
  );
});

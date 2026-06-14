import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteDetailRail } from "../src/components/RouteDetailRail";
import { loadGraphData } from "../src/lib/graphLoader";
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

function beforeExposureMiniCard(summary: string): string {
  const gridIndex = summary.indexOf("route-reader-secondary-signals");
  const accessIndex = summary.indexOf("route-reader-access");
  assert.notEqual(gridIndex, -1, `selected summary should include secondary signal chips; got: ${summary}`);
  assert.notEqual(accessIndex, -1, `selected summary should include an exposure mini-card; got: ${summary}`);
  return summary.slice(gridIndex, accessIndex);
}

function startHereCard(html: string): string {
  const match = html.match(/<section[^>]*class="[^"]*route-rail-start[^"]*"[\s\S]*?<\/section>/);
  assert.ok(match, `start-here card should be addressable; got: ${html}`);
  return match[0];
}

function keyChokepointsCard(html: string): string {
  const titleIndex = html.indexOf("Key chokepoints");
  assert.notEqual(titleIndex, -1, `key chokepoints should render; got: ${html}`);
  const sectionStart = html.lastIndexOf("<section", titleIndex);
  const sectionEnd = html.indexOf("</section>", titleIndex);
  assert.notEqual(sectionStart, -1, `key chokepoints section should have a section wrapper; got: ${html}`);
  assert.notEqual(sectionEnd, -1, `key chokepoints section should close; got: ${html}`);
  return html.slice(sectionStart, sectionEnd + "</section>".length);
}

function directRequiresChildren(graph: GraphData, source: string): string[] {
  return graph.edges
    .filter((entry) => entry.relation === "requires" && entry.source === source)
    .map((entry) => entry.target);
}

test("RouteDetailRail prioritizes route explanation before selected node detail", () => {
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
  assert.match(html, /p50 RMB 80,000/);
  assert.match(
    html,
    /aria-label="Precision gearbox, module, 2 links, p50 RMB 80,000"/,
    `route step button should expose a spaced accessible label instead of concatenated child text; got: ${html}`,
  );
  assert.match(html, /Selected/i);
  assert.match(html, /Robot arm/);
  assert.match(html, /data-testid="route-rail-detail-tab"/);
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
    /p50 RMB 149,500/,
    "selected aggregate node should show the same rolled-up cost signal used by graph edges and detail cards",
  );
});

test("RouteDetailRail renders a bottleneck-risk lens summary instead of a cost route", () => {
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

  assert.match(html, /Bottleneck risks/i);
  assert.match(html, /Start here/i);
  assert.match(html, /Key chokepoints/i);
  assert.match(html, /Precision gearbox/);
  assert.match(html, /Heat \d+\/100/i);
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

  assert.match(summary, /Bottleneck thesis/i);
  assert.match(summary, /Why it matters:/i);
  assert.match(summary, /Constraint: Robot arm moves parcels into the sorter\./);
  assert.match(summary, /Why hard to clear: it constrains Sorting robot/i);
  assert.doesNotMatch(summary, /Current signal:/i);
  assert.doesNotMatch(summary, /it is marked as a bottleneck/i);
  assert.doesNotMatch(summary, /\{importance\}/);
  assert.doesNotMatch(summary, /sorter\.\./);
  assert.match(summary, /Where it is stuck/i);
  assert.match(summary, /Decision brief/i);
  assert.match(summary, /Cost/i);
  assert.match(summary, /Supply constraint/i);
  assert.match(summary, /Capacity \/ scale/i);
  assert.match(summary, /Component availability/i);
  assert.match(summary, /Relief timing/i);
  assert.match(summary, /18 months/i);
  assert.match(summary, /Maturity 58\/100/i);
  const whereStuck = summary.match(/route-reader-factors[\s\S]*?route-reader-decision-brief/)?.[0] ?? "";
  assert.doesNotMatch(
    whereStuck,
    /Maturity 58\/100/i,
    `Where it is stuck should show constraint factors and cost, not raw score; got: ${whereStuck}`,
  );
  assert.match(summary, /Key sources/i);
  assert.match(summary, /3 source records linked/i);
  assert.doesNotMatch(summary, /Evidence status/i);
  assert.doesNotMatch(summary, /reviewed \/ .*total evidence records/i);
  assert.match(summary, /Inspect next/i);
  assert.match(summary, /Precision gearbox/);
  assert.match(summary, /Servo motor/);
  assert.match(summary, /Vision kit/);
  assert.doesNotMatch(summary, /Vacuum end effector/);

  const thesisIndex = summary.indexOf("Bottleneck thesis");
  assert.ok(thesisIndex >= 0, `selected summary should start with a bottleneck thesis; got: ${summary}`);
  for (const later of ["Heat"]) {
    const index = summary.indexOf(later);
    assert.ok(index > thesisIndex, `${later} should be secondary to the thesis; got: ${summary}`);
  }
  assert.doesNotMatch(summary, /Full-free flagship demo/i);
});

test("RouteDetailRail root selection summarizes the route entry instead of root audit gaps", () => {
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
  const summary = selectedSummary(html);

  assert.match(summary, /Route entry/i);
  assert.match(summary, /Robot arm/);
  assert.match(summary, /Capacity \/ scale/i);
  assert.match(summary, /Component availability/i);
  assert.match(summary, /18 months/i);
  assert.doesNotMatch(summary, /Constraint not classified yet/i);
  assert.doesNotMatch(summary, /Not priceable from reviewed data/i);
});

test("RouteDetailRail selected summary demotes Heat and exposure after the thesis", () => {
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
  const signalBeforeExposure = beforeExposureMiniCard(summary);
  const thesisIndex = summary.indexOf("Bottleneck thesis");
  const secondaryIndex = summary.indexOf("route-reader-secondary-signals");

  assert.ok(thesisIndex >= 0, `selected summary should include a thesis; got: ${summary}`);
  assert.ok(secondaryIndex > thesisIndex, `secondary chips should follow the thesis; got: ${summary}`);
  assert.match(signalBeforeExposure, /Heat/i);
  assert.match(signalBeforeExposure, /Source trail/i);
  assert.doesNotMatch(signalBeforeExposure, /Evidence status/i);
  assert.doesNotMatch(signalBeforeExposure, /Maturity/i);
  assert.doesNotMatch(signalBeforeExposure, /Cost signal/i);
  assert.doesNotMatch(signalBeforeExposure, /p50 RMB/i);
});

test("RouteDetailRail names unknown cost and lead-time as audit gaps, not internal fields", () => {
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

  assert.match(summary, /Not priceable from reviewed data/i);
  assert.match(summary, /No audited lead-time basis yet/i);
  assert.doesNotMatch(summary, /Cost not modeled yet/i);
  assert.doesNotMatch(summary, /Lead time not modeled yet/i);
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

  assert.match(renderSelected("economics"), /Unknown until demand, utilization, and unit economics are validated/i);
  assert.match(renderSelected("material"), /material supply and qualification must scale together/i);
  assert.match(renderSelected("component"), /qualified components or second sources must scale/i);
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
  assert.ok(
    summary.indexOf("Bottleneck thesis") < summary.indexOf("Heat"),
    "plain-language bottleneck thesis should appear before signal chips",
  );
});

test("RouteDetailRail start-here and chokepoints explain why before showing Heat", () => {
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
  assert.match(start, /Bottleneck thesis/i);
  assert.match(start, /Why it matters:/i);
  assert.match(start, /Constraint: Precision gearbox limits repeatable arm motion\./);
  assert.match(start, /Decision brief/i);
  assert.match(start, /Cost/i);
  assert.match(start, /Supply constraint/i);
  assert.match(start, /Relief timing/i);
  assert.ok(
    start.indexOf("Decision brief") < start.indexOf("Evidence"),
    `start-here decision brief should appear before next-step buttons; got: ${start}`,
  );
  assert.doesNotMatch(start, /Current signal:/i);
  assert.doesNotMatch(start, /it is marked as a bottleneck/i);
  assert.doesNotMatch(start, /\{importance\}/);
  assert.doesNotMatch(start, /motion\.\./);
  assert.ok(
    start.indexOf("Bottleneck thesis") < start.indexOf("Heat"),
    `start-here card should explain the bottleneck before Heat; got: ${start}`,
  );
  assert.match(
    start,
    /<details[^>]*data-testid="route-start-secondary-signals"[\s\S]*Heat[\s\S]*<\/details>/,
    `start-here Heat and evidence status should live in collapsed secondary signals; got: ${start}`,
  );

  const chokepoints = keyChokepointsCard(html);
  assert.match(chokepoints, /Precision gearbox/);
  assert.match(chokepoints, /Precision gearbox limits repeatable arm motion\./);
  assert.doesNotMatch(chokepoints, /Maturity 42\/100/);
  assert.match(chokepoints, /p50 RMB 80,000/);
  assert.match(chokepoints, /class="route-step-signal"[\s\S]*Heat \d+\/100/);
  assert.doesNotMatch(
    chokepoints.slice(0, chokepoints.indexOf("Precision gearbox limits repeatable arm motion.")),
    /Heat \d+\/100/,
    `key chokepoints should lead each item with node + why, not Heat; got: ${chokepoints}`,
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

  assert.match(html, /Technical know-how view/);
  assert.match(html, /Methods and process constraints/);
  assert.match(html, /Know-how focus/);
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
  assert.match(start, /Bottleneck thesis/i);
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
  assert.match(
    start,
    /<details[^>]*data-testid="route-start-secondary-signals"[\s\S]*Heat[\s\S]*Source trail[\s\S]*<\/details>/,
    `Heat and source trail should be collapsed secondary signals on the start card; got: ${start}`,
  );

  const beforeSignals = start.slice(0, start.indexOf('data-testid="route-start-secondary-signals"'));
  assert.doesNotMatch(beforeSignals, /Heat \d+\/100/i);
  assert.doesNotMatch(beforeSignals, /Evidence status/i);
  assert.doesNotMatch(beforeSignals, /\d+ reviewed \/ \d+ total evidence records/i);
  assert.doesNotMatch(html, /77 suppliers hidden/i);
  assert.doesNotMatch(html, /paid exposure layer/i);
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

test("RouteDetailRail renders preview access distinctly instead of labeling it unlocked", () => {
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

  assert.match(summary, /Preview only: graph route not live/i);
  assert.match(summary, /access model is still being reviewed/i);
  assert.doesNotMatch(summary, /Exposure layer unlocked/i);
});

test("RouteDetailRail renders audit previews as review-only without saying the graph route is offline", () => {
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

  assert.match(summary, /Research preview: exposure not reviewed/i);
  assert.match(summary, /Supplier exposure, tickers, and paid access stay locked/i);
  assert.match(html, /Not scored for paid use/i);
  assert.match(start, /Review evidence first/i);
  assert.doesNotMatch(start, /Suppliers &amp; tickers/i);
  assert.doesNotMatch(summary, /graph route not live/i);
  assert.doesNotMatch(summary, /Exposure layer unlocked/i);
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

  assert.match(summary, /Source trail/i);
  assert.match(summary, /No direct evidence/i);
});

test("RouteDetailRail renders a maturity weak-points summary with maturity scores", () => {
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

  assert.match(html, /Maturity weak points/i);
  assert.match(html, /least mature/i);
  assert.match(html, /42\/100/);
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
      currentRootId: "root_product",
      onSetRootNode: () => {},
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-testid="route-rail-node-detail"/);
  assert.match(html, /Node detail/i);
  assert.match(html, /Robot arm description/);
  assert.match(html, /Maturity/i);
  assert.ok(
    html.indexOf('data-testid="detail-bottleneck-thesis"') < html.indexOf('data-testid="set-root-node-button"'),
    `research-root control must not appear before the node summary in the detail tab; got: ${html}`,
  );
});

test("RouteDetailRail exposes a selected-node action for changing the graph root", () => {
  const graph = graphFixture();
  const route = selectCostDriverRoute(graph, "root_product", { limit: 2 });
  const selectedNode = graph.nodes.find((entry) => entry.id === "arm")!;

  const html = renderToStaticMarkup(
    React.createElement(RouteDetailRail, {
      graph,
      route,
      selectedNode,
      currentRootId: "root_product",
      onSetRootNode: () => {},
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-testid="set-root-node-button"/);
  assert.match(html, /Set as research root/i);
  assert.match(
    html,
    /<details[^>]*data-testid="route-reader-research-controls"[\s\S]*Set as research root/,
    "root action should be inside collapsed research controls instead of the first-screen summary body",
  );
  assert.match(
    html,
    /aria-label="Set Robot arm as the graph research root"/,
    "root action should describe that it re-centres the graph research view",
  );
  assert.match(
    html,
    /href="\/graph\?root=arm"/,
    "root action should have an href fallback so the research-root jump works before hydration",
  );
});

test("research-root links keep href fallback but prevent hydrated navigation", () => {
  const routeRailSource = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "RouteDetailRail.tsx"),
    "utf8",
  );
  const graphExplorerSource = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "GraphExplorer.tsx"),
    "utf8",
  );

  assert.match(
    routeRailSource,
    /href=\{graphRootHref\(selectedNode\.id\)\}[\s\S]*?onClick=\{\(event\) => \{\s*event\.preventDefault\(\);\s*if \(rootTransitioning\)[\s\S]*?onSetRootNode\?\.\(selectedNode\.id\);[\s\S]*?\}\}/,
    "set-root link should keep its href fallback but prevent hydrated navigation so the in-place root transition can animate",
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

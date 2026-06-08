import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteDetailRail } from "../src/components/RouteDetailRail";
import { selectCostDriverRoute } from "../src/lib/routeHighlight";
import type { Edge, GraphData, Node } from "../src/lib/schema";

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
        maturityLabel: "lab prototype",
      }),
      costNode("motor", "Servo motor", 50_000, {
        maturityScore: 74,
        maturityLabel: "commercial",
      }),
    ],
    edges: [
      edge("e_root_arm", "root_product", "arm"),
      edge("e_arm_gearbox", "arm", "gearbox"),
      edge("e_arm_motor", "arm", "motor"),
    ],
  };
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
  assert.match(html, /Key risk nodes/i);
  assert.match(html, /Precision gearbox/);
  assert.match(html, /Risk/i);
  assert.doesNotMatch(html, /Top 1-5/i);
  assert.doesNotMatch(html, /Primary cost chain/i);
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
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-testid="route-rail-node-detail"/);
  assert.match(html, /Node detail/i);
  assert.match(html, /Robot arm description/);
  assert.match(html, /Maturity/i);
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
    /href="\/graph"[\s\S]*?onClick=\{\(event\) => \{\s*event\.preventDefault\(\);\s*onResetRoot\(\);[\s\S]*?\}\}/,
    "reset-root link should keep its href fallback but prevent hydrated navigation so returning to the product root can animate",
  );
});

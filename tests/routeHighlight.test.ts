import test from "node:test";
import assert from "node:assert/strict";
import {
  selectCostDriverRoute,
  type RouteHighlight,
} from "../src/lib/routeHighlight";
import { filterCanvasGraph } from "../src/lib/canvasGraph";
import { loadGraphData } from "../src/lib/graphLoader";
import type { Edge, GraphData, Node } from "../src/lib/schema";

const rootId = "root_product";

function node(id: string, kind: Node["kind"] = "module", metrics?: Node["metrics"]): Node {
  return {
    id,
    name: id,
    kind,
    domain: ["test"],
    ...(metrics ? { metrics } : {}),
  };
}

function costNode(id: string, typical: number): Node {
  return node(id, "module", [
    {
      name: "Cost",
      unit: "RMB",
      currency: "RMB",
      currentValue: { min: typical, typical, max: typical },
      costAsOf: "2025",
    },
  ]);
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, relation: "requires" };
}

function testGraph(): GraphData {
  return {
    graphVersion: "route-highlight-test",
    evidence: [],
    nodes: [
      node(rootId, "product"),
      node("arm"),
      costNode("gearbox", 80_000),
      costNode("motor", 50_000),
      costNode("camera", 5_000),
      costNode("orphan_expensive", 1_000_000),
    ],
    edges: [
      edge("e_root_arm", rootId, "arm"),
      edge("e_arm_gearbox", "arm", "gearbox"),
      edge("e_arm_motor", "arm", "motor"),
      edge("e_root_camera", rootId, "camera"),
    ],
  };
}

test("selectCostDriverRoute highlights only real requires paths from root to cost drivers", () => {
  const route = selectCostDriverRoute(testGraph(), rootId, { limit: 2 });

  assert.equal(route.mode, "cost-drivers");
  assert.deepEqual(route.targetNodeIds, ["gearbox", "motor"]);
  assert.equal(route.nodeIds.has(rootId), true);
  assert.equal(route.nodeIds.has("arm"), true);
  assert.equal(route.nodeIds.has("gearbox"), true);
  assert.equal(route.nodeIds.has("motor"), true);
  assert.equal(route.nodeIds.has("orphan_expensive"), false);
  assert.deepEqual(
    [...route.edgeIds].sort(),
    ["e_arm_gearbox", "e_arm_motor", "e_root_arm"],
  );
});

test("selectCostDriverRoute returns ordered learning steps with cost values", () => {
  const route = selectCostDriverRoute(testGraph(), rootId, { limit: 2 });

  assert.deepEqual(
    route.steps.map((step) => [step.nodeId, step.costTypicalRmb]),
    [
      ["gearbox", 80_000],
      ["motor", 50_000],
    ],
  );
});

test("selectCostDriverRoute has a valid cost route on the real parcel graph", () => {
  const fullGraph = loadGraphData();
  const graph = filterCanvasGraph(fullGraph);
  const route: RouteHighlight = selectCostDriverRoute(
    graph,
    "low_cost_parcel_sorting_robot_300k_rmb",
    { limit: 4, costGraph: fullGraph },
  );

  assert.equal(route.mode, "cost-drivers");
  assert.ok(route.targetNodeIds.length >= 2, "real graph should expose multiple cost-driver targets");
  assert.ok(route.edgeIds.size >= route.targetNodeIds.length, "route should include path edges");
  assert.ok(
    route.nodeIds.has("low_cost_parcel_sorting_robot_300k_rmb"),
    "route must include the focal product",
  );
});

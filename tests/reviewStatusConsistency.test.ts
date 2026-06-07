import test from "node:test";
import assert from "node:assert/strict";

import { loadGraphData } from "../src/lib/graphLoader";

const graph = loadGraphData();

test("capability enables edges are not reviewed or high-confidence without evidence", () => {
  const unsupportedEdges = graph.edges
    .filter((edge) => edge.relation === "enables")
    .filter((edge) => edge.target === "affordable_small_warehouse_automation")
    .filter((edge) => edge.reviewStatus === "reviewed" || edge.confidence === "high")
    .filter((edge) => !(edge.evidenceIds?.length))
    .map((edge) => edge.id)
    .sort();

  assert.deepEqual(unsupportedEdges, []);
});

test("investment-facing core product records carry explicit reviewStatus", () => {
  const coreNodeIds = [
    "low_cost_parcel_sorting_robot_300k_rmb",
    "total_system_cost",
    "end_effector_gripper_or_suction",
    "maintenance_workflow",
    "cost_optimized_hardware_stack",
  ];
  const coreEdgeIds = [
    "e_product_requires_vision",
    "e_product_requires_tracking",
    "e_product_requires_manipulation",
    "e_product_requires_conveyor",
    "e_product_requires_cost_stack",
    "e_product_measured_total_cost",
    "e_v0_product_enables_capability",
  ];

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const missing = [
    ...coreNodeIds.filter((id) => !nodesById.get(id)?.reviewStatus).map((id) => `node:${id}`),
    ...coreEdgeIds.filter((id) => !edgesById.get(id)?.reviewStatus).map((id) => `edge:${id}`),
  ];

  assert.deepEqual(missing, []);
});

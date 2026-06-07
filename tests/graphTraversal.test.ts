import test from "node:test";
import assert from "node:assert/strict";

import { loadGraphData } from "../src/lib/graphLoader";
import { isDecompositionFrontier, nodeById, scopeGraphToReachableNodes } from "../src/lib/graphTraversal";

test("isDecompositionFrontier treats frontierFor as an authored frontier marker", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "vision_barcode_label_recognition");
  assert.ok(node, "fixture node must exist");
  assert.ok(node!.frontierFor?.includes("low_cost_parcel_sorting_robot_300k_rmb"), "oracle: node carries frontierFor");

  assert.equal(isDecompositionFrontier(graph, node!), true);
});

test("scopeGraphToReachableNodes keeps sibling products but excludes sibling internal subtrees", () => {
  const scoped = scopeGraphToReachableNodes(loadGraphData());
  const ids = new Set(scoped.nodes.map((node) => node.id));

  assert.equal(ids.has("parcel_sorting_robot_with_gripper_300k_rmb"), true, "sibling product node should remain visible");
  assert.equal(
    scoped.edges.some((edge) => edge.id === "e_gripper_sibling_enables_capability"),
    true,
    "sibling capability-grouping enables edge should remain visible",
  );
  assert.equal(
    scoped.edges.some((edge) => edge.id === "e_gripper_sibling_requires_end_effector"),
    false,
    "sibling product internal requires edge must not leak into the active product scope",
  );
});

test("active suction product and gripper sibling use distinct end-effector modules", () => {
  const graph = loadGraphData();
  const activeEndEffector = nodeById(graph, "end_effector_gripper_or_suction");
  const activeCalibration = nodeById(graph, "gripper_tcp_pattern_calibration");
  const gripperEndEffector = nodeById(graph, "mechanical_gripper_end_effector_module");
  const gripperEdge = graph.edges.find((edge) => edge.id === "e_gripper_sibling_requires_end_effector");

  assert.ok(activeEndEffector, "active product end-effector node must exist");
  assert.match(activeEndEffector!.name, /Vacuum suction/i);
  assert.doesNotMatch(activeEndEffector!.description ?? "", /\bgripper\b/i);
  assert.ok(activeCalibration, "active suction calibration node must exist");
  assert.doesNotMatch(activeCalibration!.name, /\bgripper\b/i);
  assert.ok(gripperEndEffector, "gripper sibling should have its own placeholder module");
  assert.equal(gripperEdge?.target, "mechanical_gripper_end_effector_module");
});

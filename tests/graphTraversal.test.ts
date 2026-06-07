import test from "node:test";
import assert from "node:assert/strict";

import { loadGraphData } from "../src/lib/graphLoader";
import { downstream, isDecompositionFrontier, nodeById, scopeGraphToReachableNodes, upstream } from "../src/lib/graphTraversal";

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

test("upstream and downstream traversal deduplicate nodes reached by multiple relations", () => {
  const graph = loadGraphData();

  const upstreamIds = upstream(graph, "parcel_induction_spacing_control").map((node) => node.id);
  const downstreamIds = downstream(graph, "conveyor_integration").map((node) => node.id);

  assert.equal(
    upstreamIds.filter((id) => id === "conveyor_integration").length,
    1,
    "parcel_induction_spacing_control should show conveyor_integration once even when both requires and implemented_by edges exist",
  );
  assert.equal(
    downstreamIds.filter((id) => id === "parcel_induction_spacing_control").length,
    1,
    "conveyor_integration should show parcel_induction_spacing_control once even when both requires and implemented_by edges exist",
  );
});

test("robot controller and I/O is recursively decomposed instead of remaining a leaf frontier", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "robot_controller_io");
  assert.ok(node, "robot_controller_io must exist");
  assert.equal(
    node!.tags?.includes("decomposition_frontier"),
    false,
    "robot_controller_io should not remain a frontier once its controls/I-O layer is added",
  );

  const children = graph.edges
    .filter((edge) => edge.source === "robot_controller_io" && edge.relation === "requires")
    .map((edge) => edge.target);

  for (const id of [
    "robot_controller_cpu_module",
    "robot_realtime_control_runtime",
    "robot_fieldbus_gateway",
    "robot_safety_io_interface",
    "robot_external_io_sensor_interface",
    "robot_controller_diagnostics_interface",
  ]) {
    assert.ok(children.includes(id), `robot_controller_io must require ${id}`);
    assert.ok(nodeById(graph, id), `${id} node must exist`);
  }
});

test("robot controller and I/O children carry explicit low-confidence cost placeholders", () => {
  const graph = loadGraphData();

  for (const id of [
    "robot_controller_cpu_module",
    "robot_realtime_control_runtime",
    "robot_fieldbus_gateway",
    "robot_safety_io_interface",
    "robot_external_io_sensor_interface",
    "robot_controller_diagnostics_interface",
  ]) {
    const edge = graph.edges.find((candidate) => candidate.source === id && candidate.relation === "measured_by");
    assert.ok(edge, `${id} must have a measured_by cost edge`);

    const metric = nodeById(graph, edge!.target);
    assert.equal(metric?.kind, "metric", `${edge!.target} must be a metric node`);
    assert.equal(metric?.confidence, "low", `${edge!.target} should remain low-confidence until supplier/teardown review`);
    assert.equal(metric?.reviewStatus, "unreviewed", `${edge!.target} should not be treated as reviewed cost evidence`);

    const cost = metric?.metrics?.find((item) => item.name === "Cost");
    assert.equal(cost?.unit, "RMB", `${edge!.target} must expose an RMB cost`);
    assert.equal(cost?.currency, "RMB", `${edge!.target} must expose an RMB currency`);
    assert.equal(cost?.costAsOf, "2025", `${edge!.target} must carry a costAsOf year`);
    assert.equal(typeof cost?.currentValue, "object", `${edge!.target} must use a min/typical/max range`);
    assert.notEqual(cost?.currentValue, null, `${edge!.target} must use a non-null cost range`);
    assert.equal(typeof cost?.currentValue?.min, "number", `${edge!.target} must expose a numeric min cost`);
    assert.equal(typeof cost?.currentValue?.typical, "number", `${edge!.target} must expose a numeric p50 cost`);
    assert.equal(typeof cost?.currentValue?.max, "number", `${edge!.target} must expose a numeric max cost`);
  }
});

test("barcode OCR reading software exposes the hard software subproblems", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "barcode_ocr_reading_software");
  assert.ok(node, "barcode_ocr_reading_software must exist");
  assert.equal(
    node!.tags?.includes("decomposition_frontier"),
    false,
    "barcode_ocr_reading_software should not remain a frontier once its no-read software layer is added",
  );

  const children = graph.edges
    .filter((edge) => edge.source === "barcode_ocr_reading_software" && edge.relation === "requires")
    .map((edge) => edge.target);

  for (const id of [
    "parcel_label_localization",
    "industrial_barcode_decoding_runtime",
    "parcel_ocr_model_runtime",
    "barcode_ocr_no_read_recovery",
    "parcel_label_training_dataset",
    "barcode_ocr_benchmark_metrics",
  ]) {
    assert.ok(children.includes(id), `barcode_ocr_reading_software must require ${id}`);
    assert.ok(nodeById(graph, id), `${id} node must exist`);
  }

  const costEdge = graph.edges.find((edge) => edge.source === "barcode_ocr_reading_software" && edge.relation === "measured_by");
  assert.ok(costEdge, "barcode_ocr_reading_software must carry an explicit cost placeholder");
});

test("low-cost real-time vision compute integration exposes deployment subproblems", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "low_cost_realtime_vision_compute_integration");
  assert.ok(node, "low_cost_realtime_vision_compute_integration must exist");
  assert.equal(
    node!.tags?.includes("decomposition_frontier"),
    false,
    "low_cost_realtime_vision_compute_integration should not remain a frontier after its deployment layer is added",
  );

  const children = graph.edges
    .filter((edge) => edge.source === "low_cost_realtime_vision_compute_integration" && edge.relation === "requires")
    .map((edge) => edge.target);

  for (const id of [
    "vision_model_deployment_optimization",
    "vision_inference_runtime_stack",
    "camera_sdk_frame_acquisition_pipeline",
    "vision_latency_budget_and_timestamping",
    "fanless_compute_thermal_management",
  ]) {
    assert.ok(children.includes(id), `low_cost_realtime_vision_compute_integration must require ${id}`);
    assert.ok(nodeById(graph, id), `${id} node must exist`);
  }

  const costEdge = graph.edges.find(
    (edge) => edge.source === "low_cost_realtime_vision_compute_integration" && edge.relation === "measured_by",
  );
  assert.ok(costEdge, "low_cost_realtime_vision_compute_integration must carry an explicit cost placeholder");
});

test("parcel induction and spacing control exposes throughput-limiting subproblems", () => {
  const graph = loadGraphData();
  const node = nodeById(graph, "parcel_induction_spacing_control");
  assert.ok(node, "parcel_induction_spacing_control must exist");
  assert.equal(
    node!.tags?.includes("decomposition_frontier"),
    false,
    "parcel_induction_spacing_control should not remain a frontier once its throughput-control layer is added",
  );

  const children = graph.edges
    .filter((edge) => edge.source === "parcel_induction_spacing_control" && edge.relation === "requires")
    .map((edge) => edge.target);

  for (const id of [
    "parcel_singulation_and_metering",
    "dynamic_gap_control_logic",
    "induction_sensor_array",
    "variable_speed_induction_drive",
    "induction_exception_recovery",
  ]) {
    assert.ok(children.includes(id), `parcel_induction_spacing_control must require ${id}`);
    assert.ok(nodeById(graph, id), `${id} node must exist`);
  }

  const costEdge = graph.edges.find(
    (edge) => edge.source === "parcel_induction_spacing_control" && edge.relation === "measured_by",
  );
  assert.ok(costEdge, "parcel_induction_spacing_control must carry an explicit cost placeholder");
});

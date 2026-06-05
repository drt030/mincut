import test from "node:test";
import assert from "node:assert/strict";
import { filterCanvasGraph } from "../src/lib/canvasGraph";
import { loadGraphData } from "../src/lib/graphLoader";

test("canvas graph excludes operational workflow nodes from the structural canvas", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const ids = new Set(canvas.nodes.map((node) => node.id));

  assert.ok(
    graph.nodes.some((node) => node.id === "maintenance_workflow"),
    "fixture must include the semantic-noise maintenance workflow node",
  );
  assert.equal(ids.has("maintenance_workflow"), false);
  assert.equal(
    canvas.edges.some((edge) => edge.source === "low_cost_parcel_sorting_robot_300k_rmb" && edge.target === "maintenance_workflow"),
    false,
  );
});

test("canvas graph hides generic material and raw supply-chain nodes by default", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const ids = new Set(canvas.nodes.map((node) => node.id));

  assert.equal(ids.has("semiconductor_grade_silicon_and_electronics"), false);
  assert.equal(ids.has("alloy_steel_precision_material"), false);
  assert.equal(ids.has("iron_ore_steelmaking_chain"), false);
  assert.equal(ids.has("quartz_silica_silicon_chain"), false);
});

test("canvas graph keeps concrete decomposition nodes such as controlled vision lighting", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const ids = new Set(canvas.nodes.map((node) => node.id));

  assert.equal(ids.has("low_cost_parcel_sorting_robot_300k_rmb"), true);
  assert.equal(ids.has("vision_barcode_label_recognition"), true);
  assert.equal(ids.has("controlled_machine_vision_lighting"), true);
  assert.equal(
    canvas.edges.some((edge) => edge.source === "vision_barcode_label_recognition" && edge.target === "controlled_machine_vision_lighting"),
    true,
  );
});

test("canvas graph reduces multi-parent pseudo-shared requires targets", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const incomingRequires = new Map<string, number>();
  for (const edge of canvas.edges) {
    if (edge.relation !== "requires") continue;
    incomingRequires.set(edge.target, (incomingRequires.get(edge.target) ?? 0) + 1);
  }

  assert.equal(incomingRequires.get("semiconductor_grade_silicon_and_electronics"), undefined);
  assert.ok(
    (incomingRequires.get("plc_and_wcs_integration") ?? 0) >= 2,
    "real shared integration modules may remain shared on canvas",
  );
});

test("canvas graph keeps robot execution children under the manipulation subsystem, not duplicated as product sectors", () => {
  const graph = loadGraphData();
  const canvas = filterCanvasGraph(graph);
  const root = "low_cost_parcel_sorting_robot_300k_rmb";
  const execution = "parcel_manipulation_or_diverter";
  const executionChildren = new Set([
    "industrial_robot_arm_body",
    "end_effector_gripper_or_suction",
    "motion_planning",
  ]);

  for (const child of executionChildren) {
    assert.equal(
      canvas.edges.some((edge) => edge.relation === "requires" && edge.source === root && edge.target === child),
      false,
      `${child} should not be a duplicated first-layer product dependency`,
    );
    assert.equal(
      canvas.edges.some((edge) => edge.relation === "requires" && edge.source === execution && edge.target === child),
      true,
      `${child} should remain a child of the parcel execution subsystem`,
    );
  }
});

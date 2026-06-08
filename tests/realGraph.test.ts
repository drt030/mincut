import test from "node:test";
import assert from "node:assert/strict";
import { loadGraphData } from "../src/lib/graphLoader";
import { rollupCost } from "../src/lib/costRollup";
import { nodeRisk } from "../src/lib/nodeRisk";
import { edgeTintFor } from "../src/lib/edgeTint";
import { siblingProductsForProduct } from "../src/lib/graphTraversal";

/**
 * Integration tests against the real parcel-sorting graph. Unlike the
 * unit tests with hand-built fixtures, these load the actual production
 * data and assert that the slice-1/2/4 outputs behave as expected on
 * the live content. If anyone tweaks data/nodes/parcel_sorting_robot.json
 * in a way that flips these assertions, they should re-read the spec
 * to make sure the change is intentional.
 */

const graph = loadGraphData();

test("real graph: parcel_manipulation_or_diverter surfaces the cost inversion", () => {
  // The headline user-reported bug. parent direct 4k vs child rollup 60k+
  // should now resolve to (a) rolled-up ≥ 69k, (b) directLowerThanChildren
  // = true.
  const result = rollupCost(graph, "parcel_manipulation_or_diverter");
  assert.ok(result.rolledUp.typical >= 60_000 * 1.15, `expected rolled-up ≥ 69k, got ${result.rolledUp.typical}`);
  assert.equal(result.directLowerThanChildren, true, "inversion badge should fire on this node");
  assert.ok(result.directOnly?.typical === 4_000, `direct 4k preserved; got ${result.directOnly?.typical}`);
});

test("real graph: flagship rolled-up moves with the new walker (not 274.7k)", () => {
  // Slice 1's headline number: 274.7k (old walker) → 283.5k (new walker).
  // The 2026-05-31 cost-consistency backfill decomposes arm/conveyor bundle
  // costs, moving the live rolled-up typical to ~310.0k. The 2026-06-07
  // robot-arm price calibration moves it to ~360.3k. The 2026-06-07
  // induction/spacing and electronics-cost backfill moves it to ~376.3k.
  // The 2026-06-07 servo motor material/component backfill makes the next
  // motor layer explicit and moves the live rolled-up typical to ~404.8k.
  // The 2026-06-07 vacuum EOAT and material-chain backfill moves it to
  // ~411.7k while reducing the cost coverage gap. The 2026-06-07 frontier
  // process cost backfill adds calibration, jam-recovery, cost-stack, and
  // base-alignment allocations, moving it to ~421.8k. The 2026-06-08 robot-arm
  // recalibration raises the direct arm-body p50 above low-end marketplace
  // samples and moves the live rollup to ~451.8k. The 2026-06-08 manufacturing
  // process backfill adds explicit assembly/test allocations and moves it to
  // ~469.1k.
  // Lock that value in so a future change that accidentally hides child
  // cost drivers is caught.
  const result = rollupCost(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  assert.equal(result.directOnly, null, "annual maintenance cost must not be treated as direct product capex");
  assert.ok(
    result.rolledUp.typical > 464_000 && result.rolledUp.typical < 474_000,
    `flagship rolled-up typical drifted: ${result.rolledUp.typical} (expected ~469.1k)`,
  );
});

test("real graph: parcel_manipulation_or_diverter is high risk in bottleneck mode", () => {
  // The cost-inversion subsystem should rank high on the risk ramp:
  // maturity is prototype (~50/100) and the children-side cost share
  // is substantial.
  const node = graph.nodes.find((n) => n.id === "parcel_manipulation_or_diverter");
  assert.ok(node, "fixture: parcel_manipulation_or_diverter must exist");
  const risk = nodeRisk(node!, graph);
  assert.ok(risk > 0.15, `expected nodeRisk > 0.15, got ${risk}`);
});

test("real graph: edgeTint produces non-default warm colors in cost mode", () => {
  // The expensive industrial_robot_arm_body should not tint to
  // NEUTRAL_TINT or to the cheap-end blue — it should be visibly warm.
  const arm = graph.nodes.find((n) => n.id === "industrial_robot_arm_body");
  assert.ok(arm, "fixture: industrial_robot_arm_body must exist");
  const tint = edgeTintFor(arm!, "cost", graph);
  assert.notEqual(tint, "#94a3b8", "should not be NEUTRAL_TINT — arm has real cost data");
  assert.match(tint, /^#[0-9a-f]{6}$/i, "should be a hex color");
});

test("real graph: sibling product candidates do not reuse active product metric nodes", () => {
  const graph = loadGraphData();
  const siblingProductIds = new Set(
    siblingProductsForProduct(graph, "low_cost_parcel_sorting_robot_300k_rmb").map((node) => node.id),
  );
  assert.ok(
    siblingProductIds.has("parcel_sorting_robot_with_gripper_300k_rmb"),
    "sibling metric-reuse guard must include the gripper sibling product",
  );
  const activeProductMetricIds = new Set([
    "total_system_cost",
    "parcels_per_hour",
    "sorting_accuracy",
    "allowed_parcel_weight_range",
    "allowed_parcel_size_range",
    "failure_jam_rate",
    "human_intervention_rate",
    "installation_time",
    "maintenance_cost",
    "payback_period",
  ]);

  const leakingEdges = graph.edges
    .filter((edge) => siblingProductIds.has(edge.source))
    .filter((edge) => edge.relation === "measured_by" || edge.relation === "depends_on_metric")
    .filter((edge) => activeProductMetricIds.has(edge.target))
    .map((edge) => edge.id)
    .sort();

  assert.deepEqual(leakingEdges, []);
});

test("real graph: parcel throughput metric is structurally linked to throughput-limiting nodes", () => {
  const graph = loadGraphData();
  const expectedConstraintIds = [
    "parcel_induction_spacing_control",
    "parcel_detection_and_tracking",
    "barcode_ocr_no_read_recovery",
    "motion_planning",
    "plc_and_wcs_integration",
    "jam_detection_and_recovery",
    "maintenance_workflow",
  ];

  const constraintIds = new Set(
    graph.edges
      .filter((edge) => edge.relation === "depends_on_metric")
      .filter((edge) => edge.target === "parcels_per_hour")
      .map((edge) => edge.source),
  );

  for (const expectedId of expectedConstraintIds) {
    assert.ok(
      constraintIds.has(expectedId),
      `parcels_per_hour must expose ${expectedId} as a structured throughput constraint`,
    );
  }
});

test("real graph: startup opportunity candidates are explicit on key bottleneck nodes", () => {
  const graph = loadGraphData();
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const opportunityNodeIds = [
    "low_cost_realtime_vision_compute_integration",
    "parcel_induction_spacing_control",
    "plc_and_wcs_integration",
    "reducer_lubrication_and_life_test",
    "maintenance_workflow",
  ];

  for (const nodeId of opportunityNodeIds) {
    const node = nodesById.get(nodeId);
    assert.ok(node, `${nodeId} must exist`);
    assert.ok(
      node!.tags?.includes("startup_opportunity_candidate"),
      `${nodeId} must be tagged as a startup opportunity candidate`,
    );
    assert.match(node!.notes ?? "", /Startup opportunity:/, `${nodeId} must explain the opportunity hypothesis`);
  }
});

test("real graph: throughput constraints carry structured constraint-factor tags", () => {
  const graph = loadGraphData();
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const expectedFactors: Record<string, string[]> = {
    low_cost_realtime_vision_compute_integration: [
      "constraint_technical_maturity",
      "constraint_integration_commissioning",
    ],
    parcel_induction_spacing_control: [
      "constraint_integration_commissioning",
      "constraint_component_availability",
      "constraint_capacity_scale",
    ],
    parcel_singulation_and_metering: [
      "constraint_integration_commissioning",
      "constraint_capacity_scale",
    ],
    dynamic_gap_control_logic: [
      "constraint_integration_commissioning",
      "constraint_capacity_scale",
    ],
    plc_and_wcs_integration: [
      "constraint_integration_commissioning",
    ],
    reducer_lubrication_and_life_test: [
      "constraint_technical_maturity",
      "constraint_maintenance_operations",
    ],
    maintenance_workflow: [
      "constraint_maintenance_operations",
    ],
    servo_motor_permanent_magnet_rotor: [
      "constraint_material_supply_chain",
    ],
  };

  for (const [nodeId, expectedTags] of Object.entries(expectedFactors)) {
    const node = nodesById.get(nodeId);
    assert.ok(node, `${nodeId} must exist`);
    const tags = new Set(node!.tags ?? []);
    for (const expectedTag of expectedTags) {
      assert.ok(
        tags.has(expectedTag),
        `${nodeId} must expose ${expectedTag} so investor/operator workflows can distinguish the limiting factor`,
      );
    }
  }
});

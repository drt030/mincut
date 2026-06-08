import test from "node:test";
import assert from "node:assert/strict";
import { eligibleCostSubsystemIds, rollupCost } from "../src/lib/costRollup";
import { loadGraphData } from "../src/lib/graphLoader";
import { loadFixture } from "./fixtures/loader";

/**
 * Slice 1 RED — cost-inversion fixture: parent has a direct cost of 4k
 * RMB but its `requires` child carries a 60k RMB hardware price. The
 * current walker prefers the direct reading and returns 4k, which makes
 * the parent look cheaper than its own component. The user reported
 * this as the visible "subsystem priced above its parent" bug.
 *
 * Expected post-fix behaviour:
 *   - `rolledUp.typical` is the max of (direct, children_sum × 1.15)
 *   - new fields on the result let the UI surface the breakdown:
 *       `directOnly`, `fromChildren`, `directLowerThanChildren`
 */
test("rollupCost surfaces direct/children breakdown and uses max() when direct < children", () => {
  const graph = loadFixture("cost-inversion.json");
  const result = rollupCost(graph, "parent_module");

  // The single child has a typical cost of 60,000 RMB. After the 15%
  // integration overhead the children-side estimate is 69,000. The direct
  // reading on the parent is 4,000. The fixed walker must return the
  // larger of the two so a parent never reads cheaper than its parts.
  assert.ok(
    result.rolledUp.typical >= 60_000 * 1.15,
    `expected rolledUp.typical ≥ 69000, got ${result.rolledUp.typical}`,
  );

  // The UI needs both numbers separately to render the breakdown row
  // and the ⚠ inversion badge.
  assert.equal(
    result.directOnly?.typical,
    4_000,
    `expected directOnly.typical = 4000, got ${result.directOnly?.typical}`,
  );
  assert.ok(
    result.fromChildren?.typical && result.fromChildren.typical >= 60_000 * 1.15,
    `expected fromChildren.typical ≥ 69000, got ${result.fromChildren?.typical}`,
  );

  // The inversion flag drives the ⚠ "direct lower than children" badge
  // in NodeDetailPanel.
  assert.equal(
    result.directLowerThanChildren,
    true,
    "expected directLowerThanChildren = true for this fixture",
  );
});

test("rollupCost ignores annual operating-cost metrics when deriving direct capex", () => {
  const graph = loadGraphData();
  const result = rollupCost(graph, "low_cost_parcel_sorting_robot_300k_rmb");

  assert.equal(
    result.directOnly,
    null,
    "product direct capex should not use maintenance_cost because RMB/year is an annual operating-cost rate",
  );
  assert.ok(
    result.fromChildren?.typical && result.fromChildren.typical > 300_000,
    `expected product child rollup to remain available, got ${result.fromChildren?.typical}`,
  );
});

test("rollupCost excludes principle nodes from capex coverage gaps", () => {
  const graph = loadGraphData();
  const result = rollupCost(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  const eligibleIds = eligibleCostSubsystemIds(graph, "low_cost_parcel_sorting_robot_300k_rmb");

  for (const nodeId of ["real_time_machine_vision", "queuing_and_flow_variability"]) {
    assert.equal(
      result.coverageGap.includes(nodeId),
      false,
      `${nodeId} is a principle anchor and should not be reported as a capex coverage gap`,
    );
    assert.equal(
      eligibleIds.has(nodeId),
      false,
      `${nodeId} should be excluded from the capex denominator`,
    );
  }
});

test("active parcel frontier nodes expose p50 capex placeholders when no quote is available", () => {
  const graph = loadGraphData();

  for (const nodeId of [
    "vision_barcode_label_recognition",
    "gripper_tcp_pattern_calibration",
    "servo_motor_windings",
    "servo_motor_housing_and_thermal_design",
    "servo_motor_feedback_alignment",
    "jam_detection_and_recovery",
    "cost_optimized_hardware_stack",
    "robot_base_installation_alignment_process",
    "servo_motor_assembly_and_test_process",
    "robot_arm_assembly_process",
    "modular_cell_manufacturing",
    "photolithography_photoresist_chemical_chain",
    "semiconductor_packaging_solder_substrate_chain",
  ]) {
    const result = rollupCost(graph, nodeId);
    assert.equal(result.anyChildContributed, true, `${nodeId} must have reachable capex data`);
    assert.ok(
      result.rolledUp.typical > 0,
      `${nodeId} must expose a positive p50 capex estimate or child rollup`,
    );
  }
});

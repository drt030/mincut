import test from "node:test";
import assert from "node:assert/strict";
import { eligibleCostSubsystemIds, rollupCost } from "../src/lib/costRollup";
import { loadGraphData } from "../src/lib/graphLoader";
import type { GraphData } from "../src/lib/schema";
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

test("rollupCost reads non-first explicit capex metrics and scales currency magnitude units", () => {
  const graph: GraphData = {
    graphVersion: "cost-unit-magnitude-test",
    evidence: [],
    nodes: [
      {
        id: "advanced_fab",
        name: "Advanced fab",
        kind: "module",
        domain: ["test"],
        maturityLabel: "early_deployment",
        maturityAsOf: "2026-06",
        metrics: [
          {
            name: "Utilization",
            unit: "%",
            currentValue: 95,
          },
          {
            name: "Cost per leading-edge fab",
            unit: "billion USD",
            currentValue: 20,
            currency: "USD",
            costAsOf: "2025",
          },
        ],
      },
    ],
    edges: [],
  };

  const result = rollupCost(graph, "advanced_fab");

  assert.equal(result.directOnly?.typical, 144_000_000_000);
  assert.equal(result.rolledUp.typical, 144_000_000_000);
});

test("live AI logic-die fabrication uses authored fab capex rather than heuristic fallback", () => {
  const graph = loadGraphData();
  const result = rollupCost(graph, "logic_die_fabrication");

  assert.ok(
    result.directOnly?.typical && result.directOnly.typical >= 100_000_000_000,
    `expected logic_die_fabrication direct fab capex >= 100B RMB, got ${result.directOnly?.typical}`,
  );
  assert.ok(
    result.rolledUp.typical >= result.directOnly.typical,
    `rolled up ${result.rolledUp.typical} should include direct fab capex ${result.directOnly.typical}`,
  );
});

test("rollupCost rolls up commodified parents when they still have structural children", () => {
  const graph: GraphData = {
    graphVersion: "commodified-parent-rollup-test",
    evidence: [],
    nodes: [
      {
        id: "parent_product",
        name: "Parent product",
        kind: "product",
        domain: ["test"],
        maturityLabel: "widely_adopted",
        maturityAsOf: "2026-06",
      },
      {
        id: "child_module",
        name: "Child module",
        kind: "module",
        domain: ["test"],
        maturityLabel: "early_deployment",
        maturityAsOf: "2026-06",
        metrics: [
          {
            name: "Module cost",
            unit: "RMB",
            currentValue: 10_000,
            currency: "RMB",
            costAsOf: "2026",
          },
        ],
      },
    ],
    edges: [
      {
        id: "parent_requires_child",
        source: "parent_product",
        target: "child_module",
        relation: "requires",
      },
    ],
  };

  const result = rollupCost(graph, "parent_product");

  assert.equal(result.rolledUp.typical, 11_500);
  assert.equal(result.fromChildren?.typical, 11_500);
  assert.deepEqual(result.coverageGap, []);
});

test("live AI compute root cost-scale proxy rolls up from its structural children", () => {
  const graph = loadGraphData();
  const root = rollupCost(graph, "ai_accelerator_module_hbm_cowos");
  const child = rollupCost(graph, "logic_die_fabrication");

  assert.ok(
    root.fromChildren?.typical && root.fromChildren.typical >= child.rolledUp.typical,
    `expected AI compute root child rollup >= logic die ${child.rolledUp.typical}, got ${root.fromChildren?.typical}`,
  );
  assert.ok(root.rolledUp.typical >= child.rolledUp.typical);
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
    "copper_ore_mining_and_refining_chain",
    "iron_ore_steelmaking_chain",
  ]) {
    const result = rollupCost(graph, nodeId);
    assert.equal(result.anyChildContributed, true, `${nodeId} must have reachable capex data`);
    assert.ok(
      result.rolledUp.typical > 0,
      `${nodeId} must expose a positive p50 capex estimate or child rollup`,
    );
  }
});

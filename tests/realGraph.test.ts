import test from "node:test";
import assert from "node:assert/strict";
import { loadGraphData } from "../src/lib/graphLoader";
import { rollupCost } from "../src/lib/costRollup";
import { nodeRisk } from "../src/lib/nodeRisk";
import { edgeTintFor } from "../src/lib/edgeTint";

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
  // ~411.7k while reducing the cost coverage gap.
  // Lock that value in so a future change that accidentally hides child
  // cost drivers is caught.
  const result = rollupCost(graph, "low_cost_parcel_sorting_robot_300k_rmb");
  assert.ok(
    result.rolledUp.typical > 407_000 && result.rolledUp.typical < 416_000,
    `flagship rolled-up typical drifted: ${result.rolledUp.typical} (expected ~411.7k)`,
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
  const siblingProductIds = new Set([
    "delta_robot_sorting",
    "conveyor_diverter_sorting",
    "mobile_robot_sorting",
    "hybrid_human_robot_assisted_sorting",
  ]);
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

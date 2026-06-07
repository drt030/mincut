import test from "node:test";
import assert from "node:assert/strict";
import { loadGateQuestions, loadGraphData } from "../src/lib/graphLoader";
import { runGate } from "../src/lib/gateRunner";

test("gate required module checklist follows product-level modules, not execution-subsystem children", () => {
  const graph = loadGraphData();
  const questions = loadGateQuestions();
  const report = runGate(graph, questions, "low_cost_parcel_sorting_robot_300k_rmb");
  const requiredModules = report.questionResults.find((result) => result.questionId === "required_modules");
  assert.ok(requiredModules, "required_modules result must exist");

  assert.deepEqual(
    requiredModules!.missingNodeIds ?? [],
    [],
    "robot arm body, end effector, and motion planning are children of the execution subsystem, not missing product-level modules",
  );
  assert.equal(
    report.recommendedNextTasks.some((task) => task.title.startsWith("Add missing module ")),
    false,
    "gate should not ask to add execution-subsystem children as missing root modules",
  );
});

test("gate main bottlenecks reads structural bottleneckOf nodes for the parcel product", () => {
  const graph = loadGraphData();
  const questions = loadGateQuestions();
  const report = runGate(graph, questions, "low_cost_parcel_sorting_robot_300k_rmb");
  const mainBottlenecks = report.questionResults.find((result) => result.questionId === "main_bottlenecks");
  assert.ok(mainBottlenecks, "main_bottlenecks result must exist");

  assert.match(
    mainBottlenecks!.answer,
    /parcel_detection_and_tracking/,
    "product-level bottleneck answer should include structural nodes tagged by bottleneckOf",
  );
});

test("gate cost answer uses p50 language instead of typical range-first language", () => {
  const graph = loadGraphData();
  const questions = loadGateQuestions();
  const report = runGate(graph, questions, "low_cost_parcel_sorting_robot_300k_rmb");
  const cost = report.questionResults.find((result) => result.questionId === "cost_constraints");
  assert.ok(cost, "cost_constraints result must exist");

  assert.match(cost!.answer, /Rolled-up cost \(RMB\): p50=/);
  assert.match(cost!.answer, /Target cost \(RMB\): p50=/);
  assert.doesNotMatch(cost!.answer, /typical=/);
  assert.doesNotMatch(cost!.answer, /target typical/i);
});

test("gate key metrics answer includes current and target values for performance metrics", () => {
  const graph = loadGraphData();
  const questions = loadGateQuestions();
  const report = runGate(graph, questions, "low_cost_parcel_sorting_robot_300k_rmb");
  const keyMetrics = report.questionResults.find((result) => result.questionId === "key_metrics");
  assert.ok(keyMetrics, "key_metrics result must exist");

  assert.match(keyMetrics!.answer, /parcels_per_hour: Parcels per hour — current p50 1,500 \(range 325–1,800\) parcels\/hour; target 1,500 parcels\/hour/);
  assert.match(keyMetrics!.answer, /sorting_accuracy: Sorting accuracy — current p50 99 \(range 98–99\.5\) %; target 99 %/);
  assert.match(keyMetrics!.answer, /maintenance_cost: Maintenance cost — current p50 24,000 \(range 12,000–45,000\) RMB\/year; target 18,000 RMB\/year/);
  assert.match(keyMetrics!.answer, /payback_period: Payback period — current p50 36 \(range 24–48\) months; target 24 months/);
  assert.doesNotMatch(keyMetrics!.answer, /parcels_per_hour: Parcels per hour; sorting_accuracy: Sorting accuracy/);
});

test("gate excluded claims derives sibling products instead of using a stale hard-coded list", () => {
  const graph = loadGraphData();
  const questions = loadGateQuestions();
  const report = runGate(graph, questions, "low_cost_parcel_sorting_robot_300k_rmb");
  const excludedClaims = report.questionResults.find((result) => result.questionId === "excluded_claims");
  assert.ok(excludedClaims, "excluded_claims result must exist");

  assert.match(
    excludedClaims!.answer,
    /parcel_sorting_robot_with_gripper_300k_rmb/,
    "gate must flag the gripper sibling product as out-of-bound for the active suction product",
  );
});

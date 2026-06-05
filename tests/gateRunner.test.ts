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

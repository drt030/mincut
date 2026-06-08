import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentExpansionTask,
  upsertAgentExpansionTask,
} from "../src/lib/agentExpansionTask";
import type { GraphData, ResearchTask } from "../src/lib/schema";

const graph: GraphData = {
  graphVersion: "agent-expansion-task",
  evidence: [],
  nodes: [
    {
      id: "root_product",
      name: "Root product",
      kind: "product",
      domain: ["test"],
    },
    {
      id: "robot_arm",
      name: "Robot arm",
      kind: "module",
      domain: ["test"],
    },
  ],
  edges: [
    {
      id: "e_root_arm",
      source: "root_product",
      target: "robot_arm",
      relation: "requires",
    },
  ],
};

test("buildAgentExpansionTask creates a bounded one-layer expansion request for the selected root", () => {
  const task = buildAgentExpansionTask(graph, "robot_arm", "2026-06-08T12:00:00.000Z");

  assert.equal(task.targetNodeId, "robot_arm");
  assert.equal(task.suggestedNodeKind, "module");
  assert.equal(task.priority, "medium");
  assert.equal(task.status, "pending");
  assert.match(task.id, /^task_agent_expand_robot_arm_20260608120000$/);
  assert.match(task.title, /Expand Robot arm one dependency layer/);
  assert.match(task.reason, /docs\/NODE_EXPANSION\.md/);
  assert.match(task.reason, /small candidate import batch/);
});

test("upsertAgentExpansionTask reuses an existing pending request for the same target", () => {
  const existing: ResearchTask = {
    ...buildAgentExpansionTask(graph, "robot_arm", "2026-06-08T12:00:00.000Z"),
    id: "task_existing_robot_arm_expand",
  };

  const result = upsertAgentExpansionTask(
    graph,
    [existing],
    "robot_arm",
    "2026-06-08T12:05:00.000Z",
  );

  assert.equal(result.created, false);
  assert.equal(result.task.id, "task_existing_robot_arm_expand");
  assert.deepEqual(result.tasks, [existing]);
});

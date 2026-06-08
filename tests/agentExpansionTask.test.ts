import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentExpansionGraphPatch,
  buildAgentExpansionTask,
  upsertAgentExpansionTask,
} from "../src/lib/agentExpansionTask";
import { loadActiveGraphData } from "../src/lib/graphLoader";
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

test("buildAgentExpansionGraphPatch lists concrete unreviewed candidate nodes immediately", () => {
  const activeGraph = loadActiveGraphData();
  const patch = buildAgentExpansionGraphPatch(
    activeGraph,
    "robot_controller_io",
    "2026-06-08T12:00:00.000Z",
  );

  assert.ok(patch.nodes.length >= 3, `expected at least three controller/I-O candidates, got ${patch.nodes.length}`);
  assert.equal(patch.edges.length, patch.nodes.length, "each listed candidate should be connected by one requires edge");
  assert.ok(
    patch.nodes.some((node) => node.id === "robot_controller_io_backplane_and_power_distribution"),
    `controller expansion should include a concrete backplane/power-distribution candidate; got ${patch.nodes.map((node) => node.id).join(", ")}`,
  );
  for (const node of patch.nodes) {
    assert.equal(node.reviewStatus, "unreviewed", `${node.id} should remain unreviewed until human review`);
    assert.equal(node.confidence, "low", `${node.id} should be low-confidence before evidence collection`);
    assert.ok(node.tags?.includes("agent_candidate"), `${node.id} should be marked as an agent candidate`);
    assert.ok(node.tags?.includes("decomposition_frontier"), `${node.id} should remain a visible decomposition frontier`);
  }
  for (const edge of patch.edges) {
    assert.equal(edge.source, "robot_controller_io", `${edge.id} should attach directly to the active research root`);
    assert.equal(edge.relation, "requires", `${edge.id} should use strict requires semantics`);
    assert.equal(edge.reviewStatus, "unreviewed", `${edge.id} should remain unreviewed until human review`);
  }

  const graphWithPatch = {
    ...activeGraph,
    nodes: [...activeGraph.nodes, ...patch.nodes],
    edges: [...activeGraph.edges, ...patch.edges],
  };
  const duplicatePatch = buildAgentExpansionGraphPatch(
    graphWithPatch,
    "robot_controller_io",
    "2026-06-08T12:05:00.000Z",
  );
  assert.deepEqual(
    duplicatePatch,
    { nodes: [], edges: [] },
    "building a patch against a graph that already has the candidates should be idempotent",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveDataFiles, validateCandidateImport } from "../scripts/import-candidates";
import { loadGraphData, loadTasks } from "../src/lib/graphLoader";

test("resolveDataFiles defaults to the parcel-sorting v0 data files", () => {
  const files = resolveDataFiles();
  assert.equal(files.nodeFile, path.join(process.cwd(), "data", "nodes", "parcel_sorting_robot.json"));
  assert.equal(files.edgeFile, path.join(process.cwd(), "data", "edges", "parcel_sorting_robot_edges.json"));
  assert.equal(
    files.evidenceFile,
    path.join(process.cwd(), "data", "evidence", "parcel_sorting_robot_evidence.json"),
  );
  assert.equal(files.taskFile, path.join(process.cwd(), "data", "tasks", "pending_tasks.json"));
});

test("resolveDataFiles routes node/edge/evidence appends to per-domain files", () => {
  const files = resolveDataFiles("ai_compute_chain");
  assert.equal(files.nodeFile, path.join(process.cwd(), "data", "nodes", "ai_compute_chain.json"));
  assert.equal(files.edgeFile, path.join(process.cwd(), "data", "edges", "ai_compute_chain_edges.json"));
  assert.equal(
    files.evidenceFile,
    path.join(process.cwd(), "data", "evidence", "ai_compute_chain_evidence.json"),
  );
  // Research tasks stay in the shared queue regardless of domain.
  assert.equal(files.taskFile, path.join(process.cwd(), "data", "tasks", "pending_tasks.json"));
});

test("resolveDataFiles rejects domain names that are not lower_snake_case", () => {
  assert.throws(() => resolveDataFiles("../escape"));
  assert.throws(() => resolveDataFiles("AI-Compute"));
  assert.throws(() => resolveDataFiles(""));
});

test("candidate nodes referencing missing evidence are rejected", () => {
  const errors = validateCandidateImport(
    {
      nodes: [
        {
          id: "test_node_dangling_ev",
          name: "Test",
          kind: "module",
          domain: ["test"],
          evidenceIds: ["ev_does_not_exist_anywhere"],
        },
      ],
      edges: [],
      evidence: [],
      tasks: [],
    },
    loadGraphData(),
    loadTasks(),
    { allowReviewed: false, allowActiveScopeExpansion: false },
  );
  assert.ok(
    errors.some((e) => e.includes("test_node_dangling_ev") && e.includes("ev_does_not_exist_anywhere")),
    `expected a dangling node-evidence error, got: ${JSON.stringify(errors)}`,
  );
});

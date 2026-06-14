import test from "node:test";
import assert from "node:assert/strict";
import { applyMechanicalChanges } from "../src/lib/evidenceAudit";
import type { GraphData } from "../src/lib/schema";

const graph: GraphData = {
  graphVersion: "t",
  nodes: [{ id: "n1", name: "N1", kind: "module", evidenceIds: ["ev_dead", "ev_ok"] }],
  edges: [],
  evidence: [
    { id: "ev_dead", type: "paper", title: "dead", sourceStatus: "404" },
    { id: "ev_ok", type: "paper", title: "ok", sourceStatus: "fetch_ok", excerpt: "70%" },
  ],
} as unknown as GraphData;

test("demote moves a dead record from evidenceIds to rejectedEvidenceIds and never deletes it", () => {
  const { graph: next, changes } = applyMechanicalChanges(
    graph,
    [
      { id: "ev_dead", bucket: "demote", reasons: ["dead source: 404"], hasExcerpt: false, numberSupported: null },
      { id: "ev_ok", bucket: "structural_ok", reasons: [], hasExcerpt: true, numberSupported: true },
    ],
    "2026-06-14",
  );

  const n1 = next.nodes[0] as { evidenceIds?: string[]; rejectedEvidenceIds?: string[] };
  assert.deepEqual(n1.evidenceIds, ["ev_ok"]);
  assert.deepEqual(n1.rejectedEvidenceIds, ["ev_dead"]);
  assert.ok(next.evidence.some((e) => e.id === "ev_dead"), "record is preserved, not deleted");

  const ok = next.evidence.find((e) => e.id === "ev_ok");
  assert.equal(ok?.machineCheck?.status, "structural_ok");
  assert.ok(changes.demoted.includes("ev_dead"));
});

test("applier never writes reviewStatus", () => {
  const { graph: next } = applyMechanicalChanges(
    graph,
    [{ id: "ev_ok", bucket: "structural_ok", reasons: [], hasExcerpt: true, numberSupported: true }],
    "2026-06-14",
  );
  assert.equal(next.evidence.find((e) => e.id === "ev_ok")?.reviewStatus, undefined);
});

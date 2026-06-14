import test from "node:test";
import assert from "node:assert/strict";
import { agentVerdictsSchema, applyAgentVerdicts, applyOwnerFlips } from "../src/lib/evidenceAudit";
import type { GraphData } from "../src/lib/schema";

const graph: GraphData = {
  graphVersion: "t",
  nodes: [],
  edges: [],
  evidence: [
    { id: "ev1", type: "paper", title: "t1", sourceStatus: "fetch_ok", excerpt: "70%" },
    { id: "ev2", type: "paper", title: "t2", sourceStatus: "fetch_ok", excerpt: "x" },
  ],
} as unknown as GraphData;

test("verdict schema caps escalations at 10", () => {
  const tooMany = {
    verified: [],
    escalations: Array.from({ length: 11 }, (_, i) => ({ id: `e${i}`, question: "q" })),
  };
  assert.throws(() => agentVerdictsSchema.parse(tooMany));
});

test("applyAgentVerdicts marks verified but never sets reviewStatus", () => {
  const verdicts = agentVerdictsSchema.parse({
    verified: [{ id: "ev1", quoteMatch: "exact", numberInQuote: true }],
    escalations: [{ id: "ev2", question: "quote only says ~70, claim says 72" }],
  });
  const { graph: next } = applyAgentVerdicts(graph, verdicts, "2026-06-14");
  assert.equal(next.evidence.find((e) => e.id === "ev1")?.machineCheck?.status, "verified");
  assert.equal(next.evidence.find((e) => e.id === "ev1")?.reviewStatus, undefined);
});

test("applyOwnerFlips is the ONLY path that sets reviewed", () => {
  const { graph: next } = applyOwnerFlips(graph, ["ev1"]);
  assert.equal(next.evidence.find((e) => e.id === "ev1")?.reviewStatus, "reviewed");
  assert.equal(next.evidence.find((e) => e.id === "ev2")?.reviewStatus, undefined);
});

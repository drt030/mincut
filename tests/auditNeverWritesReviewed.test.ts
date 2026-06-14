import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMechanicalChanges } from "../src/lib/evidenceAudit";
import type { GraphData } from "../src/lib/schema";

test("applyMechanicalChanges never sets reviewStatus on any record", () => {
  const graph = {
    graphVersion: "t",
    nodes: [],
    edges: [],
    evidence: [{ id: "ev", type: "paper", title: "t", sourceStatus: "fetch_ok", excerpt: "70%" }],
  } as unknown as GraphData;
  const { graph: next } = applyMechanicalChanges(
    graph,
    [{ id: "ev", bucket: "structural_ok", reasons: [], hasExcerpt: true, numberSupported: true }],
    "2026-06-14",
  );
  assert.equal(next.evidence[0].reviewStatus, undefined);
});

test("only applyOwnerFlips assigns reviewed in the audit core (exactly one place)", () => {
  const src = readFileSync("src/lib/evidenceAudit.ts", "utf8");
  const matches = src.match(/reviewStatus:\s*["']reviewed["']/g) ?? [];
  assert.equal(matches.length, 1, "exactly one reviewed-assignment, inside applyOwnerFlips");
  // and it must live inside applyOwnerFlips, not the mechanical/agent appliers
  const ownerFlipsBody = src.slice(src.indexOf("export function applyOwnerFlips"));
  assert.match(ownerFlipsBody, /reviewStatus:\s*["']reviewed["']/, "the reviewed-assignment must be in applyOwnerFlips");
});

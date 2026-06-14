import test from "node:test";
import assert from "node:assert/strict";
import { stampMachineChecks } from "../src/lib/evidenceAudit";
import type { Evidence } from "../src/lib/schema";
import type { RecordAudit } from "../src/lib/evidenceAudit";

const evidence: Evidence[] = [
  { id: "a", type: "paper", title: "a", sourceStatus: "404" },
  { id: "b", type: "paper", title: "b", sourceStatus: "fetch_ok", excerpt: "70%" },
  { id: "c", type: "paper", title: "c", sourceStatus: "fetch_ok", excerpt: "x" },
];
const audits: RecordAudit[] = [
  { id: "a", bucket: "demote", reasons: ["dead source: 404"], hasExcerpt: false, numberSupported: null },
  { id: "b", bucket: "needs_fetch", reasons: [], hasExcerpt: true, numberSupported: null },
];

test("stamps failed for demoted/dead records and verified overrides when in the verified set", () => {
  const out = stampMachineChecks(evidence, audits, "2026-06-14", new Set(["b"]));
  assert.equal(out.find((e) => e.id === "a")?.machineCheck?.status, "failed");
  assert.match(out.find((e) => e.id === "a")?.machineCheck?.notes ?? "", /dead source/);
  assert.equal(out.find((e) => e.id === "b")?.machineCheck?.status, "verified");
});

test("records with no audit entry are left untouched", () => {
  const out = stampMachineChecks(evidence, audits, "2026-06-14", new Set());
  assert.equal(out.find((e) => e.id === "c")?.machineCheck, undefined);
});

test("never writes reviewStatus", () => {
  const out = stampMachineChecks(evidence, audits, "2026-06-14", new Set(["b"]));
  assert.ok(out.every((e) => e.reviewStatus === undefined));
});

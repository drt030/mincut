import test from "node:test";
import assert from "node:assert/strict";
import { auditRecord, numberInQuote } from "../src/lib/evidenceAudit";
import type { Evidence } from "../src/lib/schema";

const base: Evidence = {
  id: "ev",
  type: "paper",
  title: "T",
  sourceStatus: "fetch_ok",
  excerpt: "TSMC holds about 70% foundry share.",
};

test("numberInQuote ignores commas/spaces", () => {
  assert.equal(numberInQuote("1,500", "throughput is 1500 pph"), true);
  assert.equal(numberInQuote("72", "about 70% share"), false);
});

test("dead source → demote", () => {
  const a = auditRecord({ ...base, sourceStatus: "404" }, []);
  assert.equal(a.bucket, "demote");
});

test("missing excerpt → failed", () => {
  const a = auditRecord({ ...base, excerpt: undefined }, []);
  assert.equal(a.bucket, "failed");
  assert.ok(a.reasons.some((r) => /excerpt/.test(r)));
});

test("claimed number absent from excerpt → failed", () => {
  const a = auditRecord(base, ["72"]);
  assert.equal(a.bucket, "failed");
  assert.ok(a.reasons.some((r) => /number/.test(r)));
});

test("clean record with supported number → structural_ok", () => {
  const a = auditRecord(base, ["70"]);
  assert.equal(a.bucket, "structural_ok");
  assert.deepEqual(a.reasons, []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { evidenceSchema, machineCheckSchema } from "../src/lib/schema";

test("machineCheck accepts a verified record", () => {
  const parsed = machineCheckSchema.parse({
    status: "verified",
    checkedAsOf: "2026-06-14",
    quoteMatch: "exact",
    numberInQuote: true,
  });
  assert.equal(parsed.status, "verified");
});

test("machineCheck rejects a bad checkedAsOf", () => {
  assert.throws(() => machineCheckSchema.parse({ status: "verified", checkedAsOf: "June 2026" }));
});

test("evidence record round-trips with an optional machineCheck", () => {
  const ev = evidenceSchema.parse({
    id: "ev_x",
    type: "paper",
    title: "T",
    machineCheck: { status: "structural_ok", checkedAsOf: "2026-06-14" },
  });
  assert.equal(ev.machineCheck?.status, "structural_ok");
  const evNone = evidenceSchema.parse({ id: "ev_y", type: "paper", title: "T2" });
  assert.equal(evNone.machineCheck, undefined);
});

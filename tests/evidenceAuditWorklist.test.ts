import test from "node:test";
import assert from "node:assert/strict";
import { buildWorklist } from "../src/lib/evidenceAudit";
import type { Evidence } from "../src/lib/schema";

const clean = (id: string, over: Partial<Evidence> = {}): Evidence => ({
  id,
  type: "paper",
  title: id,
  sourceStatus: "fetch_ok",
  excerpt: "share is about 70%",
  ...over,
});

test("clean high-stakes record becomes needs_fetch; low-stakes stays structural_ok", () => {
  const evidence = [clean("ev_hot"), clean("ev_cold")];
  const wl = buildWorklist({
    evidence,
    supportedNumbersByEvidenceId: { ev_hot: ["70"], ev_cold: ["70"] },
    highStakesEvidenceIds: new Set(["ev_hot"]),
  });
  assert.equal(wl.find((r) => r.id === "ev_hot")?.bucket, "needs_fetch");
  assert.equal(wl.find((r) => r.id === "ev_cold")?.bucket, "structural_ok");
});

test("dead source stays demote even when high-stakes", () => {
  const wl = buildWorklist({
    evidence: [clean("ev", { sourceStatus: "404" })],
    supportedNumbersByEvidenceId: {},
    highStakesEvidenceIds: new Set(["ev"]),
  });
  assert.equal(wl[0].bucket, "demote");
});

test("failed high-stakes record is NOT promoted to needs_fetch", () => {
  const wl = buildWorklist({
    evidence: [clean("ev", { excerpt: undefined })],
    supportedNumbersByEvidenceId: {},
    highStakesEvidenceIds: new Set(["ev"]),
  });
  assert.equal(wl[0].bucket, "failed");
});

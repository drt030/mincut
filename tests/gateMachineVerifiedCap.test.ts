import test from "node:test";
import assert from "node:assert/strict";
import { applyReviewStatusCap, type EvidenceFindings } from "../src/lib/gateRunner";
import type { Node } from "../src/lib/schema";

// Note (2026-06-14): the plan proposed an end-to-end runGate assertion, but no
// review-status-capped question in the current ai-compute or parcel data has a
// raw score above 3, so the cap never binds above 3 in real data and the lift
// cannot be observed end-to-end. We unit-test the cap function directly — it is
// the exact logic this task changes.

function findings(over: Partial<EvidenceFindings>): EvidenceFindings {
  return {
    trustedEvidence: [],
    weakEvidence: [],
    missingReviewedEvidence: [],
    unreviewedClaims: [],
    disputedClaims: [],
    disputedEvidence: [],
    vendorOrInternalOnlyClaims: [],
    frontiers: [],
    machineVerifiedClaimIds: new Set<string>(),
    ...over,
  };
}

const claim = (id: string) => ({ id }) as unknown as Node;

test("disputed caps at 2 even when claims are machine-verified", () => {
  assert.equal(
    applyReviewStatusCap(
      findings({
        disputedClaims: [claim("d")],
        unreviewedClaims: [claim("u")],
        machineVerifiedClaimIds: new Set(["u"]),
      }),
    ),
    2,
  );
});

test("a single bare unreviewed claim still caps at 3", () => {
  assert.equal(
    applyReviewStatusCap(
      findings({
        unreviewedClaims: [claim("u1"), claim("u2")],
        machineVerifiedClaimIds: new Set(["u1"]), // u2 is still bare unreviewed
      }),
    ),
    3,
  );
});

test("all unreviewed claims machine-verified lifts the cap to 4", () => {
  assert.equal(
    applyReviewStatusCap(
      findings({
        unreviewedClaims: [claim("u1"), claim("u2")],
        machineVerifiedClaimIds: new Set(["u1", "u2"]),
      }),
    ),
    4,
  );
});

test("no disputed and no unreviewed claims → no cap (5 reachable)", () => {
  assert.equal(applyReviewStatusCap(findings({})), undefined);
});

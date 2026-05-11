import test from "node:test";
import assert from "node:assert/strict";
import { rollupCost } from "../src/lib/costRollup";
import { loadFixture } from "./fixtures/loader";

/**
 * Slice 1 RED — cost-inversion fixture: parent has a direct cost of 4k
 * RMB but its `requires` child carries a 60k RMB hardware price. The
 * current walker prefers the direct reading and returns 4k, which makes
 * the parent look cheaper than its own component. The user reported
 * this as the visible "subsystem priced above its parent" bug.
 *
 * Expected post-fix behaviour:
 *   - `rolledUp.typical` is the max of (direct, children_sum × 1.15)
 *   - new fields on the result let the UI surface the breakdown:
 *       `directOnly`, `fromChildren`, `directLowerThanChildren`
 */
test("rollupCost surfaces direct/children breakdown and uses max() when direct < children", () => {
  const graph = loadFixture("cost-inversion.json");
  const result = rollupCost(graph, "parent_module");

  // The single child has a typical cost of 60,000 RMB. After the 15%
  // integration overhead the children-side estimate is 69,000. The direct
  // reading on the parent is 4,000. The fixed walker must return the
  // larger of the two so a parent never reads cheaper than its parts.
  assert.ok(
    result.rolledUp.typical >= 60_000 * 1.15,
    `expected rolledUp.typical ≥ 69000, got ${result.rolledUp.typical}`,
  );

  // The UI needs both numbers separately to render the breakdown row
  // and the ⚠ inversion badge.
  assert.equal(
    result.directOnly?.typical,
    4_000,
    `expected directOnly.typical = 4000, got ${result.directOnly?.typical}`,
  );
  assert.ok(
    result.fromChildren?.typical && result.fromChildren.typical >= 60_000 * 1.15,
    `expected fromChildren.typical ≥ 69000, got ${result.fromChildren?.typical}`,
  );

  // The inversion flag drives the ⚠ "direct lower than children" badge
  // in NodeDetailPanel.
  assert.equal(
    result.directLowerThanChildren,
    true,
    "expected directLowerThanChildren = true for this fixture",
  );
});

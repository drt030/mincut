import test from "node:test";
import assert from "node:assert/strict";
// RED Slice B2 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md
// § "Slice B2 — Click → elastic sector expansion (Level 1)";
// ADR-0006 § "Focus interaction").
//
// `sectorAngles` is the NEW pure function the GREEN commit will add
// at src/lib/sectorAngles.ts. It assigns an angular (center, width)
// in radians to every first-layer subsystem so the radial canvas
// can expand the clicked sector elastically without recomputing
// node positions.
//
// Signature (pinned by this test):
//
//   export type SectorAngleAssignment = {
//     angles: Map<string, { center: number; width: number }>;
//     focusedId: string | null;
//   };
//   export function sectorAngles(
//     allSubsystemIds: string[],
//     focusedSubsystemId: string | null,
//   ): SectorAngleAssignment;
//
// Geometry contract:
//   - allSubsystemIds.length === N ≥ 1.
//   - No focus (focusedSubsystemId === null): each subsystem gets
//     width = 2π/N and center = i × 2π/N for sorted i ∈ [0, N).
//   - Focus: focused subsystem gets width = 2π × (120/360) = 2π/3.
//     Other N-1 subsystems share the remaining 4π/3 equally, each
//     getting width = (4π/3) / (N-1).
//   - Centers (focused): keep id-sorted order. Walk sorted ids and
//     lay out widths sequentially starting at θ = 0. The focused
//     subsystem occupies its OWN angular slot at its id-sorted
//     index — i.e., its center = (sum of widths before it) +
//     (own width / 2). This is the rule recommended in the slice
//     brief; it makes "the focused sector stays where it was, just
//     wider" the readable visual story.
//   - allSubsystemIds.length === 1 edge case: width = 2π,
//     center = 0 — a single subsystem owns the full ring.
//   - If focusedSubsystemId is not present in allSubsystemIds,
//     fall back to the no-focus layout.
//   - Determinism: same input → identical output, bit-for-bit.
//
// The module does not exist yet; this import fails at load time,
// which is the cleanest RED signal we can give the GREEN sub-agent.
import { sectorAngles } from "../src/lib/sectorAngles";

const TWO_PI = Math.PI * 2;
const FOCUS_WIDTH = TWO_PI / 3; // 120° in radians

/**
 * Helper: build an N-element list of synthetic subsystem ids. We
 * pad to 2 digits so lexicographic sort matches numeric order, so
 * the tests can reason about "sorted index" without surprises.
 */
function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `sub_${String(i).padStart(2, "0")}`);
}

/**
 * Helper: serialize a SectorAngleAssignment to a stable string for
 * bit-for-bit equality checks (determinism test). Map iteration
 * order is preserved by JS, but we sort by key explicitly so the
 * serialization does not depend on insertion order.
 */
function stableStringify(result: ReturnType<typeof sectorAngles>): string {
  const sorted = [...result.angles.entries()].sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({
    focusedId: result.focusedId,
    angles: sorted.map(([id, v]) => [id, { center: v.center, width: v.width }]),
  });
}

// -------------------- Test 1: No focus, N=14 (real data shape) --------------------

/**
 * Assertion 1 (no-focus, N=14): the actual data has 14 first-layer
 * subsystems (per the `radialLayout` test fixture probe). With no
 * focus, every subsystem must get width = 2π/14 and the 14 centers
 * must form the set { i × 2π/14 | i ∈ [0, 14) }, in id-sorted
 * order.
 *
 * Why N=14 specifically: this is the production layout the GREEN
 * commit will ship. Pinning it here guards against a future regression
 * where someone hard-codes "12" (the spec narrative count) instead
 * of taking N from the input list.
 */
test("no-focus, N=14 (production shape): equal widths 2π/14, centers at i × 2π/14, id-sorted", () => {
  const subsystemIds = ids(14);
  const result = sectorAngles(subsystemIds, null);

  assert.equal(result.focusedId, null, "focusedId must be null when no focus argument");
  assert.equal(result.angles.size, 14, "must produce exactly 14 angle assignments");

  const sortedIds = [...subsystemIds].sort();
  const expectedWidth = TWO_PI / 14;

  for (let i = 0; i < 14; i++) {
    const id = sortedIds[i];
    const entry = result.angles.get(id);
    assert.ok(entry, `must have angle entry for ${id}`);
    assert.ok(
      Math.abs(entry.width - expectedWidth) < 1e-9,
      `width for ${id} expected 2π/14 = ${expectedWidth}, got ${entry.width}`,
    );
    const expectedCenter = i * expectedWidth;
    assert.ok(
      Math.abs(entry.center - expectedCenter) < 1e-9,
      `center for ${id} (sorted index ${i}) expected ${expectedCenter}, got ${entry.center}`,
    );
  }
});

// -------------------- Test 2: No focus, N=12 (spec narrative shape) --------------------

/**
 * Assertion 2 (no-focus, N=12): the spec narrative talks about 12
 * subsystems (the original number before data grew to 14). The
 * function must adapt N to the input list, not a constant. Pinning
 * N=12 here forces the GREEN implementation to be data-driven.
 */
test("no-focus, N=12 (spec narrative): equal widths 2π/12, centers at i × 2π/12", () => {
  const subsystemIds = ids(12);
  const result = sectorAngles(subsystemIds, null);

  assert.equal(result.angles.size, 12, "must produce exactly 12 angle assignments");
  const sortedIds = [...subsystemIds].sort();
  const expectedWidth = TWO_PI / 12;

  for (let i = 0; i < 12; i++) {
    const id = sortedIds[i];
    const entry = result.angles.get(id);
    assert.ok(entry, `must have angle entry for ${id}`);
    assert.ok(
      Math.abs(entry.width - expectedWidth) < 1e-9,
      `width for ${id} expected 2π/12 = ${expectedWidth}, got ${entry.width}`,
    );
    assert.ok(
      Math.abs(entry.center - i * expectedWidth) < 1e-9,
      `center for ${id} (sorted index ${i}) expected ${i * expectedWidth}, got ${entry.center}`,
    );
  }
});

// -------------------- Test 3: No focus, N=4 (hand-built exact values) --------------------

/**
 * Assertion 3 (no-focus, N=4): hand-built small case with exact
 * expected values. With 4 subsystems the centers should land at
 * {0, π/2, π, 3π/2} — the cardinal angles — and widths at π/2
 * each. This catches off-by-one errors that an N=12/14 test would
 * not surface as cleanly (those just produce "small numbers", a
 * cardinal-angle layout is visually obvious).
 */
test("no-focus, N=4: widths π/2; centers {0, π/2, π, 3π/2}", () => {
  const subsystemIds = ["alpha", "bravo", "charlie", "delta"];
  const result = sectorAngles(subsystemIds, null);

  assert.equal(result.angles.size, 4, "must produce 4 entries");

  // Sorted order: alpha < bravo < charlie < delta.
  const expectedCenters: Record<string, number> = {
    alpha: 0,
    bravo: Math.PI / 2,
    charlie: Math.PI,
    delta: (3 * Math.PI) / 2,
  };

  for (const [id, expectedCenter] of Object.entries(expectedCenters)) {
    const entry = result.angles.get(id);
    assert.ok(entry, `must have entry for ${id}`);
    assert.ok(
      Math.abs(entry.width - Math.PI / 2) < 1e-9,
      `width for ${id} expected π/2, got ${entry.width}`,
    );
    assert.ok(
      Math.abs(entry.center - expectedCenter) < 1e-9,
      `center for ${id} expected ${expectedCenter}, got ${entry.center}`,
    );
  }
});

// -------------------- Test 4: Focused N=14 — width split --------------------

/**
 * Assertion 4 (focused, N=14): the focused subsystem gets width
 * 2π/3 (120°); the other 13 each get (4π/3)/13 ≈ 0.3221 rad ≈
 * 18.46°. We check widths only here — center placement is its own
 * test below.
 *
 * Fixture choice: focus the id at sorted index 7 (middle of the
 * list) so any off-by-one in "before vs after the focused slot"
 * has room to manifest in the center test.
 */
test("focus N=14: focused width = 2π/3; other 13 widths = (4π/3)/13 each", () => {
  const subsystemIds = ids(14);
  const focused = "sub_07"; // middle of sorted list
  const result = sectorAngles(subsystemIds, focused);

  assert.equal(result.focusedId, focused, "focusedId must equal the input");
  assert.equal(result.angles.size, 14, "still 14 entries");

  const focusedEntry = result.angles.get(focused);
  assert.ok(focusedEntry, "must have entry for focused id");
  assert.ok(
    Math.abs(focusedEntry.width - FOCUS_WIDTH) < 1e-9,
    `focused width expected 2π/3 = ${FOCUS_WIDTH}, got ${focusedEntry.width}`,
  );

  const expectedOtherWidth = (TWO_PI - FOCUS_WIDTH) / 13;
  for (const id of subsystemIds) {
    if (id === focused) continue;
    const entry = result.angles.get(id);
    assert.ok(entry, `must have entry for ${id}`);
    assert.ok(
      Math.abs(entry.width - expectedOtherWidth) < 1e-9,
      `non-focused width for ${id} expected (4π/3)/13 = ${expectedOtherWidth}, got ${entry.width}`,
    );
  }
});

// -------------------- Test 5: Focused N=14 — widths sum to 2π --------------------

/**
 * Assertion 5 (sum check): the total angular budget must always be
 * exactly 2π. This is the conservation law that makes the elastic
 * expansion visually believable — the circle never gains or loses
 * angular real estate, the focused sector just borrows from its
 * peers.
 */
test("focus N=14: all widths sum to 2π (within 1e-9)", () => {
  const subsystemIds = ids(14);
  const result = sectorAngles(subsystemIds, "sub_03");

  let total = 0;
  for (const entry of result.angles.values()) total += entry.width;
  assert.ok(
    Math.abs(total - TWO_PI) < 1e-9,
    `sum of widths must be 2π = ${TWO_PI}, got ${total} (diff ${total - TWO_PI})`,
  );
});

// -------------------- Test 6: Focused id not in list → no-focus fallback --------------------

/**
 * Assertion 6 (unknown focus id): if the caller passes an id that
 * is not present in `allSubsystemIds`, the function must fall back
 * to the no-focus layout instead of producing 14 entries plus a
 * 15th-but-missing focused slot. The output must equal the result
 * of calling `sectorAngles(allSubsystemIds, null)` exactly, and
 * focusedId must be null (not the bogus id).
 *
 * This guard matters because the UI's focus state can briefly hold
 * a stale id during route transitions; the layout should degrade
 * gracefully, not crash or skew.
 */
test("focus N=14, unknown id: falls back to no-focus layout", () => {
  const subsystemIds = ids(14);
  const expected = sectorAngles(subsystemIds, null);
  const actual = sectorAngles(subsystemIds, "nonexistent_subsystem_xyz");

  assert.equal(actual.focusedId, null, "focusedId must be null when input id is unknown");
  assert.equal(stableStringify(actual), stableStringify(expected), "fallback must match no-focus layout exactly");
});

// -------------------- Test 7: N=1 edge case → single subsystem owns the ring --------------------

/**
 * Assertion 7 (N=1): one subsystem with focus must occupy width
 * 2π (full ring); 4π/3 / (N-1) would be division by zero. The
 * function must handle this without throwing, and the single
 * subsystem must own the full circle. Center is at 0 by
 * convention.
 */
test("N=1: single subsystem occupies full 2π, focused or not", () => {
  const onlyId = "lonely_subsystem";

  for (const focusArg of [null, onlyId] as const) {
    const result = sectorAngles([onlyId], focusArg);
    assert.equal(result.angles.size, 1, `must produce 1 entry (focusArg=${focusArg})`);
    const entry = result.angles.get(onlyId);
    assert.ok(entry, `must have entry for the only id (focusArg=${focusArg})`);
    assert.ok(
      Math.abs(entry.width - TWO_PI) < 1e-9,
      `single subsystem width must be 2π, got ${entry.width} (focusArg=${focusArg})`,
    );
    assert.ok(
      Math.abs(entry.center - 0) < 1e-9,
      `single subsystem center must be 0, got ${entry.center} (focusArg=${focusArg})`,
    );
  }
});

// -------------------- Test 8: Determinism --------------------

/**
 * Assertion 8 (determinism): calling the function twice with the
 * same input must produce a bit-for-bit identical SectorAngleAssignment.
 * Compared via stable-key JSON serialization so Map iteration
 * order does not affect the check.
 */
test("determinism: same input → bit-for-bit equal output (sorted-entry JSON compare)", () => {
  const subsystemIds = ids(14);

  // No focus.
  const a1 = sectorAngles(subsystemIds, null);
  const a2 = sectorAngles(subsystemIds, null);
  assert.equal(stableStringify(a1), stableStringify(a2), "determinism: no-focus");

  // With focus.
  const b1 = sectorAngles(subsystemIds, "sub_05");
  const b2 = sectorAngles(subsystemIds, "sub_05");
  assert.equal(stableStringify(b1), stableStringify(b2), "determinism: focused");

  // Input list order should not matter — the function sorts internally.
  const shuffled = [...subsystemIds].reverse();
  const c1 = sectorAngles(subsystemIds, "sub_05");
  const c2 = sectorAngles(shuffled, "sub_05");
  assert.equal(
    stableStringify(c1),
    stableStringify(c2),
    "determinism: result independent of input order (sort happens inside)",
  );
});

// -------------------- Test 9: Order preservation + focused slot at its sorted index --------------------

/**
 * Assertion 9 (order preservation): the angular layout must
 * preserve id-sorted order around the circle. Walking the sorted
 * ids 0..N-1 and accumulating widths must place each id's center
 * at exactly (sum of widths before it) + (its own width / 2).
 * The focused id occupies its OWN sorted-index slot — it does
 * NOT get moved to θ = π or to position 0. This is the
 * spatial-continuity rule from ADR-0006 § "Focus interaction":
 * "Position of nodes never change — only the angular distribution
 * of sectors". The clicked sector stays in its same angular
 * neighbourhood; it just grows.
 *
 * The independent expected layout is computed here; the
 * implementation must agree with it.
 */
test("order preservation: focused sector sits at its id-sorted index; sequential layout starting at θ=0", () => {
  const subsystemIds = ids(14);
  const focused = "sub_07"; // sorted index 7 of [00..13]
  const result = sectorAngles(subsystemIds, focused);

  const sortedIds = [...subsystemIds].sort();
  const nonFocusedWidth = (TWO_PI - FOCUS_WIDTH) / 13;

  let acc = 0;
  for (let i = 0; i < sortedIds.length; i++) {
    const id = sortedIds[i];
    const ownWidth = id === focused ? FOCUS_WIDTH : nonFocusedWidth;
    const expectedCenter = acc + ownWidth / 2;
    const entry = result.angles.get(id);
    assert.ok(entry, `must have entry for ${id}`);
    assert.ok(
      Math.abs(entry.center - expectedCenter) < 1e-9,
      `center for ${id} (sorted index ${i}, focused=${id === focused}) expected ${expectedCenter}, got ${entry.center}`,
    );
    acc += ownWidth;
  }

  // Final accumulator must equal 2π — closes the conservation
  // story with the explicit sequential walk.
  assert.ok(Math.abs(acc - TWO_PI) < 1e-9, `sequential walk must close at 2π; got ${acc}`);

  // Cross-check: focused entry's center must equal what the walk
  // computed for its sorted index, NOT π (a common alternative
  // rule the brief explicitly rejected).
  const focusedSortedIdx = sortedIds.indexOf(focused);
  const expectedFocusedCenter =
    focusedSortedIdx * nonFocusedWidth + FOCUS_WIDTH / 2;
  const focusedEntry = result.angles.get(focused)!;
  assert.ok(
    Math.abs(focusedEntry.center - expectedFocusedCenter) < 1e-9,
    `focused center: expected ${expectedFocusedCenter} (sorted index ${focusedSortedIdx} × non-focused-width + half focus width), got ${focusedEntry.center}`,
  );
});

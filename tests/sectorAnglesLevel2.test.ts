import test from "node:test";
import assert from "node:assert/strict";
import { sectorAngles } from "../src/lib/sectorAngles";
import type { GraphData } from "../src/lib/schema";

// RED Slice C1 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md
// § "Slice C1 — Recursive Level-2 elastic";
// ADR-0006 § "Focus interaction" — the Level-2 paragraph).
//
// B2 shipped `sectorAngles(allSubsystemIds, focusedSubsystemId, ...)`
// where `focusedSubsystemId: string | null` produces the Level-1
// elastic layout (focused outer sector → 120°, others share 240°).
//
// C1 generalises that contract: the second argument becomes a
// **focus path** — an array of ids representing the click-stack from
// outer to inner. Length-1 path is the Level-1 behaviour. Length-2
// triggers the Level-2 sub-sector expansion inside the focused
// outer sector. Length-3+ does NOT modify geometry — only viewport
// zoom changes deeper than that, per the ADR.
//
// Pinned signature (the GREEN commit at C1 must satisfy this; B2
// callers passing a bare string keep working via an overload):
//
//   export type SectorAngleAssignment = {
//     angles: Map<string, { center: number; width: number }>;
//     subSectorAngles?: Map<string, Map<string, { center: number; width: number }>>;
//     focusedId: string | null;          // preserved for B2 callers
//     focusPath: string[];               // new in C1; [] when no focus
//   };
//
//   export function sectorAngles(
//     allSubsystemIds: string[],
//     focusedSubsystemId: string | null,
//     graph?: GraphData,
//   ): SectorAngleAssignment;
//   export function sectorAngles(
//     allSubsystemIds: string[],
//     focusPath: string[] | null,
//     graph?: GraphData,
//   ): SectorAngleAssignment;
//
// Geometry contract for Level 2:
//
//   - The outer focused sector (path[0]) keeps width = 2π/3 = 120°
//     as in Level 1. Its center stays where Level-1 placed it.
//   - WITHIN that 120°, the focused inner sub-subsystem (path[1])
//     expands its sub-angle from the default (120° / Mₛ, where
//     Mₛ is the number of `requires`-children of path[0] inside
//     the same first-layer sector) to exactly 80° (4π/9 rad).
//   - The other Mₛ - 1 sub-subsystems share the remaining 40°
//     (120° - 80°) equally, each getting 40° / (Mₛ - 1).
//   - All sub-subsystem widths sum to exactly 120° (within 1e-9).
//   - Sub-sector centers are placed sequentially in id-sorted order
//     starting at the outer focused sector's left edge:
//       leftEdge = outerCenter - outerWidth/2
//     Each sub-subsystem's center = leftEdge + (sum of sub-widths
//     before it) + (own sub-width / 2). This is the analogue of the
//     Level-1 "sector stays where it was, just grows" rule, one
//     level deeper.
//   - subSectorAngles is keyed by the OUTER first-layer subsystem id
//     (path[0]); its value is a Map keyed by inner sub-subsystem id.
//     For Level 1 and no-focus, subSectorAngles is undefined OR an
//     empty Map. (The RED test only requires that Level-2 produces
//     a populated nested Map for path[0]; Level-1 produces no nested
//     Map for that id, or one that is empty.)
//
// Level 3+ rule: when focusPath.length ≥ 3, the geometry is identical
// to focusPath.slice(0, 2) — extra path elements are ignored for
// geometry. Viewport zoom is a render-layer concern, not this pure
// function's concern.
//
// Backward compat: passing the SAME id as a bare string and as
// [id] must produce identical `angles` Maps. We keep that as an
// explicit assertion so the GREEN commit can't quietly diverge the
// two paths.
//
// Fixture: a hand-built GraphData where `sub_05` (a first-layer
// subsystem) has exactly 4 `requires`-children inside its sector:
// `child_a`, `child_b`, `child_c`, `child_d`. The `requires` edges
// have source=child, target=parent (per the existing edge schema
// where `requires` reads "source requires target").

const TWO_PI = Math.PI * 2;
const FOCUS_WIDTH = TWO_PI / 3; // 120° in radians (outer focused width)
const DEG_TO_RAD = Math.PI / 180;
const EIGHTY_DEG = 80 * DEG_TO_RAD; // 4π/9, the inner focused sub-width
const FORTY_DEG = 40 * DEG_TO_RAD; // remaining angular budget inside 120°

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `sub_${String(i).padStart(2, "0")}`);
}

/**
 * Build a minimal GraphData fixture for the Level-2 tests. The
 * function under test only needs to enumerate `requires`-children of
 * the outer focused subsystem — node descriptions, kinds, and other
 * fields are filler. `sub_05` has 4 children: child_a, child_b,
 * child_c, child_d. Each child has 1 grandchild for Level-3+ test.
 */
function buildFixture(): GraphData {
  const subsystemIds = ids(14);
  const childIds = ["child_a", "child_b", "child_c", "child_d"];
  const grandchildIds = ["grandchild_x"]; // child_b's grandchild for L3+ probe

  const nodes = [
    // Focal product so the graph isn't completely orphaned.
    {
      id: "product_root",
      name: "Product Root",
      kind: "product" as const,
      domain: ["test"],
    },
    // 14 first-layer subsystems.
    ...subsystemIds.map((id) => ({
      id,
      name: id,
      kind: "module" as const,
      domain: ["test"],
    })),
    // 4 children of sub_05.
    ...childIds.map((id) => ({
      id,
      name: id,
      kind: "module" as const,
      domain: ["test"],
    })),
    // 1 grandchild of child_b for the Level-3+ test.
    ...grandchildIds.map((id) => ({
      id,
      name: id,
      kind: "module" as const,
      domain: ["test"],
    })),
  ];

  const edges = [
    // Each first-layer subsystem requires the product (so it's
    // discoverable as a child of `product_root` if anyone uses that
    // walk). We only really care about sub_05's children below.
    ...subsystemIds.map((id, i) => ({
      id: `e_${id}_requires_product`,
      source: id,
      target: "product_root",
      relation: "requires" as const,
      weight: i, // any small distinct value
    })),
    // sub_05's 4 requires-children: source=child, target=sub_05.
    ...childIds.map((id) => ({
      id: `e_${id}_requires_sub_05`,
      source: id,
      target: "sub_05",
      relation: "requires" as const,
    })),
    // child_b's 1 grandchild for Level-3+ probe.
    {
      id: "e_grandchild_x_requires_child_b",
      source: "grandchild_x",
      target: "child_b",
      relation: "requires" as const,
    },
  ];

  return {
    graphVersion: "test-c1-level2-fixture",
    nodes,
    edges,
    evidence: [],
  };
}

/**
 * Stable stringify for deep-equal across calls (determinism test).
 * Sorts top-level angles and any nested subSectorAngles by key.
 */
function stableStringify(result: ReturnType<typeof sectorAngles>): string {
  const angles = [...result.angles.entries()].sort(([a], [b]) => a.localeCompare(b));
  const sub = result.subSectorAngles
    ? [...result.subSectorAngles.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([outerId, inner]) => [
          outerId,
          [...inner.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([innerId, v]) => [innerId, { center: v.center, width: v.width }]),
        ])
    : null;
  return JSON.stringify({
    focusedId: result.focusedId ?? null,
    focusPath: result.focusPath ?? [],
    angles: angles.map(([id, v]) => [id, { center: v.center, width: v.width }]),
    subSectorAngles: sub,
  });
}

// -------------------- Test 1: Level-1 backward compat via [id] --------------------

/**
 * Assertion 1: passing a single-element path `[id]` must produce the
 * same outer-sector `angles` Map as the existing B2 contract that
 * accepts a bare `id` string. This keeps every B2 call site working
 * after C1 generalises the signature. The graph argument is allowed
 * but optional for Level-1 — pass it to verify it doesn't perturb
 * Level-1 geometry either.
 */
test("L1 backward compat: [id] path produces same outer geometry as bare id", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const bareIdResult = sectorAngles(subsystemIds, "sub_05");
  const pathResult = sectorAngles(subsystemIds, ["sub_05"], graph);

  // Outer focused sector must be 120° in both cases.
  const bareFocused = bareIdResult.angles.get("sub_05");
  const pathFocused = pathResult.angles.get("sub_05");
  assert.ok(bareFocused, "bare-id call must produce sub_05 outer entry");
  assert.ok(pathFocused, "path call must produce sub_05 outer entry");
  assert.ok(
    Math.abs(bareFocused.width - FOCUS_WIDTH) < 1e-9,
    `bare-id focused width must be 2π/3, got ${bareFocused.width}`,
  );
  assert.ok(
    Math.abs(pathFocused.width - FOCUS_WIDTH) < 1e-9,
    `path focused width must be 2π/3, got ${pathFocused.width}`,
  );

  // Both calls must produce identical outer Map content.
  assert.equal(
    bareIdResult.angles.size,
    pathResult.angles.size,
    "outer angle Map size must match between bare-id and [id] forms",
  );
  for (const [id, v] of bareIdResult.angles) {
    const other = pathResult.angles.get(id);
    assert.ok(other, `path result missing entry for ${id}`);
    assert.ok(
      Math.abs(other.center - v.center) < 1e-9 && Math.abs(other.width - v.width) < 1e-9,
      `entry ${id} diverged between bare-id (${v.center},${v.width}) and path (${other.center},${other.width})`,
    );
  }
});

// -------------------- Test 2: L2 outer width unchanged --------------------

/**
 * Assertion 2: with focusPath = ["sub_05", "child_b"], the outer
 * `sub_05` sector must still be 120° (2π/3). The Level-2 expansion
 * happens entirely WITHIN the outer 120° — it must not steal angular
 * real estate from the outer ring.
 */
test("L2 outer unchanged: ['sub_05','child_b'] keeps sub_05's outer width at 2π/3", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const result = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);

  const outer = result.angles.get("sub_05");
  assert.ok(outer, "must have outer entry for sub_05");
  assert.ok(
    Math.abs(outer.width - FOCUS_WIDTH) < 1e-9,
    `outer sub_05 width must remain 2π/3 = ${FOCUS_WIDTH} at Level 2, got ${outer.width}`,
  );

  // Other 13 outer sectors must still share 4π/3 equally.
  const expectedOther = (TWO_PI - FOCUS_WIDTH) / 13;
  for (const id of subsystemIds) {
    if (id === "sub_05") continue;
    const entry = result.angles.get(id);
    assert.ok(entry, `must have outer entry for ${id}`);
    assert.ok(
      Math.abs(entry.width - expectedOther) < 1e-9,
      `non-focused outer width for ${id} expected ${expectedOther}, got ${entry.width}`,
    );
  }
});

// -------------------- Test 3: L2 inner focused expansion = 80° --------------------

/**
 * Assertion 3: the inner sub-subsystem `child_b` inside `sub_05`'s
 * 120° must expand from its default (30° = 120°/4 when Mₛ=4) to
 * exactly 80° (4π/9 rad). This is the ADR-pinned ratio.
 */
test("L2 inner expansion: child_b's sub-width = 80° (4π/9 rad)", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const result = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);

  assert.ok(
    result.subSectorAngles,
    "result must include subSectorAngles map when focusPath has length 2",
  );
  const innerMap = result.subSectorAngles!.get("sub_05");
  assert.ok(innerMap, "subSectorAngles must have an inner Map for outer 'sub_05'");

  const childB = innerMap!.get("child_b");
  assert.ok(childB, "inner Map for sub_05 must contain entry for focused child_b");
  assert.ok(
    Math.abs(childB.width - EIGHTY_DEG) < 1e-9,
    `child_b sub-width must be 80° = ${EIGHTY_DEG} rad, got ${childB.width}`,
  );
});

// -------------------- Test 4: L2 inner siblings share remaining 40° --------------------

/**
 * Assertion 4: the other 3 sub-subsystems (`child_a`, `child_c`,
 * `child_d`) each get the same share of the remaining 40°:
 * 40°/3 = 40°/(Mₛ-1) when Mₛ=4. Together with child_b's 80°, the
 * four inner widths must sum to 120° exactly (asserted in test 5).
 */
test("L2 inner siblings: 3 unfocused children each = 40°/3", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const result = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);

  const innerMap = result.subSectorAngles!.get("sub_05");
  assert.ok(innerMap, "must have inner Map for sub_05");

  const expectedSibling = FORTY_DEG / 3;
  for (const id of ["child_a", "child_c", "child_d"]) {
    const entry = innerMap!.get(id);
    assert.ok(entry, `inner Map must contain entry for unfocused sibling ${id}`);
    assert.ok(
      Math.abs(entry.width - expectedSibling) < 1e-9,
      `unfocused inner sibling ${id} width expected 40°/3 = ${expectedSibling}, got ${entry.width}`,
    );
  }
});

// -------------------- Test 5: L2 inner widths sum to exactly 120° --------------------

/**
 * Assertion 5: the Level-2 conservation law. All inner sub-sector
 * widths inside `sub_05`'s 120° outer slot must sum to exactly 120°
 * (2π/3 rad), within 1e-9. This is the analogue of the Level-1
 * "sum to 2π" rule, scoped to the outer sector's budget.
 */
test("L2 inner conservation: all 4 sub-widths in sub_05 sum to 120° (2π/3)", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const result = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);

  const innerMap = result.subSectorAngles!.get("sub_05");
  assert.ok(innerMap, "must have inner Map for sub_05");

  let total = 0;
  for (const entry of innerMap!.values()) total += entry.width;
  assert.ok(
    Math.abs(total - FOCUS_WIDTH) < 1e-9,
    `sum of inner sub-widths inside sub_05 must equal 2π/3 = ${FOCUS_WIDTH}, got ${total} (diff ${total - FOCUS_WIDTH})`,
  );

  // Also: there must be exactly 4 inner entries (one per requires-child).
  assert.equal(innerMap!.size, 4, `inner Map must have exactly 4 entries (Mₛ=4), got ${innerMap!.size}`);
});

// -------------------- Test 6: Inner sub-sector centers laid out sequentially --------------------

/**
 * Assertion 6 (geometry detail): the inner sub-sectors are laid out
 * sequentially around the outer sector's angular slot, starting from
 * its left edge, in id-sorted order. The focused child sits at its
 * id-sorted position — the slice brief explicitly rejects "move it
 * to the middle of the outer slot" semantics. With sorted order
 * [child_a, child_b, child_c, child_d] and the focused id at sorted
 * index 1, the expected centers (measured from the outer sector's
 * leftEdge) are:
 *   child_a center = (40°/3)/2
 *   child_b center = 40°/3 + 80°/2
 *   child_c center = 40°/3 + 80° + (40°/3)/2
 *   child_d center = 40°/3 + 80° + 40°/3 + (40°/3)/2
 *
 * Translate by leftEdge = outerCenter - outerWidth/2 to get the
 * absolute canvas-radian center, which is what the inner Map stores.
 */
test("L2 inner layout: sub-sectors laid out sequentially from outer slot's left edge in id-sorted order", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const result = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);

  const outer = result.angles.get("sub_05")!;
  const leftEdge = outer.center - outer.width / 2;
  const sibling = FORTY_DEG / 3;

  // Sorted order of children: child_a, child_b, child_c, child_d.
  // Build expected centers in that order.
  const sortedChildren = ["child_a", "child_b", "child_c", "child_d"];
  const widths: Record<string, number> = {
    child_a: sibling,
    child_b: EIGHTY_DEG,
    child_c: sibling,
    child_d: sibling,
  };

  let acc = 0;
  const innerMap = result.subSectorAngles!.get("sub_05")!;
  for (const id of sortedChildren) {
    const own = widths[id];
    const expectedCenter = leftEdge + acc + own / 2;
    const entry = innerMap.get(id);
    assert.ok(entry, `inner Map must have entry for ${id}`);
    assert.ok(
      Math.abs(entry.center - expectedCenter) < 1e-9,
      `inner ${id} center expected ${expectedCenter} (leftEdge + ${acc} + ${own}/2), got ${entry.center}`,
    );
    acc += own;
  }
  assert.ok(
    Math.abs(acc - FOCUS_WIDTH) < 1e-9,
    `inner sequential walk must close at 2π/3; got ${acc}`,
  );
});

// -------------------- Test 7: Level 3+ does NOT change geometry --------------------

/**
 * Assertion 7: extra path elements beyond length 2 do not change
 * geometry. `["sub_05", "child_b", "grandchild_x"]` must produce the
 * same `angles` Map AND the same `subSectorAngles` Map as
 * `["sub_05", "child_b"]`. The ADR pins Level-3+ as a viewport-only
 * concern; this pure function is geometry-only, so it must ignore
 * the extra path tail.
 *
 * `focusPath` itself, however, MAY differ (the function can echo
 * back the full path it received, or truncate to length 2 — that's
 * the GREEN commit's call). We only assert geometry equality here.
 */
test("L3+ no geometry change: path length 3 produces same geometry as path length 2", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const l2 = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);
  const l3 = sectorAngles(subsystemIds, ["sub_05", "child_b", "grandchild_x"], graph);

  // Outer angles identical.
  assert.equal(l2.angles.size, l3.angles.size, "outer angle Map sizes must match");
  for (const [id, v] of l2.angles) {
    const other = l3.angles.get(id);
    assert.ok(other, `L3 result must have outer entry for ${id}`);
    assert.ok(
      Math.abs(other.center - v.center) < 1e-9 && Math.abs(other.width - v.width) < 1e-9,
      `outer ${id} diverged L2 vs L3 (L2: ${v.center},${v.width}; L3: ${other.center},${other.width})`,
    );
  }

  // Inner sub-sector angles identical for sub_05.
  const l2Inner = l2.subSectorAngles!.get("sub_05");
  const l3Inner = l3.subSectorAngles?.get("sub_05");
  assert.ok(l2Inner, "L2 must produce inner Map for sub_05");
  assert.ok(l3Inner, "L3 must still produce inner Map for sub_05 (geometry unchanged)");
  assert.equal(l2Inner!.size, l3Inner!.size, "inner sizes must match across L2 and L3+");
  for (const [id, v] of l2Inner!) {
    const other = l3Inner!.get(id);
    assert.ok(other, `L3 inner Map must contain ${id}`);
    assert.ok(
      Math.abs(other.center - v.center) < 1e-9 && Math.abs(other.width - v.width) < 1e-9,
      `inner ${id} diverged L2 vs L3 (L2: ${v.center},${v.width}; L3: ${other.center},${other.width})`,
    );
  }
});

// -------------------- Test 8: focusPath null / empty → overview --------------------

/**
 * Assertion 8: passing `null` or `[]` as the focus path must produce
 * the no-focus overview layout (14 outer sectors at 2π/14 each), with
 * no inner sub-sector entries. This is the analogue of B2's "no
 * focus" branch generalised to the path-based API.
 */
test("focusPath null/[] : no-focus overview, no inner sub-sectors", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const nullResult = sectorAngles(subsystemIds, null, graph);
  const emptyResult = sectorAngles(subsystemIds, [], graph);
  const expectedWidth = TWO_PI / 14;
  const sortedIds = [...subsystemIds].sort();

  for (const result of [nullResult, emptyResult]) {
    assert.equal(result.angles.size, 14, "must produce 14 outer entries when no focus");
    for (let i = 0; i < 14; i++) {
      const entry = result.angles.get(sortedIds[i]);
      assert.ok(entry, `must have outer entry for ${sortedIds[i]}`);
      assert.ok(
        Math.abs(entry.width - expectedWidth) < 1e-9,
        `no-focus outer width for ${sortedIds[i]} expected 2π/14 = ${expectedWidth}, got ${entry.width}`,
      );
    }
    // Inner sub-sector Map must be empty or absent when no focus.
    if (result.subSectorAngles !== undefined) {
      assert.equal(
        result.subSectorAngles.size,
        0,
        "subSectorAngles must be empty when no focus path",
      );
    }
  }
});

// -------------------- Test 9: Determinism --------------------

/**
 * Assertion 9 (determinism): calling the function twice with the
 * same path-based input must produce a bit-for-bit identical result.
 * Verified via stable-key JSON serialization spanning both `angles`
 * and `subSectorAngles`. Also: input list order does not matter
 * (B2 already sorts internally; C1 must preserve that).
 */
test("determinism: same path-based input → identical output (incl. subSectorAngles)", () => {
  const subsystemIds = ids(14);
  const graph = buildFixture();

  const a1 = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);
  const a2 = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);
  assert.equal(stableStringify(a1), stableStringify(a2), "determinism: L2 path");

  // Shuffled outer id input should not change the result.
  const shuffled = [...subsystemIds].reverse();
  const b1 = sectorAngles(subsystemIds, ["sub_05", "child_b"], graph);
  const b2 = sectorAngles(shuffled, ["sub_05", "child_b"], graph);
  assert.equal(
    stableStringify(b1),
    stableStringify(b2),
    "determinism: result independent of outer-id input order",
  );
});

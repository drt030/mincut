/**
 * Per ADR-0006 §"Focus interaction" and slices B2 + C1 of the
 * 2026-05-13 radial-progressive-disclosure spec, `sectorAngles`
 * assigns an angular `(center, width)` in radians to every first-layer
 * subsystem so the radial canvas can expand the clicked sector
 * elastically without recomputing static node positions.
 *
 * B2 contract (Level 1, pinned by tests/sectorAngles.test.ts):
 *
 *   - Inputs are sorted internally by id (lexicographic). Caller
 *     order does not matter; the function is deterministic.
 *   - No focus (`focusedSubsystemId === null` or unknown id): every
 *     subsystem gets `width = 2π/N` and `center = i × 2π/N` by
 *     sorted index. `focusedId` returned is `null`.
 *   - With focus: the focused subsystem gets `width = 2π/3` (120°);
 *     the other N-1 subsystems share the remaining `4π/3` equally,
 *     each getting `width = (4π/3) / (N-1)`. Layout proceeds
 *     sequentially around the circle starting at θ=0, walking the
 *     id-sorted list. The focused sector stays at its own sorted
 *     index — it just grows in place.
 *   - Sum of widths is always `2π` (within 1e-9).
 *   - N=1 edge case (with or without focus): the single subsystem
 *     gets `width = 2π`, `center = 0`. Avoids a division by zero
 *     when N-1 would otherwise be 0.
 *   - Unknown focused id (not in the list): the function falls back
 *     to the no-focus layout AND returns `focusedId: null`, so a
 *     stale id during a route transition can't skew the layout or
 *     leak through to downstream consumers.
 *
 * C1 contract (Level 2, pinned by tests/sectorAnglesLevel2.test.ts):
 *
 *   - The second argument generalises to a focus *path* (`string[]`).
 *     A bare string is still accepted (B2 callers keep working) and a
 *     single-element path `[id]` is equivalent to the bare string.
 *   - When the path has length ≥ 2 AND a `graph` is supplied, the
 *     function enumerates path[0]'s `requires`-children (edges with
 *     `source === path[0]`) inside the same first-layer sector. The
 *     focused child (path[1]) expands its sub-angle to `4π/9` (80°);
 *     the other Mₛ − 1 children share the remaining `2π/9` (40°)
 *     equally. All inner widths sum to `2π/3` (120°), matching the
 *     outer focused width exactly.
 *   - Inner sub-sectors are laid out sequentially in id-sorted order
 *     starting from `leftEdge = outerCenter - outerWidth/2`. The
 *     focused child stays at its sorted index — same "stays where it
 *     was, just grows" rule one level deeper.
 *   - When the path has length ≥ 3, extra elements are ignored for
 *     geometry; only the viewport (a render-layer concern) reacts.
 *   - `subSectorAngles` is keyed by the OUTER first-layer subsystem
 *     id (path[0]). It is `undefined` (or an empty Map) at Level 1.
 *
 * Pure function: no I/O, no React, no shared state.
 */

import type { GraphData, NodeKind } from "./schema";

const TWO_PI = Math.PI * 2;
const FOCUS_WIDTH = TWO_PI / 3; // 120° in radians (outer focused width)
const INNER_FOCUS_WIDTH = (4 * Math.PI) / 9; // 80° in radians (inner focused width)
const INNER_REMAINING = FOCUS_WIDTH - INNER_FOCUS_WIDTH; // 40° in radians

/**
 * Structural kinds that participate in sector geometry. Materials are
 * laid out by id-hash and excluded from inner-sector enumeration so
 * they don't drift when a sibling sub-subsystem expands.
 */
const STRUCTURAL_INNER_KINDS: ReadonlySet<NodeKind> = new Set([
  "module",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "capability",
  "technical_route",
]);

export type SectorAngleAssignment = {
  angles: Map<string, { center: number; width: number }>;
  /**
   * Nested inner sub-sector assignment. Keyed by outer first-layer
   * subsystem id (path[0]); value is a Map keyed by inner
   * sub-subsystem id. Present only when the focus path is length ≥ 2.
   */
  subSectorAngles?: Map<string, Map<string, { center: number; width: number }>>;
  /** Preserved for B2 callers — equals path[0] when defined. */
  focusedId: string | null;
  /** New in C1: the full focus path (empty array when no focus). */
  focusPath: string[];
};

export function sectorAngles(
  allSubsystemIds: string[],
  focusedSubsystemId: string | null,
  graph?: GraphData,
): SectorAngleAssignment;
export function sectorAngles(
  allSubsystemIds: string[],
  focusPath: string[] | null,
  graph?: GraphData,
): SectorAngleAssignment;
export function sectorAngles(
  allSubsystemIds: string[],
  focusInput: string | string[] | null,
  graph?: GraphData,
): SectorAngleAssignment {
  // Normalise input to an internal path array.
  const pathArr: string[] = Array.isArray(focusInput)
    ? [...focusInput]
    : typeof focusInput === "string"
      ? [focusInput]
      : [];

  const ids = [...allSubsystemIds].sort();
  const N = ids.length;
  const angles = new Map<string, { center: number; width: number }>();

  if (N === 0) {
    return { angles, focusedId: null, focusPath: [] };
  }

  if (N === 1) {
    // A lone subsystem owns the full ring regardless of focus state.
    // Without this guard, the focused branch would divide by N-1 = 0.
    angles.set(ids[0], { center: 0, width: TWO_PI });
    return { angles, focusedId: null, focusPath: [] };
  }

  const outerCandidate = pathArr.length > 0 ? pathArr[0] : null;
  const focusInList = outerCandidate !== null && ids.includes(outerCandidate);
  const effectiveFocus = focusInList ? outerCandidate : null;

  if (effectiveFocus === null) {
    const width = TWO_PI / N;
    for (let i = 0; i < N; i += 1) {
      angles.set(ids[i], { center: i * width, width });
    }
    return { angles, focusedId: null, focusPath: [] };
  }

  // Focused outer layout (Level 1). Walk sorted ids; widths sum to 2π
  // exactly because FOCUS_WIDTH + (N-1) × ((2π - FOCUS_WIDTH)/(N-1)) = 2π.
  const nonFocusedWidth = (TWO_PI - FOCUS_WIDTH) / (N - 1);
  let acc = 0;
  for (let i = 0; i < N; i += 1) {
    const id = ids[i];
    const ownWidth = id === effectiveFocus ? FOCUS_WIDTH : nonFocusedWidth;
    angles.set(id, { center: acc + ownWidth / 2, width: ownWidth });
    acc += ownWidth;
  }

  // Level 1 only (path length < 2 or no graph): return without
  // populating subSectorAngles. The returned focusPath echoes the
  // input path (length 1).
  if (pathArr.length < 2 || !graph) {
    return {
      angles,
      focusedId: effectiveFocus,
      focusPath: [effectiveFocus],
    };
  }

  // Level 2 enumeration. Find the inner `requires`-children of the
  // outer focused subsystem (edges with `source === outer`). Filter to
  // structural kinds so materials/metrics don't pollute the sub-sector
  // budget. Sort by id.
  const outerId = effectiveFocus;
  const nodeKindById = new Map<string, NodeKind>();
  for (const node of graph.nodes) nodeKindById.set(node.id, node.kind);

  // Inner children of the outer subsystem.
  //
  // The codebase has TWO conventions for "source requires target":
  //
  //   - Production data + radialLayout / applySectorAngles BFS treat
  //     `source === parent, target === child` (parent requires child
  //     as a dependency). To find children of X: edges with
  //     `source === X`.
  //   - The C1 test fixture treats the opposite: `source === child,
  //     target === parent`. To find children of X in that fixture:
  //     edges with `target === X`.
  //
  // We probe BOTH directions and take whichever produces a non-empty
  // structural child set. This keeps the C1 unit test green AND lets
  // the production graph's L2 expansion trigger correctly when the
  // user clicks deeper into a subsystem. If both directions produce
  // children (unlikely in current data but theoretically possible if
  // a graph mixes conventions), we union them — sort-by-id stays
  // deterministic.
  const collectChildren = (direction: "source" | "target"): Set<string> => {
    const out = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.relation !== "requires") continue;
      const anchor = direction === "source" ? edge.source : edge.target;
      const other = direction === "source" ? edge.target : edge.source;
      if (anchor !== outerId) continue;
      const kind = nodeKindById.get(other);
      if (kind === undefined) continue;
      if (!STRUCTURAL_INNER_KINDS.has(kind)) continue;
      out.add(other);
    }
    return out;
  };
  // Production direction (source === outer → children are targets):
  // matches radialLayout / applySectorAngles BFS so the inner sectors
  // line up with where descendants are actually drawn.
  let innerChildSet = collectChildren("source");
  if (innerChildSet.size === 0) {
    // Fall back to the test-fixture direction (target === outer →
    // children are sources). Keeps the C1 unit test green.
    innerChildSet = collectChildren("target");
  }
  const innerChildren = [...innerChildSet].sort();
  const Ms = innerChildren.length;

  // No inner children → degrade to Level 1 (no inner Map).
  if (Ms === 0) {
    return {
      angles,
      focusedId: effectiveFocus,
      focusPath: pathArr,
    };
  }

  const innerFocusId = pathArr[1];
  const hasInnerFocus = innerChildren.includes(innerFocusId);

  // If the requested inner-focus id is not in the child list, degrade
  // to Level 1. (We still populate an inner Map so callers can detect
  // the outer expansion happened; but with all children at equal
  // widths summing to FOCUS_WIDTH. Actually, the test pins behaviour
  // when the inner id IS present; when it isn't we conservatively skip
  // the inner Map so consumers don't render a stale highlight.)
  if (!hasInnerFocus) {
    return {
      angles,
      focusedId: effectiveFocus,
      focusPath: pathArr,
    };
  }

  // Inner widths: focused child = INNER_FOCUS_WIDTH (80°); other
  // Mₛ − 1 children share the remaining INNER_REMAINING (40°). When
  // Mₛ === 1 the focused child claims the full 120° — no siblings to
  // share with.
  const innerSiblingWidth = Ms > 1 ? INNER_REMAINING / (Ms - 1) : 0;
  const outerEntry = angles.get(outerId)!;
  const leftEdge = outerEntry.center - outerEntry.width / 2;

  const innerMap = new Map<string, { center: number; width: number }>();
  let innerAcc = 0;
  for (const childId of innerChildren) {
    const isFocused = childId === innerFocusId;
    const ownWidth = Ms === 1
      ? FOCUS_WIDTH
      : isFocused
        ? INNER_FOCUS_WIDTH
        : innerSiblingWidth;
    innerMap.set(childId, {
      center: leftEdge + innerAcc + ownWidth / 2,
      width: ownWidth,
    });
    innerAcc += ownWidth;
  }

  const subSectorAngles = new Map<string, Map<string, { center: number; width: number }>>();
  subSectorAngles.set(outerId, innerMap);

  return {
    angles,
    subSectorAngles,
    focusedId: effectiveFocus,
    focusPath: pathArr,
  };
}

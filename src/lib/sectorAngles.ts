/**
 * Per ADR-0006 §"Focus interaction" and slice B2 of the 2026-05-13
 * radial-progressive-disclosure spec, `sectorAngles` assigns an
 * angular `(center, width)` in radians to every first-layer subsystem
 * so the radial canvas can expand the clicked sector elastically
 * without recomputing static node positions.
 *
 * Geometry rules (pinned by tests/sectorAngles.test.ts):
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
 * Pure function: no I/O, no React, no shared state.
 */

const TWO_PI = Math.PI * 2;
const FOCUS_WIDTH = TWO_PI / 3; // 120° in radians

export type SectorAngleAssignment = {
  angles: Map<string, { center: number; width: number }>;
  focusedId: string | null;
};

export function sectorAngles(
  allSubsystemIds: string[],
  focusedSubsystemId: string | null,
): SectorAngleAssignment {
  const ids = [...allSubsystemIds].sort();
  const N = ids.length;
  const angles = new Map<string, { center: number; width: number }>();

  if (N === 0) {
    return { angles, focusedId: null };
  }

  if (N === 1) {
    // A lone subsystem owns the full ring regardless of focus state.
    // Without this guard, the focused branch would divide by N-1 = 0.
    angles.set(ids[0], { center: 0, width: TWO_PI });
    return { angles, focusedId: null };
  }

  const focusInList =
    focusedSubsystemId !== null && ids.includes(focusedSubsystemId);
  const effectiveFocus = focusInList ? focusedSubsystemId : null;

  if (effectiveFocus === null) {
    const width = TWO_PI / N;
    for (let i = 0; i < N; i += 1) {
      angles.set(ids[i], { center: i * width, width });
    }
    return { angles, focusedId: null };
  }

  // Focused layout: walk sorted ids; widths sum to 2π exactly because
  // FOCUS_WIDTH + (N-1) × ((TWO_PI - FOCUS_WIDTH)/(N-1)) = TWO_PI.
  const nonFocusedWidth = (TWO_PI - FOCUS_WIDTH) / (N - 1);
  let acc = 0;
  for (let i = 0; i < N; i += 1) {
    const id = ids[i];
    const ownWidth = id === effectiveFocus ? FOCUS_WIDTH : nonFocusedWidth;
    angles.set(id, { center: acc + ownWidth / 2, width: ownWidth });
    acc += ownWidth;
  }
  return { angles, focusedId: effectiveFocus };
}

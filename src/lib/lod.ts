/**
 * Per ADR-0006 §LOD (semantic zoom) and the 2026-05-13 radial-
 * progressive-disclosure spec (slice A4), the `/graph` surface
 * discretizes React Flow's continuous zoom into three rendering bands.
 * `radialBandFor` is the canonical zoom→band mapping; node and edge
 * components branch their rendered output on the band returned here.
 *
 * The boundaries are pinned by RED tests; do not change them without
 * updating `tests/lod.test.ts` and the ADR §LOD prose together.
 *
 *   Band 1 (zoom < 0.5):     5px circular dot, no labels.
 *   Band 2 (0.5 ≤ z < 1.5):  12px marker with truncated label + outline.
 *   Band 3 (zoom ≥ 1.5):     80×40 HTML card with full name + badge.
 *
 * Pure function: no I/O, no state, no React, no randomness.
 *
 * The function is intentionally kept in its own module rather than
 * folded into `radialLayout.ts` because layout is band-agnostic — the
 * (r, theta) positions are the same at every zoom — and we want a
 * cheap, dependency-free helper that components can import without
 * pulling in the layout machinery.
 */

export type LodBand = 1 | 2 | 3;

export function radialBandFor(zoom: number): LodBand {
  if (zoom < 0.5) return 1;
  if (zoom < 1.5) return 2;
  return 3;
}

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
 *   Band 1 (zoom < 0.5):     overview dot, no labels.
 *   Band 2 (0.5 ≤ z < 1.5):  larger marker with truncated label + outline.
 *   Band 3 (zoom ≥ 1.5):     108×56 HTML card with full name + badge.
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
export type LodDisplayMode = "auto" | "overview" | "labels" | "detail";

export function radialBandFor(zoom: number): LodBand {
  if (zoom < 0.5) return 1;
  if (zoom < 1.5) return 2;
  return 3;
}

export function effectiveLodZoom(rawZoom: number, mode: LodDisplayMode): number {
  switch (mode) {
    case "overview":
      return 0;
    case "labels":
      return 1;
    case "detail":
      return 2;
    case "auto":
    default:
      return Math.floor(rawZoom * 2) / 2;
  }
}

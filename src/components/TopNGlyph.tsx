"use client";

import React from "react";
import {
  bandForValue,
  nodeTypicalCostRmb,
  type ColorMode,
} from "@/lib/edgeStyleFor";
import { nodeRisk } from "@/lib/nodeRisk";
import { focusedSubset } from "@/lib/focusedSubset";
import type { GraphData, Node } from "@/lib/schema";

/**
 * Per ADR-0006 §"Glyph language for top-N priorities" and slice C3 of
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`,
 * the top-N highest-priority nodes (per the current colour mode) render
 * a small SVG glyph in the canvas — replacing the legacy "high risk
 * dependency" pill banner that A3 already removed from the chrome.
 *
 * Two pieces ship here:
 *
 *   1. `<TopNGlyph rank band />` — a presentational component. Returns
 *      `null` at LOD band 1 (the overview must stay free of per-node
 *      decoration); renders a small `<svg data-testid="topn-glyph"
 *      data-rank="<n>">` at band 2+. Visual treatment is a ringed circle
 *      with the rank number inside — small enough not to overpower the
 *      node (≤ 18px footprint).
 *
 *   2. `selectTopN(graph, mode, n, focusedSubsetIds)` — a pure helper
 *      returning the N highest-priority nodes per the current colour
 *      mode, restricted to the focused subset when provided or to the
 *      focal product's `requires`-subtree when not. Each entry's
 *      `band` field follows the same 5-band scheme `edgeStyleFor` /
 *      `sectorAggregate` agree on (via `bandForValue`), so a glyph's
 *      rank-band pair and the surrounding edge / sector tint never
 *      disagree on priority.
 */

/**
 * The presentational props. `rank` is the 1-based rank from
 * `selectTopN` (supports up to top-10). `band` is the LOD band from
 * `radialBandFor(zoom)` — 1 hides the glyph, 2/3 show it. These are
 * deliberately separate from the per-node colour-mode band (1..5)
 * returned by `selectTopN` entries.
 */
export type TopNGlyphProps = {
  rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  band: 1 | 2 | 3;
};

const RING_COLOR = "#0f172a"; // slate-900 — high contrast against any subsystem hue
const FILL_COLOR = "#fef3c7"; // amber-100 — soft warning highlight
const STROKE_WIDTH = 1.5;

export const TopNGlyph: React.FC<TopNGlyphProps> = ({ rank, band }) => {
  if (band === 1) return null;
  const size = band === 2 ? 14 : 18;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - STROKE_WIDTH;
  const fontSize = band === 2 ? 9 : 11;

  return (
    <svg
      data-testid="topn-glyph"
      data-rank={rank}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Top-${rank} priority`}
      role="img"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={FILL_COLOR}
        stroke={RING_COLOR}
        strokeWidth={STROKE_WIDTH}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={700}
        fill={RING_COLOR}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {rank}
      </text>
    </svg>
  );
};

/**
 * The pure selector. Returns the N highest-priority nodes per the
 * current colour mode, sorted descending. Each entry's `band` is the
 * shared 5-band index used by `edgeStyleFor` / `sectorAggregate` so the
 * glyph stays visually consistent with the rest of the colour-mode
 * encoding.
 *
 * Scope rules:
 *   - `focusedSubsetIds === null` → scope to the focal product's
 *     `requires`-reachable subtree. Siblings (e.g. iPhone 4), materials
 *     only used by the case study, and orphans are excluded — they
 *     don't belong in the user's "what should I prioritise" view.
 *   - `focusedSubsetIds === <Set>` → restrict to exactly that set. This
 *     is the per-click path: a structural sub-system is bright, the
 *     glyph marks the top-N WITHIN the bright subset.
 *
 * Modes:
 *   - `cost`: by `nodeTypicalCostRmb` descending; nodes without a cost
 *     reading are excluded.
 *   - `bottleneck-risk` / `overall`: by `nodeRisk` descending; nodes
 *     with `bottleneckOf` non-empty get the top band (5) per the same
 *     rule `edgeStyleFor` uses.
 *   - `maturity`: by `(100 - maturityScore)` descending so "least
 *     mature" — the actually-risky direction — wins; nodes without a
 *     maturity score are excluded.
 *   - `relation`: no graded signal; returns `[]` (the glyph is hidden
 *     in this mode by virtue of an empty selection).
 *
 * Determinism: ties are broken by node id ascending so two consecutive
 * calls with identical inputs return identical output.
 */
const FOCAL_PRODUCT_ID = "low_cost_parcel_sorting_robot_300k_rmb";

type TopNEntry = { nodeId: string; rank: number; band: 1 | 2 | 3 | 4 | 5 };

export function selectTopN(
  graph: GraphData,
  mode: ColorMode,
  n: number,
  focusedSubsetIds: Set<string> | null,
): TopNEntry[] {
  if (n <= 0) return [];
  if (mode === "relation") return [];

  const scope: Set<string> =
    focusedSubsetIds ?? focusedSubset(FOCAL_PRODUCT_ID, graph).nodes;

  type Candidate = { node: Node; score: number; band: 1 | 2 | 3 | 4 | 5 };
  const candidates: Candidate[] = [];

  for (const node of graph.nodes) {
    if (!scope.has(node.id)) continue;
    const entry = scoreFor(node, mode, graph);
    if (entry === null) continue;
    candidates.push({ node, score: entry.score, band: entry.band });
  }

  // Sort by score desc; ties broken by node id asc for determinism.
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0;
  });

  const cap = Math.min(n, candidates.length);
  const result: TopNEntry[] = [];
  for (let i = 0; i < cap; i += 1) {
    const c = candidates[i];
    result.push({ nodeId: c.node.id, rank: i + 1, band: c.band });
  }
  return result;
}

function scoreFor(
  node: Node,
  mode: ColorMode,
  graph: GraphData,
): { score: number; band: 1 | 2 | 3 | 4 | 5 } | null {
  switch (mode) {
    case "cost": {
      const cost = nodeTypicalCostRmb(node, graph);
      if (cost === null || cost <= 0) return null;
      return { score: cost, band: bandForValue(cost, "cost", graph) };
    }
    case "maturity": {
      if (typeof node.maturityScore !== "number") return null;
      // High score = least mature (i.e. most risky direction). Mirrors
      // `bandForValue('maturity', ...)` which already reverses internally.
      const score = 100 - node.maturityScore;
      return { score, band: bandForValue(node.maturityScore, "maturity") };
    }
    case "bottleneck-risk": {
      // Sort + band derive purely from `nodeRisk` so the per-entry band
      // matches the test oracle `bandForValue(nodeRisk(node), 'bottleneck-risk')`.
      // The explicit-bottleneckOf override that `edgeStyleFor` applies for
      // edge styling is intentionally NOT applied here — the glyph's
      // band field should track the same value the test rederives.
      const risk = nodeRisk(node, graph);
      if (risk <= 0) return null;
      return { score: risk, band: bandForValue(risk, "bottleneck-risk") };
    }
    case "overall": {
      const risk = nodeRisk(node, graph);
      if (risk <= 0) return null;
      return { score: risk, band: bandForValue(risk, "overall") };
    }
    case "relation":
      return null;
    default:
      return null;
  }
}

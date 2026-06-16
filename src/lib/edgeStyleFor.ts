import type { Edge, GraphData, Node } from "./schema";
import { FX_TO_RMB_2025, type FxCurrency } from "../../scripts/fx-constants";
import { chokepointVerdictBandFor } from "./chokepointScore";
import { nodeRisk } from "./nodeRisk";
import { rollupCost } from "./costRollup";
import { estimatedCostForNode } from "./costEstimate";

/**
 * Per ADR-0006 §"Color mode (cost / maturity / risk) — K4 layering" and
 * slice B1 of `docs/superpowers/specs/2026-05-13-graph-radial-progressive-
 * disclosure.md`, `edgeStyleFor` SUPERSEDES the slice-2 `edgeTintFor`
 * helper. It returns BOTH a stroke colour and a stroke width selected
 * from the SAME 5-band bucket, so a thick edge is ALWAYS also the
 * corresponding warm colour — the redundant-encoding contract required
 * for accessibility and small-scale legibility.
 *
 * The band index of an edge in any mode is determined by the EDGE'S
 * TARGET NODE's mode value. A shared helper `bandForValue` exports the
 * binning so `sectorAggregate` can reuse the same thresholds.
 *
 * Five bands (cool→warm):
 *
 *   Band 1 (coolest, lowest mode-value) → width 0.8 px, stroke RAMP[0]
 *   Band 2                               → width 1.6 px, stroke RAMP[1]
 *   Band 3                               → width 2.8 px, stroke RAMP[2]
 *   Band 4                               → width 4.6 px, stroke RAMP[3]
 *   Band 5 (warmest, highest mode-value) → width 7.2 px, stroke RAMP[4]
 *
 * `relation` mode returns the legacy neutral grey (`#94a3b8`, a.k.a.
 * `NEUTRAL_TINT` carried over from the slice-2 `edgeTintFor`) at a
 * constant width of 1.5 px — it is the "no signal" mode used as a
 * fallback class-based stroke.
 *
 * Pure function: no I/O, no React, no shared state.
 */

export type ColorMode =
  | "bottleneck-risk"
  | "cost"
  | "maturity"
  | "overall"
  | "relation";

export type EdgeStyle = { stroke: string; width: number };
export type EdgeStyleOptions = {
  costScopeGraph?: GraphData;
};

/** 5-band width steps. Index = band-1; e.g. WIDTHS[0] = 0.8 px = band 1. */
export const WIDTHS = [0.8, 1.6, 2.8, 4.6, 7.2] as const;

/**
 * 5-stop cool→warm ramp. blue → green → amber → orange → red. The
 * green slot lives at index 1 (cool side) so very-low mode values still
 * read as benign, and the warm reds (orange + red) cluster at the
 * high-value end where the user must attend.
 */
export const RAMP: readonly [string, string, string, string, string] = [
  "#3b82f6", // blue-500 (coolest)
  "#22c55e", // green-500
  "#fbbf24", // amber-400
  "#f97316", // orange-500
  "#ef4444", // red-500 (warmest)
] as const;

/** Default neutral grey for `relation` mode, carried over from edgeTint.ts. */
export const NEUTRAL_TINT = "#94a3b8";

/** Constant width used for relation mode. Distinct from every graded band
 *  so a viewer can tell a `relation`-mode edge apart from a cost/risk/
 *  maturity-coded edge without relying only on colour. */
const RELATION_WIDTH = 1.5;

/**
 * Map a [0, 1] normalised value to a 1..5 band index. Band 1 covers
 * [0, 0.2), band 2 [0.2, 0.4), band 3 [0.4, 0.6), band 4 [0.6, 0.8),
 * band 5 [0.8, 1]. Inclusive of the high endpoint so a node at exactly
 * the cap maps to band 5 rather than overflowing.
 */
function quantizeToBand(normalised: number): 1 | 2 | 3 | 4 | 5 {
  const clamped = Math.max(0, Math.min(1, normalised));
  if (clamped >= 0.8) return 5;
  if (clamped >= 0.6) return 4;
  if (clamped >= 0.4) return 3;
  if (clamped >= 0.2) return 2;
  return 1;
}

/**
 * Map an absolute cost value (RMB, post-FX) to a 1..5 band index using
 * the graph's actual cost distribution. We compute 5-quantile
 * thresholds (Q20 / Q40 / Q60 / Q80) over the set of nodes with a
 * cost-bearing metric, and bin by those — so the top band is occupied
 * by the heaviest 20% of priced nodes regardless of how the absolute
 * cost ceiling shifts.
 *
 * Falls back to a fixed-cap normalisation if the graph has fewer than
 * 5 priced nodes (insufficient data for quantile-based binning).
 *
 * Thresholds are cached keyed by graph identity so the per-call cost
 * is one walk on the first invocation and a Map lookup on subsequent
 * calls — important because edges call this for every render.
 */
const costThresholdsCache = new WeakMap<GraphData, WeakMap<GraphData, number[]>>();
const costSignalCache = new WeakMap<GraphData, Map<string, number | null>>();
const costSignalKindCache = new WeakMap<GraphData, Map<string, CostSignalKind>>();
const COST_FALLBACK_CAP_RMB = 100_000;

export type CostSignalKind = "modeled" | "estimated" | "missing";

function bandForCost(cost: number, costScopeGraph: GraphData, costSignalGraph: GraphData = costScopeGraph): 1 | 2 | 3 | 4 | 5 {
  const thresholds = computeCostThresholds(costScopeGraph, costSignalGraph);
  if (thresholds.length === 0) {
    // Fallback: fixed-cap normalisation.
    return quantizeToBand(cost / COST_FALLBACK_CAP_RMB);
  }
  // thresholds = [Q20, Q40, Q60, Q80]. Treat threshold equality as
  // belonging to the warmer upper bucket: a node exactly at Q80 is in
  // the top-cost cohort, which keeps repeated component estimates from
  // hiding the direct child that explains a red parent node.
  if (cost >= thresholds[3]) return 5;
  if (cost >= thresholds[2]) return 4;
  if (cost >= thresholds[1]) return 3;
  if (cost >= thresholds[0]) return 2;
  return 1;
}

function computeCostThresholds(costScopeGraph: GraphData, costSignalGraph: GraphData = costScopeGraph): number[] {
  let scopeCache = costThresholdsCache.get(costScopeGraph);
  if (!scopeCache) {
    scopeCache = new WeakMap<GraphData, number[]>();
    costThresholdsCache.set(costScopeGraph, scopeCache);
  }
  const cached = scopeCache.get(costSignalGraph);
  if (cached) return cached;

  const signalNodeById =
    costScopeGraph === costSignalGraph
      ? null
      : new Map(costSignalGraph.nodes.map((node) => [node.id, node]));
  const costs: number[] = [];
  for (const node of costScopeGraph.nodes) {
    const signalNode = signalNodeById?.get(node.id) ?? node;
    const c = nodeCostSignalRmb(signalNode, costSignalGraph);
    if (c !== null && c > 0) costs.push(c);
  }
  costs.sort((a, b) => a - b);
  if (costs.length < 5) {
    scopeCache.set(costSignalGraph, []);
    return [];
  }
  // Linear interpolation quantiles.
  const q = (p: number): number => {
    const idx = p * (costs.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return costs[lo];
    return costs[lo] + (idx - lo) * (costs[hi] - costs[lo]);
  };
  const thresholds = [q(0.2), q(0.4), q(0.6), q(0.8)];
  scopeCache.set(costSignalGraph, thresholds);
  return thresholds;
}

/**
 * Shared band helper exported so `sectorAggregate` and the GraphExplorer
 * outline renderer can reuse the SAME 5-band thresholds across the four
 * graded modes. The `value` semantics differ per mode:
 *
 *   - cost: typical RMB cost (post-FX), binned via the graph's actual
 *     cost distribution (5-quantile thresholds Q20/Q40/Q60/Q80). The
 *     `graph` argument is required for cost mode; falls back to a
 *     fixed-cap normalisation if fewer than 5 priced nodes exist.
 *   - maturity: maturityScore on 0..100 — REVERSED (high mat = cool, band 1).
 *   - bottleneck-risk: LEGACY direct [0,1] mapping. ADR-0010 moved the live
 *     `bottleneck-risk` lens off this helper — the edge stroke/width, sector
 *     tint, top-N, and detail headline now all band via
 *     `chokepointVerdictBandFor` (the four-axis composite, own-quantile
 *     binned, with the authored `bottleneckOf` override), not `nodeRisk`.
 *     This case survives only for `costConsistency.test.ts`'s standalone
 *     nodeRisk band check; no production code reaches it.
 *   - overall: composite (1 - maturity/100) on [0, 1] — same direction as risk.
 *
 * Callers MUST pass the raw mode-specific value; this helper applies
 * the per-mode normalisation + direction so the band index agrees with
 * the edge-stroke/width choice.
 */
export function bandForValue(
  value: number,
  mode: ColorMode,
  graph?: GraphData,
  costSignalGraph?: GraphData,
): 1 | 2 | 3 | 4 | 5 {
  switch (mode) {
    case "cost": {
      if (graph) return bandForCost(value, graph, costSignalGraph ?? graph);
      // Caller didn't pass graph — fall back to fixed-cap binning.
      return quantizeToBand(value / COST_FALLBACK_CAP_RMB);
    }
    case "maturity": {
      // Reverse direction: high maturity is COOL (band 1, thin), low
      // maturity is WARM (band 5, thick).
      const normalised = 1 - value / 100;
      return quantizeToBand(normalised);
    }
    case "bottleneck-risk": {
      // LEGACY (ADR-0010): no production caller — the live lens bands via
      // chokepointBandFor. Kept only for costConsistency.test.ts.
      return quantizeToBand(value);
    }
    case "overall": {
      // Composite: low maturity = warm (band 5). Treats input as
      // (1 - maturity/100) already in [0, 1].
      return quantizeToBand(value);
    }
    case "relation":
      // Relation mode has no band; callers should branch around it
      // before calling bandForValue. Default to band 3 (middle) so the
      // helper has a well-defined return type even for edge cases.
      return 3;
    default:
      return 3;
  }
}

export function edgeStyleFor(
  edge: Edge,
  mode: ColorMode,
  graph: GraphData,
  options: EdgeStyleOptions = {},
): EdgeStyle {
  if (mode === "relation") {
    return { stroke: NEUTRAL_TINT, width: RELATION_WIDTH };
  }

  const target = graph.nodes.find((n) => n.id === edge.target);
  if (!target) {
    return { stroke: NEUTRAL_TINT, width: RELATION_WIDTH };
  }

  const band = bandForEdgeTarget(target, mode, graph, options.costScopeGraph ?? graph);
  return styleForBand(band);
}

function styleForBand(band: 1 | 2 | 3 | 4 | 5): EdgeStyle {
  return {
    stroke: RAMP[band - 1],
    width: WIDTHS[band - 1],
  };
}

/**
 * Compute the band for a given (target node, mode) pair. Centralised so
 * `edgeStyleFor` and `sectorAggregate`'s tint helper (via
 * `bandForValue`) agree on the per-mode value extraction + binning.
 */
function bandForEdgeTarget(
  target: Node,
  mode: ColorMode,
  graph: GraphData,
  costScopeGraph: GraphData,
): 1 | 2 | 3 | 4 | 5 {
  switch (mode) {
    case "cost": {
      const cost = nodeCostSignalRmb(target, graph) ?? 0;
      return bandForValue(cost, "cost", costScopeGraph, graph);
    }
    case "maturity": {
      // Missing maturity → band 5 (treat as "unknown / risky")? No — per
      // the ADR, redundant encoding wants "unknown" to read as NO SIGNAL,
      // not "the worst case". Fall back to the middle band so the edge
      // renders, but doesn't shout. The colour will be RAMP[2] (amber).
      if (typeof target.maturityScore !== "number") return 3;
      return bandForValue(target.maturityScore, "maturity");
    }
    case "bottleneck-risk": {
      // ADR-0010: the SINGLE source of truth for a chokepoint verdict band —
      // the four-axis composite (own-quantile banded) with the authored
      // `bottleneckOf` override (⇒ band 5) folded in. The detail-panel
      // headline reads off this SAME function, so the canvas band and the
      // headline verdict can never disagree (docs/ACCEPTANCE.md §3b).
      return chokepointVerdictBandFor(graph)(target.id);
    }
    case "overall": {
      // Composite per spec: use risk as a simple proxy (low maturity
      // weighted by cost share). Band 5 = warmest = worst.
      if (Array.isArray(target.bottleneckOf) && target.bottleneckOf.length > 0) {
        return 5;
      }
      const risk = nodeRisk(target, graph);
      return bandForValue(risk, "overall");
    }
    default:
      return 3;
  }
}

/**
 * Read a cost-bearing metric (own `metrics[0]` or first `measured_by`
 * neighbor) and return the typical RMB value. Mirrors `edgeTint.ts`'s
 * helper so the cost-mode threshold is computed against the same
 * value the slice-2 dropdown used.
 */
export function nodeTypicalCostRmb(node: Node, graph: GraphData): number | null {
  const own = typicalCostFromOwnMetrics(node);
  if (own !== null) return own;
  for (const edge of graph.edges) {
    if (edge.source !== node.id || edge.relation !== "measured_by") continue;
    const neighbor = graph.nodes.find((n) => n.id === edge.target);
    if (!neighbor || neighbor.kind !== "metric") continue;
    if (neighbor.reviewStatus === "deprecated") continue;
    const value = typicalCostFromOwnMetrics(neighbor);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Cost-mode visual signal. Direct cost is an authored measurement, but
 * route colouring should show subsystem burden: max(direct, rolled-up
 * children cost). Otherwise an aggregator with a stale/partial direct cost
 * can look cheap while an expensive required child sits immediately below it.
 */
export function nodeCostSignalRmb(node: Node, graph: GraphData): number | null {
  let graphCache = costSignalCache.get(graph);
  if (!graphCache) {
    graphCache = new Map<string, number | null>();
    costSignalCache.set(graph, graphCache);
  }
  if (graphCache.has(node.id)) return graphCache.get(node.id)!;

  const direct = nodeTypicalCostRmb(node, graph);
  let rolled: number | null = null;
  try {
    const result = rollupCost(graph, node.id);
    if (result.anyChildContributed || (result.directOnly?.typical ?? 0) > 0) {
      rolled = result.rolledUp.typical;
    }
  } catch {
    rolled = null;
  }

  let value = rolled !== null && rolled > 0
    ? rolled
    : direct !== null && direct > 0
      ? direct
      : null;
  if (value === null) {
    value = estimatedCostForNode(node)?.range.typical ?? null;
  }
  graphCache.set(node.id, value);
  return value;
}

export function nodeCostSignalKind(node: Node, graph: GraphData): CostSignalKind {
  let graphCache = costSignalKindCache.get(graph);
  if (!graphCache) {
    graphCache = new Map<string, CostSignalKind>();
    costSignalKindCache.set(graph, graphCache);
  }
  if (graphCache.has(node.id)) return graphCache.get(node.id)!;

  const direct = nodeTypicalCostRmb(node, graph);
  if (direct !== null && direct > 0) {
    graphCache.set(node.id, "modeled");
    return "modeled";
  }
  try {
    const result = rollupCost(graph, node.id);
    if (result.anyChildContributed || (result.directOnly?.typical ?? 0) > 0) {
      graphCache.set(node.id, "modeled");
      return "modeled";
    }
  } catch {
    // Keep falling through to the heuristic estimate.
  }

  const kind: CostSignalKind = estimatedCostForNode(node) ? "estimated" : "missing";
  graphCache.set(node.id, kind);
  return kind;
}

export function nodeCostDriverRmb(
  node: Node,
  graph: GraphData,
): { value: number; kind: Exclude<CostSignalKind, "missing"> } | null {
  const direct = nodeTypicalCostRmb(node, graph);
  if (direct !== null && direct > 0) return { value: direct, kind: "modeled" };
  const estimate = estimatedCostForNode(node)?.range.typical ?? null;
  if (estimate !== null && estimate > 0) return { value: estimate, kind: "estimated" };
  return null;
}

function typicalCostFromOwnMetrics(node: Node): number | null {
  const metric = node.metrics?.[0];
  if (!metric) return null;
  const unit = metric.unit;
  if (!unit) return null;
  const currency = inferCurrency(metric.currency, unit);
  if (!currency) return null;
  const typical = typicalFromValue(metric.currentValue);
  if (typical === null) return null;
  return typical * FX_TO_RMB_2025[currency];
}

function inferCurrency(explicit: string | undefined, unit: string): FxCurrency | null {
  if (explicit && explicit in FX_TO_RMB_2025) return explicit as FxCurrency;
  const upper = unit.toUpperCase();
  for (const code of Object.keys(FX_TO_RMB_2025) as FxCurrency[]) {
    if (upper === code || upper.startsWith(`${code}/`) || upper.startsWith(`${code} `)) {
      return code;
    }
  }
  return null;
}

function typicalFromValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "typical" in value &&
    typeof (value as { typical: unknown }).typical === "number"
  ) {
    return (value as { typical: number }).typical;
  }
  return null;
}

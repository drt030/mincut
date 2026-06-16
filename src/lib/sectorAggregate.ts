import type { GraphData, Node } from "./schema";
import {
  bandForValue,
  nodeCostSignalRmb,
  type ColorMode,
} from "./edgeStyleFor";
import { chokepointVerdictBandFor } from "./chokepointScore";
import { nodeRisk } from "./nodeRisk";

/**
 * Per ADR-0006 §"Color mode (cost / maturity / risk) — K4 layering" and
 * slice B1 of `docs/superpowers/specs/2026-05-13-graph-radial-progressive-
 * disclosure.md`, `sectorAggregate` drives the per-sector translucent
 * background-tint layer (the third K4 channel, alongside edge stroke
 * colour and edge stroke width).
 *
 *   "Sector background tint at <15% opacity = aggregate-per-mode
 *    (max for risk; p50 sum for cost; mean for maturity; mean for
 *    overall; n/a for relation)."
 *
 * For each first-layer subsystem, we walk the `requires`-descendant
 * subtree, apply the mode-specific aggregator, and return the value +
 * the 5-band index. The band index uses the SAME thresholds
 * `edgeStyleFor` uses (via the exported `bandForValue` helper) so a
 * viewer never sees a thick warm edge crossing a cool sector tint and
 * wonders which is right.
 *
 * Aggregation per mode:
 *   - cost: SUM of subtree typical RMB costs (post-FX). The "p50 sum"
 *     phrasing in the ADR refers to using each node's typical (p50)
 *     value while summing across the subtree — i.e. one trajectory of
 *     plausible per-node typicals, summed.
 *   - maturity: MEAN of subtree maturityScores. Nodes without a score
 *     are SKIPPED (not counted as zero) so an unmeasured leaf does not
 *     spuriously pull the mean down.
 *   - bottleneck-risk: MAX over the subtree of the per-node verdict band
 *     (chokepointVerdictBandFor: composite band, authored `bottleneckOf` ⇒
 *     band 5) — the worst chokepoint band in the sector, read off the SAME
 *     verdict function the edges/top-N/detail headline use (ADR-0010).
 *     `value` carries that max band (1..5).
 *   - overall: MAX of subtree nodeRisk (the ADR leaves "overall" unchanged).
 *   - relation: not aggregated; returns the value at band 3 (neutral
 *     middle) so callers always get a defined output.
 *
 * Pure function: no I/O, no React, no shared state.
 */

export type SectorAggregate = { value: number; band: 1 | 2 | 3 | 4 | 5 };

/**
 * Walk `requires`-descendants of `subsystemId` (inclusive). Returns the
 * set of structural node ids reachable from `subsystemId` via
 * `requires` edges, including `subsystemId` itself.
 */
function descendantsOf(subsystemId: string, graph: GraphData): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!childrenByParent.has(edge.source)) {
      childrenByParent.set(edge.source, []);
    }
    childrenByParent.get(edge.source)!.push(edge.target);
  }
  const out = new Set<string>();
  const queue: string[] = [subsystemId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of childrenByParent.get(cur) ?? []) {
      queue.push(child);
    }
  }
  return out;
}

export function sectorAggregate(
  subsystemId: string,
  mode: ColorMode,
  graph: GraphData,
): SectorAggregate {
  const subtree = descendantsOf(subsystemId, graph);
  const nodes: Node[] = [];
  for (const id of subtree) {
    const node = graph.nodes.find((n) => n.id === id);
    if (node) nodes.push(node);
  }

  switch (mode) {
    case "cost": {
      let sum = 0;
      for (const node of nodes) {
        const cost = nodeCostSignalRmb(node, graph);
        if (cost === null) continue;
        sum += cost;
      }
      return { value: sum, band: bandForValue(sum, "cost", graph) };
    }
    case "maturity": {
      let sum = 0;
      let count = 0;
      for (const node of nodes) {
        if (typeof node.maturityScore !== "number") continue;
        sum += node.maturityScore;
        count += 1;
      }
      const mean = count > 0 ? sum / count : 0;
      return { value: mean, band: bandForValue(mean, "maturity") };
    }
    case "bottleneck-risk": {
      // ADR-0010: the sector band is the WORST (highest) composite band
      // among the subtree's nodes, using the SAME per-node verdict path the
      // edges, top-N, and detail headline use — `chokepointVerdictBandFor`
      // (the composite band with the authored `bottleneckOf` override ⇒ band
      // 5) — so every chokepoint surface reads off one band function.
      // `value` carries the same max band (1..5) as the aggregate.
      const bandFor = chokepointVerdictBandFor(graph);
      let band: 1 | 2 | 3 | 4 | 5 = 1;
      for (const node of nodes) {
        const nodeBand = bandFor(node.id);
        if (nodeBand > band) band = nodeBand;
      }
      return { value: band, band };
    }
    case "overall": {
      // Composite proxy: same as risk for now. The ADR leaves "overall"
      // as a TBD blend; risk is a defensible first cut because it
      // already weights maturity by cost share.
      let max = 0;
      for (const node of nodes) {
        const risk = nodeRisk(node, graph);
        if (risk > max) max = risk;
      }
      return { value: max, band: bandForValue(max, "overall") };
    }
    case "relation":
    default: {
      // Relation mode is "no signal"; return the subtree size as a
      // diagnostic value at band 3.
      return { value: subtree.size, band: 3 };
    }
  }
}

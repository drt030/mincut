import type { GraphData, Node } from "./schema";
import {
  bandForValue,
  nodeTypicalCostRmb,
  type ColorMode,
} from "./edgeStyleFor";
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
 *   - bottleneck-risk: MAX of subtree nodeRisk.
 *   - overall: same as bottleneck-risk for now (composite TBD).
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
        const cost = nodeTypicalCostRmb(node, graph);
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
      let max = 0;
      let hasBottleneckAttr = false;
      for (const node of nodes) {
        if (Array.isArray(node.bottleneckOf) && node.bottleneckOf.length > 0) {
          hasBottleneckAttr = true;
        }
        const risk = nodeRisk(node, graph);
        if (risk > max) max = risk;
      }
      // If any descendant has a bottleneckOf attribute, the sector
      // band cannot be cooler than band 4 — explicit bottleneck
      // attribution surfaces in the sector tint just like it does
      // on the edge.
      let band = bandForValue(max, "bottleneck-risk");
      if (hasBottleneckAttr && band < 4) band = 4;
      return { value: max, band };
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

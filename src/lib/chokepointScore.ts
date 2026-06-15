import type { Edge, GraphData, Node } from "./schema";
import { holdersForNode } from "./supplyConcentration";

/** Decomposition relations whose source depends on the target (ADR-0005). */
const DECOMPOSITION_RELATIONS: ReadonlyArray<Edge["relation"]> = [
  "requires",
  "part_of",
  "has_route",
  "implemented_by",
];

/** Distinct nodes that directly depend on `nodeId` via a non-deprecated
 *  decomposition edge (its parents in the requires-DAG). */
export function directDependents(graph: GraphData, nodeId: string): string[] {
  const parents = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.target !== nodeId) continue;
    if (edge.reviewStatus === "deprecated") continue;
    if (!DECOMPOSITION_RELATIONS.includes(edge.relation)) continue;
    parents.add(edge.source);
  }
  return [...parents];
}

/** All nodes that transitively depend on `nodeId` (reverse decomposition
 *  reachability). Excludes the node itself. */
export function dependentAncestors(graph: GraphData, nodeId: string): Set<string> {
  const seen = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const parent of directDependents(graph, current)) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      queue.push(parent);
    }
  }
  return seen;
}

/** Structural fan-in: how many distinct parents directly depend on the node.
 *  Most tree nodes = 1; shared (multi-parent) chokepoints = >1. */
export function criticalityRaw(graph: GraphData, nodeId: string): number {
  return directDependents(graph, nodeId).length;
}

export type AxisValue = { value: number; known: boolean };
export type CriticalityValue = AxisValue & { demandKnown: boolean };

/** Sum of `demandScale` over the dependent ancestor products. Defaults to
 *  weight 1 (and demandKnown=false) when no ancestor product sets it. */
function demandWeight(graph: GraphData, nodeId: string): { weight: number; demandKnown: boolean } {
  const ancestors = dependentAncestors(graph, nodeId);
  const scales: number[] = [];
  for (const id of ancestors) {
    const n = graph.nodes.find((node) => node.id === id);
    if (n?.kind === "product" && typeof n.demandScale === "number") scales.push(n.demandScale);
  }
  if (scales.length === 0) return { weight: 1, demandKnown: false };
  return { weight: scales.reduce((a, b) => a + b, 0), demandKnown: true };
}

/** Criticality = structural fan-in × ancestor-product demand weight. */
export function criticalityValue(graph: GraphData, nodeId: string): CriticalityValue {
  const raw = criticalityRaw(graph, nodeId);
  const { weight, demandKnown } = demandWeight(graph, nodeId);
  return { value: raw * weight, known: raw > 0, demandKnown };
}

/** Empirical-rank normalizer to [0,1] over a value distribution — the same
 *  idea as `bandForCost`'s quantile binning, generalized. Returns a function
 *  mapping a value to (count strictly below) / (n - 1). Ties share a rank. */
export function quantileNormalizer(values: number[]): (v: number) => number {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return () => 0;
  if (sorted.length === 1) return () => 0.5;
  const denom = sorted.length - 1;
  return (v: number) => {
    let below = 0;
    for (const s of sorted) if (s < v) below++;
    return Math.max(0, Math.min(1, below / denom));
  };
}

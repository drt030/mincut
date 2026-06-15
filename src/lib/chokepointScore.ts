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

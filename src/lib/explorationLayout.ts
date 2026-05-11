import type { GraphData } from "./schema";

/**
 * Per spec docs/superpowers/specs/2026-05-10-graph-redesign.md slice 3,
 * `explorationLayout` is a deterministic pure function that places nodes
 * in (x, y) coordinates based on the user's *exploration state* (focus +
 * expansion set) rather than an opaque layout engine. Replacing ELK's
 * incremental-layout step with this function:
 *
 *   1. Eliminates the empty-Map early-return bug that's been showing
 *      cards in fallback positions all session.
 *   2. Makes "reflow on expand" trivial — the layout is recomputed on
 *      every state change because the function is pure and fast.
 *   3. Is testable as a unit (slice-3 RED → GREEN above).
 *
 * Algorithm: pre-order traversal of the `requires`-induced tree starting
 * at `focusId`. Each visited node gets x = depth × COL_WIDTH and
 * y = cursor × ROW_HEIGHT, where cursor advances one slot per visited
 * node. The traversal descends into a child IFF it is in `expandedIds`.
 * A child not in `expandedIds` is still positioned (so the user can see
 * "you have N un-expanded children"); only its descendants are skipped.
 *
 * Why pre-order: it gives a natural "expanding B pushes B's siblings
 * down" behaviour without bespoke shifting logic — when B's children
 * occupy y slots immediately after B, every later sibling of B is
 * shifted down by exactly the size of B's subtree.
 */

export type GraphPoint = { x: number; y: number };

export type ExplorationStage = "overview" | "focused";

export type ExplorationLayoutInput = {
  graph: GraphData;
  focusId: string;
  expandedIds: ReadonlySet<string>;
  stage: ExplorationStage;
};

export const COL_WIDTH = 320;
export const ROW_HEIGHT = 200;

export function explorationLayout(input: ExplorationLayoutInput): Map<string, GraphPoint> {
  const { graph, focusId, expandedIds } = input;
  const positions = new Map<string, GraphPoint>();
  const visited = new Set<string>();
  // requires-induced child lookup (skipped non-substantive kinds match
  // costRollup's filter — metric/evidence/bottleneck/placeholder_breakthrough
  // are positioned via their own paths, not the main layered tree).
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  let cursor = 0;

  function visit(nodeId: string, depth: number): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    positions.set(nodeId, { x: depth * COL_WIDTH, y: cursor * ROW_HEIGHT });
    cursor += 1;
    if (!expandedIds.has(nodeId)) return;
    const children = childrenByParent.get(nodeId) ?? [];
    for (const childId of children) {
      visit(childId, depth + 1);
    }
  }

  visit(focusId, 0);
  return positions;
}

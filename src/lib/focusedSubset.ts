import type { GraphData } from "./schema";

/**
 * Per ADR-0006 §"Focus interaction" and slice B3 of
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`,
 * a click on a structural node X must keep X and its `requires`
 * descendants at full saturation while every other node fades to
 * greyscale.
 *
 * `focusedSubset` is the pure function that computes the two
 * membership sets the renderer applies the `.radial-dim` CSS class
 * against:
 *
 *   - `nodes`: node ids that stay full-saturation.
 *   - `edges`: edge ids (matching `graph.edges[i].id`, A2's
 *     convention) that stay full-saturation. An edge is in iff
 *     BOTH its source and target are in `nodes`.
 *
 * Contract (pinned by `tests/focusedSubset.test.ts`):
 *   - `focusId === null` → every node id + every edge id (regardless
 *     of relation). The overview reads "everything bright."
 *   - `focusId === <known id>` → focus itself + every id reachable
 *     by walking `relation === "requires"` edges forward
 *     (source → target). Ancestors / siblings / unrelated subtrees
 *     are excluded — only the downward `requires`-subtree counts.
 *   - `focusId === <unknown id>` → empty sets. The renderer defaults
 *     to "everything desaturated", surfacing the bug rather than
 *     silently falling back to bright.
 *   - Deterministic: same input ⇒ identical sets across runs.
 */
export type FocusedSubset = {
  nodes: Set<string>;
  edges: Set<string>;
};

export function focusedSubset(
  focusId: string | null,
  graph: GraphData,
): FocusedSubset {
  if (focusId === null) {
    return {
      nodes: new Set(graph.nodes.map((n) => n.id)),
      edges: new Set(graph.edges.map((e) => e.id)),
    };
  }

  // Unknown focus id → empty sets. Matches the "surface the bug"
  // contract in the slice brief.
  if (!graph.nodes.some((n) => n.id === focusId)) {
    return { nodes: new Set(), edges: new Set() };
  }

  // BFS forward via `requires` edges from focus. Deterministic
  // because we iterate `graph.edges` in its (stable) input order for
  // every BFS step, and the visited set short-circuits already-seen
  // descendants.
  const nodes = new Set<string>([focusId]);
  const queue: string[] = [focusId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.source !== cur) continue;
      if (edge.relation !== "requires") continue;
      if (nodes.has(edge.target)) continue;
      nodes.add(edge.target);
      queue.push(edge.target);
    }
  }

  // Edge membership: both endpoints in `nodes`. Iterating
  // `graph.edges` in source-order means the resulting set is
  // bit-stable for a given graph + focus.
  const edges = new Set<string>();
  for (const edge of graph.edges) {
    if (nodes.has(edge.source) && nodes.has(edge.target)) {
      edges.add(edge.id);
    }
  }

  return { nodes, edges };
}

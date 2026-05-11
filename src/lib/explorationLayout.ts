import type { GraphData } from "./schema";

/**
 * Per spec docs/superpowers/specs/2026-05-10-graph-redesign.md slice 3,
 * `explorationLayout` is a deterministic pure function that places nodes
 * in (x, y) coordinates from the user's *exploration state* (focus +
 * expansion set) rather than an opaque layout engine. Replacing ELK's
 * incremental-layout step:
 *
 *   1. Eliminates the empty-Map early-return bug that shipped fallback
 *      positions all session.
 *   2. Makes "reflow on expand" trivial — pure useMemo recomputation.
 *   3. Is testable as a unit (tests/explorationLayout.test.ts).
 *
 * Layout algorithm (top-down tree, post 2026-05-10 redesign):
 *   - Focus at (0, 0)
 *   - Each layer occupies one row at y = depth × ROW_HEIGHT
 *   - Within a row, siblings spread horizontally centered on their
 *     parent. The horizontal span of a subtree is proportional to its
 *     leaf count, so subtrees don't crash into each other when the
 *     tree is deep
 *   - A collapsed (not-in-expandedIds) node contributes width 1 but
 *     does not descend
 *
 * The previous (pre-2026-05-10) variant stacked every child vertically
 * at x = depth × COL_WIDTH, which crushed 12+ direct children into a
 * single tall column and made the graph unreadable. The user reported
 * the chaos; this rewrite addresses it.
 */

export type GraphPoint = { x: number; y: number };

export type ExplorationStage = "overview" | "focused";

export type ExplorationLayoutInput = {
  graph: GraphData;
  focusId: string;
  expandedIds: ReadonlySet<string>;
  stage: ExplorationStage;
  /**
   * Optional set of node ids that should be visible on the canvas.
   * Used to position non-tree visible nodes (alt-sibling products,
   * capability cluster, frontier-ranked metrics, etc.) so they don't
   * fall back to `fallbackPositionFor` which uses kind-based lanes
   * that overlap the focus tree's x range. When omitted, only the
   * focus's `requires` subtree is positioned.
   */
  visibleIds?: ReadonlySet<string>;
};

/** Per-slot horizontal stride. One slot = one card slot (card width + gap). */
export const COL_WIDTH = 280;
/** Per-row vertical stride. */
export const ROW_HEIGHT = 240;

export function explorationLayout(input: ExplorationLayoutInput): Map<string, GraphPoint> {
  const { graph, focusId, expandedIds } = input;
  const positions = new Map<string, GraphPoint>();

  // `requires`-induced child lookup; non-substantive kinds (metric /
  // evidence / bottleneck / placeholder_breakthrough) are skipped so the
  // tree mirrors the cost-rollup walker's substantive-only descent.
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    const childNode = graph.nodes.find((n) => n.id === edge.target);
    if (!childNode) continue;
    if (
      childNode.kind === "metric" ||
      childNode.kind === "evidence" ||
      childNode.kind === "bottleneck" ||
      childNode.kind === "placeholder_breakthrough"
    ) {
      continue;
    }
    if (childNode.reviewStatus === "deprecated") continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  // Pass 1: subtree width per node (counted in slots, where one leaf = 1).
  const widths = new Map<string, number>();
  function computeWidth(nodeId: string, ancestors: Set<string>): number {
    if (widths.has(nodeId)) return widths.get(nodeId)!;
    if (ancestors.has(nodeId)) return 1;
    if (!expandedIds.has(nodeId)) {
      widths.set(nodeId, 1);
      return 1;
    }
    const children = childrenByParent.get(nodeId) ?? [];
    if (children.length === 0) {
      widths.set(nodeId, 1);
      return 1;
    }
    const next = new Set(ancestors);
    next.add(nodeId);
    let sum = 0;
    for (const child of children) sum += computeWidth(child, next);
    const result = Math.max(1, sum);
    widths.set(nodeId, result);
    return result;
  }
  // Guard: focus must exist in the graph or we return an empty map.
  const focusNode = graph.nodes.find((n) => n.id === focusId);
  if (!focusNode) return positions;
  computeWidth(focusId, new Set());

  // Pass 2: place each node. `slot` is the x-position in slot units;
  // we shift it left by half the subtree width so the parent sits
  // visually centred above its children.
  function place(nodeId: string, depth: number, slot: number, ancestors: Set<string>): void {
    if (positions.has(nodeId)) return;
    if (ancestors.has(nodeId)) return;
    positions.set(nodeId, { x: slot * COL_WIDTH, y: depth * ROW_HEIGHT });
    if (!expandedIds.has(nodeId)) return;
    const children = childrenByParent.get(nodeId) ?? [];
    if (children.length === 0) return;
    const myWidth = widths.get(nodeId) ?? 1;
    // Children fan out left-to-right; cursor tracks the *left edge*
    // (in slot units) of the next child's subtree.
    let cursor = slot - (myWidth - 1) / 2;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(nodeId);
    for (const child of children) {
      const w = widths.get(child) ?? 1;
      const childCenter = cursor + (w - 1) / 2;
      place(child, depth + 1, childCenter, nextAncestors);
      cursor += w;
    }
  }
  place(focusId, 0, 0, new Set());

  // Pass 3: place visible non-tree nodes in a "context band" above the
  // focus. Catches alt-sibling products, the capability cluster, and
  // orphan metrics that aren't in the focus's requires subtree but are
  // still rendered (e.g. `showMetricsAsNodes` on, or a metric with two
  // visible parents). Without this they'd fall through to
  // fallbackPositionFor which places products at x=0 (same column as
  // focus) → overlap chaos.
  if (input.visibleIds) {
    const nonTree: string[] = [];
    for (const id of input.visibleIds) {
      if (positions.has(id)) continue;
      // Verify node exists; skip silently if not.
      if (!graph.nodes.find((n) => n.id === id)) continue;
      nonTree.push(id);
    }
    // Sort by kind so capability sits in the centre, products around it,
    // metrics on the outside. Deterministic but readable layout.
    const kindOrder: Record<string, number> = {
      capability: 0,
      product: 1,
      module: 2,
      metric: 3,
      placeholder_breakthrough: 4,
      bottleneck: 5,
    };
    nonTree.sort((a, b) => {
      const na = graph.nodes.find((n) => n.id === a);
      const nb = graph.nodes.find((n) => n.id === b);
      const ka = kindOrder[na?.kind ?? ""] ?? 9;
      const kb = kindOrder[nb?.kind ?? ""] ?? 9;
      return ka - kb || a.localeCompare(b);
    });
    const halfCount = (nonTree.length - 1) / 2;
    nonTree.forEach((id, i) => {
      positions.set(id, {
        x: (i - halfCount) * COL_WIDTH,
        y: -ROW_HEIGHT,
      });
    });
  }

  return positions;
}

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
export const COL_WIDTH = 260;
/** Per-row vertical stride. */
export const ROW_HEIGHT = 210;
/**
 * When the focus's immediate-children count exceeds this threshold,
 * wrap the children into multiple rows in a grid instead of one long
 * row. Keeps the per-row width within ~CHILDREN_MAX_PER_ROW × COL_WIDTH
 * so fit-view zoom doesn't crush card titles below readability.
 * Per UX Flow follow-up 2026-05-10 v3 iter-2.
 */
export const CHILDREN_MAX_PER_ROW = 4;
const GRID_WRAP_MIN_CHILDREN = 8;

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

  // Pass 2: place each node. Two layout modes:
  //   - default: subtree-width tree fan-out (parent centred above
  //     children, children fan left-to-right with subtree-width spacing)
  //   - grid mode (kicks in when a parent has > CHILDREN_MAX_PER_ROW
  //     immediate children AND every child is a leaf — typical for the
  //     parcel-sorting flagship's 12 modules): children wrap into a
  //     grid of CHILDREN_MAX_PER_ROW per row, parent sits centred
  //     above the grid. Halves the horizontal span on wide product
  //     graphs so fit-view zoom doesn't crush card titles.
  function place(nodeId: string, depth: number, slot: number, ancestors: Set<string>): void {
    if (positions.has(nodeId)) return;
    if (ancestors.has(nodeId)) return;
    positions.set(nodeId, { x: slot * COL_WIDTH, y: depth * ROW_HEIGHT });
    if (!expandedIds.has(nodeId)) return;
    const children = childrenByParent.get(nodeId) ?? [];
    if (children.length === 0) return;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(nodeId);

    const allLeaves = children.every((c) => (widths.get(c) ?? 1) === 1);
    if (allLeaves && children.length >= GRID_WRAP_MIN_CHILDREN && children.length > CHILDREN_MAX_PER_ROW) {
      // Grid mode: wrap into rows of up to CHILDREN_MAX_PER_ROW.
      const cols = Math.min(CHILDREN_MAX_PER_ROW, children.length);
      const rows = Math.ceil(children.length / cols);
      for (let i = 0; i < children.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        // Each row's child count may be smaller on the last row.
        const childrenInRow = Math.min(cols, children.length - row * cols);
        const localOffset = col - (childrenInRow - 1) / 2;
        const childSlot = slot + localOffset;
        const childDepth = depth + 1 + row;
        positions.set(children[i], {
          x: childSlot * COL_WIDTH,
          y: childDepth * ROW_HEIGHT,
        });
      }
      void rows;
      return;
    }

    // Default: subtree-width tree fan-out.
    const myWidth = widths.get(nodeId) ?? 1;
    let cursor = slot - (myWidth - 1) / 2;
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

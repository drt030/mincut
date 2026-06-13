import type { Edge, GraphData, Node } from "./schema";
import { isCanvasTreeEdge, isKnowHowNode } from "./canvasGraph";

/**
 * Per ADR-0008: the /graph canvas is one persistent radial map viewed
 * through two layers. Layout runs once over the union graph; layers
 * only flip visibility and styling, never positions (ADR-0007 stable
 * identity).
 *
 *  - "product": artifact kinds only — answers "what do you buy/build".
 *  - "knowhow": know-how nodes keep their subsystem-family colour so
 *    the user can still read where each method/process belongs; artifact
 *    nodes stay as dimmed grey context.
 */
export type GraphLayer = "product" | "knowhow";

export const DEFAULT_GRAPH_LAYER: GraphLayer = "product";

/** Transactability fill ramp: green = procurable, amber = must_build. */
export const KNOW_HOW_FILLS = Object.freeze({
  procurable: "hsl(145, 55%, 42%)",
  must_build: "hsl(32, 85%, 48%)",
  unset: "hsl(215, 12%, 64%)",
});

/** Grey context fill for artifact nodes inside the know-how layer. */
export const ARTIFACT_DIM_FILL = "hsl(215, 14%, 84%)";

export function knowHowFill(node: Node): string {
  if (node.transactability === "procurable") return KNOW_HOW_FILLS.procurable;
  if (node.transactability === "must_build") return KNOW_HOW_FILLS.must_build;
  return KNOW_HOW_FILLS.unset;
}

export function knowHowLayerFill(node: Node, subsystemFamilyFill: string): string {
  return isKnowHowNode(node) ? subsystemFamilyFill : ARTIFACT_DIM_FILL;
}

export function layerHidesNode(node: Node, layer: GraphLayer): boolean {
  return layer === "product" && isKnowHowNode(node);
}

export function layerHidesEdge(
  edge: Edge,
  layer: GraphLayer,
  nodeById: Map<string, Node>,
): boolean {
  if (layer !== "product") return false;
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  return (source !== undefined && isKnowHowNode(source)) ||
    (target !== undefined && isKnowHowNode(target));
}

/**
 * Per the spec's bottleneck-surfacing rule: a product-layer host shows
 * a red-ring badge counting its know-how tree children (via `requires`
 * / `implemented_by` attachment edges) that carry non-empty
 * `bottleneckOf`. Returns hosts with count ≥ 1 only.
 */
export function knowHowBottleneckCounts(graph: GraphData): Map<string, number> {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const counts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (edge.reviewStatus === "deprecated") continue;
    const target = nodeById.get(edge.target);
    if (!target || !isKnowHowNode(target)) continue;
    if (target.reviewStatus === "deprecated") continue;
    if ((target.bottleneckOf?.length ?? 0) === 0) continue;
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
  }
  return counts;
}

export type ListingInfo = {
  status: "public" | "private" | "subsidiary" | "unknown";
  ticker: string | undefined;
};

/**
 * Listing info for an organization node. Schema fields are canonical;
 * the fallback reads the ai-chain data convention (`public_company`
 * tag + a "Public listing" metric whose currentValue is the ticker)
 * so that graph gets chips without editing its hot data file.
 */
export function listingInfoForOrg(org: Node): ListingInfo {
  if (org.listingStatus) {
    return { status: org.listingStatus, ticker: org.ticker };
  }
  const listingMetric = (org.metrics ?? []).find((m) => m.name === "Public listing");
  const metricTicker = typeof listingMetric?.currentValue === "string"
    ? listingMetric.currentValue
    : undefined;
  if (org.tags?.includes("public_company") || metricTicker) {
    return { status: "public", ticker: org.ticker ?? metricTicker };
  }
  return { status: "unknown", ticker: org.ticker };
}

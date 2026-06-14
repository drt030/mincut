import type { Edge, GraphData, Node, NodeKind } from "./schema";
import { defaultFocalProduct } from "./graphTraversal";

export const DEFAULT_CANVAS_MAX_DEPTH = 4;

const CANVAS_KINDS: ReadonlySet<NodeKind> = new Set([
  "product",
  "technical_route",
  "module",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "material",
]);

/** Per ADR-0008: display-layer umbrella "Know-how" = these two kinds. */
export const KNOW_HOW_KINDS: ReadonlySet<NodeKind> = new Set([
  "engineering_method",
  "manufacturing_process",
]);

export function isKnowHowNode(node: Node): boolean {
  return KNOW_HOW_KINDS.has(node.kind);
}

/** Canvas node that is a purchasable/buildable artifact (product layer content). */
export function isArtifactCanvasNode(node: Node): boolean {
  return isCanvasNode(node) && !isKnowHowNode(node);
}

/**
 * Per ADR-0008: the canvas tree is built from `requires` edges PLUS
 * `implemented_by` edges whose target is a know-how node (a handful of
 * know-how nodes in the parcel graph attach only that way). `implemented_by`
 * edges to organizations stay panel-only.
 */
export function isCanvasTreeEdge(edge: Edge, nodeById: Map<string, Node>): boolean {
  if (edge.relation === "requires") {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (source && target && isKnowHowNode(source) && isArtifactCanvasNode(target)) {
      return false;
    }
    return true;
  }
  if (edge.relation === "has_route") return true;
  if (edge.relation !== "implemented_by") return false;
  const target = nodeById.get(edge.target);
  return target !== undefined && isKnowHowNode(target);
}

const GENERIC_OPERATIONAL_TAGS = new Set([
  "deployment",
  "maintenance",
  "operator_training",
  "installation",
]);

const RAW_SUPPLY_TAGS = new Set([
  "raw_material",
  "mining",
  "supply_chain",
]);

function hasAnyTag(node: Node, tags: ReadonlySet<string>): boolean {
  return (node.tags ?? []).some((tag) => tags.has(tag));
}

function isExplicitlyKey(node: Node): boolean {
  const tags = new Set(node.tags ?? []);
  return tags.has("hard_to_develop") ||
    tags.has("bottleneck") ||
    (node.bottleneckOf?.length ?? 0) > 0 ||
    (node.frontierFor?.length ?? 0) > 0;
}

function isOperationalWorkflow(node: Node): boolean {
  const label = `${node.id} ${node.name}`.toLowerCase();
  return label.includes("workflow") && hasAnyTag(node, GENERIC_OPERATIONAL_TAGS);
}

function isRawSupplyChainNode(node: Node): boolean {
  return hasAnyTag(node, RAW_SUPPLY_TAGS) && !isExplicitlyKey(node);
}

export function isCanvasNode(node: Node): boolean {
  if (!CANVAS_KINDS.has(node.kind)) return false;
  if (isOperationalWorkflow(node)) return false;
  if (node.kind === "material") return isExplicitlyKey(node);
  if (node.kind === "manufacturing_process" && isRawSupplyChainNode(node)) return false;
  return true;
}

export function isRootableCanvasNode(node: Node): boolean {
  return node.kind === "product" || isCanvasNode(node);
}

export function resolveCanvasRootId(graph: GraphData, preferredRootId?: string | null): string | null {
  if (preferredRootId) {
    const preferred = graph.nodes.find((node) => node.id === preferredRootId);
    if (preferred && isRootableCanvasNode(preferred)) return preferred.id;
  }
  return defaultFocalProduct(graph)?.id ?? null;
}

function edgeKey(edge: Edge): string {
  return `${edge.source}\u0000${edge.target}\u0000${edge.relation}`;
}

type CanvasGraphFilterOptions = {
  maxDepth?: number | null;
};

export function filterCanvasGraph(
  graph: GraphData,
  rootId?: string | null,
  options: CanvasGraphFilterOptions = {},
): GraphData {
  const focalId = resolveCanvasRootId(graph, rootId);
  const focal = focalId ? graph.nodes.find((node) => node.id === focalId) : null;
  if (!focal) return { ...graph, nodes: graph.nodes.filter(isCanvasNode), edges: [] };
  const maxDepth = options.maxDepth ?? DEFAULT_CANVAS_MAX_DEPTH;

  const baseEligibleIds = new Set(
    graph.nodes.filter(isCanvasNode).map((node) => node.id),
  );
  baseEligibleIds.add(focal.id);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const treeEdges = graph.edges.filter((edge) =>
    isCanvasTreeEdge(edge, nodeById) &&
    baseEligibleIds.has(edge.source) &&
    baseEligibleIds.has(edge.target),
  );

  const childrenByParent = new Map<string, string[]>();
  for (const edge of treeEdges) {
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  const reachable = new Set<string>();
  const depthById = new Map<string, number>([[focal.id, 0]]);
  const queue: string[] = [focal.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const depth = depthById.get(current) ?? 0;
    if (maxDepth !== null && depth >= maxDepth) continue;
    for (const child of childrenByParent.get(current) ?? []) {
      if (reachable.has(child)) continue;
      const nextDepth = depth + 1;
      const existingDepth = depthById.get(child);
      if (existingDepth === undefined || nextDepth < existingDepth) {
        depthById.set(child, nextDepth);
        queue.push(child);
      }
    }
  }

  const nodes = graph.nodes.filter((node) => reachable.has(node.id));
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const edge of treeEdges) {
    if (!reachable.has(edge.source) || !reachable.has(edge.target)) continue;
    const key = edgeKey(edge);
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge);
  }

  return { ...graph, nodes, edges };
}

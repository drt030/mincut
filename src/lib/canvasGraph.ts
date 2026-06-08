import type { Edge, GraphData, Node, NodeKind } from "./schema";

export const DEFAULT_CANVAS_MAX_DEPTH = 4;

const CANVAS_KINDS: ReadonlySet<NodeKind> = new Set([
  "product",
  "module",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "material",
]);

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
  return graph.nodes.find((node) => node.kind === "product")?.id ?? null;
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

  const requiresEdges = graph.edges.filter((edge) =>
    edge.relation === "requires" &&
    baseEligibleIds.has(edge.source) &&
    baseEligibleIds.has(edge.target),
  );

  const childrenByParent = new Map<string, string[]>();
  for (const edge of requiresEdges) {
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
  for (const edge of requiresEdges) {
    if (!reachable.has(edge.source) || !reachable.has(edge.target)) continue;
    const key = edgeKey(edge);
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge);
  }

  return { ...graph, nodes, edges };
}

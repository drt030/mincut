import { nodeCostDriverRmb, type CostSignalKind } from "./edgeStyleFor";
import type { Edge, GraphData, Node } from "./schema";

export type RouteMode = "cost-drivers";

export type RouteStep = {
  nodeId: string;
  costTypicalRmb: number;
  costSignalKind: CostSignalKind;
  pathNodeIds: string[];
  pathEdgeIds: string[];
};

export type RouteHighlight = {
  mode: RouteMode;
  rootId: string;
  targetNodeIds: string[];
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  steps: RouteStep[];
};

type RouteOptions = {
  limit?: number;
  costGraph?: GraphData;
};

const DEFAULT_LIMIT = 4;
const STRUCTURAL_KINDS = new Set<Node["kind"]>([
  "product",
  "module",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "material",
]);

export function selectCostDriverRoute(
  graph: GraphData,
  rootId: string,
  options: RouteOptions = {},
): RouteHighlight {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const costGraph = options.costGraph ?? graph;
  const candidates = graph.nodes
    .flatMap((node) => {
      if (node.id === rootId) return [];
      if (!STRUCTURAL_KINDS.has(node.kind)) return [];
      if (node.reviewStatus === "deprecated") return [];
      const costNode = costGraph.nodes.find((entry) => entry.id === node.id) ?? node;
      const cost = nodeCostDriverRmb(costNode, costGraph);
      if (!cost || cost.value <= 0) return [];
      return [{ node, cost: cost.value, costSignalKind: cost.kind }];
    })
    .sort((left, right) => {
      const delta = right.cost - left.cost;
      return delta === 0 ? left.node.id.localeCompare(right.node.id) : delta;
    });

  const nodeIds = new Set<string>([rootId]);
  const edgeIds = new Set<string>();
  const steps: RouteStep[] = [];

  for (const candidate of candidates) {
    if (steps.length >= limit) break;
    const path = findRequiresPath(graph, rootId, candidate.node.id);
    if (!path) continue;
    for (const id of path.nodeIds) nodeIds.add(id);
    for (const id of path.edgeIds) edgeIds.add(id);
    steps.push({
      nodeId: candidate.node.id,
      costTypicalRmb: candidate.cost,
      costSignalKind: candidate.costSignalKind,
      pathNodeIds: path.nodeIds,
      pathEdgeIds: path.edgeIds,
    });
  }

  return {
    mode: "cost-drivers",
    rootId,
    targetNodeIds: steps.map((step) => step.nodeId),
    nodeIds,
    edgeIds,
    steps,
  };
}

function findRequiresPath(
  graph: GraphData,
  rootId: string,
  targetId: string,
): { nodeIds: string[]; edgeIds: string[] } | null {
  if (rootId === targetId) return { nodeIds: [rootId], edgeIds: [] };

  const children = new Map<string, Array<{ edge: Edge; target: string }>>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!children.has(edge.source)) children.set(edge.source, []);
    children.get(edge.source)!.push({ edge, target: edge.target });
  }
  for (const list of children.values()) {
    list.sort((left, right) => left.target.localeCompare(right.target));
  }

  const queue: Array<{ nodeId: string; nodePath: string[]; edgePath: string[] }> = [
    { nodeId: rootId, nodePath: [rootId], edgePath: [] },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);
    for (const next of children.get(current.nodeId) ?? []) {
      if (visited.has(next.target)) continue;
      const nodePath = [...current.nodePath, next.target];
      const edgePath = [...current.edgePath, next.edge.id];
      if (next.target === targetId) return { nodeIds: nodePath, edgeIds: edgePath };
      queue.push({ nodeId: next.target, nodePath, edgePath });
    }
  }

  return null;
}

import type { Edge, Evidence, GraphData, Node } from "./schema";

export const V0_TARGET_NODE_ID = "low_cost_parcel_sorting_robot_300k_rmb";

export function nodeById(graph: GraphData, id: string): Node | undefined {
  return graph.nodes.find((node) => node.id === id);
}

export function evidenceById(graph: GraphData, id: string): Evidence | undefined {
  return graph.evidence.find((item) => item.id === id);
}

export function outgoingEdges(graph: GraphData, nodeId: string, relation?: Edge["relation"]): Edge[] {
  return graph.edges.filter((edge) => edge.source === nodeId && (!relation || edge.relation === relation));
}

export function incomingEdges(graph: GraphData, nodeId: string, relation?: Edge["relation"]): Edge[] {
  return graph.edges.filter((edge) => edge.target === nodeId && (!relation || edge.relation === relation));
}

export function targets(graph: GraphData, nodeId: string, relation?: Edge["relation"]): Node[] {
  return outgoingEdges(graph, nodeId, relation)
    .map((edge) => nodeById(graph, edge.target))
    .filter((node): node is Node => Boolean(node));
}

export function sources(graph: GraphData, nodeId: string, relation?: Edge["relation"]): Node[] {
  return incomingEdges(graph, nodeId, relation)
    .map((edge) => nodeById(graph, edge.source))
    .filter((node): node is Node => Boolean(node));
}

export function requiredModules(graph: GraphData, productId: string): Node[] {
  return targets(graph, productId, "requires").filter((node) => node.kind === "module");
}

export function routesForModule(graph: GraphData, moduleId: string): Node[] {
  return targets(graph, moduleId, "has_route").filter((node) => node.kind === "technical_route");
}

export function routesForProduct(graph: GraphData, productId: string): Node[] {
  const direct = targets(graph, productId, "has_route").filter((node) => node.kind === "technical_route");
  const moduleRoutes = requiredModules(graph, productId).flatMap((module) => routesForModule(graph, module.id));
  return uniqueNodes([...direct, ...moduleRoutes]);
}

export function bottlenecksForNode(graph: GraphData, nodeId: string): Node[] {
  return targets(graph, nodeId, "bottlenecked_by").filter((node) => node.kind === "bottleneck" || node.kind === "placeholder_breakthrough");
}

export function metricsForNode(graph: GraphData, nodeId: string): Node[] {
  return targets(graph, nodeId, "measured_by").filter((node) => node.kind === "metric");
}

export function evidenceForNode(graph: GraphData, nodeId: string): Evidence[] {
  const node = nodeById(graph, nodeId);
  const direct = (node?.evidenceIds ?? []).map((id) => evidenceById(graph, id)).filter((item): item is Evidence => Boolean(item));
  const supporting = graph.evidence.filter((item) => item.supportsNodeIds?.includes(nodeId));
  return uniqueEvidence([...direct, ...supporting]);
}

export function evidenceForEdge(graph: GraphData, edgeId: string): Evidence[] {
  const edge = graph.edges.find((item) => item.id === edgeId);
  const direct = (edge?.evidenceIds ?? []).map((id) => evidenceById(graph, id)).filter((item): item is Evidence => Boolean(item));
  const supporting = graph.evidence.filter((item) => item.supportsEdgeIds?.includes(edgeId));
  return uniqueEvidence([...direct, ...supporting]);
}

export function downstream(graph: GraphData, nodeId: string): Node[] {
  return targets(graph, nodeId);
}

export function upstream(graph: GraphData, nodeId: string): Node[] {
  return sources(graph, nodeId);
}

export function reachableNodeIdsFrom(graph: GraphData, targetNodeId: string): Set<string> {
  const ids = new Set<string>([targetNodeId]);
  const queue = [targetNodeId];

  while (queue.length) {
    const source = queue.shift();
    if (!source) continue;
    for (const edge of graph.edges.filter((item) => item.source === source)) {
      if (ids.has(edge.target)) continue;
      ids.add(edge.target);
      queue.push(edge.target);
    }
  }

  return ids;
}

export function evidenceForScope(graph: GraphData, nodes: Node[], edges: Edge[]): Evidence[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const evidenceIds = new Set<string>();

  for (const node of nodes) {
    for (const id of node.evidenceIds ?? []) evidenceIds.add(id);
  }
  for (const edge of edges) {
    for (const id of edge.evidenceIds ?? []) evidenceIds.add(id);
  }

  return graph.evidence.flatMap((item) => {
    const supportsNodeIds = item.supportsNodeIds?.filter((id) => nodeIds.has(id));
    const supportsEdgeIds = item.supportsEdgeIds?.filter((id) => edgeIds.has(id));
    const hasScopedSupport = Boolean(supportsNodeIds?.length || supportsEdgeIds?.length);
    const isDirectlyReferenced = evidenceIds.has(item.id);

    if (!isDirectlyReferenced && !hasScopedSupport) return [];

    return [
      {
        ...item,
        ...(item.supportsNodeIds ? { supportsNodeIds: supportsNodeIds ?? [] } : {}),
        ...(item.supportsEdgeIds ? { supportsEdgeIds: supportsEdgeIds ?? [] } : {}),
      },
    ];
  });
}

export function scopeGraphToReachableNodes(graph: GraphData, targetNodeId: string = V0_TARGET_NODE_ID): GraphData {
  const nodeIds = reachableNodeIdsFrom(graph, targetNodeId);
  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const evidence = evidenceForScope(graph, nodes, edges);
  return {
    ...graph,
    nodes,
    edges,
    evidence,
  };
}

export function uniqueNodes(nodes: Node[]): Node[] {
  return [...new Map(nodes.map((node) => [node.id, node])).values()];
}

function uniqueEvidence(items: Evidence[]): Evidence[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

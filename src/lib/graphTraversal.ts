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

/**
 * Per ADR-0005, "no expanded children" means: the node has no outgoing
 * decomposition-relation edges to a substantive child node. Decomposition
 * relations are `requires`, `part_of`, `has_route`, and `implemented_by`.
 * A child is "substantive" if it is itself a decomposable subsystem rather
 * than only a measurement / annotation node. We exclude `metric`, `bottleneck`,
 * `placeholder_breakthrough`, `standard_or_regulation`, `organization`, and
 * `evidence` from "expanded children" because their presence does not
 * constitute decomposition further into the technology tree.
 */
const decompositionRelations: Edge["relation"][] = ["requires", "part_of", "has_route", "implemented_by"];
const nonExpandableChildKinds = new Set([
  "metric",
  "bottleneck",
  "placeholder_breakthrough",
  "standard_or_regulation",
  "organization",
  "evidence",
]);

export function hasExpandedChildren(graph: GraphData, nodeId: string): boolean {
  for (const edge of graph.edges) {
    if (edge.source !== nodeId) continue;
    if (!decompositionRelations.includes(edge.relation)) continue;
    const target = nodeById(graph, edge.target);
    if (!target) continue;
    if (nonExpandableChildKinds.has(target.kind)) continue;
    return true;
  }
  return false;
}

/**
 * Per ADR-0005, a node is a decomposition frontier if EITHER it carries the
 * explicit `decomposition_frontier` tag, OR its `maturityLabel` is not in
 * {mature, widely_adopted} AND it has no expanded children. The first arm is
 * an authored override; the second arm catches incomplete decomposition where
 * the stop condition (commodified-at-industrial-scale) has not been met.
 */
export function isDecompositionFrontier(graph: GraphData, node: Node): boolean {
  if (node.tags?.includes("decomposition_frontier")) return true;
  const stopLabels = new Set(["mature", "widely_adopted"]);
  if (node.maturityLabel && stopLabels.has(node.maturityLabel)) return false;
  return !hasExpandedChildren(graph, node.id);
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

/**
 * Other Product nodes that share at least one Capability target with the
 * given Product, via the `enables` relation. Encodes the ADR-0004 boundary:
 * alternative Product architectures live as siblings under one Capability.
 */
export function siblingProductsForProduct(graph: GraphData, productId: string): Node[] {
  const productNode = nodeById(graph, productId);
  if (!productNode || productNode.kind !== "product") return [];
  const capabilityIds = new Set(
    outgoingEdges(graph, productId, "enables")
      .filter((edge) => nodeById(graph, edge.target)?.kind === "capability")
      .map((edge) => edge.target),
  );
  if (capabilityIds.size === 0) return [];
  const siblingIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.relation !== "enables" || !capabilityIds.has(edge.target)) continue;
    if (edge.source === productId) continue;
    if (nodeById(graph, edge.source)?.kind === "product") siblingIds.add(edge.source);
  }
  return [...siblingIds]
    .map((id) => nodeById(graph, id))
    .filter((node): node is Node => Boolean(node));
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

  // Per ADR-0004, the Capability that the active Product `enables` and the
  // *other* sibling Products that share that Capability are part of the
  // boundary structure a learner must see on-graph. They are not reached by
  // following outgoing edges from the Product (sibling Products are sources,
  // not targets). We pull them in at scope time, but we do NOT pull in any
  // of the sibling Products' inner subtrees — only the sibling Product nodes
  // themselves and the cluster `enables` edges. This keeps the active graph
  // small while letting the Layered builder render the cluster.
  for (const edge of graph.edges) {
    if (edge.source !== targetNodeId || edge.relation !== "enables") continue;
    const targetNode = graph.nodes.find((node) => node.id === edge.target);
    if (targetNode?.kind !== "capability") continue;
    nodeIds.add(edge.target);
    for (const inboundEdge of graph.edges) {
      if (inboundEdge.target !== edge.target || inboundEdge.relation !== "enables") continue;
      const sourceNode = graph.nodes.find((node) => node.id === inboundEdge.source);
      if (sourceNode?.kind === "product") nodeIds.add(inboundEdge.source);
    }
  }

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

import { edgeAwarePackRectangularNodes, type GeometryLayoutEdge } from "./edgeAwareLayout";
import { defaultFocalProduct } from "./graphTraversal";
import { radialLayout, type PolarPosition } from "./radialLayout";
import type { PackedPoint, SectorBounds } from "./cardAwareLayout";
import { filterCanvasGraph, isCanvasTreeEdge } from "./canvasGraph";
import { layerHidesNode, type GraphLayer } from "./knowHowLayer";
import type { GraphData } from "./schema";

export const GRAPH_LAYOUT_BOX = { width: 136, height: 72 } as const;
export const GRAPH_LAYOUT_PX_SCALE = 2.4;

function polarToCartesian(polar: PolarPosition): PackedPoint {
  return {
    x: polar.r * GRAPH_LAYOUT_PX_SCALE * Math.cos(polar.theta),
    y: polar.r * GRAPH_LAYOUT_PX_SCALE * Math.sin(polar.theta),
  };
}

function sectorForTheta(
  theta: number,
  sectors: ReadonlyMap<string, { center: number; width: number }>,
): SectorBounds | null {
  const normalized = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  for (const sector of sectors.values()) {
    const start = sector.center - sector.width / 2;
    const end = sector.center + sector.width / 2;
    if (normalized >= start - 1e-9 && normalized <= end + 1e-9) return { start, end };
  }
  return null;
}

function buildFocalSubtree(graph: GraphData, rootId: string): Set<string> {
  const focal = graph.nodes.find((node) => node.id === rootId) ?? defaultFocalProduct(graph);
  if (!focal) return new Set();

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  const subtree = new Set<string>();
  const queue: string[] = [focal.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (subtree.has(current)) continue;
    subtree.add(current);
    for (const child of childrenByParent.get(current) ?? []) queue.push(child);
  }
  return subtree;
}

export function computeGraphLayoutPositions(
  graph: GraphData,
  rootId: string,
  graphLayer: GraphLayer,
): Map<string, PackedPoint> {
  const canvasGraph = filterCanvasGraph(graph, rootId);
  const layout = radialLayout(canvasGraph, rootId);
  const focalSubtree = buildFocalSubtree(canvasGraph, rootId);
  const radialNodePositions = new Map<string, PackedPoint>();
  for (const [nodeId, polar] of layout.positions) {
    if (!focalSubtree.has(nodeId)) continue;
    radialNodePositions.set(nodeId, polarToCartesian(polar));
  }

  const layerVisibleNodeIds = new Set<string>();
  for (const node of canvasGraph.nodes) {
    if (!layerHidesNode(node, graphLayer)) layerVisibleNodeIds.add(node.id);
  }

  const firstLayerSubsystems: string[] = [];
  for (const edge of canvasGraph.edges) {
    if (edge.relation !== "requires") continue;
    if (edge.source !== rootId) continue;
    const target = canvasGraph.nodes.find((node) => node.id === edge.target);
    if (!target || target.kind === "material") continue;
    firstLayerSubsystems.push(edge.target);
  }
  const firstLayerSubsystemSet = new Set(firstLayerSubsystems);

  const childrenByParent = new Map<string, string[]>();
  const nodeById = new Map(canvasGraph.nodes.map((node) => [node.id, node]));
  for (const edge of canvasGraph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  const sectorBoundsById = new Map<string, SectorBounds>();
  for (const [nodeId, polar] of layout.positions) {
    const sectorBounds = sectorForTheta(polar.theta, layout.sectors);
    if (sectorBounds) sectorBoundsById.set(nodeId, sectorBounds);
  }

  const visualRadiusFor = (nodeId: string): number => {
    if (!nodeById.has(nodeId)) return 12;
    if (nodeId === rootId) return 26;
    if (firstLayerSubsystemSet.has(nodeId)) return 22;
    const hasStructuralChildren = (childrenByParent.get(nodeId) ?? []).some((childId) =>
      layout.positions.has(childId),
    );
    return hasStructuralChildren ? 16 : 10;
  };

  const layoutEdges: GeometryLayoutEdge[] = canvasGraph.edges.flatMap((edge) => {
    if (!isCanvasTreeEdge(edge, nodeById)) return [];
    if (layout.edges.get(edge.id)?.style !== "primary") return [];
    if (!layerVisibleNodeIds.has(edge.source) || !layerVisibleNodeIds.has(edge.target)) return [];
    if (!focalSubtree.has(edge.source) || !focalSubtree.has(edge.target)) return [];
    if (!radialNodePositions.has(edge.source) || !radialNodePositions.has(edge.target)) return [];
    return [{
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceRadius: visualRadiusFor(edge.source),
      targetRadius: visualRadiusFor(edge.target),
    }];
  });

  return edgeAwarePackRectangularNodes(radialNodePositions, {
    width: GRAPH_LAYOUT_BOX.width,
    height: GRAPH_LAYOUT_BOX.height,
    padding: 36,
    fixedIds: new Set([rootId]),
    sectorBoundsById,
    sectorPaddingRadians: 0.1,
    edges: layoutEdges,
  });
}

import { filterCanvasGraph, isCanvasTreeEdge } from "./canvasGraph";
import { computeRectEdgePorts } from "./edgePorts";
import {
  edgeAwarePackRectangularNodes,
  scoreEdgeGeometry,
  type EdgeCrossingIssue,
  type EdgeNodeIntersectionIssue,
  type EdgeOverlapIssue,
  type GeometryLayoutEdge,
} from "./edgeAwareLayout";
import { layerHidesNode } from "./knowHowLayer";
import { radialLayout } from "./radialLayout";
import type { Edge, GraphData } from "./schema";

const PX_SCALE = 2.4;
const DETAIL_BOX = { width: 136, height: 72 } as const;
const TWO_PI = Math.PI * 2;

export type HighFanoutPortAudit = {
  nodeId: string;
  nodeName: string;
  outgoingEdgeIds: string[];
  outgoingEdgeCount: number;
  uniqueSourceAnchorCount: number;
  minimumSourceAnchorDistance: number;
  failure: string | null;
};

export type GraphGeometryAudit = {
  rootId: string;
  visibleEdgeCount: number;
  geometryScore: number;
  highFanoutNodes: HighFanoutPortAudit[];
  fanoutPortFailures: string[];
  edgeCrossings: EdgeCrossingIssue[];
  edgeNodeIntersections: EdgeNodeIntersectionIssue[];
  edgeOverlaps: EdgeOverlapIssue[];
  edgeGeometryFailures: string[];
};

type GraphGeometryAuditOptions = {
  highFanoutThreshold?: number;
  minimumAnchorDistance?: number;
  maxEdgeCrossings?: number;
  maxEdgeNodeIntersections?: number;
  maxEdgeOverlaps?: number;
};

function polarToPoint(polar: { r: number; theta: number }): { x: number; y: number } {
  return {
    x: polar.r * PX_SCALE * Math.cos(polar.theta),
    y: polar.r * PX_SCALE * Math.sin(polar.theta),
  };
}

function normalizeTheta(theta: number): number {
  return ((theta % TWO_PI) + TWO_PI) % TWO_PI;
}

function sectorForTheta(
  theta: number,
  sectors: ReadonlyMap<string, { center: number; width: number }>,
): { start: number; end: number } | null {
  const normalized = normalizeTheta(theta);
  for (const sector of sectors.values()) {
    const start = sector.center - sector.width / 2;
    const end = sector.center + sector.width / 2;
    if (normalized >= start - 1e-9 && normalized <= end + 1e-9) return { start, end };
  }
  return null;
}

function minimumDistance(points: Array<{ x: number; y: number }>): number {
  let minimum = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      minimum = Math.min(
        minimum,
        Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y),
      );
    }
  }
  return minimum === Infinity ? 0 : minimum;
}

function anchorKey(point: { x: number; y: number }): string {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

export function auditGraphGeometry(
  graph: GraphData,
  rootId: string,
  options: GraphGeometryAuditOptions = {},
): GraphGeometryAudit {
  const highFanoutThreshold = options.highFanoutThreshold ?? 6;
  const minimumAnchorDistance = options.minimumAnchorDistance ?? 6;
  const maxEdgeCrossings = options.maxEdgeCrossings ?? 0;
  const maxEdgeNodeIntersections = options.maxEdgeNodeIntersections ?? 90;
  const maxEdgeOverlaps = options.maxEdgeOverlaps ?? 0;
  const canvas = filterCanvasGraph(graph, rootId);
  const layout = radialLayout(canvas, rootId);
  const nodeById = new Map(canvas.nodes.map((node) => [node.id, node]));
  const visibleNodeIds = new Set(
    canvas.nodes.flatMap((node) => layerHidesNode(node, "product") ? [] : [node.id]),
  );
  const rawPositions = new Map<string, { x: number; y: number }>();
  const sectorBoundsById = new Map<string, { start: number; end: number }>();

  for (const [nodeId, polar] of layout.positions) {
    const point = polarToPoint(polar);
    rawPositions.set(nodeId, point);
    const sector = sectorForTheta(polar.theta, layout.sectors);
    if (sector) sectorBoundsById.set(nodeId, sector);
  }

  const visibleEdges = canvas.edges.filter((edge) =>
    isCanvasTreeEdge(edge, nodeById) &&
    layout.edges.get(edge.id)?.style === "primary" &&
    visibleNodeIds.has(edge.source) &&
    visibleNodeIds.has(edge.target) &&
    packedEdgeEndpointsExist(rawPositions, edge)
  );
  const firstLayerSubsystemSet = new Set(
    canvas.edges.flatMap((edge) => {
      if (edge.relation !== "requires" || edge.source !== rootId) return [];
      const target = nodeById.get(edge.target);
      return target && target.kind !== "material" ? [edge.target] : [];
    }),
  );
  const childrenByParent = new Map<string, string[]>();
  for (const edge of canvas.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
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
  const layoutEdges: GeometryLayoutEdge[] = visibleEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceRadius: visualRadiusFor(edge.source),
    targetRadius: visualRadiusFor(edge.target),
  }));

  const packedPositions = edgeAwarePackRectangularNodes(rawPositions, {
    width: DETAIL_BOX.width,
    height: DETAIL_BOX.height,
    padding: 36,
    fixedIds: new Set([rootId]),
    sectorBoundsById,
    sectorPaddingRadians: 0.1,
    edges: layoutEdges,
  });

  const geometry = scoreEdgeGeometry({
    edges: layoutEdges,
    positions: packedPositions,
    box: DETAIL_BOX,
  });

  const { sourceAnchorByEdge } = computeRectEdgePorts(visibleEdges, packedPositions, DETAIL_BOX);
  const outgoingBySource = new Map<string, Edge[]>();
  for (const edge of visibleEdges) {
    const outgoing = outgoingBySource.get(edge.source) ?? [];
    outgoing.push(edge);
    outgoingBySource.set(edge.source, outgoing);
  }

  const highFanoutNodes: HighFanoutPortAudit[] = [];
  const fanoutPortFailures: string[] = [];
  for (const [nodeId, outgoing] of outgoingBySource) {
    if (outgoing.length < highFanoutThreshold) continue;
    const anchors = outgoing.flatMap((edge) => {
      const anchor = sourceAnchorByEdge.get(edge.id);
      return anchor ? [anchor] : [];
    });
    const uniqueSourceAnchorCount = new Set(anchors.map(anchorKey)).size;
    const minimumSourceAnchorDistance = minimumDistance(anchors);
    let failure: string | null = null;
    if (anchors.length !== outgoing.length) {
      failure = `missing source anchors for ${outgoing.length - anchors.length} edge(s)`;
    } else if (uniqueSourceAnchorCount !== outgoing.length) {
      failure = `${outgoing.length - uniqueSourceAnchorCount} source anchor collision(s)`;
    } else if (minimumSourceAnchorDistance < minimumAnchorDistance) {
      failure = `minimum source anchor distance ${minimumSourceAnchorDistance.toFixed(1)}px below ${minimumAnchorDistance}px`;
    }

    const audit: HighFanoutPortAudit = {
      nodeId,
      nodeName: nodeById.get(nodeId)?.name ?? nodeId,
      outgoingEdgeIds: outgoing.map((edge) => edge.id).sort((a, b) => a.localeCompare(b)),
      outgoingEdgeCount: outgoing.length,
      uniqueSourceAnchorCount,
      minimumSourceAnchorDistance,
      failure,
    };
    highFanoutNodes.push(audit);
    if (failure) fanoutPortFailures.push(`${nodeId}: ${failure}`);
  }

  highFanoutNodes.sort((a, b) =>
    b.outgoingEdgeCount - a.outgoingEdgeCount ||
    a.minimumSourceAnchorDistance - b.minimumSourceAnchorDistance ||
    a.nodeId.localeCompare(b.nodeId),
  );
  fanoutPortFailures.sort((a, b) => a.localeCompare(b));

  const edgeGeometryFailures: string[] = [];
  if (geometry.edgeCrossings.length > maxEdgeCrossings) {
    edgeGeometryFailures.push(
      `edge crossings ${geometry.edgeCrossings.length} exceed ${maxEdgeCrossings}`,
    );
  }
  if (geometry.edgeNodeIntersections.length > maxEdgeNodeIntersections) {
    edgeGeometryFailures.push(
      `edge-node intersections ${geometry.edgeNodeIntersections.length} exceed ${maxEdgeNodeIntersections}`,
    );
  }
  if (geometry.edgeOverlaps.length > maxEdgeOverlaps) {
    edgeGeometryFailures.push(
      `edge overlaps ${geometry.edgeOverlaps.length} exceed ${maxEdgeOverlaps}`,
    );
  }

  return {
    rootId,
    visibleEdgeCount: visibleEdges.length,
    geometryScore: geometry.score,
    highFanoutNodes,
    fanoutPortFailures,
    edgeCrossings: geometry.edgeCrossings,
    edgeNodeIntersections: geometry.edgeNodeIntersections,
    edgeOverlaps: geometry.edgeOverlaps,
    edgeGeometryFailures,
  };
}

function packedEdgeEndpointsExist(
  positions: ReadonlyMap<string, { x: number; y: number }>,
  edge: Pick<Edge, "source" | "target">,
): boolean {
  return positions.has(edge.source) && positions.has(edge.target);
}

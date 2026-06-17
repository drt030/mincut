import { filterCanvasGraph, isCanvasTreeEdge } from "./canvasGraph";
import { packRectangularNodes } from "./cardAwareLayout";
import { computeRectEdgePorts } from "./edgePorts";
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
  highFanoutNodes: HighFanoutPortAudit[];
  fanoutPortFailures: string[];
};

type GraphGeometryAuditOptions = {
  highFanoutThreshold?: number;
  minimumAnchorDistance?: number;
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
  const canvas = filterCanvasGraph(graph, rootId);
  const layout = radialLayout(canvas, rootId);
  const nodeById = new Map(canvas.nodes.map((node) => [node.id, node]));
  const rawPositions = new Map<string, { x: number; y: number }>();
  const sectorBoundsById = new Map<string, { start: number; end: number }>();

  for (const [nodeId, polar] of layout.positions) {
    const point = polarToPoint(polar);
    rawPositions.set(nodeId, point);
    const sector = sectorForTheta(polar.theta, layout.sectors);
    if (sector) sectorBoundsById.set(nodeId, sector);
  }

  const packedPositions = packRectangularNodes(rawPositions, {
    width: DETAIL_BOX.width,
    height: DETAIL_BOX.height,
    padding: 36,
    fixedIds: new Set([rootId]),
    sectorBoundsById,
    sectorPaddingRadians: 0.1,
  });

  const visibleEdges = canvas.edges.filter((edge) =>
    isCanvasTreeEdge(edge, nodeById) &&
    layout.edges.has(edge.id) &&
    packedPositions.has(edge.source) &&
    packedPositions.has(edge.target)
  );
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

  return {
    rootId,
    visibleEdgeCount: visibleEdges.length,
    highFanoutNodes,
    fanoutPortFailures,
  };
}

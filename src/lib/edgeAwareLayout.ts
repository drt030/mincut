import { packRectangularNodes, type PackedPoint, type PackRectangularNodesOptions, type SectorBounds } from "./cardAwareLayout";
import { computeRectEdgePorts } from "./edgePorts";

export type GeometryLayoutEdge = {
  id: string;
  source: string;
  target: string;
  sourceRadius?: number;
  targetRadius?: number;
};

export type GeometryIssue = {
  edgeId: string;
  source: string;
  target: string;
};

export type EdgeCrossingIssue = {
  edgeA: GeometryIssue;
  edgeB: GeometryIssue;
  x: number;
  y: number;
};

export type EdgeNodeIntersectionIssue = GeometryIssue & {
  nodeId: string;
};

export type EdgeOverlapIssue = {
  edgeA: GeometryIssue;
  edgeB: GeometryIssue;
  closeSampleCount: number;
};

export type EdgeGeometryScore = {
  score: number;
  edgeCrossings: EdgeCrossingIssue[];
  edgeNodeIntersections: EdgeNodeIntersectionIssue[];
  edgeOverlaps: EdgeOverlapIssue[];
  nodeOverlapCount: number;
};

export type EdgeAwarePackOptions = PackRectangularNodesOptions & {
  edges: readonly GeometryLayoutEdge[];
  candidateNodeIds?: ReadonlySet<string>;
  optimize?: boolean;
  optimizeIterations?: number;
  maxNodeShift?: number;
};

type LayoutBox = { width: number; height: number };

const DEFAULT_BOX: LayoutBox = { width: 136, height: 72 };
const TWO_PI = Math.PI * 2;
const EDGE_NODE_WEIGHT = 80;
const EDGE_CROSSING_WEIGHT = 520;
const EDGE_OVERLAP_WEIGHT = 16;
const NODE_OVERLAP_WEIGHT = 220;
const MOVEMENT_WEIGHT = 0.08;
const LABEL_EDGE_GAP = 3;
const LABEL_MAX_MARKER_RADIUS = 18;
const LABEL_ARROW_LENGTH = 8;

function normalizeTheta(theta: number): number {
  return ((theta % TWO_PI) + TWO_PI) % TWO_PI;
}

function angularDistance(a: number, b: number): number {
  const delta = Math.abs(a - b);
  return Math.min(delta, TWO_PI - delta);
}

function clampPointToSector(point: PackedPoint, bounds: SectorBounds, padding: number): PackedPoint {
  const width = Math.max(0, bounds.end - bounds.start);
  const inset = width > 1e-6 ? Math.min(padding, Math.max(0, width / 2 - 1e-6)) : 0;
  const start = bounds.start + inset;
  const end = bounds.end - inset;
  const theta = normalizeTheta(Math.atan2(point.y, point.x));
  if (theta >= start && theta <= end) return point;

  const clampedTheta = angularDistance(theta, start) <= angularDistance(theta, end) ? start : end;
  const radius = Math.hypot(point.x, point.y);
  return {
    x: radius * Math.cos(clampedTheta),
    y: radius * Math.sin(clampedTheta),
  };
}

function rectFor(center: PackedPoint, box = DEFAULT_BOX): { left: number; right: number; top: number; bottom: number } {
  return {
    left: center.x - box.width / 2,
    right: center.x + box.width / 2,
    top: center.y - box.height / 2,
    bottom: center.y + box.height / 2,
  };
}

function nodeOverlapCount(
  positions: ReadonlyMap<string, PackedPoint>,
  box = DEFAULT_BOX,
): number {
  const entries = [...positions].map(([id, point]) => ({ id, rect: rectFor(point, box) }));
  let count = 0;
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i].rect;
      const b = entries[j].rect;
      const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (xOverlap > 2 && yOverlap > 2) count += 1;
    }
  }
  return count;
}

function cubic(
  p0: PackedPoint,
  p1: PackedPoint,
  p2: PackedPoint,
  p3: PackedPoint,
  t: number,
): PackedPoint {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function normalizedVector(
  vx: number,
  vy: number,
  fallbackX: number,
  fallbackY: number,
): PackedPoint {
  const length = Math.hypot(vx, vy);
  if (length > 1e-9) return { x: vx / length, y: vy / length };
  const fallbackLength = Math.hypot(fallbackX, fallbackY);
  if (fallbackLength > 1e-9) return { x: fallbackX / fallbackLength, y: fallbackY / fallbackLength };
  return { x: 1, y: 0 };
}

function markerPortFromAnchor({
  anchor,
  center,
  radius,
  fallback,
}: {
  anchor: PackedPoint;
  center: PackedPoint;
  radius: number;
  fallback: PackedPoint;
}): { point: PackedPoint; normal: PackedPoint } {
  const normal = normalizedVector(anchor.x - center.x, anchor.y - center.y, fallback.x, fallback.y);
  return {
    point: {
      x: center.x + normal.x * radius,
      y: center.y + normal.y * radius,
    },
    normal,
  };
}

function softChordControls(source: PackedPoint, target: PackedPoint): { c1: PackedPoint; c2: PackedPoint } {
  const length = Math.hypot(target.x - source.x, target.y - source.y);
  const axis = normalizedVector(target.x - source.x, target.y - source.y, 1, 0);
  const normal = { x: -axis.y, y: axis.x };
  const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  const outward = normalizedVector(midpoint.x, midpoint.y, normal.x, normal.y);
  const sign = normal.x * outward.x + normal.y * outward.y >= 0 ? 1 : -1;
  const bow = Math.min(28, Math.max(8, length * 0.06));
  return {
    c1: {
      x: source.x + axis.x * length * 0.34 + normal.x * sign * bow,
      y: source.y + axis.y * length * 0.34 + normal.y * sign * bow,
    },
    c2: {
      x: source.x + axis.x * length * 0.68 + normal.x * sign * bow,
      y: source.y + axis.y * length * 0.68 + normal.y * sign * bow,
    },
  };
}

function samplePortCurve(
  edge: GeometryLayoutEdge,
  positions: ReadonlyMap<string, PackedPoint>,
  sourceAnchor: PackedPoint,
  targetAnchor: PackedPoint,
  fallbackSourceRadius: number,
  fallbackTargetRadius: number,
): PackedPoint[] {
  const sourceCenter = positions.get(edge.source);
  const targetCenter = positions.get(edge.target);
  if (!sourceCenter || !targetCenter) return [];

  const sourceRadius = Math.min(
    edge.sourceRadius ?? fallbackSourceRadius,
    LABEL_MAX_MARKER_RADIUS,
  );
  const targetRadius = Math.min(
    edge.targetRadius ?? fallbackTargetRadius,
    LABEL_MAX_MARKER_RADIUS,
  );
  const sourcePort = markerPortFromAnchor({
    anchor: sourceAnchor,
    center: sourceCenter,
    radius: sourceRadius,
    fallback: { x: targetCenter.x - sourceCenter.x, y: targetCenter.y - sourceCenter.y },
  });
  const targetPort = markerPortFromAnchor({
    anchor: targetAnchor,
    center: targetCenter,
    radius: targetRadius,
    fallback: { x: sourceCenter.x - targetCenter.x, y: sourceCenter.y - targetCenter.y },
  });
  const source = {
    x: sourcePort.point.x + sourcePort.normal.x * LABEL_EDGE_GAP,
    y: sourcePort.point.y + sourcePort.normal.y * LABEL_EDGE_GAP,
  };
  const targetTip = {
    x: targetPort.point.x + targetPort.normal.x * LABEL_EDGE_GAP,
    y: targetPort.point.y + targetPort.normal.y * LABEL_EDGE_GAP,
  };
  const targetDirection = unitVector(source, targetTip);
  const target = {
    x: targetTip.x - targetDirection.x * LABEL_ARROW_LENGTH,
    y: targetTip.y - targetDirection.y * LABEL_ARROW_LENGTH,
  };
  const { c1, c2 } = softChordControls(source, target);

  const points: PackedPoint[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    points.push(cubic(source, c1, c2, target, i / steps));
  }
  return points;
}

function sampledEdges(
  edges: readonly GeometryLayoutEdge[],
  positions: ReadonlyMap<string, PackedPoint>,
  box = DEFAULT_BOX,
): Array<GeometryLayoutEdge & { samples: PackedPoint[] }> {
  const { sourceAnchorByEdge, targetAnchorByEdge } = computeRectEdgePorts(edges, positions, box);
  const structuralParentIds = new Set(edges.map((edge) => edge.source));
  const fallbackRadiusFor = (nodeId: string) => structuralParentIds.has(nodeId) ? 16 : 10;
  return edges.flatMap((edge) => {
    const sourceAnchor = sourceAnchorByEdge.get(edge.id);
    const targetAnchor = targetAnchorByEdge.get(edge.id);
    if (!sourceAnchor || !targetAnchor) return [];
    return [{
      ...edge,
      samples: samplePortCurve(
        edge,
        positions,
        sourceAnchor,
        targetAnchor,
        fallbackRadiusFor(edge.source),
        fallbackRadiusFor(edge.target),
      ),
    }];
  });
}

function distance(a: PackedPoint, b: PackedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentIntersection(
  a: PackedPoint,
  b: PackedPoint,
  c: PackedPoint,
  d: PackedPoint,
): PackedPoint | null {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) return null;
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
}

function issueFor(edge: GeometryLayoutEdge): GeometryIssue {
  return {
    edgeId: edge.id,
    source: edge.source,
    target: edge.target,
  };
}

function nearPathEndpoint(edge: { samples: PackedPoint[] }, point: PackedPoint): boolean {
  if (edge.samples.length < 2) return true;
  return distance(edge.samples[0], point) < 20 || distance(edge.samples[edge.samples.length - 1], point) < 20;
}

function insideRect(point: PackedPoint, rect: { left: number; right: number; top: number; bottom: number }, inset: number): boolean {
  return point.x >= rect.left + inset &&
    point.x <= rect.right - inset &&
    point.y >= rect.top + inset &&
    point.y <= rect.bottom - inset;
}

export function scoreEdgeGeometry({
  edges,
  positions,
  box = DEFAULT_BOX,
}: {
  edges: readonly GeometryLayoutEdge[];
  positions: ReadonlyMap<string, PackedPoint>;
  box?: { width: number; height: number };
}): EdgeGeometryScore {
  const visibleEdges = edges.filter((edge) => positions.has(edge.source) && positions.has(edge.target));
  const sampled = sampledEdges(visibleEdges, positions, box);
  const nodeRects = [...positions].map(([id, point]) => ({ id, rect: rectFor(point, box) }));

  const edgeCrossings: EdgeCrossingIssue[] = [];
  for (let i = 0; i < sampled.length; i += 1) {
    for (let j = i + 1; j < sampled.length; j += 1) {
      const a = sampled[i];
      const b = sampled[j];
      let found: PackedPoint | null = null;
      for (let ai = 0; ai < a.samples.length - 1 && !found; ai += 1) {
        for (let bi = 0; bi < b.samples.length - 1; bi += 1) {
          const point = segmentIntersection(a.samples[ai], a.samples[ai + 1], b.samples[bi], b.samples[bi + 1]);
          if (!point || nearPathEndpoint(a, point) || nearPathEndpoint(b, point)) continue;
          found = point;
          break;
        }
      }
      if (found) {
        edgeCrossings.push({
          edgeA: issueFor(a),
          edgeB: issueFor(b),
          x: Number(found.x.toFixed(1)),
          y: Number(found.y.toFixed(1)),
        });
      }
    }
  }

  const edgeNodeIntersections: EdgeNodeIntersectionIssue[] = [];
  for (const edge of sampled) {
    for (const node of nodeRects) {
      if (node.id === edge.source || node.id === edge.target) continue;
      let insideCount = 0;
      for (let i = 3; i < edge.samples.length - 3; i += 1) {
        if (insideRect(edge.samples[i], node.rect, 3)) insideCount += 1;
      }
      if (insideCount >= 2) {
        edgeNodeIntersections.push({
          ...issueFor(edge),
          nodeId: node.id,
        });
      }
    }
  }

  const edgeOverlaps: EdgeOverlapIssue[] = [];
  for (let i = 0; i < sampled.length; i += 1) {
    for (let j = i + 1; j < sampled.length; j += 1) {
      const a = sampled[i];
      const b = sampled[j];
      let closeSampleCount = 0;
      for (let ai = 3; ai < a.samples.length - 3; ai += 2) {
        let minimum = Infinity;
        for (let bi = 3; bi < b.samples.length - 3; bi += 2) {
          minimum = Math.min(minimum, distance(a.samples[ai], b.samples[bi]));
        }
        if (minimum < 6) closeSampleCount += 1;
      }
      if (closeSampleCount >= 4) {
        edgeOverlaps.push({
          edgeA: issueFor(a),
          edgeB: issueFor(b),
          closeSampleCount,
        });
      }
    }
  }

  const overlapCount = nodeOverlapCount(positions, box);
  const score = edgeNodeIntersections.length * EDGE_NODE_WEIGHT +
    edgeCrossings.length * EDGE_CROSSING_WEIGHT +
    edgeOverlaps.length * EDGE_OVERLAP_WEIGHT +
    overlapCount * NODE_OVERLAP_WEIGHT;

  return {
    score,
    edgeCrossings,
    edgeNodeIntersections,
    edgeOverlaps,
    nodeOverlapCount: overlapCount,
  };
}

function shifted(point: PackedPoint, dx: number, dy: number): PackedPoint {
  return { x: point.x + dx, y: point.y + dy };
}

function movementPenalty(
  positions: ReadonlyMap<string, PackedPoint>,
  anchors: ReadonlyMap<string, PackedPoint>,
): number {
  let total = 0;
  for (const [id, point] of positions) {
    const anchor = anchors.get(id);
    if (!anchor) continue;
    total += distance(point, anchor) * MOVEMENT_WEIGHT;
  }
  return total;
}

function boundedDelta(delta: PackedPoint, maximum: number): PackedPoint {
  const length = Math.hypot(delta.x, delta.y);
  if (length <= maximum || length <= 1e-9) return delta;
  return { x: (delta.x / length) * maximum, y: (delta.y / length) * maximum };
}

function addDelta(deltas: Map<string, PackedPoint>, id: string, delta: PackedPoint): void {
  const existing = deltas.get(id) ?? { x: 0, y: 0 };
  deltas.set(id, { x: existing.x + delta.x, y: existing.y + delta.y });
}

function unitVector(from: PackedPoint, to: PackedPoint): PackedPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

function perpendicularAwayFromSegment(node: PackedPoint, source: PackedPoint, target: PackedPoint): PackedPoint {
  const axis = unitVector(source, target);
  const normal = { x: -axis.y, y: axis.x };
  const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  const sign = ((node.x - midpoint.x) * normal.x + (node.y - midpoint.y) * normal.y) >= 0 ? 1 : -1;
  return { x: normal.x * sign, y: normal.y * sign };
}

function cloneSwapSubtrees(
  positions: ReadonlyMap<string, PackedPoint>,
  subtreeA: ReadonlySet<string>,
  subtreeB: ReadonlySet<string>,
  rootA: string,
  rootB: string,
  fixedIds: ReadonlySet<string>,
  sectorBoundsById: ReadonlyMap<string, SectorBounds> | undefined,
  sectorPaddingRadians: number,
): Map<string, PackedPoint> {
  const pointA = positions.get(rootA);
  const pointB = positions.get(rootB);
  if (!pointA || !pointB) return new Map(positions);
  const deltaA = { x: pointB.x - pointA.x, y: pointB.y - pointA.y };
  const deltaB = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
  const next = new Map<string, PackedPoint>();
  for (const [nodeId, point] of positions) {
    let candidate = point;
    if (!fixedIds.has(nodeId) && subtreeA.has(nodeId)) {
      candidate = shifted(point, deltaA.x, deltaA.y);
    } else if (!fixedIds.has(nodeId) && subtreeB.has(nodeId)) {
      candidate = shifted(point, deltaB.x, deltaB.y);
    }
    const sectorBounds = sectorBoundsById?.get(nodeId);
    next.set(
      nodeId,
      sectorBounds ? clampPointToSector(candidate, sectorBounds, sectorPaddingRadians) : candidate,
    );
  }
  return next;
}

function issueNodeIds(geometry: EdgeGeometryScore): Set<string> {
  const ids = new Set<string>();
  for (const crossing of geometry.edgeCrossings) {
    ids.add(crossing.edgeA.source);
    ids.add(crossing.edgeA.target);
    ids.add(crossing.edgeB.source);
    ids.add(crossing.edgeB.target);
  }
  for (const hit of geometry.edgeNodeIntersections) {
    ids.add(hit.source);
    ids.add(hit.target);
    ids.add(hit.nodeId);
  }
  for (const overlap of geometry.edgeOverlaps) {
    ids.add(overlap.edgeA.source);
    ids.add(overlap.edgeA.target);
    ids.add(overlap.edgeB.source);
    ids.add(overlap.edgeB.target);
  }
  return ids;
}

function swapIssueNodeIds(geometry: EdgeGeometryScore): Set<string> {
  const ids = new Set<string>();
  for (const crossing of geometry.edgeCrossings) {
    ids.add(crossing.edgeA.source);
    ids.add(crossing.edgeA.target);
    ids.add(crossing.edgeB.source);
    ids.add(crossing.edgeB.target);
  }
  for (const overlap of geometry.edgeOverlaps) {
    ids.add(overlap.edgeA.source);
    ids.add(overlap.edgeA.target);
    ids.add(overlap.edgeB.source);
    ids.add(overlap.edgeB.target);
  }
  return ids;
}

function optimizeEdgeAwarePositions(
  basePositions: ReadonlyMap<string, PackedPoint>,
  options: EdgeAwarePackOptions,
): Map<string, PackedPoint> {
  const box = { width: options.width, height: options.height };
  const fixedIds = options.fixedIds ?? new Set<string>();
  const sectorBoundsById = options.sectorBoundsById;
  const sectorPaddingRadians = options.sectorPaddingRadians ?? 0.01;
  const maxNodeShift = options.maxNodeShift ?? 58;
  const iterations = options.optimizeIterations ?? 12;
  const anchors = new Map<string, PackedPoint>();
  for (const [id, point] of basePositions) anchors.set(id, { ...point });

  const childrenByParent = new Map<string, string[]>();
  for (const edge of options.edges) {
    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
  }
  for (const children of childrenByParent.values()) children.sort((a, b) => a.localeCompare(b));
  const subtreeMemo = new Map<string, Set<string>>();
  const subtreeMembers = (rootId: string, seen = new Set<string>()): Set<string> => {
    const memo = subtreeMemo.get(rootId);
    if (memo) return memo;
    const members = new Set<string>([rootId]);
    if (seen.has(rootId)) return members;
    seen.add(rootId);
    for (const child of childrenByParent.get(rootId) ?? []) {
      for (const member of subtreeMembers(child, seen)) members.add(member);
    }
    seen.delete(rootId);
    subtreeMemo.set(rootId, members);
    return members;
  };

  let current = new Map(basePositions);
  let currentGeometry = scoreEdgeGeometry({ edges: options.edges, positions: current, box });
  let currentScore = currentGeometry.score + movementPenalty(current, anchors);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (
      currentGeometry.edgeCrossings.length === 0 &&
      currentGeometry.edgeNodeIntersections.length === 0 &&
      currentGeometry.edgeOverlaps.length === 0
    ) {
      break;
    }

    const issueIds = issueNodeIds(currentGeometry);
    const swapIssueIds = swapIssueNodeIds(currentGeometry);
    let bestSwap: {
      positions: Map<string, PackedPoint>;
      geometry: EdgeGeometryScore;
      score: number;
    } | null = null;
    for (const children of swapIssueIds.size === 0 ? [] : childrenByParent.values()) {
      const candidateChildren = children.filter((child) =>
        current.has(child) &&
        !fixedIds.has(child) &&
        (!options.candidateNodeIds || options.candidateNodeIds.has(child)) &&
        [...subtreeMembers(child)].some((member) => swapIssueIds.has(member))
      );
      if (candidateChildren.length < 2) continue;
      const ordered = [...candidateChildren].sort((a, b) => {
        const pa = current.get(a)!;
        const pb = current.get(b)!;
        return Math.atan2(pa.y, pa.x) - Math.atan2(pb.y, pb.x);
      });
      for (let i = 0; i < ordered.length - 1; i += 1) {
        for (let j = i + 1; j < ordered.length; j += 1) {
          const a = ordered[i];
          const b = ordered[j];
          const candidate = cloneSwapSubtrees(
            current,
            subtreeMembers(a),
            subtreeMembers(b),
            a,
            b,
            fixedIds,
            sectorBoundsById,
            sectorPaddingRadians,
          );
          const candidateGeometry = scoreEdgeGeometry({ edges: options.edges, positions: candidate, box });
          const candidateScore = candidateGeometry.score + movementPenalty(candidate, anchors);
          const bestScore = bestSwap?.score ?? currentScore;
          if (candidateScore + 1e-6 < bestScore) {
            bestSwap = {
              positions: candidate,
              geometry: candidateGeometry,
              score: candidateScore,
            };
          }
        }
      }
    }
    if (bestSwap) {
      current = bestSwap.positions;
      currentGeometry = bestSwap.geometry;
      currentScore = bestSwap.score;
      continue;
    }

    const deltas = new Map<string, PackedPoint>();
    for (const hit of currentGeometry.edgeNodeIntersections) {
      if (options.candidateNodeIds && !options.candidateNodeIds.has(hit.nodeId)) continue;
      if (fixedIds.has(hit.nodeId)) continue;
      const source = current.get(hit.source);
      const target = current.get(hit.target);
      const node = current.get(hit.nodeId);
      if (!source || !target || !node) continue;
      const normal = perpendicularAwayFromSegment(node, source, target);
      addDelta(deltas, hit.nodeId, { x: normal.x * 14, y: normal.y * 14 });
    }

    for (const crossing of currentGeometry.edgeCrossings) {
      for (const [edge, other] of [[crossing.edgeA, crossing.edgeB], [crossing.edgeB, crossing.edgeA]] as const) {
        if (fixedIds.has(edge.target)) continue;
        if (options.candidateNodeIds && !options.candidateNodeIds.has(edge.target)) continue;
        const target = current.get(edge.target);
        const otherSource = current.get(other.source);
        const otherTarget = current.get(other.target);
        if (!target || !otherSource || !otherTarget) continue;
        const normal = perpendicularAwayFromSegment(target, otherSource, otherTarget);
        addDelta(deltas, edge.target, { x: normal.x * 22, y: normal.y * 22 });
      }
    }

    for (const overlap of currentGeometry.edgeOverlaps) {
      for (const edge of [overlap.edgeA, overlap.edgeB]) {
        if (fixedIds.has(edge.target)) continue;
        if (options.candidateNodeIds && !options.candidateNodeIds.has(edge.target)) continue;
        const source = current.get(edge.source);
        const target = current.get(edge.target);
        if (!source || !target) continue;
        const axis = unitVector(source, target);
        const normal = { x: -axis.y, y: axis.x };
        const sign = edge.edgeId.localeCompare(overlap.edgeA.edgeId) <= 0 ? 1 : -1;
        addDelta(deltas, edge.target, { x: normal.x * sign * 8, y: normal.y * sign * 8 });
      }
    }

    if (deltas.size === 0) break;

    const candidate = new Map<string, PackedPoint>();
    for (const [id, point] of current) {
      const delta = deltas.get(id);
      const anchor = anchors.get(id);
      if (!delta || !anchor) {
        candidate.set(id, point);
        continue;
      }
      if (fixedIds.has(id)) {
        candidate.set(id, point);
        continue;
      }
      const bounded = boundedDelta(delta, 18);
      let next = shifted(point, bounded.x, bounded.y);
      if (distance(next, anchor) > maxNodeShift) {
        const direction = unitVector(anchor, next);
        next = {
          x: anchor.x + direction.x * maxNodeShift,
          y: anchor.y + direction.y * maxNodeShift,
        };
      }
      const sectorBounds = sectorBoundsById?.get(id);
      if (sectorBounds) {
        next = clampPointToSector(next, sectorBounds, sectorPaddingRadians);
      }
      candidate.set(id, next);
    }

    const candidateGeometry = scoreEdgeGeometry({ edges: options.edges, positions: candidate, box });
    const candidateScore = candidateGeometry.score + movementPenalty(candidate, anchors);
    if (candidateScore + 1e-6 >= currentScore) break;
    current = candidate;
    currentGeometry = candidateGeometry;
    currentScore = candidateScore;
  }

  return current;
}

export function edgeAwarePackRectangularNodes(
  rawPositions: ReadonlyMap<string, PackedPoint>,
  options: EdgeAwarePackOptions,
): Map<string, PackedPoint> {
  const packed = packRectangularNodes(rawPositions, options);
  if (options.optimize === false || options.edges.length === 0) return packed;
  return optimizeEdgeAwarePositions(packed, options);
}

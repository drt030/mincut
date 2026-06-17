export type PackedPoint = { x: number; y: number };
export type SectorBounds = { start: number; end: number };

export type PackRectangularNodesOptions = {
  width: number;
  height: number;
  padding?: number;
  iterations?: number;
  fixedIds?: ReadonlySet<string>;
  sectorBoundsById?: ReadonlyMap<string, SectorBounds>;
  sectorPaddingRadians?: number;
};

const TWO_PI = Math.PI * 2;

function fallbackDirection(idA: string, idB: string): number {
  let hash = 0;
  const input = `${idA}:${idB}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1;
}

function normalizedTheta(point: PackedPoint): number {
  return ((Math.atan2(point.y, point.x) % TWO_PI) + TWO_PI) % TWO_PI;
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
  const theta = normalizedTheta(point);
  if (theta >= start && theta <= end) return point;

  const clampedTheta = angularDistance(theta, start) <= angularDistance(theta, end) ? start : end;
  const radius = Math.hypot(point.x, point.y);
  return {
    x: radius * Math.cos(clampedTheta),
    y: radius * Math.sin(clampedTheta),
  };
}

export function packRectangularNodes(
  rawPositions: ReadonlyMap<string, PackedPoint>,
  options: PackRectangularNodesOptions,
): Map<string, PackedPoint> {
  const padding = options.padding ?? 12;
  const iterations = options.iterations ?? 90;
  const minDx = options.width + padding;
  const minDy = options.height + padding;
  const fixedIds = options.fixedIds ?? new Set<string>();
  const sectorBoundsById = options.sectorBoundsById;
  const sectorPaddingRadians = options.sectorPaddingRadians ?? 0.01;
  const ids = [...rawPositions.keys()].sort((a, b) => a.localeCompare(b));
  const original = new Map<string, PackedPoint>();
  const current = new Map<string, PackedPoint>();
  for (const id of ids) {
    const point = rawPositions.get(id)!;
    original.set(id, { x: point.x, y: point.y });
    current.set(id, { x: point.x, y: point.y });
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let moved = false;
    const deltas = new Map<string, PackedPoint>();
    for (const id of ids) deltas.set(id, { x: 0, y: 0 });

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const idA = ids[i];
        const idB = ids[j];
        const a = current.get(idA)!;
        const b = current.get(idB)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = minDx - Math.abs(dx);
        const overlapY = minDy - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        const pushX = overlapX <= overlapY;
        const fixedA = fixedIds.has(idA);
        const fixedB = fixedIds.has(idB);
        if (fixedA && fixedB) continue;

        const axis = pushX ? "x" : "y";
        const rawSign = pushX ? Math.sign(dx) : Math.sign(dy);
        const sign = rawSign === 0 ? fallbackDirection(idA, idB) : rawSign;
        const push = ((pushX ? overlapX : overlapY) / 2) * 0.75;
        const deltaA = deltas.get(idA)!;
        const deltaB = deltas.get(idB)!;
        if (fixedA) {
          deltaB[axis] += sign * push * 2;
        } else if (fixedB) {
          deltaA[axis] -= sign * push * 2;
        } else {
          deltaA[axis] -= sign * push;
          deltaB[axis] += sign * push;
        }
      }
    }

    for (const id of ids) {
      if (fixedIds.has(id)) continue;
      const point = current.get(id)!;
      const delta = deltas.get(id)!;
      const anchor = original.get(id)!;
      const next = {
        x: point.x + delta.x + (anchor.x - point.x) * 0.015,
        y: point.y + delta.y + (anchor.y - point.y) * 0.015,
      };
      const sectorBounds = sectorBoundsById?.get(id);
      current.set(
        id,
        sectorBounds ? clampPointToSector(next, sectorBounds, sectorPaddingRadians) : next,
      );
    }

    if (!moved) break;
  }

  return current;
}

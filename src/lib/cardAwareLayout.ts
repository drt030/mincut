export type PackedPoint = { x: number; y: number };

export type PackRectangularNodesOptions = {
  width: number;
  height: number;
  padding?: number;
  iterations?: number;
  fixedIds?: ReadonlySet<string>;
};

function fallbackDirection(idA: string, idB: string): number {
  let hash = 0;
  const input = `${idA}:${idB}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1;
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
      current.set(id, {
        x: point.x + delta.x + (anchor.x - point.x) * 0.015,
        y: point.y + delta.y + (anchor.y - point.y) * 0.015,
      });
    }

    if (!moved) break;
  }

  return current;
}

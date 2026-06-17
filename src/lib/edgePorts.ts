export type RectPortSide = "left" | "right" | "top" | "bottom";

export type RectPortBox = {
  width: number;
  height: number;
};

export type RectPortPoint = {
  x: number;
  y: number;
};

export type RectPortEdge = {
  id: string;
  source: string;
  target: string;
};

export type RectEdgePorts = {
  sourceAnchorByEdge: Map<string, RectPortPoint>;
  targetAnchorByEdge: Map<string, RectPortPoint>;
};

export function rectPortSideForVector(
  dx: number,
  dy: number,
  box: RectPortBox,
): RectPortSide {
  if (dx === 0 && dy === 0) return "right";
  const horizontalReach = Math.abs(dx) / (box.width / 2);
  const verticalReach = Math.abs(dy) / (box.height / 2);
  if (horizontalReach >= verticalReach) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

export function rectPortOffset(
  index: number,
  count: number,
  side: RectPortSide,
  box: RectPortBox,
): number {
  if (count <= 1) return 0;
  const usable = side === "left" || side === "right"
    ? box.height - 16
    : box.width - 20;
  const preferredSpacing = side === "left" || side === "right" ? 18 : 20;
  const span = Math.min(usable, (count - 1) * preferredSpacing);
  return -span / 2 + (span * index) / (count - 1);
}

export function rectPortPoint(
  center: RectPortPoint,
  side: RectPortSide,
  offset: number,
  box: RectPortBox,
): RectPortPoint {
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  switch (side) {
    case "left":
      return { x: center.x - halfW, y: center.y + offset };
    case "right":
      return { x: center.x + halfW, y: center.y + offset };
    case "top":
      return { x: center.x + offset, y: center.y - halfH };
    case "bottom":
      return { x: center.x + offset, y: center.y + halfH };
  }
}

export function computeRectEdgePorts<T extends RectPortEdge>(
  edges: readonly T[],
  nodePositions: ReadonlyMap<string, RectPortPoint>,
  box: RectPortBox,
): RectEdgePorts {
  const sourceGroups = new Map<string, Array<T & { side: RectPortSide }>>();
  const targetGroups = new Map<string, Array<T & { side: RectPortSide }>>();
  for (const edge of edges) {
    const sourceCenter = nodePositions.get(edge.source);
    const targetCenter = nodePositions.get(edge.target);
    if (!sourceCenter || !targetCenter) continue;
    const sourceSide = rectPortSideForVector(
      targetCenter.x - sourceCenter.x,
      targetCenter.y - sourceCenter.y,
      box,
    );
    const targetSide = rectPortSideForVector(
      sourceCenter.x - targetCenter.x,
      sourceCenter.y - targetCenter.y,
      box,
    );
    const sourceKey = `${edge.source}:${sourceSide}`;
    const targetKey = `${edge.target}:${targetSide}`;
    if (!sourceGroups.has(sourceKey)) sourceGroups.set(sourceKey, []);
    if (!targetGroups.has(targetKey)) targetGroups.set(targetKey, []);
    sourceGroups.get(sourceKey)!.push({ ...edge, side: sourceSide });
    targetGroups.get(targetKey)!.push({ ...edge, side: targetSide });
  }

  const sourceAnchorByEdge = new Map<string, RectPortPoint>();
  const targetAnchorByEdge = new Map<string, RectPortPoint>();
  const sortByCounterpart = (
    items: Array<T & { side: RectPortSide }>,
    role: "source" | "target",
  ) => items.sort((a, b) => {
    const aCounterpart = nodePositions.get(role === "source" ? a.target : a.source);
    const bCounterpart = nodePositions.get(role === "source" ? b.target : b.source);
    const axis = a.side === "left" || a.side === "right" ? "y" : "x";
    const delta = (aCounterpart?.[axis] ?? 0) - (bCounterpart?.[axis] ?? 0);
    return delta === 0 ? a.id.localeCompare(b.id) : delta;
  });

  for (const group of sourceGroups.values()) {
    const sorted = sortByCounterpart(group, "source");
    sorted.forEach((edge, index) => {
      const center = nodePositions.get(edge.source);
      if (!center) return;
      sourceAnchorByEdge.set(
        edge.id,
        rectPortPoint(center, edge.side, rectPortOffset(index, sorted.length, edge.side, box), box),
      );
    });
  }
  for (const group of targetGroups.values()) {
    const sorted = sortByCounterpart(group, "target");
    sorted.forEach((edge, index) => {
      const center = nodePositions.get(edge.target);
      if (!center) return;
      targetAnchorByEdge.set(
        edge.id,
        rectPortPoint(center, edge.side, rectPortOffset(index, sorted.length, edge.side, box), box),
      );
    });
  }

  return { sourceAnchorByEdge, targetAnchorByEdge };
}

import test from "node:test";
import assert from "node:assert/strict";
import { packRectangularNodes } from "../src/lib/cardAwareLayout";
import { filterCanvasGraph } from "../src/lib/canvasGraph";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import { radialLayout } from "../src/lib/radialLayout";

const PX_SCALE = 2.4;
const DETAIL_BOX = { width: 136, height: 72 } as const;

function toCartesianPositions() {
  const graph = filterCanvasGraph(loadActiveGraphData());
  const layout = radialLayout(graph);
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, polar] of layout.positions) {
    positions.set(id, {
      x: polar.r * PX_SCALE * Math.cos(polar.theta),
      y: polar.r * PX_SCALE * Math.sin(polar.theta),
    });
  }
  return positions;
}

function overlapCount(positions: Map<string, { x: number; y: number }>): number {
  const boxes = [...positions].map(([id, point]) => ({
    id,
    left: point.x - DETAIL_BOX.width / 2,
    right: point.x + DETAIL_BOX.width / 2,
    top: point.y - DETAIL_BOX.height / 2,
    bottom: point.y + DETAIL_BOX.height / 2,
  }));
  let count = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (xOverlap > 2 && yOverlap > 2) count += 1;
    }
  }
  return count;
}

test("packRectangularNodes reduces real graph detail-card overlaps without dropping nodes", () => {
  const raw = toCartesianPositions();
  const before = overlapCount(raw);
  assert.ok(before > 20, `fixture should reproduce current detail-card crowding; got ${before}`);

  const packed = packRectangularNodes(raw, {
    width: DETAIL_BOX.width,
    height: DETAIL_BOX.height,
    padding: 24,
    fixedIds: new Set(["low_cost_parcel_sorting_robot_300k_rmb"]),
  });

  assert.equal(packed.size, raw.size);
  assert.deepEqual([...packed.keys()].sort(), [...raw.keys()].sort());

  const after = overlapCount(packed);
  assert.ok(after < before / 3, `expected packing to cut overlaps sharply; before=${before}, after=${after}`);
});

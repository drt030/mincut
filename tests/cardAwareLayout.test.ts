import test from "node:test";
import assert from "node:assert/strict";
import { packRectangularNodes } from "../src/lib/cardAwareLayout";
import { filterCanvasGraph } from "../src/lib/canvasGraph";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { loadActiveGraphData, loadGraphData } from "../src/lib/graphLoader";
import { radialLayout } from "../src/lib/radialLayout";

const PX_SCALE = 2.4;
const DETAIL_BOX = { width: 136, height: 72 } as const;
const TWO_PI = Math.PI * 2;

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

function norm(theta: number): number {
  return ((theta % TWO_PI) + TWO_PI) % TWO_PI;
}

function sectorForPoint(
  point: { x: number; y: number },
  sectors: ReadonlyMap<string, { center: number; width: number }>,
): string | null {
  const theta = norm(Math.atan2(point.y, point.x));
  for (const [id, sector] of sectors) {
    const start = sector.center - sector.width / 2;
    const end = sector.center + sector.width / 2;
    if (theta >= start - 1e-9 && theta <= end + 1e-9) return id;
  }
  return null;
}

test("packRectangularNodes preserves AI compute nodes inside their radial sectors when constrained", () => {
  const rootId = "ai_accelerator_module_hbm_cowos";
  const graph = filterCanvasGraph(loadGraphData(), rootId);
  const layout = radialLayout(graph, rootId);
  const raw = new Map<string, { x: number; y: number }>();
  const sectorBoundsById = new Map<string, { start: number; end: number }>();

  for (const [id, polar] of layout.positions) {
    raw.set(id, {
      x: polar.r * PX_SCALE * Math.cos(polar.theta),
      y: polar.r * PX_SCALE * Math.sin(polar.theta),
    });
    const sectorId = sectorForPoint(raw.get(id)!, layout.sectors);
    const sector = sectorId ? layout.sectors.get(sectorId) : null;
    if (sector) {
      sectorBoundsById.set(id, {
        start: sector.center - sector.width / 2,
        end: sector.center + sector.width / 2,
      });
    }
  }

  const packed = packRectangularNodes(raw, {
    width: DETAIL_BOX.width,
    height: DETAIL_BOX.height,
    padding: 36,
    fixedIds: new Set([rootId]),
    sectorBoundsById,
    sectorPaddingRadians: 0.1,
  });

  const escaped = [...packed]
    .flatMap(([id, point]) => {
      if (id === rootId) return [];
      const rawSector = sectorForPoint(raw.get(id)!, layout.sectors);
      const packedSector = sectorForPoint(point, layout.sectors);
      return rawSector === packedSector
        ? []
        : [`${id}: ${rawSector} -> ${packedSector}`];
    })
    .sort((a, b) => a.localeCompare(b));

  assert.deepEqual(escaped, []);

  const boundaryHuggers = [...packed]
    .flatMap(([id, point]) => {
      if (id === rootId) return [];
      const packedSector = sectorForPoint(point, layout.sectors);
      const sector = packedSector ? layout.sectors.get(packedSector) : null;
      if (!sector) return [];
      const theta = norm(Math.atan2(point.y, point.x));
      const start = sector.center - sector.width / 2;
      const end = sector.center + sector.width / 2;
      const margin = Math.min(Math.abs(theta - start), Math.abs(end - theta));
      return margin >= 0.09 ? [] : [`${id}: ${packedSector} margin=${margin.toFixed(3)}`];
    })
    .sort((a, b) => a.localeCompare(b));

  assert.deepEqual(
    boundaryHuggers,
    [],
    "packed nodes should not sit directly on sector borders where they read as neighboring-branch nodes",
  );
});

test("packRectangularNodes keeps commercial route nodes inside final rendered sectors", () => {
  const failures: string[] = [];

  for (const route of DOMAIN_ROUTES) {
    const graph = filterCanvasGraph(loadActiveGraphData(route.rootId), route.rootId);
    const layout = radialLayout(graph, route.rootId);
    const raw = new Map<string, { x: number; y: number }>();
    const sectorBoundsById = new Map<string, { start: number; end: number }>();

    for (const [id, polar] of layout.positions) {
      raw.set(id, {
        x: polar.r * PX_SCALE * Math.cos(polar.theta),
        y: polar.r * PX_SCALE * Math.sin(polar.theta),
      });
      const sectorId = sectorForPoint(raw.get(id)!, layout.sectors);
      const sector = sectorId ? layout.sectors.get(sectorId) : null;
      if (sector) {
        sectorBoundsById.set(id, {
          start: sector.center - sector.width / 2,
          end: sector.center + sector.width / 2,
        });
      }
    }

    const packed = packRectangularNodes(raw, {
      width: DETAIL_BOX.width,
      height: DETAIL_BOX.height,
      padding: 36,
      fixedIds: new Set([route.rootId]),
      sectorBoundsById,
      sectorPaddingRadians: 0.1,
    });

    for (const [id, point] of packed) {
      if (id === route.rootId) continue;
      const rawSector = sectorForPoint(raw.get(id)!, layout.sectors);
      const packedSector = sectorForPoint(point, layout.sectors);
      if (rawSector !== packedSector) {
        failures.push(`${route.slug}:${id}: ${rawSector} -> ${packedSector}`);
        continue;
      }
      const sector = packedSector ? layout.sectors.get(packedSector) : null;
      if (!sector) continue;
      const theta = norm(Math.atan2(point.y, point.x));
      const start = sector.center - sector.width / 2;
      const end = sector.center + sector.width / 2;
      const margin = Math.min(Math.abs(theta - start), Math.abs(end - theta));
      const requiredMargin = Math.min(0.09, Math.max(0, sector.width / 2 - 1e-3));
      if (margin < requiredMargin) {
        failures.push(`${route.slug}:${id}: ${packedSector} margin=${margin.toFixed(3)}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});

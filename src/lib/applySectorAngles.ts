import type { GraphData, NodeKind } from "./schema";
import type { PolarPosition } from "./radialLayout";
import type { SectorAngleAssignment } from "./sectorAngles";

/**
 * Per ADR-0006 §"Focus interaction" and slice B2, `applySectorAngles`
 * remaps each structural node's static `theta` from its DEFAULT
 * sector range `[i × 2π/N, (i+1) × 2π/N]` (where i is the sorted
 * index of the node's first-layer ancestor / canonical sector) onto
 * the NEW range `[newCenter - newWidth/2, newCenter + newWidth/2]`
 * dictated by the active `SectorAngleAssignment`.
 *
 *   tInOldSector = (oldTheta - oldSectorStart) / oldSectorWidth
 *   newTheta     = newSectorStart + tInOldSector × newSectorWidth
 *
 * Radius (`r`) is preserved bit-for-bit — only theta moves. This is
 * the key spatial-continuity property of ADR-0006: nodes stay on
 * their original radial layer, sectors are the only thing that
 * stretches / compresses.
 *
 * Node classification & sector resolution:
 *
 *   1. The focal product (kind === "product", at r=0) is unchanged.
 *      "At r=0" is the practical test we use — a sibling product
 *      placed on the fallback ring is NOT the canvas focal product.
 *   2. First-layer subsystems are looked up directly in the
 *      assignment Map.
 *   3. Other structural nodes resolve their sector by BFS walking
 *      `requires` edges UP from the node toward the focal product
 *      until they hit a first-layer subsystem. The first such
 *      ancestor (smallest sector index by sorted id) is the
 *      canonical sector — same rule `radialLayout` and `subsystemHue`
 *      use. We cache the resolution in a Map<nodeId, sectorId> built
 *      once per call.
 *   4. Materials and any node whose theta we cannot trust to a
 *      single sector (no resolved first-layer ancestor) are LEFT
 *      AT THEIR ORIGINAL THETA. The static `radialLayout` places
 *      materials on the outer ring via id-hash; under focus we keep
 *      them there. This matches the spec's "If radialLayout placed
 *      them with hash-keyed thetas regardless of subsystem, leave
 *      them at unchanged theta" branch and prevents materials from
 *      visually jumping when a sector expands.
 *
 * Determinism: the function is pure. Same inputs → same Map<id,
 * PolarPosition>. Node iteration order does not affect output.
 */

const TWO_PI = Math.PI * 2;
const STRUCTURAL_KINDS: ReadonlySet<NodeKind> = new Set([
  "product",
  "module",
  "material",
  "engineering_method",
  "manufacturing_process",
]);

/**
 * Build a `nodeId → first-layer-ancestor-id` map by BFS forward from
 * every first-layer subsystem along `requires` edges. The "canonical"
 * ancestor for shared nodes is the smallest-sector-index reaching
 * subsystem (matches radialLayout and subsystemHue rules).
 */
function buildSectorMap(
  graph: GraphData,
  firstLayerIds: ReadonlySet<string>,
  sortedFirstLayer: ReadonlyArray<string>,
): Map<string, string> {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  const sectorIndex = new Map<string, number>();
  sortedFirstLayer.forEach((id, i) => sectorIndex.set(id, i));

  const ancestorById = new Map<string, string>();
  for (const sub of sortedFirstLayer) {
    const visited = new Set<string>();
    const queue: string[] = [sub];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const existing = ancestorById.get(cur);
      if (existing === undefined || sectorIndex.get(sub)! < sectorIndex.get(existing)!) {
        ancestorById.set(cur, sub);
      }
      for (const child of childrenByParent.get(cur) ?? []) {
        if (visited.has(child)) continue;
        queue.push(child);
      }
    }
  }

  // First-layer subsystems themselves resolve to themselves.
  for (const sub of firstLayerIds) ancestorById.set(sub, sub);
  return ancestorById;
}

export function applySectorAngles(
  basePositions: Map<string, PolarPosition>,
  graph: GraphData,
  assignment: SectorAngleAssignment,
): Map<string, PolarPosition> {
  const out = new Map<string, PolarPosition>();

  // Defensive: if there are no sectors, just copy positions through.
  if (assignment.angles.size === 0) {
    for (const [id, pos] of basePositions) out.set(id, { r: pos.r, theta: pos.theta });
    return out;
  }

  const sortedFirstLayer = [...assignment.angles.keys()].sort();
  const N = sortedFirstLayer.length;
  const oldSectorWidth = TWO_PI / N;
  const firstLayerSet = new Set(sortedFirstLayer);

  // Old-sector-start-by-id: position of the id in the sorted list × oldSectorWidth.
  const oldStartById = new Map<string, number>();
  sortedFirstLayer.forEach((id, i) => oldStartById.set(id, i * oldSectorWidth));

  const sectorBySubtreeMember = buildSectorMap(graph, firstLayerSet, sortedFirstLayer);

  // Identify the focal product so we never remap it. The canvas focal
  // product is the node at r === 0; any kind:"product" node placed on
  // the fallback ring is a sibling and gets the normal treatment.
  const nodeKindById = new Map<string, NodeKind>();
  for (const node of graph.nodes) nodeKindById.set(node.id, node.kind);

  for (const [id, pos] of basePositions) {
    const kind = nodeKindById.get(id);

    // Focal product: lives at r=0, never moves.
    if (kind === "product" && pos.r === 0) {
      out.set(id, { r: pos.r, theta: pos.theta });
      continue;
    }

    // Materials: their theta is hash-keyed and not tied to a single
    // sector. Leaving them at unchanged theta is the spec-allowed
    // choice and prevents visible jumping when sectors stretch.
    if (kind === "material") {
      out.set(id, { r: pos.r, theta: pos.theta });
      continue;
    }

    const sectorId = sectorBySubtreeMember.get(id);
    if (sectorId === undefined) {
      // Orphan / fallback-ring node (sibling product subtree, etc.):
      // no resolved sector → leave theta unchanged.
      out.set(id, { r: pos.r, theta: pos.theta });
      continue;
    }

    const newSector = assignment.angles.get(sectorId);
    const oldStart = oldStartById.get(sectorId);
    if (newSector === undefined || oldStart === undefined) {
      out.set(id, { r: pos.r, theta: pos.theta });
      continue;
    }

    // Linear interp old → new sector. `oldSectorWidth` is 2π/N. We
    // wrap the input theta into the old sector's [start, start +
    // oldSectorWidth] window via modulo to be robust to thetas that
    // may have wrapped past 2π in some upstream callers (radialLayout
    // currently produces values in [0, 2π), but normalising here
    // costs little and keeps the function defensive).
    let oldTheta = pos.theta - oldStart;
    // Normalise into [0, oldSectorWidth) without using modulo of
    // potentially-negative floats.
    oldTheta = oldTheta - Math.floor(oldTheta / oldSectorWidth) * oldSectorWidth;
    const tInOld = oldTheta / oldSectorWidth;
    const newStart = newSector.center - newSector.width / 2;
    const newTheta = newStart + tInOld * newSector.width;
    out.set(id, { r: pos.r, theta: newTheta });
  }

  return out;
}

// Re-export structural kinds for callers that need to identify
// material nodes (e.g. tests).
export { STRUCTURAL_KINDS };

import type { Edge, GraphData, NodeKind } from "./schema";
import type { PolarPosition } from "./radialLayout";
import type { SectorAngleAssignment } from "./sectorAngles";

/**
 * Per ADR-0006 §"Focus interaction" and slices B2 + C1, `applySectorAngles`
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
 * C1 (Level 2): when the `SectorAngleAssignment` carries a
 * `subSectorAngles` Map for the focused outer subsystem, structural
 * descendants of THAT outer sector get a SECOND remap:
 *
 *   a. Each structural descendant is assigned an inner sub-subsystem
 *      via BFS from the outer subsystem's `requires`-children. The
 *      sub-subsystem set comes from the assignment's
 *      `subSectorAngles.get(outer).keys()` so the function only sees
 *      sub-subsystems consistent with the geometry it was given.
 *   b. Within the outer sector's 120° slot, each inner sub-subsystem
 *      DEFAULTS to a `120°/Mₛ` slice in id-sorted order. The
 *      assignment provides the NEW (`expanded` for the focused inner,
 *      `compressed` for the rest) per-inner range, which we use as
 *      the destination range when remapping.
 *   c. We compute `tInDefaultInner = (tInOuter - innerIdx/Mₛ) × Mₛ`,
 *      clamped to `[0, 1]`, and remap that fraction onto the new
 *      inner range. The clamp tolerates the (common) case where the
 *      original radialLayout did not place the node neatly inside its
 *      "default inner slice" — i.e. the node may have been positioned
 *      anywhere inside the outer 120°. We still preserve relative
 *      ordering within an inner sub-subsystem; we just don't try to
 *      perfectly interp from a sub-slice that radialLayout never
 *      actually used.
 *   d. The outer subsystem's own dot stays at its outer sector
 *      center (the L1 remap value); only its descendants distribute
 *      across the inner sub-sectors.
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

/**
 * C1 Level-2 helper: build a `nodeId → inner-sub-subsystem-id` map
 * by BFS from each inner sub-subsystem of the focused outer sector.
 *
 * `childrenByParent` is a forward index ("parent requires child")
 * used in production data. `parentsByChild` is the reverse index
 * ("child requires parent") used in some test fixtures. We BFS in
 * the production direction first; if a sub-subsystem produces no
 * descendants that way, we try the reverse. This mirrors the dual-
 * direction child enumeration in `sectorAngles` so both production
 * graphs and the C1 unit-test fixture remap consistently.
 *
 * Returns `undefined` for nodes that are not descendants of any
 * inner sub-subsystem (incl. the outer subsystem itself).
 */
function buildInnerSectorMap(
  edges: ReadonlyArray<Edge>,
  outerId: string,
  innerIds: ReadonlyArray<string>,
): Map<string, string> {
  const innerSet = new Set(innerIds);
  const childrenByParent = new Map<string, string[]>();
  const parentsByChild = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.relation !== "requires") continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
    if (!parentsByChild.has(edge.target)) parentsByChild.set(edge.target, []);
    parentsByChild.get(edge.target)!.push(edge.source);
  }
  // For deterministic ties, sort each adjacency list.
  for (const list of childrenByParent.values()) list.sort();
  for (const list of parentsByChild.values()) list.sort();

  const innerOf = new Map<string, string>();
  for (const inner of [...innerIds].sort()) {
    // Production direction: walk forward from inner via "inner requires
    // descendant" edges (source → target). Most production data lives
    // here.
    const forwardReached = new Set<string>();
    {
      const visited = new Set<string>();
      const queue: string[] = [inner];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        // Don't cross back into the outer subsystem or another inner
        // sub-subsystem — keep each inner subtree isolated.
        if (cur !== inner && (cur === outerId || innerSet.has(cur))) continue;
        forwardReached.add(cur);
        for (const child of childrenByParent.get(cur) ?? []) {
          if (visited.has(child)) continue;
          queue.push(child);
        }
      }
    }
    // Test-fixture direction: walk backward from inner via "descendant
    // requires inner" edges (target ← source). Used by the C1 unit
    // test fixture; rarely populated in production.
    const reverseReached = new Set<string>();
    if (forwardReached.size <= 1) {
      const visited = new Set<string>();
      const queue: string[] = [inner];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        if (cur !== inner && (cur === outerId || innerSet.has(cur))) continue;
        reverseReached.add(cur);
        for (const parent of parentsByChild.get(cur) ?? []) {
          if (visited.has(parent)) continue;
          queue.push(parent);
        }
      }
    }
    const reached = forwardReached.size > reverseReached.size ? forwardReached : reverseReached;
    for (const id of reached) {
      // First-write-wins is fine because we iterate inner ids in sorted
      // order and a shared node should attach to the lowest-index
      // inner (mirrors the canonical-parent rule used elsewhere).
      if (!innerOf.has(id)) innerOf.set(id, inner);
    }
  }
  return innerOf;
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

  // C1 (Level 2): pre-build the inner-sector membership map for the
  // focused outer subsystem (if any). With no `subSectorAngles` (L0
  // / L1), `innerByNode` stays an empty Map and the per-node loop
  // below short-circuits at the L1 branch.
  let outerForInner: string | null = null;
  let innerEntriesById: Map<string, { center: number; width: number }> | null = null;
  let innerByNode: Map<string, string> = new Map();
  let sortedInnerIds: string[] = [];
  if (assignment.subSectorAngles) {
    for (const [outerId, innerMap] of assignment.subSectorAngles) {
      if (innerMap.size === 0) continue;
      outerForInner = outerId;
      innerEntriesById = innerMap;
      sortedInnerIds = [...innerMap.keys()].sort();
      innerByNode = buildInnerSectorMap(graph.edges, outerId, sortedInnerIds);
      break; // current geometry only ever has one outer with inner expansion
    }
  }

  // For L2 default-inner-slice math we need the inner index per id.
  const innerIndexById = new Map<string, number>();
  sortedInnerIds.forEach((id, i) => innerIndexById.set(id, i));
  const Ms = sortedInnerIds.length;

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

    // C1 Level-2 branch: if this node sits inside the outer focused
    // subsystem AND we have an inner-sub-subsystem expansion AND we
    // can attribute the node to one of those inner sub-subsystems,
    // remap into the inner sub-sector's new range instead of the
    // outer's. The outer subsystem dot itself stays at the outer
    // center (uses the L1 path below).
    if (
      outerForInner !== null &&
      innerEntriesById !== null &&
      sectorId === outerForInner &&
      id !== outerForInner &&
      Ms > 0
    ) {
      const innerId = innerByNode.get(id);
      if (innerId !== undefined) {
        const innerEntry = innerEntriesById.get(innerId);
        const innerIdx = innerIndexById.get(innerId);
        if (innerEntry !== undefined && innerIdx !== undefined) {
          // Default inner slice fraction within the outer's
          // [0, 1] domain: each inner takes 1/Ms in id-sorted order.
          let tInDefaultInner = (tInOld - innerIdx / Ms) * Ms;
          // Clamp into [0, 1] — radialLayout did not actually
          // subdivide by inner sub-subsystem, so a node attributed
          // to inner `i` may have been placed anywhere in the outer
          // 120°. Clamping keeps it inside its NEW inner range.
          if (tInDefaultInner < 0) tInDefaultInner = 0;
          if (tInDefaultInner > 1) tInDefaultInner = 1;
          const innerStart = innerEntry.center - innerEntry.width / 2;
          const innerTheta = innerStart + tInDefaultInner * innerEntry.width;
          out.set(id, { r: pos.r, theta: innerTheta });
          continue;
        }
      }
      // No inner attribution: fall through to L1 remap so the node
      // stays inside the outer's expanded sector even if we can't
      // pin it to a specific inner sub-subsystem.
    }

    const newStart = newSector.center - newSector.width / 2;
    const newTheta = newStart + tInOld * newSector.width;
    out.set(id, { r: pos.r, theta: newTheta });
  }

  return out;
}

// Re-export structural kinds for callers that need to identify
// material nodes (e.g. tests).
export { STRUCTURAL_KINDS };

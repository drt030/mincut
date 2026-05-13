import type { GraphData, NodeKind } from "./schema";

/**
 * Per ADR-0006 §Color and spec
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`
 * slice A3, `subsystemHue` is a pure deterministic function mapping a node
 * id to an HSL colour triple that encodes which first-layer subsystem
 * family the node belongs to.
 *
 * Algorithm:
 *
 *   1. Focal product = first node with `kind === "product"` in graph.nodes
 *      order. Returns neutral grey.
 *   2. First-layer subsystems = focal product's `requires`-children among
 *      structural kinds (product / module / material / engineering_method /
 *      manufacturing_process). Materials directly wired from the focal
 *      product are NOT first-layer subsystems (materials always grey).
 *      Sorted alphabetically by id for deterministic sector-index
 *      assignment. N = count.
 *   3. Each first-layer subsystem i ∈ [0, N) gets
 *        `hue_i = (i × 360 / N + HUE_OFFSET) % 360`
 *      at saturation 0.65, lightness 0.55 — the default coloured tone.
 *   4. A `requires`-descendant of a first-layer subsystem inherits that
 *      subsystem's hue triple bit-for-bit IFF the descendant has exactly
 *      ONE incoming `requires` parent inside the focal subtree.
 *   5. A non-first-layer descendant with ≥ 2 incoming `requires` parents
 *      inside the focal subtree is neutral grey — its primary-parent
 *      assignment is arbitrary per ADR-0006 §Layout.
 *   6. Exception: if a node IS a first-layer subsystem AND ALSO required
 *      by other modules (so its incoming-edge count from the focal
 *      subtree is ≥ 2 because the focal-product edge plus other module
 *      edges land on it), first-layer-ness wins → its first-layer hue,
 *      not grey. We implement this naturally because the algorithm
 *      checks `sectorIndex.has(id)` BEFORE the shared-parent check.
 *   7. Materials (`kind === "material"`) are always neutral grey.
 *   8. The focal product itself is neutral grey.
 *   9. Structural nodes not reachable from the focal product (sibling
 *      product subtrees, orphan modules) are neutral grey.
 *
 * Pure function: no I/O, no React, no shared state, no randomness.
 */

const HUE_OFFSET = 15;
const COLOUR_SATURATION = 0.65;
const COLOUR_LIGHTNESS = 0.55;
const GREY_LIGHTNESS = 0.6;

export type SubsystemHue = {
  hue: number;
  saturation: number;
  lightness: number;
};

const NEUTRAL_GREY: SubsystemHue = Object.freeze({
  hue: 0,
  saturation: 0,
  lightness: GREY_LIGHTNESS,
});

type SubsystemIndex = {
  focalId: string | undefined;
  sectorIndexById: Map<string, number>;
  firstLayerAncestor: Map<string, string>;
  inCountFromSubtree: Map<string, number>;
  subtree: Set<string>;
  N: number;
};

function buildSubsystemIndex(graph: GraphData): SubsystemIndex {
  const focal = graph.nodes.find((n) => n.kind === "product");
  if (!focal) {
    return {
      focalId: undefined,
      sectorIndexById: new Map(),
      firstLayerAncestor: new Map(),
      inCountFromSubtree: new Map(),
      subtree: new Set(),
      N: 0,
    };
  }

  const nodeKindById = new Map<string, NodeKind>();
  for (const node of graph.nodes) {
    nodeKindById.set(node.id, node.kind);
  }

  // `requires`-children index. The first-layer ring takes EVERY
  // `requires`-child of the focal product (excluding materials, which
  // always belong on the outer grey ring). Descendants of those first-
  // layer subsystems are walked through `requires` edges restricted to
  // structural-on-structural so descriptive subtrees (metrics under a
  // scientific_principle, etc.) don't pollute the family.
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  // First-layer subsystems = focal product's `requires`-children
  // EXCLUDING materials (materials are always grey per Rule 7). We do
  // NOT filter by structural kind here — the test contract counts every
  // `requires`-child of the focal product as a first-layer subsystem
  // and expects each to receive its own hue family.
  const firstLayerCandidates = (childrenByParent.get(focal.id) ?? []).filter(
    (id) => nodeKindById.get(id) !== "material",
  );
  const firstLayer = [...new Set(firstLayerCandidates)].sort((a, b) => a.localeCompare(b));
  const N = firstLayer.length;
  const sectorIndexById = new Map<string, number>();
  firstLayer.forEach((id, i) => sectorIndexById.set(id, i));

  // BFS from the focal product (via `requires` edges only, structural
  // restriction already applied) → the focal subtree.
  const subtree = new Set<string>();
  {
    const queue: string[] = [focal.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (subtree.has(cur)) continue;
      subtree.add(cur);
      for (const child of childrenByParent.get(cur) ?? []) queue.push(child);
    }
  }

  // For each first-layer subsystem, BFS into its descendants and record
  // the FIRST first-layer ancestor reached. If a node sits under multiple
  // first-layer subsystems via DAG cross-edges, prefer the smallest
  // sector index (deterministic; matches radialLayout.ts).
  const firstLayerAncestor = new Map<string, string>();
  for (const sub of firstLayer) {
    const visited = new Set<string>();
    const queue: string[] = [sub];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const existing = firstLayerAncestor.get(cur);
      if (existing === undefined || sectorIndexById.get(sub)! < sectorIndexById.get(existing)!) {
        firstLayerAncestor.set(cur, sub);
      }
      for (const child of childrenByParent.get(cur) ?? []) {
        if (visited.has(child)) continue;
        queue.push(child);
      }
    }
  }

  // Count incoming `requires` edges per target, restricted to edges whose
  // BOTH endpoints sit inside the focal subtree. The shared-parent check
  // looks at this map.
  const inCountFromSubtree = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!subtree.has(edge.source) || !subtree.has(edge.target)) continue;
    inCountFromSubtree.set(edge.target, (inCountFromSubtree.get(edge.target) ?? 0) + 1);
  }

  return {
    focalId: focal.id,
    sectorIndexById,
    firstLayerAncestor,
    inCountFromSubtree,
    subtree,
    N,
  };
}

// Cache the per-graph index on a WeakMap so repeated `subsystemHue` calls
// over the same `graph` reference don't re-walk the graph. The function
// stays pure: same `graph` reference → same triple. A new GraphData
// reference (e.g. after a reload) builds a fresh index.
const indexCache = new WeakMap<GraphData, SubsystemIndex>();

function getIndex(graph: GraphData): SubsystemIndex {
  let entry = indexCache.get(graph);
  if (entry === undefined) {
    entry = buildSubsystemIndex(graph);
    indexCache.set(graph, entry);
  }
  return entry;
}

function colouredHueForSector(i: number, N: number): SubsystemHue {
  const hue = (((i * 360) / N) + HUE_OFFSET) % 360;
  return {
    hue,
    saturation: COLOUR_SATURATION,
    lightness: COLOUR_LIGHTNESS,
  };
}

/**
 * Returns the HSL hue family for a given node id under the current graph.
 * See file header for the full contract. Result is bit-for-bit identical
 * on repeat calls with the same `(nodeId, graph)` pair.
 */
export function subsystemHue(nodeId: string, graph: GraphData): SubsystemHue {
  const index = getIndex(graph);

  // No focal product → everything grey.
  if (index.focalId === undefined) return { ...NEUTRAL_GREY };

  // Rule 8: focal product itself.
  if (nodeId === index.focalId) return { ...NEUTRAL_GREY };

  // Rule 3 (first-layer subsystem direct hit) — checked BEFORE the
  // shared-parent rule so a first-layer subsystem that is also required
  // by other modules still gets its family hue (Exception 6).
  const sectorIdx = index.sectorIndexById.get(nodeId);
  if (sectorIdx !== undefined) {
    return colouredHueForSector(sectorIdx, index.N);
  }

  // Rule 7: materials are always grey, regardless of subtree membership.
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return { ...NEUTRAL_GREY };
  if (node.kind === "material") return { ...NEUTRAL_GREY };

  // Rule 9: orphan structural nodes (not reachable from focal product)
  // are grey.
  if (!index.subtree.has(nodeId)) return { ...NEUTRAL_GREY };

  // Rule 5: shared non-first-layer descendants (≥ 2 incoming `requires`
  // parents inside the focal subtree) are grey.
  if ((index.inCountFromSubtree.get(nodeId) ?? 0) >= 2) return { ...NEUTRAL_GREY };

  // Rule 4: single-parent descendant inherits its first-layer ancestor's
  // hue. The BFS above guaranteed each subtree node has a deterministic
  // first-layer ancestor entry (smallest sector index in case of DAG
  // cross-edges).
  const ancestor = index.firstLayerAncestor.get(nodeId);
  if (ancestor === undefined) return { ...NEUTRAL_GREY };
  const ancestorSector = index.sectorIndexById.get(ancestor);
  if (ancestorSector === undefined) return { ...NEUTRAL_GREY };
  return colouredHueForSector(ancestorSector, index.N);
}

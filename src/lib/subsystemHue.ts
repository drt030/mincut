import type { Edge, GraphData } from "./schema";
import { defaultFocalProduct } from "./graphTraversal";
import { isArtifactCanvasNode, isCanvasTreeEdge, isKnowHowNode } from "./canvasGraph";

/**
 * Per ADR-0006 §Color and spec
 * `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`
 * slice A3, `subsystemHue` is a pure deterministic function mapping a node
 * id to an HSL colour triple that encodes which first-layer subsystem
 * family the node belongs to.
 *
 * Algorithm:
 *
 *   1. Focal root = explicit `rootId` when supplied, otherwise the
 *      canonical default focal product (`defaultFocalProduct`: the active
 *      v0 target, falling back to first product in graph order). Returns
 *      neutral grey.
 *   2. First-layer subsystems = focal root's canvas-tree children. The
 *      canvas tree relation set is shared with `filterCanvasGraph`:
 *      `requires` plus `implemented_by` edges whose target is know-how.
 *      Sorted alphabetically by id for deterministic sector-index
 *      assignment. N = count.
 *   3. Each first-layer subsystem i ∈ [0, N) gets
 *        `hue_i = (i × 360 / N + HUE_OFFSET) % 360`
 *      at saturation 0.65, lightness 0.55 — the default coloured tone.
 *   4. A canvas-tree descendant of a first-layer subsystem inherits that
 *      subsystem's hue triple bit-for-bit.
 *   5. A non-first-layer descendant with ≥ 2 incoming canvas-tree parents
 *      inside the focal subtree inherits exactly one primary parent's
 *      hue family. Weighted canvas-tree edges pick the highest-weight
 *      parent; ties and unweighted edges use the stable sector/id
 *      fallback shared with `radialLayout`.
 *   6. Exception: if a node IS a first-layer subsystem AND ALSO required
 *      by other modules (so its incoming-edge count from the focal
 *      subtree is ≥ 2 because the focal-product edge plus other module
 *      edges land on it), first-layer-ness wins → its first-layer hue,
 *      not grey. We implement this naturally because the algorithm
 *      checks `sectorIndex.has(id)` BEFORE the shared-parent check.
 *   7. Reachable materials inherit their canonical first-layer ancestor
 *      like other visible artifact nodes.
 *   8. The focal product itself is a near-white neutral root colour.
 *   9. Structural nodes not reachable from the focal product (sibling
 *      product subtrees, orphan modules) are neutral grey.
 *
 * Pure function: no I/O, no React, no shared state, no randomness.
 */

const HUE_OFFSET = 15;
const COLOUR_SATURATION = 0.65;
const COLOUR_LIGHTNESS = 0.55;
const GREY_LIGHTNESS = 0.6;
const ROOT_LIGHTNESS = 0.98;

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

const ROOT_NEUTRAL: SubsystemHue = Object.freeze({
  hue: 0,
  saturation: 0,
  lightness: ROOT_LIGHTNESS,
});

type SubsystemIndex = {
  focalId: string | undefined;
  sectorIndexById: Map<string, number>;
  firstLayerAncestor: Map<string, string>;
  canonicalFirstLayerAncestor: Map<string, string>;
  subtree: Set<string>;
  N: number;
};

type IncomingCanvasTreeEdge = {
  source: string;
  edge: Edge;
};

type SharedParentCandidate = {
  source: string;
  weight: number | undefined;
  sourceIsKnowHow: boolean;
  sourceIsMaterial: boolean;
};

function edgeWeight(edge: Edge): number | undefined {
  return typeof edge.weight === "number" && Number.isFinite(edge.weight)
    ? edge.weight
    : undefined;
}

function buildSubsystemIndex(graph: GraphData, rootId?: string | null): SubsystemIndex {
  const requestedRoot = rootId ? graph.nodes.find((n) => n.id === rootId) : undefined;
  const focal = requestedRoot ?? defaultFocalProduct(graph);
  if (!focal) {
    return {
      focalId: undefined,
      sectorIndexById: new Map(),
      firstLayerAncestor: new Map(),
      canonicalFirstLayerAncestor: new Map(),
      subtree: new Set(),
      N: 0,
    };
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  // Canvas-tree children index. The first-layer ring takes EVERY
  // canvas-tree child of the focal product. This deliberately mirrors
  // filterCanvasGraph/radialLayout so visible implemented_by know-how
  // nodes inherit the same family ancestry that placed them on-canvas.
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  // First-layer subsystems = focal product's canvas-tree children. We do
  // NOT filter by structural kind here — the historical test contract
  // counted every `requires`-child of the focal product as a first-layer
  // subsystem, and the canvas-tree relation set now extends that same
  // rule to visible know-how children and direct key materials.
  const firstLayerCandidates = childrenByParent.get(focal.id) ?? [];
  const firstLayer = [...new Set(firstLayerCandidates)].sort((a, b) => a.localeCompare(b));
  const N = firstLayer.length;
  const sectorIndexById = new Map<string, number>();
  firstLayer.forEach((id, i) => sectorIndexById.set(id, i));

  // BFS from the focal product via canvas-tree edges → the focal subtree.
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

  const incomingByTarget = new Map<string, IncomingCanvasTreeEdge[]>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!incomingByTarget.has(edge.target)) incomingByTarget.set(edge.target, []);
    incomingByTarget.get(edge.target)!.push({ source: edge.source, edge });
  }

  const canonicalParentByShared = new Map<string, string>();
  for (const [targetId, inEdges] of incomingByTarget) {
    if (sectorIndexById.has(targetId)) continue;
    if (targetId === focal.id) continue;
    if (!subtree.has(targetId)) continue;

    const subtreeEdges = inEdges.filter(
      ({ source }) => subtree.has(source) && firstLayerAncestor.has(source),
    );
    if (subtreeEdges.length < 2) continue;

    const target = nodeById.get(targetId);
    const targetIsArtifact = target !== undefined && isArtifactCanvasNode(target);
    const candidates: SharedParentCandidate[] = subtreeEdges.map(({ source, edge }) => {
      const sourceNode = nodeById.get(source);
      return {
        source,
        weight: edgeWeight(edge),
        sourceIsKnowHow: sourceNode !== undefined && isKnowHowNode(sourceNode),
        sourceIsMaterial: sourceNode?.kind === "material",
      };
    });
    candidates.sort((a, b) => {
      if (targetIsArtifact && a.sourceIsKnowHow !== b.sourceIsKnowHow) {
        return a.sourceIsKnowHow ? 1 : -1;
      }
      if (targetIsArtifact && a.sourceIsMaterial !== b.sourceIsMaterial) {
        return a.sourceIsMaterial ? 1 : -1;
      }
      const aw = a.weight ?? Number.NEGATIVE_INFINITY;
      const bw = b.weight ?? Number.NEGATIVE_INFINITY;
      if (aw !== bw) return bw - aw;
      const ai = sectorIndexById.get(firstLayerAncestor.get(a.source)!)!;
      const bi = sectorIndexById.get(firstLayerAncestor.get(b.source)!)!;
      if (ai !== bi) return ai - bi;
      return a.source.localeCompare(b.source);
    });
    canonicalParentByShared.set(targetId, candidates[0].source);
  }

  const canonicalFirstLayerAncestor = new Map<string, string>();
  const resolveCanonicalAncestor = (
    id: string,
    visiting = new Set<string>(),
  ): string | undefined => {
    if (sectorIndexById.has(id)) {
      canonicalFirstLayerAncestor.set(id, id);
      return id;
    }

    const memo = canonicalFirstLayerAncestor.get(id);
    if (memo !== undefined) return memo;
    if (visiting.has(id)) return firstLayerAncestor.get(id);

    visiting.add(id);
    const primaryParent = canonicalParentByShared.get(id);
    const ancestor = primaryParent !== undefined
      ? resolveCanonicalAncestor(primaryParent, visiting) ?? firstLayerAncestor.get(primaryParent)
      : (() => {
        const candidateParents = (incomingByTarget.get(id) ?? [])
          .map(({ source }) => source)
          .filter((source) => subtree.has(source) && firstLayerAncestor.has(source));
        return candidateParents.length === 1
          ? resolveCanonicalAncestor(candidateParents[0], visiting) ??
              firstLayerAncestor.get(candidateParents[0])
          : firstLayerAncestor.get(id);
      })();
    visiting.delete(id);

    if (ancestor !== undefined) canonicalFirstLayerAncestor.set(id, ancestor);
    return ancestor;
  };

  for (const id of subtree) {
    resolveCanonicalAncestor(id);
  }

  return {
    focalId: focal.id,
    sectorIndexById,
    firstLayerAncestor,
    canonicalFirstLayerAncestor,
    subtree,
    N,
  };
}

// Cache the per-graph/per-root index on a WeakMap so repeated
// `subsystemHue` calls over the same `(graph, rootId)` pair don't
// re-walk the graph. The function stays pure: a new GraphData reference
// or a different root builds a fresh index.
const indexCache = new WeakMap<GraphData, Map<string, SubsystemIndex>>();

function cacheKey(rootId?: string | null): string {
  return rootId ?? "__default_root__";
}

function getIndex(graph: GraphData, rootId?: string | null): SubsystemIndex {
  let graphEntry = indexCache.get(graph);
  if (graphEntry === undefined) {
    graphEntry = new Map();
    indexCache.set(graph, graphEntry);
  }
  const key = cacheKey(rootId);
  let entry = graphEntry.get(key);
  if (entry === undefined) {
    entry = buildSubsystemIndex(graph, rootId);
    graphEntry.set(key, entry);
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
export function subsystemHue(
  nodeId: string,
  graph: GraphData,
  rootId?: string | null,
): SubsystemHue {
  const index = getIndex(graph, rootId);

  // No focal product → everything grey.
  if (index.focalId === undefined) return { ...NEUTRAL_GREY };

  // Rule 8: focal product itself.
  if (nodeId === index.focalId) return { ...ROOT_NEUTRAL };

  // Rule 3 (first-layer subsystem direct hit) — checked BEFORE the
  // shared-parent rule so a first-layer subsystem that is also required
  // by other modules still gets its family hue (Exception 6).
  const sectorIdx = index.sectorIndexById.get(nodeId);
  if (sectorIdx !== undefined) {
    return colouredHueForSector(sectorIdx, index.N);
  }

  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return { ...NEUTRAL_GREY };

  // Rule 9: orphan structural nodes (not reachable from focal product)
  // are grey.
  if (!index.subtree.has(nodeId)) return { ...NEUTRAL_GREY };

  // Rules 4/5: descendants inherit the canonical first-layer ancestor's
  // hue. Shared descendants use one primary parent; unshared descendants
  // follow their only parent path.
  const ancestor = index.canonicalFirstLayerAncestor.get(nodeId) ??
    index.firstLayerAncestor.get(nodeId);
  if (ancestor === undefined) return { ...NEUTRAL_GREY };
  const ancestorSector = index.sectorIndexById.get(ancestor);
  if (ancestorSector === undefined) return { ...NEUTRAL_GREY };
  return colouredHueForSector(ancestorSector, index.N);
}

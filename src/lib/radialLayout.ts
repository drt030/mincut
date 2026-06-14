import type { Edge, GraphData, Node, NodeKind } from "./schema";
import { defaultFocalProduct } from "./graphTraversal";
import { isArtifactCanvasNode, isCanvasTreeEdge, isKnowHowNode } from "./canvasGraph";

/**
 * Per ADR-0007 and
 * `docs/superpowers/specs/2026-05-20-stable-balanced-radial-tree-design.md`,
 * `radialLayout` is a pure deterministic function mapping a `GraphData`
 * to polar coordinates `{ r, theta }` for every *structural* node, plus
 * first-layer sector metadata and a parallel edge-style map recording
 * which `requires` edges are canonical tree branches versus low-noise
 * cross-links to shared nodes.
 *
 * The algorithm in summary:
 *
 *   1. Focal root = requested structural `rootId`, or the canonical default
 *      focal product (`defaultFocalProduct`), sits at `(r = 0, theta = 0)`.
 *   2. N first-layer subsystems (focal product's `requires`-children among
 *      structural kinds) sit on a ring at `r = R1`. Branch order is
 *      deterministic (sorted by node id), but angular width is weighted
 *      by canonical subtree size so dense branches get more room than
 *      sparse branches.
 *   3. Each subsystem owns a balanced angular sector. All
 *      `requires`-descendants of that subsystem are packed within that
 *      sector by DFS depth and sibling index. Theta stays inside the
 *      sector; `r = R1 + depth * R_STEP`.
 *   4. A *shared* structural node has ≥ 2 incoming `requires` edges among
 *      visited parents. It is given exactly ONE position in its CANONICAL
 *      primary parent's sector. Artifact targets prefer artifact parents
 *      over know-how parents so the product graph stays structurally
 *      intact when the know-how layer is hidden. Within the same parent
 *      class, the highest weighted `requires` edge wins when weights
 *      exist; otherwise the parent whose first-layer ancestor has the
 *      smallest sector index wins (ties broken by smallest parent id).
 *      Cross-sector `requires` edges from non-canonical parents are
 *      tagged `'cross'` in the `edges` Map; the canonical edge is
 *      tagged `'primary'`. Edges to the canonical position from any
 *      ancestor inside the canonical sector are also `'primary'`.
 *   5. Materials (`kind === "material"`) sit on an outer ring at
 *      `r = R_OUTER`, with theta determined by an FNV-1a hash of the
 *      node id so the placement is deterministic and well-spread.
 *   6. Structural nodes not reachable from the focal product (other
 *      products, their subtrees, orphan equipment /
 *      engineering_methods / manufacturing_processes) get a deterministic fallback position
 *      on a far outer ring at `r = R_FALLBACK`, theta keyed by id hash.
 *      This ensures the smoke contract — every structural node receives
 *      a position — holds even when the data includes sibling-product
 *      clusters outside the focal product's subtree (Phase B+ will
 *      reorganize this).
 *
 * Constants (chosen by the spec author; any positive numbers obeying the
 * monotonic relation `0 < R1 < R_OUTER < R_FALLBACK` satisfy the test
 * contract; downstream renderers scale these to viewport pixels):
 *
 *   - R1     = 100  — first-layer subsystem ring
 *   - R_STEP = 40   — additional radius per descendant depth
 *   - R_OUTER = R1 + (max_descendant_depth + 2) × R_STEP — outer material ring
 *   - R_FALLBACK = R_OUTER + 4 × R_STEP — far ring for non-reachable nodes
 *
 * The function returns:
 *   - `positions`: Map<nodeId, { r, theta }> for every structural node.
 *   - `edges`:     Map<edgeId, { style: 'primary' | 'cross' }> for every
 *                  `requires` edge whose target is a positioned structural
 *                  node; `primary` for the canonical-parent edge of a
 *                  shared node and for every non-shared edge; `cross` for
 *                  secondary parents' edges to a shared node.
 *
 * Pure function: no I/O, no React, no shared state.
 */

const TWO_PI = Math.PI * 2;
const STRUCTURAL_KINDS: ReadonlySet<NodeKind> = new Set([
  "product",
  "technical_route",
  "module",
  "equipment",
  "material",
  "engineering_method",
  "manufacturing_process",
]);

export const R1 = 100;
export const R_STEP = 40;

export type PolarPosition = { r: number; theta: number };
export type RadialSector = { center: number; width: number };
export type EdgeStyle = "primary" | "cross";

export type RadialLayoutResult = {
  positions: Map<string, PolarPosition>;
  sectors: Map<string, RadialSector>;
  edges: Map<string, { style: EdgeStyle }>;
};

type SharedParentCandidate = {
  source: string;
  weight: number | undefined;
  sourceIsKnowHow: boolean;
};

/**
 * FNV-1a 32-bit hash of a string. Used to derive deterministic angular
 * positions for materials and fallback-placed structural nodes. Returns a
 * non-negative 32-bit integer.
 */
function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime (16777619), kept in 32-bit range.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Map a node id to a deterministic theta in [0, 2π) via FNV-1a hash.
 * Resolution of 4096 buckets is plenty to avoid visible collisions at
 * the data scale we work with (≤ 200 structural nodes).
 */
function hashToTheta(nodeId: string): number {
  const bucket = fnv1aHash(nodeId) % 4096;
  return (bucket / 4096) * TWO_PI;
}

function edgeWeight(edge: Edge): number | undefined {
  return typeof edge.weight === "number" && Number.isFinite(edge.weight)
    ? edge.weight
    : undefined;
}

function buildChildIndex(graph: GraphData): {
  childrenByParent: Map<string, string[]>;
  incomingByTarget: Map<string, Array<{ source: string; edge: Edge }>>;
  structuralIds: Set<string>;
  nodeById: Map<string, Node>;
} {
  const nodeById = new Map<string, Node>();
  for (const node of graph.nodes) nodeById.set(node.id, node);

  const structuralIds = new Set<string>();
  for (const node of graph.nodes) {
    if (STRUCTURAL_KINDS.has(node.kind)) structuralIds.add(node.id);
  }

  // We restrict the child / incoming indexes to canvas tree edges whose
  // BOTH endpoints are structural — descriptive nodes (metric / capability
  // / bottleneck / etc.) are deliberately not positioned per ADR-0006
  // §Node classification.
  const childrenByParent = new Map<string, string[]>();
  const incomingByTarget = new Map<string, Array<{ source: string; edge: Edge }>>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!structuralIds.has(edge.source) || !structuralIds.has(edge.target)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
    if (!incomingByTarget.has(edge.target)) incomingByTarget.set(edge.target, []);
    incomingByTarget.get(edge.target)!.push({ source: edge.source, edge });
  }

  // Deterministic ordering: sort each child list alphabetically by id so
  // DFS visits siblings in the same order on every run.
  for (const list of childrenByParent.values()) list.sort((a, b) => a.localeCompare(b));

  return { childrenByParent, incomingByTarget, structuralIds, nodeById };
}

export function radialLayout(graph: GraphData, rootId?: string | null): RadialLayoutResult {
  const positions = new Map<string, PolarPosition>();
  const sectors = new Map<string, RadialSector>();
  const edges = new Map<string, { style: EdgeStyle }>();

  const requestedRoot = rootId
    ? graph.nodes.find((n) => n.id === rootId && STRUCTURAL_KINDS.has(n.kind))
    : undefined;
  const focal = requestedRoot ?? defaultFocalProduct(graph);
  if (!focal) {
    // No focal product → nothing to lay out radially. Materials still get
    // a deterministic placement on R_FALLBACK so callers always get a
    // positions map; non-material structural nodes have no anchor and
    // are placed on the fallback ring as well.
    placeOrphansOnFallback(graph, positions);
    return { positions, sectors, edges };
  }

  positions.set(focal.id, { r: 0, theta: 0 });

  const { childrenByParent, incomingByTarget, structuralIds, nodeById } = buildChildIndex(graph);

  // First-layer subsystems = focal product's `requires`-children among
  // structural kinds, excluding materials (materials always live on the
  // outer ring per step 9 — they are not first-layer subsystems even if
  // wired directly from the focal product).
  const firstLayerCandidates = (childrenByParent.get(focal.id) ?? []).filter((id) => {
    const node = nodeById.get(id);
    if (!node) return false;
    return node.kind !== "material";
  });
  // Deterministic order: alphabetical by id. The sector-index assignment
  // is then i = position-in-sorted-list.
  const firstLayer = [...firstLayerCandidates].sort((a, b) => a.localeCompare(b));
  const N = firstLayer.length;

  // sectorIndex[firstLayerId] = i ∈ [0, N).
  const sectorIndex = new Map<string, number>();
  firstLayer.forEach((id, i) => sectorIndex.set(id, i));

  // For shared-node canonical-parent selection we need to know which
  // first-layer ancestor each candidate parent rolls up to. We compute
  // `firstLayerAncestor` for every reachable structural node via BFS
  // from each first-layer subsystem, recording the FIRST first-layer
  // ancestor reached (deterministic because firstLayer is sorted by id
  // and BFS preserves insertion order for siblings — but a node may have
  // multiple first-layer ancestors via cross-subtree DAG edges, in which
  // case we keep the smallest sector index).
  const firstLayerAncestor = new Map<string, string>();
  for (const sub of firstLayer) {
    // BFS within this sector's reachable set, tracking visited nodes so
    // we don't re-traverse via shared-node back-edges.
    const visited = new Set<string>();
    const queue: string[] = [sub];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      // First-layer ancestor of `cur` is the smallest-sector-index
      // first-layer subsystem from which `cur` is reachable. We update
      // only if no entry exists, OR the current `sub`'s sector index is
      // smaller.
      const existing = firstLayerAncestor.get(cur);
      if (existing === undefined || sectorIndex.get(sub)! < sectorIndex.get(existing)!) {
        firstLayerAncestor.set(cur, sub);
      }
      for (const child of childrenByParent.get(cur) ?? []) {
        if (visited.has(child)) continue;
        queue.push(child);
      }
    }
  }

  // Identify shared structural nodes (≥ 2 incoming requires parents).
  // For each, pick the canonical parent. Artifact targets prefer an
  // artifact parent over a know-how parent; then highest edge weight
  // wins, with ties and unweighted edges falling back to the original
  // stable rule (smallest first-layer sector, then smallest parent id).
  // Excludes the focal product as a parent and excludes the case where
  // the shared node IS a first-layer subsystem (those are positioned
  // above).
  const canonicalParentByShared = new Map<string, string>();
  for (const [targetId, inEdges] of incomingByTarget) {
    if (sectorIndex.has(targetId)) continue; // already-positioned first-layer
    if (targetId === focal.id) continue;
    if (inEdges.length < 2) continue;
    const target = nodeById.get(targetId);
    const targetIsArtifact = target !== undefined && isArtifactCanvasNode(target);
    // Candidate parents must have a known first-layer ancestor (i.e.
    // they sit somewhere inside one of the N sectors).
    const candidates: SharedParentCandidate[] = inEdges
      .filter(({ source }) => firstLayerAncestor.has(source))
      .map(({ source, edge }) => {
        const sourceNode = nodeById.get(source);
        return {
          source,
          weight: edgeWeight(edge),
          sourceIsKnowHow: sourceNode !== undefined && isKnowHowNode(sourceNode),
        };
      });
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => {
      if (targetIsArtifact && a.sourceIsKnowHow !== b.sourceIsKnowHow) {
        return a.sourceIsKnowHow ? 1 : -1;
      }
      const aw = a.weight ?? Number.NEGATIVE_INFINITY;
      const bw = b.weight ?? Number.NEGATIVE_INFINITY;
      if (aw !== bw) return bw - aw;
      const ai = sectorIndex.get(firstLayerAncestor.get(a.source)!)!;
      const bi = sectorIndex.get(firstLayerAncestor.get(b.source)!)!;
      if (ai !== bi) return ai - bi;
      return a.source.localeCompare(b.source);
    });
    canonicalParentByShared.set(targetId, candidates[0].source);
  }

  // Track maximum descendant depth so we can pick R_OUTER for materials.
  let maxDescendantDepth = 0;

  // Place descendants per sector via deterministic DFS in the
  // CANONICAL subtree. A node is visited under sector `sub` iff its
  // canonical first-layer ancestor is `sub`. For non-shared nodes,
  // canonical first-layer ancestor === firstLayerAncestor[node]. For
  // shared nodes, it is firstLayerAncestor[canonicalParent].
  const canonicalSectorMemo = new Map<string, string | undefined>();
  const canonicalSectorOf = (id: string, visiting = new Set<string>()): string | undefined => {
    if (sectorIndex.has(id)) return id;
    if (canonicalSectorMemo.has(id)) return canonicalSectorMemo.get(id);
    if (visiting.has(id)) return firstLayerAncestor.get(id);

    visiting.add(id);
    if (canonicalParentByShared.has(id)) {
      const parentId = canonicalParentByShared.get(id)!;
      const sector = canonicalSectorOf(parentId, visiting) ?? firstLayerAncestor.get(parentId);
      visiting.delete(id);
      canonicalSectorMemo.set(id, sector);
      return sector;
    }

    const candidateParents = (incomingByTarget.get(id) ?? [])
      .map(({ source }) => source)
      .filter((source) => firstLayerAncestor.has(source));
    const sector = candidateParents.length === 1
      ? canonicalSectorOf(candidateParents[0], visiting) ?? firstLayerAncestor.get(candidateParents[0])
      : firstLayerAncestor.get(id);
    visiting.delete(id);
    canonicalSectorMemo.set(id, sector);
    return sector;
  };

  // ADR-0007 balanced overview: allocate first-layer angular width by
  // canonical visible subtree size instead of fixed equal sectors.
  // Use the size directly so sparse first-layer branches do not reserve
  // large empty wedges at the expense of dense branches.
  const subtreeWeightByFirstLayer = new Map<string, number>();
  for (const sub of firstLayer) {
    let size = 0;
    for (const id of structuralIds) {
      if (nodeById.get(id)?.kind === "material") continue;
      if (canonicalSectorOf(id) === sub) size += 1;
    }
    subtreeWeightByFirstLayer.set(sub, Math.max(1, size));
  }

  const totalWeight = firstLayer.reduce(
    (sum, id) => sum + (subtreeWeightByFirstLayer.get(id) ?? 1),
    0,
  );
  let sectorStart = 0;
  for (const id of firstLayer) {
    const weight = subtreeWeightByFirstLayer.get(id) ?? 1;
    const width = N > 0 && totalWeight > 0 ? (weight / totalWeight) * TWO_PI : 0;
    const center = sectorStart + width / 2;
    sectors.set(id, { center, width });
    positions.set(id, { r: R1, theta: center });
    sectorStart += width;
  }

  // For each first-layer subsystem, walk its canonical subtree and place
  // descendants recursively. Each parent owns an angular envelope; its
  // children split that envelope by subtree size, then grandchildren split
  // the child envelope. This preserves local parent-child structure so a
  // narrow branch reads as a branch, not as a globally even depth row.
  for (const sub of firstLayer) {
    const subSector = sectors.get(sub)!;
    const subStart = subSector.center - subSector.width / 2;

    const canonicalChildren = (parentId: string): string[] => {
      const out: string[] = [];
      for (const child of childrenByParent.get(parentId) ?? []) {
        if (canonicalSectorOf(child) !== sub) continue;
        const childNode = nodeById.get(child);
        if (childNode?.kind === "material") continue;
        const canonicalParent = canonicalParentByShared.get(child);
        if (canonicalParent !== undefined && canonicalParent !== parentId) continue;
        out.push(child);
      }
      return out;
    };

    const subtreeSizeMemo = new Map<string, number>();
    const subtreeSize = (nodeId: string, seen = new Set<string>()): number => {
      if (seen.has(nodeId)) return 0;
      const memo = subtreeSizeMemo.get(nodeId);
      if (memo !== undefined) return memo;
      seen.add(nodeId);
      let size = 1;
      for (const child of canonicalChildren(nodeId)) {
        size += subtreeSize(child, seen);
      }
      seen.delete(nodeId);
      subtreeSizeMemo.set(nodeId, size);
      return size;
    };

    const placeChildren = (
      parentId: string,
      depth: number,
      startTheta: number,
      width: number,
      visited: Set<string>,
    ): void => {
      const children = canonicalChildren(parentId).filter((id) => !visited.has(id));
      if (children.length === 0) return;
      const totalChildWeight = children.reduce((sum, id) => sum + subtreeSize(id), 0);
      let childStart = startTheta;
      for (const child of children) {
        const childWeight = subtreeSize(child);
        const childWidth = totalChildWeight > 0
          ? (childWeight / totalChildWeight) * width
          : width / children.length;
        const childTheta = childStart + childWidth / 2;
        positions.set(child, { r: R1 + depth * R_STEP, theta: childTheta });
        if (depth > maxDescendantDepth) maxDescendantDepth = depth;
        const nextVisited = new Set(visited);
        nextVisited.add(child);
        placeChildren(child, depth + 1, childStart, childWidth, nextVisited);
        childStart += childWidth;
      }
    };

    placeChildren(sub, 1, subStart, subSector.width, new Set([sub]));
  }

  // R_OUTER — material ring, strictly outside the deepest non-material
  // descendant ring.
  const R_OUTER = R1 + (maxDescendantDepth + 2) * R_STEP;
  // R_FALLBACK — for structural nodes not reachable from the focal
  // product; well outside the material ring so they never collide.
  const R_FALLBACK = R_OUTER + 4 * R_STEP;

  // Place materials on R_OUTER. Theta = id-hash → [0, 2π). Materials
  // appear regardless of whether they were reached during DFS.
  for (const node of graph.nodes) {
    if (node.kind !== "material") continue;
    if (positions.has(node.id)) continue;
    positions.set(node.id, { r: R_OUTER, theta: hashToTheta(node.id) });
  }

  // Place any remaining structural nodes (e.g. sibling products not
  // reachable from the focal product, or orphan modules /
  // engineering_methods / manufacturing_processes) on the fallback ring.
  for (const node of graph.nodes) {
    if (!structuralIds.has(node.id)) continue;
    if (positions.has(node.id)) continue;
    positions.set(node.id, { r: R_FALLBACK, theta: hashToTheta(node.id) });
  }

  // Edge metadata: for every canvas tree edge whose target is positioned
  // and structural, classify as primary or cross.
  //   - If target is shared (has canonical parent recorded), the
  //     canonical parent's edge to it is 'primary' and every other
  //     parent's edge is 'cross'.
  //   - Otherwise the edge is 'primary'.
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!structuralIds.has(edge.source) || !structuralIds.has(edge.target)) continue;
    if (!positions.has(edge.target)) continue;
    const canonical = canonicalParentByShared.get(edge.target);
    if (canonical !== undefined) {
      edges.set(edge.id, { style: edge.source === canonical ? "primary" : "cross" });
    } else {
      edges.set(edge.id, { style: "primary" });
    }
  }

  return { positions, sectors, edges };
}

/**
 * Fallback used only when the graph has no `kind: "product"` node at all.
 * Places every structural node on the fallback ring at hashed theta.
 */
function placeOrphansOnFallback(graph: GraphData, positions: Map<string, PolarPosition>): void {
  const R_FALLBACK = R1 + 10 * R_STEP;
  for (const node of graph.nodes) {
    if (!STRUCTURAL_KINDS.has(node.kind)) continue;
    if (positions.has(node.id)) continue;
    positions.set(node.id, { r: R_FALLBACK, theta: hashToTheta(node.id) });
  }
}

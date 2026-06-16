/**
 * Render depth meter — objective decomposition-depth gauge for the F3 check.
 *
 * Run:  npx tsx scripts/renderDepthMeter.ts
 *
 * For each flagship-parity domain it loads the FULL domain graph exactly the
 * way the app builds it, then reports — most importantly — the RENDERED
 * focal-tree node count: the node set the radial graph actually draws for the
 * domain's default focal product. That headline number is the count a user
 * sees on /d/<slug> in the default ("product") layer, and it is the metric the
 * orchestrator should watch each cycle.
 *
 * Why this is the true render set (function chain, mirrored from the real app
 * path src/app/d/[slug]/page.tsx -> src/components/GraphExplorer.tsx):
 *
 *   1. Server load:   loadActiveGraphData(domain.rootId)
 *                       = scopeGraphToReachableNodes(loadGraphData(), rootId)
 *   2. Server gate:   stripExposureLayer(full, entitlements).graph
 *                       (anonymous visitor => no entitlements; only redacts
 *                        organization exposure, which never sits on the canvas
 *                        tree, so it does not change the rendered count — we
 *                        replicate it anyway for fidelity).
 *   3. Client root:   currentRootId = resolveCanvasRootId(graph, ?root) ...
 *                       (no ?root on a bare /d/<slug>, so this resolves to the
 *                        domain's focal product).
 *   4. Canvas filter: canvasGraph = filterCanvasGraph(graph, currentRootId)
 *                       (isCanvasNode eligibility + DEFAULT_CANVAS_MAX_DEPTH).
 *   5. Focal subtree: buildFocalSubtree(canvasGraph, currentRootId)
 *                       = BFS from the focal product over canvas-tree edges
 *                         (isCanvasTreeEdge). Identical to the `subtree` walk
 *                         in subsystemHue.ts and to GraphExplorer's private
 *                         buildFocalSubtree — replicated below verbatim.
 *   6. Layout:        radialLayout(canvasGraph, currentRootId).positions
 *                       (positions every STRUCTURAL_KIND node in canvasGraph).
 *   7. Layer gate:    layerVisibleNodeIds — the default graph layer is
 *                       DEFAULT_GRAPH_LAYER === "product", and
 *                       layerHidesNode(node, "product") hides every know-how
 *                       node (engineering_method / manufacturing_process).
 *
 * GraphExplorer's `flowNodes` renders exactly the nodes satisfying ALL of
 * (5) AND (6 has a position) AND (7 is layer-visible). The rendered focal-tree
 * count is the size of that intersection.
 *
 * Self-check baseline = post-deepening committed depth (2026-06-16):
 *   ai_compute 69, spacex_reusable_launch 65, humanoid_robotics 86.
 *   (Pre-deepening Gate-F baseline was 69/36/58; both paid domains were
 *   deepened to flagship parity per the owner depth directive, so the floor
 *   is now their committed rendered depth — a regression guard going forward.)
 *
 * Standalone by design: imports only library modules, edits no shared file,
 * and prints a plain table. Exits 0.
 */

import { domainBySlug, type DomainRoute } from "../src/lib/domains";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import { stripExposureLayer } from "../src/lib/exposureGate";
import {
  filterCanvasGraph,
  resolveCanvasRootId,
  isCanvasTreeEdge,
} from "../src/lib/canvasGraph";
import { radialLayout } from "../src/lib/radialLayout";
import { defaultFocalProduct, V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";
import { layerHidesNode, DEFAULT_GRAPH_LAYER } from "../src/lib/knowHowLayer";
import type { GraphData } from "../src/lib/schema";

/** Domain *slugs* to measure. Each resolves to its ids/rootId via domainBySlug. */
const DOMAIN_SLUGS = ["ai-compute", "spacex-reusable-launch", "humanoid-robotics"] as const;

/** Expected rendered focal-tree counts (Gate F, 2026-06-16); ±1 tolerance. */
const BASELINE: Record<string, number> = {
  "ai-compute": 69,
  "spacex-reusable-launch": 65,
  "humanoid-robotics": 86,
};
const BASELINE_TOLERANCE = 1;

/**
 * BFS from the focal product over canvas-tree edges — the rendered focal
 * subtree. Replicated verbatim from GraphExplorer.buildFocalSubtree (a private
 * function we cannot import) and identical to the `subtree` walk in
 * subsystemHue.ts. Reuses the exported isCanvasTreeEdge / defaultFocalProduct
 * so the edge relation set stays in lockstep with the app.
 */
function buildFocalSubtree(graph: GraphData, rootId: string): Set<string> {
  const focal = graph.nodes.find((n) => n.id === rootId) ?? defaultFocalProduct(graph);
  if (!focal) return new Set();
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }
  const subtree = new Set<string>();
  const queue: string[] = [focal.id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (subtree.has(cur)) continue;
    subtree.add(cur);
    for (const child of childrenByParent.get(cur) ?? []) queue.push(child);
  }
  return subtree;
}

type DomainDepth = {
  slug: string;
  domainId: string;
  rootId: string;
  resolvedRootId: string;
  totalNodes: number;
  orgNodes: number;
  materialNodes: number;
  otherNodes: number;
  totalEdges: number;
  renderedNodes: number;
  renderedEdges: number;
  baseline: number | null;
  matchesBaseline: boolean | null;
};

function measureDomain(domain: DomainRoute): DomainDepth {
  // (1) server load + (2) anonymous exposure gate.
  const full = loadActiveGraphData(domain.rootId);
  const { graph } = stripExposureLayer(full, []);

  // (3) default client root resolution (no ?root= on a bare /d/<slug>).
  const resolvedRootId =
    resolveCanvasRootId(graph, null) ??
    resolveCanvasRootId(graph, domain.rootId) ??
    V0_TARGET_NODE_ID;

  // (4) canvas filter, (5) focal subtree, (6) radial layout positions.
  const canvasGraph = filterCanvasGraph(graph, resolvedRootId);
  const focalSubtree = buildFocalSubtree(canvasGraph, resolvedRootId);
  const layout = radialLayout(canvasGraph, resolvedRootId);

  // (7) default "product" layer hides know-how nodes.
  const layerVisible = new Set<string>();
  for (const node of canvasGraph.nodes) {
    if (!layerHidesNode(node, DEFAULT_GRAPH_LAYER)) layerVisible.add(node.id);
  }

  // Rendered focal-tree node set == GraphExplorer.flowNodes membership.
  const renderedNodeIds = new Set<string>();
  for (const node of canvasGraph.nodes) {
    if (!focalSubtree.has(node.id)) continue;
    if (!layerVisible.has(node.id)) continue;
    if (!layout.positions.has(node.id)) continue;
    renderedNodeIds.add(node.id);
  }

  // Rendered-tree edges: canvas-tree edges whose endpoints are both rendered.
  const renderedNodeById = new Map(
    canvasGraph.nodes.filter((n) => renderedNodeIds.has(n.id)).map((n) => [n.id, n]),
  );
  let renderedEdges = 0;
  for (const edge of canvasGraph.edges) {
    if (!renderedNodeIds.has(edge.source) || !renderedNodeIds.has(edge.target)) continue;
    if (!isCanvasTreeEdge(edge, renderedNodeById)) continue;
    renderedEdges += 1;
  }

  // Full-graph kind breakdown (over the loaded, exposure-gated domain graph).
  let orgNodes = 0;
  let materialNodes = 0;
  for (const node of graph.nodes) {
    if (node.kind === "organization") orgNodes += 1;
    else if (node.kind === "material") materialNodes += 1;
  }
  const totalNodes = graph.nodes.length;
  const otherNodes = totalNodes - orgNodes - materialNodes;

  const baseline = BASELINE[domain.slug] ?? null;
  const matchesBaseline =
    baseline === null ? null : Math.abs(renderedNodeIds.size - baseline) <= BASELINE_TOLERANCE;

  return {
    slug: domain.slug,
    domainId: domain.domainTag,
    rootId: domain.rootId,
    resolvedRootId,
    totalNodes,
    orgNodes,
    materialNodes,
    otherNodes,
    totalEdges: graph.edges.length,
    renderedNodes: renderedNodeIds.size,
    renderedEdges,
    baseline,
    matchesBaseline,
  };
}

function pad(value: string | number, width: number): string {
  return String(value).padStart(width);
}

function printTable(rows: DomainDepth[]): void {
  const headers = [
    ["domain", 22, "left"],
    ["total", 6],
    ["org", 5],
    ["material", 9],
    ["other", 6],
    ["edges", 6],
    ["RENDERED", 9],
    ["tree-edges", 11],
    ["baseline", 9],
    ["match", 6],
  ] as const;

  const headerLine = headers
    .map(([label, width, align]) =>
      align === "left" ? String(label).padEnd(width) : pad(label, width),
    )
    .join("  ");
  console.log(headerLine);
  console.log("-".repeat(headerLine.length));

  for (const r of rows) {
    const match = r.matchesBaseline === null ? "n/a" : r.matchesBaseline ? "OK" : "MISMATCH";
    const line = [
      r.slug.padEnd(22),
      pad(r.totalNodes, 6),
      pad(r.orgNodes, 5),
      pad(r.materialNodes, 9),
      pad(r.otherNodes, 6),
      pad(r.totalEdges, 6),
      pad(r.renderedNodes, 9),
      pad(r.renderedEdges, 11),
      pad(r.baseline ?? "-", 9),
      pad(match, 6),
    ].join("  ");
    console.log(line);
  }
}

function main(): void {
  const rows: DomainDepth[] = [];
  for (const slug of DOMAIN_SLUGS) {
    const domain = domainBySlug(slug);
    if (!domain) {
      console.error(`[renderDepthMeter] Unknown domain slug: ${slug}`);
      continue;
    }
    rows.push(measureDomain(domain));
  }

  console.log("Render depth meter — rendered focal-tree node count per domain");
  console.log("(headline = nodes the radial graph draws for the default focal product)\n");
  printTable(rows);

  const checked = rows.filter((r) => r.baseline !== null);
  const mismatches = checked.filter((r) => r.matchesBaseline === false);
  console.log("");
  if (mismatches.length === 0) {
    console.log(
      `Self-check: all ${checked.length} domains within +/-${BASELINE_TOLERANCE} of the post-deepening baseline (69/65/86).`,
    );
  } else {
    console.log(
      `Self-check: ${mismatches.length}/${checked.length} domain(s) differ from the post-deepening baseline (69/65/86):`,
    );
    for (const r of mismatches) {
      const delta = r.renderedNodes - (r.baseline ?? 0);
      console.log(
        `  - ${r.slug}: rendered ${r.renderedNodes}, baseline ${r.baseline} (delta ${delta >= 0 ? "+" : ""}${delta}).` +
          " Data may have changed since the baseline was captured.",
      );
    }
  }

  // Exit 0 regardless: this is a measurement meter, not a pass/fail gate.
  // The orchestrator's F3 check reads the RENDERED column and the self-check
  // line; it decides thresholds, so the meter must always run to completion.
  process.exit(0);
}

main();

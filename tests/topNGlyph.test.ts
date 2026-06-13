import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Priority selection regression tests.
//
// The canvas no longer renders numbered priority glyphs. The remaining
// selector is still useful for the right rail because it ranks cost,
// risk, and maturity entries without adding visual badges to nodes.
import { loadGraphData } from "../src/lib/graphLoader";
import { focusedSubset } from "../src/lib/focusedSubset";
import { filterCanvasGraph } from "../src/lib/canvasGraph";
import { bandForValue, nodeTypicalCostRmb } from "../src/lib/edgeStyleFor";
import { nodeRiskSignal } from "../src/lib/nodeRisk";
import { selectTopN } from "../src/lib/prioritySelection";
import type { Edge, GraphData, Node } from "../src/lib/schema";

// ------------------------------------------------------------------
// Fixture: the real loaded dataset.
//
// At the 2026-06-07 induction/spacing decomposition pass:
//   - The focal product `low_cost_parcel_sorting_robot_300k_rmb` has
//     95 `requires`-reachable structural nodes (pinned in
//     tests/focusedSubset.test.ts test 2).
//   - The full dataset is meaningfully larger than the focal subtree
//     (siblings: iphone_4, materials only used by the case study,
//     etc.), so `selectTopN(focusedSubsetIds=null)` MUST not just
//     fall back to the whole graph — it must scope to the focal
//     subtree.
// ------------------------------------------------------------------
const FOCAL_PRODUCT_ID = "low_cost_parcel_sorting_robot_300k_rmb";
const graph: GraphData = loadGraphData();
const focalIds: Set<string> = focusedSubset(FOCAL_PRODUCT_ID, graph).nodes;

// ==================================================================
// Test 4 — selectTopN(mode='bottleneck-risk', n=3) sorted desc, band typed
// ==================================================================
//
// In bottleneck-risk mode, the top-N MUST be sorted by reader risk signal
// descending. The band field MUST match the 5-band scheme returned
// by `bandForValue(risk, 'bottleneck-risk')`. Oracle: we compute the
// expected rank-1 node by scanning the focal subtree with the same
// signal function and confirm `selectTopN` agrees.
// ==================================================================
test("selectTopN(bottleneck-risk, n=3): returns 3, sorted by risk desc, band matches scheme", () => {
  const top = selectTopN(graph, "bottleneck-risk", 3, null);

  assert.equal(
    top.length,
    3,
    `selectTopN(..., n=3) must return exactly 3 entries; got ${top.length}`,
  );

  // Sorted by underlying risk signal descending. We re-compute per
  // node via nodeRiskSignal to avoid depending on whether `selectTopN`
  // returns the risk value itself.
  const ranked = top.map((t) => {
    const node = graph.nodes.find((n) => n.id === t.nodeId);
    assert.ok(node, `selectTopN returned unknown nodeId ${t.nodeId}`);
    return { nodeId: t.nodeId, risk: nodeRiskSignal(node!, graph), band: t.band };
  });
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(
      ranked[i].risk <= ranked[i - 1].risk,
      `top-N must be sorted by risk desc; entry ${i} risk=${ranked[i].risk} > entry ${i - 1} risk=${ranked[i - 1].risk}`,
    );
  }

  // Each entry's band field MUST agree with the 5-band scheme used
  // elsewhere (edgeStyleFor / sectorAggregate / bandForValue).
  for (const entry of ranked) {
    const expectedBand = bandForValue(entry.risk, "bottleneck-risk");
    assert.equal(
      entry.band,
      expectedBand,
      `top-N entry ${entry.nodeId} band must follow the 5-band scheme; got ${entry.band}, expected ${expectedBand} (risk=${entry.risk})`,
    );
  }

  // rank field MUST be the position in the returned array (1-based)
  // — pinned so the glyph's data-rank attribute lines up with the
  // selector's ordering.
  for (let i = 0; i < top.length; i += 1) {
    assert.equal(
      top[i].rank,
      i + 1,
      `selectTopN entry[${i}].rank must equal ${i + 1}; got ${top[i].rank}`,
    );
  }
});

test("selectTopN(bottleneck-risk): explicit bottleneck claims rank even before cost data exists", () => {
  const nodes: Node[] = [
    {
      id: "candidate_product",
      name: "Candidate product",
      kind: "product",
      domain: ["test"],
      reviewStatus: "unreviewed",
    },
    {
      id: "explicit_constraint",
      name: "Explicit constraint",
      kind: "module",
      domain: ["test"],
      maturityScore: 45,
      maturityLabel: "prototype",
      maturityAsOf: "2026-06",
      bottleneckOf: ["candidate_product"],
      reviewStatus: "unreviewed",
    },
    {
      id: "unpriced_component",
      name: "Unpriced component",
      kind: "module",
      domain: ["test"],
      maturityScore: 20,
      maturityLabel: "hypothesis",
      maturityAsOf: "2026-06",
      reviewStatus: "unreviewed",
    },
  ];
  const edges: Edge[] = [
    { id: "e_candidate_explicit", source: "candidate_product", target: "explicit_constraint", relation: "requires" },
    { id: "e_candidate_unpriced", source: "candidate_product", target: "unpriced_component", relation: "requires" },
  ];
  const fixture: GraphData = { graphVersion: "explicit-bottleneck-priority", nodes, edges, evidence: [] };

  const top = selectTopN(
    fixture,
    "bottleneck-risk",
    3,
    new Set(nodes.map((node) => node.id)),
  );

  assert.equal(top[0]?.nodeId, "explicit_constraint");
  assert.equal(top[0]?.band, 5);
  assert.equal(
    top.some((entry) => entry.nodeId === "unpriced_component"),
    false,
    "unpriced low-maturity nodes without explicit bottleneck claims should not appear just because cost data is missing",
  );
});

// ==================================================================
// Test 5 — selectTopN(mode='cost', n=5) sorted by typical RMB cost desc
// ==================================================================
//
// In cost mode, the top-N MUST be sorted by typical cost desc.
// Oracle: re-rank the focal subtree by `nodeTypicalCostRmb` and
// confirm `selectTopN`'s ordering matches the descending
// trajectory. Nodes without a cost reading are excluded.
// ==================================================================
test("selectTopN(cost, n=5): returns up to 5, sorted by typical cost desc", () => {
  const top = selectTopN(graph, "cost", 5, null);

  assert.ok(
    top.length > 0 && top.length <= 5,
    `selectTopN(cost, n=5) must return 1..5 entries; got ${top.length}`,
  );

  // Sorted desc by typical RMB cost.
  const ranked = top.map((t) => {
    const node = graph.nodes.find((n) => n.id === t.nodeId);
    assert.ok(node, `selectTopN returned unknown nodeId ${t.nodeId}`);
    return {
      nodeId: t.nodeId,
      cost: nodeTypicalCostRmb(node!, graph) ?? 0,
    };
  });
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(
      ranked[i].cost <= ranked[i - 1].cost,
      `cost-mode top-N must be sorted by typical cost desc; entry ${i} cost=${ranked[i].cost} > entry ${i - 1} cost=${ranked[i - 1].cost}`,
    );
  }
});

// ==================================================================
// Test 6 — selectTopN(n=10) returns at most 10 entries
// ==================================================================
//
// Per the spec's "configurable: top-3, top-5, top-10", n=10 is the
// maximum supported size. selectTopN MUST cap at n even if more
// nodes qualify (e.g., 16+ with-risk nodes in the focal subtree).
// ==================================================================
test("selectTopN(bottleneck-risk, n=10): returns at most 10 entries", () => {
  const top = selectTopN(graph, "bottleneck-risk", 10, null);

  assert.ok(
    top.length <= 10,
    `selectTopN(..., n=10) must return at most 10 entries; got ${top.length}`,
  );

  // Sanity: at HEAD ca659f8 the focal subtree has ≥ 10 nodes with
  // risk > 0, so the function should hit the cap (length === 10).
  // We pin "at most 10" rather than "exactly 10" so a future data
  // edit removing a risk-bearing node doesn't break the test.
});

// ==================================================================
// Test 7 — selectTopN(focusedSubsetIds=null): scope = focal subtree
// ==================================================================
//
// When the caller passes `null`, `selectTopN` MUST scope to the
// structural focal-subtree (size 105 = 100 requires + 5 know-how
// after Task 4–5 know-how attachment), NOT the full loaded dataset.
// The dataset includes siblings (e.g. `iphone_4`) and materials only
// the case study uses — those MUST be excluded.
// ==================================================================
test("selectTopN(focusedSubsetIds=null): scope is the focal subtree, not the full graph", () => {
  // Oracle: confirm the focal subtree is meaningfully smaller than
  // the loaded graph. If this fails, data changed and the assertion
  // text below must be re-pinned.
  assert.equal(
    focalIds.size,
    105,
    `oracle: focal subtree should be 105 (100 requires + 5 know-how nodes per Task 5); got ${focalIds.size}`,
  );
  assert.ok(
    graph.nodes.length > focalIds.size,
    `oracle: full graph must be larger than the focal subtree; got graph=${graph.nodes.length}, focal=${focalIds.size}`,
  );

  const top = selectTopN(graph, "bottleneck-risk", 10, null);

  for (const entry of top) {
    assert.ok(
      focalIds.has(entry.nodeId),
      `selectTopN(focusedSubsetIds=null) must scope to the focal subtree; got out-of-subtree id ${entry.nodeId}`,
    );
  }
});

// ==================================================================
// Test 8 — selectTopN(focusedSubsetIds=<set>): results ⊆ set
// ==================================================================
//
// When the caller passes a non-null Set, the result MUST be
// restricted to that set. The user-facing case is: a structural
// node has been clicked, its requires-descendant subset is bright,
// the top-N glyphs should mark the highest-priority nodes WITHIN
// that bright subset — not outside it.
// ==================================================================
test("selectTopN(focusedSubsetIds=<set>): results restricted to the supplied set", () => {
  const SUBSYSTEM_ID = "parcel_manipulation_or_diverter";
  const subset = focusedSubset(SUBSYSTEM_ID, graph).nodes;

  // Oracle: the subsystem subtree is non-empty AND non-trivially
  // smaller than the focal product subtree, so the restriction is
  // a real test (not a no-op).
  assert.ok(
    subset.size > 0 && subset.size < focalIds.size,
    `oracle: ${SUBSYSTEM_ID} subtree must be 0 < size < ${focalIds.size}; got ${subset.size}`,
  );

  const top = selectTopN(graph, "bottleneck-risk", 5, subset);

  for (const entry of top) {
    assert.ok(
      subset.has(entry.nodeId),
      `selectTopN(focusedSubsetIds=<set>) must restrict to that set; got out-of-set id ${entry.nodeId} (set size=${subset.size})`,
    );
  }
});

// ==================================================================
// Test 9 — Determinism: same input ⇒ same output (twice in a row)
// ==================================================================
//
// The selector MUST be pure. Two consecutive calls with the same
// arguments MUST return the same nodeIds in the same order with
// the same rank + band fields. No hidden randomness, no cache-
// dependent re-ordering, no Set-iteration-order leakage.
// ==================================================================
test("selectTopN: deterministic — same inputs produce identical output", () => {
  const a = selectTopN(graph, "bottleneck-risk", 5, null);
  const b = selectTopN(graph, "bottleneck-risk", 5, null);

  assert.equal(
    a.length,
    b.length,
    `determinism: lengths must match across calls; got a=${a.length}, b=${b.length}`,
  );
  for (let i = 0; i < a.length; i += 1) {
    assert.equal(
      a[i].nodeId,
      b[i].nodeId,
      `determinism: entry ${i} nodeId must match across calls; got a=${a[i].nodeId}, b=${b[i].nodeId}`,
    );
    assert.equal(
      a[i].rank,
      b[i].rank,
      `determinism: entry ${i} rank must match across calls; got a=${a[i].rank}, b=${b[i].rank}`,
    );
    assert.equal(
      a[i].band,
      b[i].band,
      `determinism: entry ${i} band must match across calls; got a=${a[i].band}, b=${b[i].band}`,
    );
  }
});

// ==================================================================
// Test 10 — Banner regression guard: GraphExplorer.tsx text body
// ==================================================================
//
// Per docs/design-principles.md § "Sorted lists alongside the canvas"
// the legacy `/graph` "High risk dependency" pill banner is an
// active exception scheduled for retirement in this slice. Slice
// A3b already removed the banner DOM during chrome cleanup; this
// guard pins the absence in JSX so a future regression can't sneak
// it back in.
//
// We assert that the legacy strings — both the Simplified Chinese
// "高风险依赖" copy and the English "Top blockers" copy, plus the
// likely DOM hook `top-blockers-banner` / `top-blockers` className —
// do not appear in JSX text. Per the brief: "if the assertions are
// too strict, allow them to be in comments only, not JSX." We
// implement this by stripping `//` line comments AND `/* … */`
// block comments AND JSX `{/* … */}` comments before scanning. A
// retired-exception NOTE in a JSDoc comment is fine.
// ==================================================================
test("GraphExplorer.tsx regression guard: no legacy banner strings in JSX text", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");

  // Strip /* block comments */ first, then // line comments. JSX
  // {/* ... */} comments are caught by the block-comment regex (the
  // surrounding `{` `}` don't matter for our string search).
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  const forbidden = [
    "高风险依赖", // Simplified Chinese legacy banner header
    "Top blockers", // English legacy banner header
    "top-blockers-banner", // className hook
    "top-blockers", // any leftover hook
  ];

  for (const needle of forbidden) {
    assert.ok(
      !noLineComments.includes(needle),
      `GraphExplorer.tsx must not contain legacy pill-banner string "${needle}" in JSX text (comments OK). ` +
        "If A3b removed it, this test stays green as a permanent guard.",
    );
  }
});

test("LanguageProvider.tsx regression guard: Chinese manufacturer label stays audit-scoped", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "LanguageProvider.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");

  assert.ok(
    raw.includes('manufacturerCandidates: "已建模制造商连接"'),
    "Chinese manufacturer heading should state modeled graph links, not confirmed market leadership",
  );
  assert.equal(
    raw.includes('manufacturerCandidates: "主要制造商"'),
    false,
    'Chinese manufacturer heading must not regress to "主要制造商"',
  );
  assert.ok(
    raw.includes("不是已验证 BOM、排名或投资建议"),
    "Chinese manufacturer hint should explain that graph links are audit-only, not a verified BOM, ranking, or recommendation",
  );
});

test("GraphExplorer.tsx regression guard: sector background radius follows layout envelope", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.ok(
    !noLineComments.includes("const R_OUTER = 500"),
    "sector tint wedges must not use a fixed oversized 500-unit radius",
  );
  assert.ok(
    !noLineComments.includes("420 * PX_SCALE"),
    "guide boundary must not use a fixed oversized 420-unit radius",
  );
  assert.ok(
    noLineComments.includes("backgroundOuterR"),
    "GraphExplorer should compute a layout-dependent backgroundOuterR",
  );
});

test("GraphExplorer.tsx regression guard: sector tint does not depend on color mode aggregates", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const sectorTintBlock = raw.match(/const sectorTintWedges = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? "";

  assert.ok(
    sectorTintBlock.length > 0,
    "GraphExplorer should keep an explicit sectorTintWedges memo block",
  );
  assert.equal(
    sectorTintBlock.includes("sectorAggregate("),
    false,
    "sector background tint should be structural only; edge/color mode aggregates belong on lines",
  );
  assert.equal(
    /\bcolorMode\b/.test(sectorTintBlock),
    false,
    "sector background tint should not change when the user switches line-colouring mode",
  );
  assert.equal(
    sectorTintBlock.includes("subsystemHue("),
    true,
    "sector background tint should use stable subsystem hue families rather than a single neutral fill",
  );
});

test("GraphExplorer.tsx regression guard: node hue uses the active canvas root context", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const flowNodeBlock = raw.match(/const flowNodes: FlowNode<[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? "";

  assert.ok(
    flowNodeBlock.length > 0,
    "GraphExplorer should keep an explicit flowNodes memo block",
  );
  assert.match(
    flowNodeBlock,
    /subsystemHue\(node\.id,\s*canvasGraph,\s*currentRootId\)/,
    "node fill hue should be computed from the active re-rooted canvas graph and explicit research root, matching sector tint context",
  );
  assert.doesNotMatch(
    flowNodeBlock,
    /subsystemHue\(node\.id,\s*graph\)/,
    "node fill hue must not use the full graph after re-rooting, or node and sector colours can diverge",
  );
});

test("GraphExplorer.tsx regression guard: default analysis lens is bottleneck risk", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.match(
    noLineComments,
    /useState<ColorMode>\(["']bottleneck-risk["']\)/,
    "GraphExplorer should open retail visitors on the bottleneck-risk heat lens by default",
  );
  assert.doesNotMatch(
    noLineComments,
    /useState<ColorMode>\(["']cost["']\)/,
    "GraphExplorer must not default the main graph entry to the cost lens",
  );
});

test("GraphExplorer.tsx regression guard: node selection does not refresh reader-fit inputs", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");
  const fitNodesBlock =
    noLineComments.match(/const readerFitNodes = useMemo\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ??
    "";

  assert.ok(
    fitNodesBlock.length > 0,
    "GraphExplorer should keep explicit fitView node inputs separate from visual selected-node state",
  );
  assert.equal(
    fitNodesBlock.includes("flowNodes.map"),
    false,
    "reader-fit inputs must not be derived from flowNodes because flowNodes changes when selectedId changes",
  );
  assert.equal(
    fitNodesBlock.includes("selectedId"),
    false,
    "selecting a node should not change fitFullSystemView dependencies or reset the user's zoom/pan",
  );
});

test("GraphExplorer.tsx regression guard: product nodes keep summary first while know-how opens detail", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");
  const onSelectBlock =
    noLineComments.match(/const onSelect = useCallback\(\(nodeId: string\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ??
    "";

  assert.ok(onSelectBlock.length > 0, "GraphExplorer should keep an explicit onSelect callback");
  assert.match(onSelectBlock, /setSelectedId\(nodeId\);/);
  assert.match(
    onSelectBlock,
    /const isKnowHowSelection = Boolean\(target && isKnowHowNode\(target\)\);/,
    "node selection should explicitly distinguish product-layer nodes from know-how nodes",
  );
  assert.match(
    onSelectBlock,
    /setRailPanel\(isKnowHowSelection \? ["']detail["'] : ["']route["']\);/,
    "product nodes should keep the reader summary first, while know-how nodes should open the technical detail panel",
  );
  assert.doesNotMatch(
    onSelectBlock,
    /setRailPanel\(["']detail["']\);/,
    "node selection must not force every node directly into the full technical detail tab",
  );
});

test("GraphExplorer.tsx regression guard: URL focus starts on the reader summary panel", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.match(
    noLineComments,
    /const \[railPanel, setRailPanel\] = useState<["']route["'] \| ["']detail["']>\(["']route["']\);/,
    "URL focus/path may preselect a node, but the first rail screen should still be the reader summary route tab",
  );
  assert.doesNotMatch(
    noLineComments,
    /initialFocus === currentRootId \? ["']route["'] : ["']detail["']/,
    "initial URL focus must not force the rail straight into the full detail tab",
  );
});

test("GraphExplorer.tsx regression guard: RouteDetailRail receives controlled panel and access state", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");
  const railBlock = noLineComments.match(/<RouteDetailRail[\s\S]*?\/>/)?.[0] ?? "";

  assert.ok(railBlock.length > 0, "GraphExplorer should render RouteDetailRail explicitly");
  assert.match(railBlock, /selectedNode=\{selectedNode\}/);
  assert.match(railBlock, /exposureAccess=\{exposureAccess\}/);
  assert.match(railBlock, /panel=\{railPanel\}/);
  assert.match(railBlock, /onPanelChange=\{setRailPanel\}/);
  assert.match(
    noLineComments,
    /<GraphProductStrip[\s\S]*exposureAccess=\{exposureAccess\}/,
    "GraphProductStrip should receive exposureAccess so route-state chips stay visible above the map",
  );
});

test("mobile graph route layout shows the map before the reader rail", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const mobileBlock = css.match(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(
    mobileBlock,
    /\.graph-map-column\s*\{[\s\S]*order:\s*1/,
    "mobile graph routes should keep product summary, layer switch, controls, and map before the reader rail",
  );
  assert.match(
    mobileBlock,
    /\.graph-toolbar-row\s*\{[\s\S]*order:\s*2/,
    "mobile graph routes should show the layer switch and compact lens controls outside the map instead of covering nodes",
  );
  assert.match(
    mobileBlock,
    /\.graph-canvas-route-led\s*\{[\s\S]*order:\s*3/,
    "mobile graph routes should put the map before the reader rail",
  );
  assert.match(
    mobileBlock,
    /\.graph-layout-radial\s*>\s*\.route-detail-rail\s*\{[\s\S]*order:\s*2/,
    "mobile graph routes should keep the route detail rail after the map column",
  );
  assert.match(
    mobileBlock,
    /\.graph-layout-radial\s*>\s*\.route-detail-rail\s*\{[\s\S]*max-height:\s*none/,
    "mobile route detail rail should not clip the Start here / supplier / evidence summary",
  );
  assert.match(
    mobileBlock,
    /\.layer-toggle\s*\{[\s\S]*position:\s*static/,
    "mobile graph routes should keep the layer toggle in document flow instead of overlaying reader text",
  );
  assert.match(
    mobileBlock,
    /\.graph-toolbar-row\s*>\s*\.graph-controls\s*\{[\s\S]*position:\s*static/,
    "mobile graph controls should be in document flow instead of overlaying the map",
  );
  assert.match(
    mobileBlock,
    /\.graph-toolbar-row\s*>\s*\.graph-controls\s+\.graph-controls-label,\s*\n\s*\.graph-toolbar-row\s*>\s*\.graph-controls\s+\.lens-legend\s*\{[\s\S]*display:\s*none/,
    "mobile graph routes should hide dense control labels and legends from the first map viewport",
  );
  assert.match(
    mobileBlock,
    /\.domain-thesis-actions\s*\{[\s\S]*display:\s*none/,
    "mobile graph routes should defer paid-candidate explanation from the first viewport so the graph appears sooner",
  );
  assert.match(
    mobileBlock,
    /\.graph-root-parent-button\s*\{[\s\S]*display:\s*none/,
    "mobile graph routes should hide secondary parent-root navigation from the product strip",
  );
});

test("route-led graph does not render a card overlay over the real graph", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const graphExplorerSource = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "GraphExplorer.tsx"),
    "utf8",
  );
  const noBlockComments = graphExplorerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.doesNotMatch(
    noLineComments,
    /RouteMapPreviewOverlay|route-map-preview-/,
    "route-led graph must not add MODULE preview cards that cover the real React Flow graph",
  );
  assert.doesNotMatch(
    css,
    /\.route-map-preview-/,
    "route-led graph CSS should not keep dead preview-card overlay styles",
  );
  assert.match(
    css,
    /\.graph-canvas-route-led\s+\.react-flow__viewport\s*\{[\s\S]*opacity:\s*1/,
    "the real React Flow graph should remain fully visible in route-led pages",
  );
  const viewportBlocks = css.match(/\.graph-canvas-route-led[^{]*\.react-flow__viewport\s*\{[^}]*\}/g) ?? [];
  assert.ok(viewportBlocks.length > 0, "route-led graph should have explicit viewport visibility rules");
  for (const block of viewportBlocks) {
    assert.doesNotMatch(
      block,
      /opacity:\s*0\.(22|3|62)/,
      "route-led pages should not dim the real graph to make room for non-graph cards",
    );
  }
});

test("route-led desktop layout keeps the graph dominant over the detail rail", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const layoutBlock = css.match(/\.graph-layout-radial\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const railBlock = css.match(/\.route-detail-rail\s*\{\n\s*background:[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(
    layoutBlock,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+clamp\(320px,\s*26vw,\s*360px\)/,
    "desktop route layout should reserve the larger column for the graph and keep the reader rail secondary",
  );
  assert.match(
    railBlock,
    /width:\s*clamp\(320px,\s*26vw,\s*360px\)/,
    "route detail rail should be readable without taking nearly half of a 1280px viewport",
  );
  assert.doesNotMatch(
    `${layoutBlock}\n${railBlock}`,
    /clamp\(520px,\s*40vw,\s*620px\)|width:\s*520px/,
    "route detail rail must not return to the oversized 520px+ layout that makes the graph feel small",
  );
});

test("desktop graph layer toggle stays in the toolbar instead of covering the graph", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const explorerSource = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "GraphExplorer.tsx"),
    "utf8",
  );
  const layerToggleBlock = css.match(/\.layer-toggle\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const toolbarBlock = css.match(/\.graph-toolbar-row\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(
    explorerSource,
    /className="graph-toolbar-row"[\s\S]*<LayerToggleFloatingButton[\s\S]*<GraphControls/,
    "GraphExplorer should render the layer toggle and lens controls inside the same toolbar before the canvas",
  );
  assert.match(
    toolbarBlock,
    /display:\s*flex/,
    "graph toolbar should use ordinary document flow instead of a canvas overlay",
  );
  assert.match(
    layerToggleBlock,
    /position:\s*static/,
    "desktop layer toggle should not be absolutely positioned over graph nodes",
  );
  assert.doesNotMatch(
    layerToggleBlock,
    /position:\s*(absolute|fixed)/,
    "desktop layer toggle must not float over the graph or access-policy text",
  );
});

test("route-led graph hides oversized sector labels by default", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");

  assert.match(
    css,
    /\.graph-canvas-route-led\s+\.sector-label-layer\s*\{[\s\S]*display:\s*none/,
    "route-led graph views should not let large sector labels compete with the reader rail or overlap controls",
  );
});

test("RadialEdge overview keeps non-route primary edges visually quiet", () => {
  const filePath = path.join(process.cwd(), "src", "components", "RadialEdge.tsx");
  const raw = fs.readFileSync(filePath, "utf8");

  assert.match(
    raw,
    /Math\.min\(Math\.max\(strokeWidth \* 0\.4,\s*highlighted \? 1 : 0\.55\),\s*1\.15\)/,
    "normal overview primary edges should be thin enough that route branches and labels carry attention",
  );
  assert.match(
    raw,
    /Math\.min\(Math\.max\(strokeWidth \* 0\.48,\s*0\.75\),\s*3\.2\)/,
    "mid-zoom non-branch risk edges should preserve visible 5-band width differences without turning the canvas into a red bundle",
  );
  assert.match(
    raw,
    /band === 1 \? 2\.4 : band === 2 \? 3\.2 : 4\.6/,
    "overview branch emphasis should be visible without becoming a thick red route bundle",
  );
  assert.match(
    raw,
    /isOuterDetail \? 0\.1 : 0\.24/,
    "normal overview primary edges should stay low-opacity so AI compute does not read as a red edge bundle",
  );
  assert.match(
    raw,
    /highlighted \? 0\.58 : 0\.32/,
    "mid-zoom non-highlighted risk edges should stay quiet enough for labels and the recommended path to dominate",
  );
});

test("GraphExplorer.tsx regression guard: node outline stays neutral while root has a visible contour", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const outlineBlock =
    raw.match(/const outlineColorFor = useCallback\([\s\S]*?\n  \);/)?.[0] ??
    raw.match(/function outlineColorFor\([\s\S]*?\n}/)?.[0] ??
    "";

  assert.ok(
    outlineBlock.length > 0,
    "GraphExplorer should keep a local outlineColorFor helper so node outline semantics are explicit",
  );
  assert.equal(
    /\bcolorMode\b/.test(outlineBlock),
    false,
    "node contour color should not change with the active cost/maturity/risk lens",
  );
  assert.equal(
    /\bRAMP\b|bandForValue|nodeTypicalCostRmb|nodeRisk\(/.test(outlineBlock),
    false,
    "node contour should not duplicate the edge/lens band calculation",
  );
  assert.equal(
    /selected/.test(outlineBlock),
    true,
    "node contour may encode only selection affordance, not analytical value",
  );
  assert.equal(
    /if\s*\(\s*isFocal\b|\bisFocal\s*\?/.test(outlineBlock),
    true,
    "root identity should keep a neutral visible contour so the near-white root node does not disappear on the canvas",
  );
  assert.equal(
    /return\s+["']transparent["']/.test(outlineBlock),
    true,
    "ordinary node contours should stay visually absent; only selected/root nodes should keep a neutral outline affordance",
  );
});

test("GraphExplorer.tsx regression guard: know-how layer keeps subsystem fill color", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");

  assert.match(
    raw,
    /knowHowLayerFill\(node,\s*baseFill\)/,
    "know-how layer nodes should preserve subsystem-family colour instead of replacing fill with status colour",
  );
  assert.doesNotMatch(
    raw,
    /isKh\s*\?\s*knowHowFill\(node\)\s*:\s*ARTIFACT_DIM_FILL/,
    "GraphExplorer must not gray or status-color know-how nodes as their primary fill",
  );
});

test("radial CSS keeps node contour semantics in the renderer instead of hard-coded canvas rules", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "app",
    "globals.css",
  );
  const raw = fs.readFileSync(filePath, "utf8");

  assert.doesNotMatch(
    raw,
    /\.radial-dot\.selected\s+svg\s+circle/,
    "selected-node contour should come from GraphExplorer/RadialNode outlineColor, not a second CSS color rule",
  );
  assert.doesNotMatch(
    raw,
    /\.radial-dot\.focal\s+svg\s+circle/,
    "root-node contour should stay in GraphExplorer/RadialNode data, not a second CSS color rule",
  );

  const radialFocusBlock = raw.match(/\.radial-dot:focus-visible\s+svg\s+circle\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.ok(radialFocusBlock.length > 0, "globals.css should keep an explicit radial keyboard-focus block");
  assert.doesNotMatch(
    radialFocusBlock,
    /37,\s*99,\s*235|#2563eb|#3b82f6/i,
    "keyboard focus contour should be neutral, not a blue analysis-like stroke",
  );

  const guideRingBlock = raw.match(/\.radial-guide-ring\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.ok(guideRingBlock.length > 0, "globals.css should keep an explicit radial-guide-ring block");
  assert.doesNotMatch(
    guideRingBlock,
    /37,\s*99,\s*235|#2563eb|#3b82f6/i,
    "guide rings should be neutral geometry, not blue analysis-like strokes",
  );
});

test("GraphExplorer.tsx regression guard: root switch has an explicit canvas transition state", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.match(
    noLineComments,
    /rootTransitioning/,
    "GraphExplorer should track a short root-transition state when changing research roots",
  );
  assert.match(
    noLineComments,
    /graph-canvas-root-transitioning/,
    "GraphExplorer should expose the root-transition state as a canvas class for CSS animation",
  );
  assert.match(
    noLineComments,
    /setTimeout\([^,]+,\s*6\d\d\)/,
    "root-transition state should clear after roughly the same duration as the node transform animation",
  );
  assert.match(
    noLineComments,
    /data-testid="reset-root-node-button"[\s\S]*href=\{graphRootHref\(resetRootNode\.id\)\}/,
    "resetting the graph root should have an href fallback to the current product root before hydration",
  );

  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  assert.match(
    css,
    /\.graph-canvas-route-led\.graph-canvas-root-transitioning\s+\.react-flow__node\s*\{[\s\S]*transition:\s*transform\s+6\d\dms/,
    "root switch should animate node transform positions during the re-rooted layout transition",
  );
});

test("commercial domain routes hide operator controls and keep reset scoped to the route root", () => {
  const graphExplorerPath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const domainPagePath = path.join(process.cwd(), "src", "app", "d", "[slug]", "page.tsx");
  const raw = fs.readFileSync(graphExplorerPath, "utf8");
  const domainPage = fs.readFileSync(domainPagePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.match(
    domainPage,
    /<GraphExplorer[\s\S]*initialRootId=\{domain\.rootId\}[\s\S]*operatorMode=\{false\}/,
    "commercial /d/[slug] pages should not expose local operator-only expansion controls",
  );
  assert.match(
    noLineComments,
    /operatorMode = OPERATOR_MODE/,
    "/graph can still opt into operator mode while domain routes override it",
  );
  assert.match(
    noLineComments,
    /isCustomRoot=\{currentRootId !== initialRootId\}/,
    "route-led maps should treat their route root as the product root, not the global parcel demo",
  );
  assert.match(
    noLineComments,
    /onResetRoot=\{\(\) => setGraphRoot\(initialRootId\)\}/,
    "reset should return to the current domain root",
  );
  assert.match(
    noLineComments,
    /routeCount > 0 \? <span>\{routeCount\} \{copy\.costTargets\}<\/span> : null/,
    "commercial pages should not show a useless 0 cost-target badge",
  );
  assert.doesNotMatch(
    noLineComments,
    /回到包裹分拣机器人/,
    "route strip copy must not hard-code the parcel demo on every paid candidate page",
  );
});

test("GraphExplorer.tsx regression guard: custom research roots expose parent, root, and agent expansion actions", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.match(
    noLineComments,
    /parentRootNode/,
    "GraphExplorer should compute the immediate parent research root for custom roots",
  );
  assert.match(
    noLineComments,
    /data-testid="parent-root-node-button"/,
    "custom research roots should expose a one-level-up action",
  );
  assert.match(
    noLineComments,
    /data-testid="reset-root-node-button"/,
    "custom research roots should still expose a direct return-to-product-root action",
  );
  assert.match(
    noLineComments,
    /data-testid="agent-expand-root-button"/,
    "the active research root should expose an agent expansion request button",
  );
  assert.match(
    noLineComments,
    /data-testid="agent-expand-progress"/,
    "agent expansion should expose a visible progress indicator while candidates are listed and evidence collection is queued",
  );
  assert.match(
    noLineComments,
    /graphPatch/,
    "agent expansion should merge a returned graphPatch into the live canvas so new candidates appear without a manual refresh",
  );
});

test("GraphExplorer.tsx regression guard: sector label SVG numbers are hydration-stable", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");
  const sectorLabelBlock = noLineComments.match(/function SectorLabelLayer\([\s\S]*?\n}\n\nfunction ZoomBridge/)?.[0] ?? "";

  assert.ok(
    sectorLabelBlock.length > 0,
    "GraphExplorer should keep an explicit SectorLabelLayer component",
  );
  assert.match(
    sectorLabelBlock,
    /const labelX = svgNumber\(item\.x\);/,
    "sector label x coordinates must use svgNumber before SVG render to avoid SSR/client float drift",
  );
  assert.match(
    sectorLabelBlock,
    /const labelY = svgNumber\(item\.y\);/,
    "sector label y coordinates must use svgNumber before SVG render to avoid SSR/client float drift",
  );
  assert.match(
    sectorLabelBlock,
    /const labelRotate = svgNumber\(item\.rotate\);/,
    "sector label rotation must use svgNumber before SVG render to avoid SSR/client float drift",
  );
  assert.equal(
    /x=\{item\.x\}|y=\{item\.y\}|rotate\(\$\{item\.rotate\}/.test(sectorLabelBlock),
    false,
    "SectorLabelLayer must not write raw floating-point values into SVG attributes",
  );
});

test("GraphExplorer.tsx regression guard: full-system canvas labels every node", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");
  const flowNodesBlock = noLineComments.match(/const flowNodes:[\s\S]*?return nodes;\n  \}, \[[^\]]*\]\);/)?.[0] ?? "";

  assert.ok(
    flowNodesBlock.length > 0,
    "GraphExplorer should keep an explicit flowNodes memo block",
  );
  assert.match(
    flowNodesBlock,
    /const showLabel = true;/,
    "full-system canvas should label every visible node, not only route/anchor/selected nodes",
  );
  assert.equal(
    flowNodesBlock.includes("visualRole !== \"leaf\""),
    false,
    "leaf nodes should not be hidden in the full-system label view",
  );
});

test("GraphExplorer.tsx regression guard: risk TopN scores with the full graph but scopes to visible canvas nodes", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.equal(
    noLineComments.includes("selectTopN(canvasGraph, colorMode, 5"),
    false,
    "TopN risk scoring must not use canvasGraph, because canvas filtering removes the cost signals nodeRisk needs",
  );
  assert.match(
    noLineComments,
    /selectTopN\(workingGraph,\s*colorMode,\s*5,\s*visiblePriorityScope\)/,
    "GraphExplorer should score TopN against the full working graph while passing a visible canvas scope",
  );
});

test("GraphExplorer.tsx regression guard: canvas no longer renders TopN number glyphs", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.equal(
    /<TopNGlyph\b/.test(noLineComments),
    false,
    "Full-system canvas should not render Top 1-5 number glyphs",
  );
  assert.equal(
    noLineComments.includes("topNRank:"),
    false,
    "GraphExplorer should not pass topNRank into radial node data",
  );
});

test("GraphExplorer.tsx regression guard: cost route highlight does not dim all non-route nodes", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.equal(
    noLineComments.includes("!isRouteNode &&"),
    false,
    "Route highlighting should not grey every non-route node; all lenses should keep the same structural visibility",
  );
  assert.equal(
    noLineComments.includes("!isRouteEdge &&"),
    false,
    "Route highlighting should not grey every non-route edge; route emphasis belongs in stroke/width only",
  );
});

test("selectTopN(bottleneck-risk): full graph scoring can still be restricted to canvas-visible nodes", () => {
  const canvasGraph = filterCanvasGraph(graph);
  const visibleScope = new Set(canvasGraph.nodes.map((node) => node.id));
  const top = selectTopN(graph, "bottleneck-risk", 5, visibleScope);

  assert.ok(top.length > 0, "risk TopN should not disappear when scoped to visible canvas nodes");
  for (const entry of top) {
    assert.ok(
      visibleScope.has(entry.nodeId),
      `risk TopN should stay canvas-visible; got ${entry.nodeId}`,
    );
  }
});

test("GraphExplorer.tsx regression guard: explicit focus query drives initial path before stale path query", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");
  const focusPathStateIndex = noLineComments.indexOf("const [focusPath, setFocusPath]");
  assert.notEqual(focusPathStateIndex, -1, "GraphExplorer should define focusPath state");
  const focusIndex = noLineComments.indexOf(
    "const focusIdFromUrl = searchParams?.get(\"focus\");",
    focusPathStateIndex,
  );
  const pathIndex = noLineComments.indexOf(
    "const raw = searchParams?.get(\"path\");",
    focusPathStateIndex,
  );

  assert.ok(
    focusIndex !== -1 && pathIndex !== -1 && focusIndex < pathIndex,
    "initial focusPath restore should honor explicit ?focus before stale ?path",
  );
});

test("GraphExplorer.tsx regression guard: default label mode uses packed node centers", () => {
  const filePath = path.join(
    process.cwd(),
    "src",
    "components",
    "GraphExplorer.tsx",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.equal(
    noLineComments.includes('displayMode === "detail" ? packedNodePositions : radialNodePositions'),
    false,
    "label mode must not fall back to raw radial positions because 136x72 click boxes can overlap",
  );
  assert.match(
    noLineComments,
    /const activeNodePositions = packedNodePositions;/,
    "GraphExplorer should use packed centers for the default clickable node boxes",
  );
});

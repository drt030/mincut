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
import { nodeRisk } from "../src/lib/nodeRisk";
import { selectTopN } from "../src/lib/prioritySelection";
import type { GraphData } from "../src/lib/schema";

// ------------------------------------------------------------------
// Fixture: the real loaded dataset.
//
// At the 2026-05-31 cost-consistency pass:
//   - The focal product `low_cost_parcel_sorting_robot_300k_rmb` has
//     72 `requires`-reachable structural nodes (pinned in
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
// In bottleneck-risk mode, the top-N MUST be sorted by node risk
// descending. The band field MUST match the 5-band scheme returned
// by `bandForValue(risk, 'bottleneck-risk')`. Oracle: we compute the
// expected rank-1 node by scanning the focal subtree with the same
// risk function and confirm `selectTopN` agrees.
// ==================================================================
test("selectTopN(bottleneck-risk, n=3): returns 3, sorted by risk desc, band matches scheme", () => {
  const top = selectTopN(graph, "bottleneck-risk", 3, null);

  assert.equal(
    top.length,
    3,
    `selectTopN(..., n=3) must return exactly 3 entries; got ${top.length}`,
  );

  // Sorted by underlying risk descending. We re-compute risk per
  // node via nodeRisk to avoid depending on whether `selectTopN`
  // returns the risk value itself.
  const ranked = top.map((t) => {
    const node = graph.nodes.find((n) => n.id === t.nodeId);
    assert.ok(node, `selectTopN returned unknown nodeId ${t.nodeId}`);
    return { nodeId: t.nodeId, risk: nodeRisk(node!, graph), band: t.band };
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
// structural focal-subtree (size 72 after the cost-consistency
// backfill), NOT the full
// loaded dataset. The dataset includes siblings (e.g. `iphone_4`)
// and materials only the case study uses — those MUST be excluded.
// ==================================================================
test("selectTopN(focusedSubsetIds=null): scope is the focal subtree, not the full graph", () => {
  // Oracle: confirm the focal subtree is meaningfully smaller than
  // the loaded graph. If this fails, data changed
  // and the assertion text below must be re-pinned.
  assert.equal(
    focalIds.size,
    72,
    `oracle: focal subtree should be 72 after the cost-consistency backfill; got ${focalIds.size}`,
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
    "sector background tint should be structural only; edge/color mode aggregates belong on lines and nodes",
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
    /selectTopN\(graph,\s*colorMode,\s*5,\s*visiblePriorityScope\)/,
    "GraphExplorer should score TopN against the full graph while passing a visible canvas scope",
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

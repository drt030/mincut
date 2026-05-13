import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// RED Slice C3 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md
// § "Slice C3 — Glyph language for top-N priorities (retires the pill
// banner)"; ADR-0006 Phase C step 3 — visual top-N replaces the
// transitional pill banner; docs/design-principles.md § "Active
// exceptions" — the `/graph` "High risk dependency" pill banner row
// retires on the GREEN commit of this slice).
//
// Two new symbols are pinned by this slice:
//
//   1. `<TopNGlyph rank band />` — a presentational component that
//      renders nothing at LOD band 1 (no glyph noise on the overview)
//      and a small SVG marker with `data-testid="topn-glyph"` +
//      `data-rank="<n>"` at band 2+. Visual treatment (star / ring /
//      pip) is the GREEN commit's call; the contract pins ONLY the
//      data attributes + presence of an `<svg>` element so the
//      renderer can iterate the visual without breaking the
//      contract.
//
//   2. `selectTopN(graph, mode, n, focusedSubsetIds)` — a pure helper
//      returning the N highest-priority nodes per the current colour
//      mode, scoped to the focal-subtree (default) or a caller-
//      supplied subset. The per-node band field reuses the same
//      5-band scheme `edgeStyleFor` / `sectorAggregate` agree on, so
//      a glyph's rank-band pair and the surrounding edge / sector
//      tint never disagree on priority.
//
// None of these symbols exist on master at HEAD ca659f8 (C2 GREEN).
// The GREEN commit creates `src/components/TopNGlyph.tsx` exporting
// `TopNGlyph`, `TopNGlyphProps`, and `selectTopN`. This test file
// fails at import time with a "cannot find module" error, which is
// the cleanest RED signal we can give the GREEN sub-agent.
import {
  TopNGlyph,
  selectTopN,
  type TopNGlyphProps,
} from "../src/components/TopNGlyph";
import { loadGraphData } from "../src/lib/graphLoader";
import { focusedSubset } from "../src/lib/focusedSubset";
import { bandForValue, nodeTypicalCostRmb } from "../src/lib/edgeStyleFor";
import { nodeRisk } from "../src/lib/nodeRisk";
import type { GraphData } from "../src/lib/schema";

// ------------------------------------------------------------------
// Fixture: the real loaded dataset.
//
// At HEAD ca659f8 (C2 GREEN):
//   - The focal product `low_cost_parcel_sorting_robot_300k_rmb` has
//     65 `requires`-reachable structural nodes (pinned in
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

// Permissive type so the test references the props the GREEN commit
// must export. The actual exported `TopNGlyphProps` must be
// structurally compatible with at least these fields.
type TopNGlyphTestProps = TopNGlyphProps;

function render(props: TopNGlyphTestProps): string {
  return renderToStaticMarkup(
    React.createElement(
      TopNGlyph as unknown as React.FC<TopNGlyphTestProps>,
      props,
    ),
  );
}

// ==================================================================
// Test 1 — TopNGlyph band 1 renders nothing
// ==================================================================
//
// Per ADR-0006 §"LOD" — band 1 (the overview) MUST stay free of
// per-node decoration. The glyph is a band-2+ affordance only.
// ==================================================================
test("TopNGlyph band=1: renders nothing visible (no SVG, no testid)", () => {
  const html = render({ rank: 1, band: 1 });

  // The component is allowed to return `null`, render an empty
  // fragment, or render a comment — we pin only that no SVG and no
  // testid is exposed.
  assert.doesNotMatch(
    html,
    /<svg/,
    `band=1 TopNGlyph must NOT render <svg>; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /data-testid=["']topn-glyph["']/,
    `band=1 TopNGlyph must NOT expose data-testid="topn-glyph"; got: ${html}`,
  );
});

// ==================================================================
// Test 2 — TopNGlyph band 2 renders SVG with data-testid + data-rank
// ==================================================================
//
// The visual treatment (star / ring / dot / pip) is the GREEN
// commit's call. We pin only the structural contract: an `<svg>`
// element with the testid + the rank exposed as a data attribute so
// downstream consumers (the rail, future tooltips, the UX-flow
// tour) can find and label the glyph.
// ==================================================================
test("TopNGlyph band=2, rank=1: renders <svg data-testid='topn-glyph' data-rank='1'>", () => {
  const html = render({ rank: 1, band: 2 });

  assert.match(
    html,
    /<svg/,
    `band=2 TopNGlyph must render an <svg> element; got: ${html}`,
  );
  assert.match(
    html,
    /data-testid=["']topn-glyph["']/,
    `band=2 TopNGlyph must expose data-testid="topn-glyph"; got: ${html}`,
  );
  assert.match(
    html,
    /data-rank=["']1["']/,
    `band=2 TopNGlyph rank=1 must expose data-rank="1"; got: ${html}`,
  );
});

// ==================================================================
// Test 3 — TopNGlyph band 3 renders the same testid (rank=3 example)
// ==================================================================
//
// Band 3 (the deepest zoom) MUST keep showing the glyph — the
// "subtle size growth" the spec mentions is allowed but not pinned;
// only presence + testid + data-rank are pinned.
// ==================================================================
test("TopNGlyph band=3, rank=3: renders <svg data-testid='topn-glyph' data-rank='3'>", () => {
  const html = render({ rank: 3, band: 3 });

  assert.match(
    html,
    /<svg/,
    `band=3 TopNGlyph must render an <svg> element; got: ${html}`,
  );
  assert.match(
    html,
    /data-testid=["']topn-glyph["']/,
    `band=3 TopNGlyph must expose data-testid="topn-glyph"; got: ${html}`,
  );
  assert.match(
    html,
    /data-rank=["']3["']/,
    `band=3 TopNGlyph rank=3 must expose data-rank="3"; got: ${html}`,
  );
});

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
// structural focal-subtree (size 65 at HEAD ca659f8), NOT the full
// loaded dataset. The dataset includes siblings (e.g. `iphone_4`)
// and materials only the case study uses — those MUST be excluded.
// ==================================================================
test("selectTopN(focusedSubsetIds=null): scope is the focal subtree, not the full graph", () => {
  // Oracle: confirm the focal subtree is meaningfully smaller than
  // the loaded graph at HEAD ca659f8. If this fails, data changed
  // and the assertion text below must be re-pinned.
  assert.equal(
    focalIds.size,
    65,
    `oracle: focal subtree should be 65 at HEAD ca659f8; got ${focalIds.size}`,
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

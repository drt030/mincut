import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// All three imports below intentionally fail at module load on master
// today. The GREEN A4 commit creates these modules / exports; RED A4
// pins the contract they must satisfy.
//
// Helper: pure zoom → band mapping. Picked as a co-located module rather
// than living inside `radialLayout.ts` because LOD is a rendering concern
// (the layout itself is band-agnostic) and we want unit-testable purity.
import { radialBandFor } from "../src/lib/lod";
// Components: A4 extracts the band-1 dot rendering out of
// `GraphExplorer.tsx` into a dedicated `RadialNode` that branches on
// band 1 / 2 / 3, and introduces a new `RadialEdge` that does the same
// for edges. Both components accept `zoom` as an explicit prop so tests
// can render them without a `ReactFlow` provider in scope (the
// production `GraphExplorer` will subscribe to React Flow's transform
// store via `useStore((s) => Math.floor(s.transform[2] * 2))` and pass
// the resulting zoom down).
import { RadialNode } from "../src/components/RadialNode";
import { RadialEdge } from "../src/components/RadialEdge";

/**
 * RED tests for Slice A4 (spec:
 * docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md;
 * ADR-0006 §LOD (semantic zoom)).
 *
 * Three discrete LOD bands per ADR-0006:
 *
 *   Band 1 (zoom < 0.5):     5px circular dot, no labels, no outline,
 *                            no foreignObject. Edges are plain thin
 *                            lines, no arrowheads, no labels.
 *   Band 2 (0.5 ≤ z < 1.5):  12px circular marker, fill = subsystem
 *                            hue, truncated name label (≤ 12 chars +
 *                            ellipsis), outline present (a hard-coded
 *                            grey in A4 — B1 will wire it to the
 *                            colour-mode band). Edges gain arrowheads
 *                            (`marker-end`) but stay unlabelled.
 *   Band 3 (zoom ≥ 1.5):     80×40 HTML card with full node name and
 *                            one badge (default: maturity). Edges keep
 *                            arrowheads and gain labels — but the label
 *                            is only visible when the edge's source or
 *                            target is the currently-focused node
 *                            (`isFocusEndpoint=true`). Focus state is
 *                            `null` throughout A4, so labels effectively
 *                            never show in A4 itself; the test below
 *                            still pins both branches so the GREEN
 *                            implementation has to wire the prop in,
 *                            ready for Phase B.
 *
 * Test-renderer choice: `react-dom/server`'s `renderToStaticMarkup` is
 * already a transitive dependency (Next.js depends on `react-dom`); no
 * new dev-dep is needed. The downside vs `react-test-renderer` is that
 * we assert on the rendered HTML string (rather than a structured JSON
 * tree), but the LOD contract is shape-of-DOM, so string-level
 * assertions are precise enough. `react-test-renderer` is not installed
 * in this repo (checked `node_modules/`), `@testing-library/react` is
 * not installed either; adding either would mean tens of extra
 * dependencies for a tightly-scoped LOD check. `renderToStaticMarkup`
 * also fully runs `useMemo` / `useCallback` so a component that uses
 * those hooks renders fine; only effect hooks (`useEffect`,
 * `useLayoutEffect`) are skipped, which is acceptable here since the
 * LOD components are pure presentation.
 */

// Minimal node prop set used for component-rendered assertions. Real
// `RadialNode` will accept the full radial-render data (id, hue,
// selected, isFocal, onSelect, etc.) but for LOD-band tests we pin only
// the inputs that affect band-switched output.
type RadialNodeTestProps = {
  id: string;
  name: string;
  fill: string;
  maturityLabel: string;
  zoom: number;
};

type RadialEdgeTestProps = {
  id: string;
  source: string;
  target: string;
  label: string;
  zoom: number;
  isFocusEndpoint: boolean;
};

function renderNode(props: RadialNodeTestProps): string {
  return renderToStaticMarkup(
    React.createElement(RadialNode as unknown as React.FC<RadialNodeTestProps>, props),
  );
}

function renderEdge(props: RadialEdgeTestProps): string {
  return renderToStaticMarkup(
    React.createElement(RadialEdge as unknown as React.FC<RadialEdgeTestProps>, props),
  );
}

// -------------------- radialBandFor pure helper --------------------

/**
 * Band thresholds (ADR-0006 §LOD):
 *   z <  0.5         → band 1
 *   0.5 ≤ z < 1.5    → band 2
 *   z ≥ 1.5          → band 3
 *
 * We pin both sides of each boundary (just-below and exactly-at) so the
 * GREEN implementation can't accidentally swap `<` for `≤` and pass.
 */
test("radialBandFor B1: zoom < 0.5 returns band 1", () => {
  assert.equal(radialBandFor(0.2), 1, "zoom=0.2 must be band 1");
  assert.equal(radialBandFor(0.3), 1, "zoom=0.3 must be band 1");
  assert.equal(
    radialBandFor(0.499999),
    1,
    "zoom=0.499999 must be band 1 (boundary just below 0.5)",
  );
});

test("radialBandFor B2: 0.5 ≤ zoom < 1.5 returns band 2", () => {
  assert.equal(radialBandFor(0.5), 2, "zoom=0.5 must be band 2 (exact lower boundary)");
  assert.equal(radialBandFor(1.0), 2, "zoom=1.0 must be band 2");
  assert.equal(
    radialBandFor(1.499999),
    2,
    "zoom=1.499999 must be band 2 (boundary just below 1.5)",
  );
});

test("radialBandFor B3: zoom ≥ 1.5 returns band 3", () => {
  assert.equal(radialBandFor(1.5), 3, "zoom=1.5 must be band 3 (exact lower boundary)");
  assert.equal(radialBandFor(3.0), 3, "zoom=3.0 must be band 3");
});

// -------------------- RadialNode component output --------------------

const SAMPLE_NODE_PROPS_BASE = {
  id: "vision_processing_compute",
  name: "Vision Processing Compute Module",
  fill: "hsl(200, 60%, 50%)",
  maturityLabel: "Lab prototype",
};

test("RadialNode band 1 (zoom 0.3): 5px SVG dot, no label, no foreignObject", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 0.3 });
  // SVG circle present.
  assert.match(html, /<svg/, `band-1 must render an <svg> root; got: ${html}`);
  assert.match(html, /<circle/, `band-1 must contain a <circle>; got: ${html}`);
  // r="5" (radius 5px). Allow either single or double quotes around the
  // attribute value; renderToStaticMarkup uses double quotes today, but
  // we keep the regex tolerant.
  assert.match(
    html,
    /r=["']5["']/,
    `band-1 circle must have r=5; got: ${html}`,
  );
  // No foreignObject (band-1 has no HTML inside SVG).
  assert.doesNotMatch(
    html,
    /foreignObject/i,
    `band-1 must NOT contain a foreignObject; got: ${html}`,
  );
  // No text labels — the node name must not appear, neither full nor
  // truncated. We check the literal node name absence (the strongest
  // signal) since "no <text> element" alone could miss a stray label
  // rendered as plain HTML.
  assert.doesNotMatch(
    html,
    /Vision Processing Compute/,
    `band-1 must NOT show the node name; got: ${html}`,
  );
  // No <text> SVG element either.
  assert.doesNotMatch(html, /<text[\s>]/, `band-1 must NOT contain a <text> element; got: ${html}`);
});

test("RadialNode band 2 (zoom 1.0): 12px circle, truncated label, outline element", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 1.0 });
  assert.match(html, /<circle/, `band-2 must contain a <circle>; got: ${html}`);
  // 12px radius.
  assert.match(
    html,
    /r=["']12["']/,
    `band-2 circle must have r=12; got: ${html}`,
  );
  // Truncated name visible. The supplied name "Vision Processing
  // Compute Module" is 33 chars; the band-2 truncation rule is "≤ 12
  // chars + ellipsis". We don't pin the exact truncation algorithm
  // (the GREEN commit may choose word-boundary vs hard slice), only
  // that (a) the rendered label is at most 13 chars including the
  // ellipsis character, and (b) it ends in a "…" / "..." marker.
  const textMatch = html.match(/<text[^>]*>([^<]+)<\/text>/);
  assert.ok(
    textMatch,
    `band-2 must contain a <text> label element; got: ${html}`,
  );
  const labelText = textMatch![1];
  // Allow the unicode ellipsis or three-dot ASCII fallback.
  assert.ok(
    labelText.endsWith("…") || labelText.endsWith("..."),
    `band-2 label must end with an ellipsis marker; got "${labelText}"`,
  );
  // Length cap (12 chars of content + 1 ellipsis char, or 12 + 3 ASCII
  // dots). We bound at 15 to allow either ellipsis style.
  assert.ok(
    labelText.length <= 15,
    `band-2 label must be ≤ 15 chars (12 chars + ellipsis); got length=${labelText.length} text="${labelText}"`,
  );
  // Outline channel exists. The GREEN commit may implement this as a
  // second concentric <circle> with `stroke` set and `fill="none"`, or
  // as a `stroke` attribute on the primary circle, or as a wrapping
  // `<g>` with a CSS class. We pin only that *some* outline-related
  // attribute appears, by requiring a `stroke=` attribute somewhere in
  // the output (band-1 deliberately omits `stroke`).
  assert.match(
    html,
    /stroke=/,
    `band-2 must expose a node outline (stroke= attribute somewhere); got: ${html}`,
  );
  // No 80x40 HTML card at band 2.
  assert.doesNotMatch(
    html,
    /(width=["']80["'][^>]*height=["']40["'])|(height=["']40["'][^>]*width=["']80["'])/,
    `band-2 must NOT render the 80x40 card; got: ${html}`,
  );
});

test("RadialNode band 3 (zoom 2.0): 80×40 HTML card with full name and a badge", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 2.0 });
  // Either a foreignObject (if mounted under SVG) or a plain HTML
  // wrapper. We accept either, but require a width=80 height=40 pair
  // somewhere in the output. The check allows the two attributes in
  // either order.
  const hasWidth80 = /width=["']80["']/.test(html);
  const hasHeight40 = /height=["']40["']/.test(html);
  assert.ok(
    hasWidth80 && hasHeight40,
    `band-3 must render an 80x40 card (width=80 + height=40 somewhere); got: ${html}`,
  );
  // Full node name must appear in band 3 (not truncated).
  assert.match(
    html,
    /Vision Processing Compute Module/,
    `band-3 must show the full node name; got: ${html}`,
  );
  // One badge — pinned as the maturity label since A4 has no mode
  // wired in yet. The badge text must appear somewhere in the output.
  assert.match(
    html,
    /Lab prototype/,
    `band-3 must show the maturity badge text; got: ${html}`,
  );
});

// -------------------- RadialEdge component output --------------------

const SAMPLE_EDGE_PROPS_BASE = {
  id: "e:vision_processing_compute__requires__industrial_area_scan_camera",
  source: "vision_processing_compute",
  target: "industrial_area_scan_camera",
  label: "requires",
};

test("RadialEdge band 1 (zoom 0.3): thin line, no arrowhead, no label", () => {
  const html = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 0.3, isFocusEndpoint: false });
  // Either <line> or <path> with a stroke attribute.
  assert.match(
    html,
    /<(line|path)[^>]*stroke=/,
    `band-1 edge must render a <line> or <path> with stroke; got: ${html}`,
  );
  // No arrowhead. We pin both `marker-end` attribute and the SVG
  // `<marker>` element form (some implementations render a defs/marker
  // pair inline; either way the marker-end reference is the explicit
  // arrowhead signal).
  assert.doesNotMatch(
    html,
    /marker-end=/,
    `band-1 edge must NOT have a marker-end (arrowhead); got: ${html}`,
  );
  // No label text.
  assert.doesNotMatch(
    html,
    /<text[\s>]/,
    `band-1 edge must NOT contain a <text> label; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /requires/,
    `band-1 edge must NOT show the label string; got: ${html}`,
  );
});

test("RadialEdge band 2 (zoom 1.0): line with arrowhead, no label", () => {
  const html = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 1.0, isFocusEndpoint: false });
  assert.match(
    html,
    /<(line|path)[^>]*stroke=/,
    `band-2 edge must render a <line> or <path> with stroke; got: ${html}`,
  );
  // Arrowhead must appear (marker-end attribute reference).
  assert.match(
    html,
    /marker-end=/,
    `band-2 edge must have a marker-end (arrowhead); got: ${html}`,
  );
  // No label.
  assert.doesNotMatch(
    html,
    /<text[\s>]/,
    `band-2 edge must NOT contain a <text> label; got: ${html}`,
  );
});

test("RadialEdge band 3 + isFocusEndpoint=false: arrowhead, still no label", () => {
  const html = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 2.0, isFocusEndpoint: false });
  assert.match(
    html,
    /marker-end=/,
    `band-3 edge (non-focus) must have a marker-end (arrowhead); got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /<text[\s>]/,
    `band-3 edge with isFocusEndpoint=false must NOT show a label; got: ${html}`,
  );
});

test("RadialEdge band 3 + isFocusEndpoint=true: arrowhead AND a visible label", () => {
  const html = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 2.0, isFocusEndpoint: true });
  assert.match(
    html,
    /marker-end=/,
    `band-3 edge (focus) must have a marker-end (arrowhead); got: ${html}`,
  );
  // Label text element exists, and the label string appears in it.
  assert.match(
    html,
    /<text[\s>]/,
    `band-3 edge with isFocusEndpoint=true must contain a <text> label; got: ${html}`,
  );
  assert.match(
    html,
    /requires/,
    `band-3 edge (focus) label must contain the label string; got: ${html}`,
  );
});

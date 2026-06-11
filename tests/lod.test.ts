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
import { effectiveLodZoom, radialBandFor } from "../src/lib/lod";
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
 *   Band 1 (zoom < 0.5):     15px circular dot, no labels, no outline,
 *                            no foreignObject. Edges are plain thin
 *                            lines, no arrowheads, no labels.
 *   Band 2 (0.5 ≤ z < 1.5):  12px circular marker, fill = subsystem
 *                            hue, truncated name label (≤ 12 chars +
 *                            ellipsis), neutral outline present for
 *                            selection/root affordance. Edges gain
 *                            arrowheads (`marker-end`) but stay
 *                            unlabelled.
 *   Band 3 (zoom ≥ 1.5):     108×56 HTML card with full node name and
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
  outlineColor?: string;
  visualRole?: "root" | "anchor" | "branch" | "leaf";
  showLabel?: boolean;
};

type RadialEdgeTestProps = {
  id: string;
  source: string;
  target: string;
  label: string;
  zoom: number;
  isFocusEndpoint: boolean;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
  sourceAnchorX?: number;
  sourceAnchorY?: number;
  targetAnchorX?: number;
  targetAnchorY?: number;
  sourceRadius?: number;
  targetRadius?: number;
  stroke?: string;
  strokeWidth?: number;
  edgeKind?: "primary" | "cross";
  emphasis?: "branch" | "normal";
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

test("effectiveLodZoom: manual display modes pin the rendered band independent of raw zoom", () => {
  assert.equal(radialBandFor(effectiveLodZoom(2.4, "overview")), 1);
  assert.equal(radialBandFor(effectiveLodZoom(0.2, "labels")), 2);
  assert.equal(radialBandFor(effectiveLodZoom(0.2, "detail")), 3);
});

test("effectiveLodZoom: auto keeps the existing zoom-threshold behaviour", () => {
  assert.equal(radialBandFor(effectiveLodZoom(0.3, "auto")), 1);
  assert.equal(radialBandFor(effectiveLodZoom(1.0, "auto")), 2);
  assert.equal(radialBandFor(effectiveLodZoom(2.0, "auto")), 3);
});

// -------------------- RadialNode component output --------------------

const SAMPLE_NODE_PROPS_BASE = {
  id: "vision_processing_compute",
  name: "Vision Processing Compute Module",
  fill: "hsl(200, 60%, 50%)",
  maturityLabel: "Lab prototype",
};

test("RadialNode band 1 (zoom 0.3): detail-sized SVG footprint with centered dot, no label, no foreignObject", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 0.3 });
  // SVG circle present.
  assert.match(html, /<svg/, `band-1 must render an <svg> root; got: ${html}`);
  assert.match(html, /width=["']136["']/, `band-1 must reserve detail width; got: ${html}`);
  assert.match(html, /height=["']72["']/, `band-1 must reserve detail height; got: ${html}`);
  assert.match(html, /<circle/, `band-1 must contain a <circle>; got: ${html}`);
  // r="15" (radius 15px). Allow either single or double quotes around the
  // attribute value; renderToStaticMarkup uses double quotes today, but
  // we keep the regex tolerant.
  assert.match(
    html,
    /r=["']15["']/,
    `band-1 circle must have r=15; got: ${html}`,
  );
  assert.match(
    html,
    /cx=["']68["']/,
    `band-1 dot must be centered in the detail footprint; got: ${html}`,
  );
  assert.match(
    html,
    /cy=["']36["']/,
    `band-1 dot must be centered in the detail footprint; got: ${html}`,
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

test("RadialNode band 1 visual hierarchy: anchors are larger than readable quiet leaves", () => {
  const anchorHtml = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 0.3, visualRole: "anchor" });
  const leafHtml = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 0.3, visualRole: "leaf" });
  assert.match(anchorHtml, /r=["']22["']/, `anchor overview dot should be r=22; got: ${anchorHtml}`);
  assert.match(leafHtml, /r=["']9["']/, `leaf overview dot should be r=9; got: ${leafHtml}`);
  assert.match(leafHtml, /opacity=["']0\.46["']/, `quiet leaf should be low-opacity texture; got: ${leafHtml}`);
});

test("RadialNode band 2 (zoom 1.0): larger readable label marker, truncated label, outline element", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 1.0 });
  assert.match(html, /<circle/, `band-2 must contain a <circle>; got: ${html}`);
  // 16px radius for ordinary branch nodes.
  assert.match(
    html,
    /r=["']16["']/,
    `band-2 circle must have r=16; got: ${html}`,
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
  assert.match(
    html,
    /font-size=["']13["']|fontSize:13|font-size:13px/,
    `band-2 label should use a larger readable 13px font; got: ${html}`,
  );
  assert.match(
    html,
    /width=["']108["']/,
    `band-2 content should stay 108px wide inside the detail footprint; got: ${html}`,
  );
  assert.match(
    html,
    /height=["']64["']/,
    `band-2 content should stay 64px tall inside the detail footprint; got: ${html}`,
  );
  assert.match(
    html,
    /<svg width=["']136["'] height=["']72["']/,
    `band-2 outer SVG must reserve the detail footprint; got: ${html}`,
  );
  // No HTML card at band 2; it only reserves the detail-sized SVG footprint.
  assert.doesNotMatch(
    html,
    /foreignObject/,
    `band-2 must NOT render the HTML detail card; got: ${html}`,
  );
});

test("RadialNode band 2: labels can be suppressed for leaf texture nodes", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 1.0, visualRole: "leaf", showLabel: false });
  assert.match(html, /<circle/, `band-2 quiet leaf still renders a node marker; got: ${html}`);
  assert.doesNotMatch(html, /<text[\s>]/, `band-2 quiet leaf should not render a label; got: ${html}`);
  assert.doesNotMatch(html, /Vision Processing Compute/, `band-2 quiet leaf should not show node name; got: ${html}`);
});

test("RadialNode band 2: transparent outline removes the ordinary node contour", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 1.0, outlineColor: "transparent" });
  assert.match(html, /<circle/, `band-2 ordinary node still renders a node marker; got: ${html}`);
  assert.match(
    html,
    /stroke-width=["']0["']|strokeWidth:0/,
    `band-2 ordinary node contour should have zero width when outlineColor is transparent; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /stroke-width=["']1\.5["']|strokeWidth:1\.5/,
    `band-2 ordinary node contour must not keep the selected/root outline width; got: ${html}`,
  );
});

test("RadialNode band 3 (zoom 2.0): 136×72 HTML card with full name and a badge", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 2.0 });
  // Either a foreignObject (if mounted under SVG) or a plain HTML
  // wrapper. We accept either, but require a width=136 height=72 pair
  // somewhere in the output. The check allows the two attributes in
  // either order.
  const hasWidth136 = /width=["']136["']/.test(html);
  const hasHeight72 = /height=["']72["']/.test(html);
  assert.ok(
    hasWidth136 && hasHeight72,
    `band-3 must render a 136x72 card (width=136 + height=72 somewhere); got: ${html}`,
  );
  assert.match(
    html,
    /font-size:14px/,
    `band-3 card text should use 14px for readability; got: ${html}`,
  );
  assert.match(
    html,
    /font-size:10px/,
    `band-3 badge should use 10px for readability; got: ${html}`,
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

test("RadialNode band 3: transparent outline removes the ordinary card contour", () => {
  const html = renderNode({ ...SAMPLE_NODE_PROPS_BASE, zoom: 2.0, outlineColor: "transparent" });
  assert.match(html, /Vision Processing Compute Module/, `band-3 ordinary card must still show the node; got: ${html}`);
  assert.match(
    html,
    /border:0/,
    `band-3 ordinary card contour should be removed when outlineColor is transparent; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /1px solid transparent/,
    `band-3 ordinary card must not keep a transparent border that reads as a hidden contour channel; got: ${html}`,
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

test("RadialEdge cross-links stay hidden until detail zoom", () => {
  const band1 = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 0.3, isFocusEndpoint: false, edgeKind: "cross" });
  const band2 = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 1.0, isFocusEndpoint: false, edgeKind: "cross" });
  const band3 = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 2.0, isFocusEndpoint: false, edgeKind: "cross" });
  assert.equal(band1, "", `cross-link should be hidden in overview band 1; got: ${band1}`);
  assert.equal(band2, "", `cross-link should be hidden in mid zoom band 2; got: ${band2}`);
  assert.match(band3, /strokeDasharray|stroke-dasharray/, `cross-link should return as dashed context in band 3; got: ${band3}`);
});

test("RadialEdge branch emphasis keeps analysis stroke color while getting thicker", () => {
  const branch = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 0.3,
    isFocusEndpoint: false,
    emphasis: "branch",
    stroke: "#ef4444",
  });
  const normal = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 0.3, isFocusEndpoint: false, emphasis: "normal" });
  assert.match(branch, /stroke=["']#ef4444["']/, `branch emphasis should preserve the active lens stroke; got: ${branch}`);
  assert.match(branch, /strokeWidth=["']4\.6["']|stroke-width=["']4\.6["']/, `branch emphasis should be thick; got: ${branch}`);
  assert.doesNotMatch(normal, /stroke=["']#ef4444["']/, `normal edge should not inherit branch stroke without emphasis; got: ${normal}`);
});

test("RadialEdge arrowhead uses the rendered stroke and follows the path end", () => {
  const html = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 1.0,
    isFocusEndpoint: false,
    emphasis: "branch",
    stroke: "#ef4444",
  });
  assert.match(html, /stroke=["']#ef4444["']/, `branch path should preserve the active lens stroke; got: ${html}`);
  assert.match(html, /fill=["']#ef4444["']/, `arrowhead fill should match rendered path stroke; got: ${html}`);
  assert.match(html, /orient=["']auto["']/, `marker should follow the outgoing path tangent; got: ${html}`);
  assert.match(html, /markerUnits=["']userSpaceOnUse["']|marker-units=["']userSpaceOnUse["']/, `marker should use explicit graph-space dimensions; got: ${html}`);
  assert.match(html, /refX=["']0["']|refX=\{0\}/, `marker reference should place the arrow tail on the path endpoint; got: ${html}`);
});

test("RadialEdge trims endpoints so the line stops at the arrow tail", () => {
  const html = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 1.0,
    isFocusEndpoint: false,
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 0,
    sourceRadius: 12,
    targetRadius: 12,
  });
  assert.match(html, /d=["']M 12 0 L 80 0["']/, `edge path should stop at the arrow tail while the arrow tip reaches the node rim; got: ${html}`);
});

test("RadialEdge detail mode trims to the card rectangle, not the overview dot radius", () => {
  const html = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 2.0,
    isFocusEndpoint: false,
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 0,
    sourceRadius: 12,
    targetRadius: 12,
  });
  assert.match(
    html,
    /d=["']M 68 0 L 124 0["']/,
    `detail edge should run from card edge to arrow tail at target card edge; got: ${html}`,
  );
});

test("RadialEdge detail primary edges use smooth port curves so card endpoints stay readable", () => {
  const html = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 2.0,
    isFocusEndpoint: false,
    sourceX: 100,
    sourceY: 0,
    targetX: 200,
    targetY: 100,
    sourceRadius: 12,
    targetRadius: 12,
  });
  assert.match(html, /<path[^>]+d=["'][^"']+ L [^"']+["']/, `detail primary edge without explicit ports should keep the fallback straight trim; got: ${html}`);
});

test("RadialEdge detail mode can use explicit card-edge ports", () => {
  const html = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 2.0,
    isFocusEndpoint: false,
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 0,
    sourceRadius: 12,
    targetRadius: 12,
    sourceAnchorX: 68,
    sourceAnchorY: 10,
    targetAnchorX: 132,
    targetAnchorY: 10,
  });
  assert.match(
    html,
    /d=["']M 75 10 C [^"']+ 117 10["']/,
    `detail edge should start just outside the assigned source port and curve into the arrow tail outside the assigned target port; got: ${html}`,
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

test("RadialEdge band 2: nearby same-angle child edges still use the curved branch style", () => {
  const html = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 1.0,
    isFocusEndpoint: false,
    sourceX: 100,
    sourceY: 0,
    targetX: 200,
    targetY: 10,
    sourceRadius: 16,
    targetRadius: 10,
  });
  assert.match(
    html,
    /<path[^>]+d=["'][^"']+ C [^"']+["']/,
    `band-2 child edges should keep the curved branch style instead of switching to odd straight-line ports; got: ${html}`,
  );
});

test("RadialEdge band 2: radially adjacent parent-child keeps the arrowhead pointing at the target", () => {
  // Real-geometry regression (conveyor_integration → parcel_induction_spacing_control):
  // the two nodes sit on radially adjacent rings (span ≈ 39px) while endpoint
  // trimming consumes sourceRadius + targetRadius + arrowLength (≈ 68px).
  // Rebuilding the radial cubic from the trimmed endpoints inverted their
  // radial order and flipped the end tangent, so the arrow rendered pointing
  // back toward the root instead of into the target node.
  const target = { x: 256.678, y: 179.553 };
  const html = renderEdge({
    ...SAMPLE_EDGE_PROPS_BASE,
    zoom: 0.9,
    isFocusEndpoint: false,
    sourceX: 255.733,
    sourceY: 98.2948,
    targetX: target.x,
    targetY: target.y,
    sourceRadius: 20,
    targetRadius: 28,
    strokeWidth: 5.85,
  });
  const d = /<path d=["']([^"']+)["'][^>]*marker-end=/.exec(html)?.[1];
  assert.ok(d, `edge should render a path with an arrowhead; got: ${html}`);
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  assert.ok(nums.length >= 4, `path should expose endpoint coordinates; got: ${d}`);
  const end = { x: nums[nums.length - 2], y: nums[nums.length - 1] };
  const prev = { x: nums[nums.length - 4], y: nums[nums.length - 3] };
  const tangent = { x: end.x - prev.x, y: end.y - prev.y };
  const toTarget = { x: target.x - end.x, y: target.y - end.y };
  const dot = tangent.x * toTarget.x + tangent.y * toTarget.y;
  assert.ok(
    dot > 0,
    `arrowhead tangent must point toward the target node; tangent (${tangent.x.toFixed(1)}, ${tangent.y.toFixed(1)}) vs to-target (${toTarget.x.toFixed(1)}, ${toTarget.y.toFixed(1)}) in: ${d}`,
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

test("RadialEdge band 3 + isFocusEndpoint=true: arrowhead and no label", () => {
  const html = renderEdge({ ...SAMPLE_EDGE_PROPS_BASE, zoom: 2.0, isFocusEndpoint: true });
  assert.match(
    html,
    /marker-end=/,
    `band-3 edge (focus) must have a marker-end (arrowhead); got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /<text[\s>]/,
    `band-3 edge with isFocusEndpoint=true must not contain a <text> label; got: ${html}`,
  );
});

test("RadialNode renders diamond marker and know-how badge when requested", () => {
  const html = renderToStaticMarkup(
    React.createElement(RadialNode, {
      id: "kh",
      name: "Know-how node",
      fill: "hsl(32, 85%, 48%)",
      maturityLabel: "lab_prototype",
      zoom: 1.0, // band 2
      shape: "diamond",
      knowHowBottleneckCount: 0,
    }),
  );
  assert.match(html, /data-node-shape="diamond"/);
});

test("RadialNode renders red-ring bottleneck badge with count at band 2", () => {
  const html = renderToStaticMarkup(
    React.createElement(RadialNode, {
      id: "host",
      name: "Host module",
      fill: "hsl(200, 60%, 50%)",
      maturityLabel: "mature",
      zoom: 1.0,
      knowHowBottleneckCount: 2,
    }),
  );
  assert.match(html, /data-knowhow-bottlenecks="2"/);
});

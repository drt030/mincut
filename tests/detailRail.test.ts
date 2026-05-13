import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// RED Slice B4 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md
// § "Slice B4 — Detail panel rail (P1 collapsed ↔ expanded)";
// ADR-0006 § "Detail panel").
//
// The detail panel becomes a right-edge rail with two states:
//
//   - Default (collapsed): 64px wide. Shows the focused node's name
//     plus one critical badge (maturity). Hints "more detail
//     available."
//   - Expanded: 400px wide. Shows description, metrics, evidence,
//     bottlenecks, upstream / downstream summary, sibling products,
//     cost rollup, regulations, principles.
//
// Content cross-fades on focus change via a `key` prop on the content
// area so React unmounts/remounts (enabling the CSS opacity
// transition). Rail/expanded state persists across focus changes.
// Pressing Esc collapses the panel AND clears focus.
//
// Testing approach (matches A4 / B1 patterns):
//   - The component is presentational with explicit props (no
//     `useStore` inside). The wrapper that owns the state lives
//     elsewhere (the page or the rewritten `NodeDetailPanel` default
//     export); this test pins the *pure* render contract of
//     `NodeDetailRail`.
//   - `renderToStaticMarkup` produces the HTML string we assert
//     against. Static rendering cannot fire clicks or keypresses, so
//     interaction wiring is asserted by markup-level checks
//     (presence + role of a toggle button, presence of a content key
//     attribute) plus a separate pure function `handleRailKeydown`
//     exported for direct testing.
//
// None of these modules exist on master at HEAD a327876. The GREEN
// commit creates `src/components/NodeDetailRail.tsx` (presentational)
// and rewrites `src/components/NodeDetailPanel.tsx` to host the
// useState + wiring around the rail. This test file fails at import
// time with a "cannot find module" error, which is the cleanest RED
// signal we can give the GREEN sub-agent.
import { NodeDetailRail, handleRailKeydown } from "../src/components/NodeDetailRail";
import { loadGraphData } from "../src/lib/graphLoader";
import type { Node } from "../src/lib/schema";

// ------------------------------------------------------------------
// Fixture nodes — pulled from the real dataset via loadGraphData so
// the rail's content rendering exercises realistic shapes (metrics,
// evidence, bottlenecks, etc.). We pin three nodes that exercise
// distinct maturity ramps and distinct content profiles:
//   1. FOCAL (focal product, `prototype` maturity, rich children).
//   2. A subsystem module — `commercially_available` maturity.
//   3. A leaf module — `lab_proven` maturity (lower end of ramp).
// ------------------------------------------------------------------
const FOCAL_PRODUCT_ID = "low_cost_parcel_sorting_robot_300k_rmb";
const SUBSYSTEM_ID = "parcel_manipulation_or_diverter"; // prototype
const COMMERCIAL_ID = "industrial_area_scan_camera"; // commercially_available
const LAB_PROVEN_LEAF_ID = "parcels_per_hour"; // lab_proven metric (a "leaf"-ish node)

const graph = loadGraphData();

function nodeById(id: string): Node {
  const node = graph.nodes.find((n) => n.id === id);
  assert.ok(node, `fixture node ${id} must exist in the loaded dataset`);
  return node!;
}

// We cast NodeDetailRail to a permissive props type so the test can
// reference props that the GREEN commit will declare. The GREEN
// commit's actual signature must accept (at minimum) the fields used
// below.
type NodeDetailRailTestProps = {
  graph: typeof graph;
  focusedNode: Node | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
};

function render(props: NodeDetailRailTestProps): string {
  return renderToStaticMarkup(
    React.createElement(
      NodeDetailRail as unknown as React.FC<NodeDetailRailTestProps>,
      props,
    ),
  );
}

const noop = () => {};

// ==================================================================
// Test 1 — Default collapsed render: 64px wide, name + maturity badge
// ==================================================================
test("collapsed: 64px-wide rail shows the focused node's name and one maturity badge", () => {
  const focused = nodeById(SUBSYSTEM_ID); // maturityLabel = "prototype"
  const html = render({
    graph,
    focusedNode: focused,
    expanded: false,
    onToggleExpand: noop,
    onClose: noop,
  });

  // Pinned hook: the root rail element must be discoverable by a
  // stable testid. The GREEN commit may put it on a <aside>, <div>,
  // or other element; the testid is the contract.
  assert.match(
    html,
    /data-testid=["']node-detail-rail["']/,
    `rail must expose data-testid="node-detail-rail"; got: ${html}`,
  );

  // Width pinned via a data attribute so we don't have to parse
  // inline style strings or CSS-in-JS. The GREEN commit also wires
  // up the actual CSS width (64px); the attribute is the test hook.
  assert.match(
    html,
    /data-rail-width=["']64["']/,
    `collapsed rail must expose data-rail-width="64"; got: ${html}`,
  );

  // The node name must appear somewhere in the rail. Use the
  // English `name` field (the GREEN commit may also render a
  // localized version via `useLanguage`, but the raw name string
  // must still appear in the rendered output since LanguageProvider
  // falls back to `node.name` when no override is registered).
  assert.ok(
    html.includes(focused.name),
    `collapsed rail must show the focused node name "${focused.name}"; got: ${html}`,
  );

  // Maturity badge text. `maturityLabel` is the snake_case raw
  // value ("prototype"). The rail must render the *display* form
  // ("Prototype") via maturityVisualFor / formatMaturityLabel —
  // this is the same treatment as the current NodeDetailPanel.
  assert.match(
    html,
    /Prototype/,
    `collapsed rail must show the maturity badge "Prototype" for the prototype-maturity subsystem; got: ${html}`,
  );
});

// ==================================================================
// Test 2 — Expanded render: 400px wide, description + metrics
// ==================================================================
test("expanded: 400px-wide rail shows description and metric references", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID); // has description + metrics
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  // Same testid hook in expanded state.
  assert.match(
    html,
    /data-testid=["']node-detail-rail["']/,
    `expanded rail must still expose data-testid="node-detail-rail"; got: ${html}`,
  );

  // Width must flip to 400px.
  assert.match(
    html,
    /data-rail-width=["']400["']/,
    `expanded rail must expose data-rail-width="400"; got: ${html}`,
  );

  // Description text — the focal product has a long `description`
  // string. We pin a stable substring rather than the whole sentence
  // so a future minor edit to the data doesn't break the test.
  assert.ok(
    focused.description,
    "oracle: focal product must have a description in the dataset",
  );
  const descSnippet = "vacuum-suction end-effector";
  assert.ok(
    focused.description!.includes(descSnippet),
    `oracle: focal product description must contain "${descSnippet}"; ` +
      "update the fixture if the dataset changed",
  );
  assert.ok(
    html.includes(descSnippet),
    `expanded rail must show the node description (must contain "${descSnippet}"); got: ${html}`,
  );

  // Metric reference. The focal product has at least one
  // `measured_by` metric child in the dataset. We don't pin the
  // exact metric title (the GREEN commit may choose to fold or
  // truncate); instead we pin the presence of a "Metrics" /
  // "metric" section header. The current NodeDetailPanel uses the
  // i18n key `t("metrics")` which is "Metrics" in English. We
  // accept either the English label or the Chinese "指标".
  assert.match(
    html,
    /Metrics|指标/,
    `expanded rail must surface a Metrics section header (English "Metrics" or Chinese "指标"); got: ${html}`,
  );
});

// ==================================================================
// Test 3 — No focus: placeholder, still 64px wide
// ==================================================================
test("no focus: rail renders a 'no selection' placeholder at 64px", () => {
  const html = render({
    graph,
    focusedNode: null,
    expanded: false,
    onToggleExpand: noop,
    onClose: noop,
  });

  // Rail still rendered (just empty-state).
  assert.match(
    html,
    /data-testid=["']node-detail-rail["']/,
    `no-focus rail must still expose data-testid="node-detail-rail"; got: ${html}`,
  );

  // Width stays at 64 even if `expanded === false`. The contract:
  // an empty rail can never be 400px — there's nothing to expand
  // to. The GREEN commit should either force width=64 in the
  // no-focus branch or refuse to render the expanded shell.
  assert.match(
    html,
    /data-rail-width=["']64["']/,
    `no-focus rail must stay at data-rail-width="64"; got: ${html}`,
  );

  // Placeholder hook: a discoverable testid for the empty-state.
  // The GREEN commit chooses the text (could be "No selection",
  // "未选中节点", "Click a node to view detail", etc.) — we pin
  // only the testid so the test doesn't couple to copy.
  assert.match(
    html,
    /data-testid=["']node-detail-rail-empty["']/,
    `no-focus rail must expose a placeholder via data-testid="node-detail-rail-empty"; got: ${html}`,
  );
});

// ==================================================================
// Test 4 — Toggle button presence (clickability via static markup)
// ==================================================================
test("toggle button: rail contains a discoverable <button> with the toggle testid", () => {
  const focused = nodeById(COMMERCIAL_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: false,
    onToggleExpand: noop,
    onClose: noop,
  });

  // The toggle is wired via the prop; static markup can't fire a
  // click, but it can verify the toggle element exists with the
  // right testid and is a real <button> (so the React onClick prop
  // will dispatch when fired in the live app).
  assert.match(
    html,
    /<button[^>]*data-testid=["']node-detail-rail-toggle["']/,
    `rail must contain a <button data-testid="node-detail-rail-toggle">; got: ${html}`,
  );
});

// ==================================================================
// Test 5 — Esc keydown handler (tested as a pure function)
// ==================================================================
test("handleRailKeydown: Esc fires onClose exactly once; other keys do not", () => {
  // Pure-function form: the rail wires its keydown listener via
  // `handleRailKeydown(event, onClose)`. The GREEN commit exports
  // this function so the test can fire it directly without
  // jsdom / DOM simulation.
  let closeCalls = 0;
  const onClose = () => {
    closeCalls += 1;
  };

  // Minimal KeyboardEvent-shaped object. The handler should read
  // only `key` and (optionally) call `preventDefault` — we provide
  // a no-op preventDefault so it doesn't throw.
  const escEvent = { key: "Escape", preventDefault: () => {} };
  handleRailKeydown(escEvent as unknown as KeyboardEvent, onClose);
  assert.equal(closeCalls, 1, "Escape must fire onClose exactly once");

  // Other keys are no-ops.
  const otherKeys = ["Enter", " ", "ArrowDown", "a", "Tab"];
  for (const key of otherKeys) {
    handleRailKeydown(
      { key, preventDefault: () => {} } as unknown as KeyboardEvent,
      onClose,
    );
  }
  assert.equal(
    closeCalls,
    1,
    `non-Escape keys must NOT fire onClose; saw ${closeCalls - 1} extra call(s)`,
  );
});

// ==================================================================
// Test 6 — Cross-fade: data-content-key reflects focused node id
// ==================================================================
test("content-key: data-content-key matches the focused node id; changes on focus change", () => {
  // Same rail, two different focused nodes. The `data-content-key`
  // attribute is the test hook for React's `key` on the content
  // container — when the key changes, React unmounts/remounts the
  // subtree, which enables the CSS opacity transition (cross-fade).
  const focusedA = nodeById(SUBSYSTEM_ID);
  const focusedB = nodeById(COMMERCIAL_ID);

  const htmlA = render({
    graph,
    focusedNode: focusedA,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const htmlB = render({
    graph,
    focusedNode: focusedB,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    htmlA,
    new RegExp(`data-content-key=["']${focusedA.id}["']`),
    `content area for focus=${focusedA.id} must expose data-content-key="${focusedA.id}"; got: ${htmlA}`,
  );
  assert.match(
    htmlB,
    new RegExp(`data-content-key=["']${focusedB.id}["']`),
    `content area for focus=${focusedB.id} must expose data-content-key="${focusedB.id}"; got: ${htmlB}`,
  );

  // No-focus case: the content-key must NOT be one of the real
  // node ids. The GREEN commit may pick `__empty__`, `null`, etc;
  // we pin that switching focus to null also changes the key so
  // the cross-fade still happens on focus=null → focus=real.
  const htmlEmpty = render({
    graph,
    focusedNode: null,
    expanded: false,
    onToggleExpand: noop,
    onClose: noop,
  });
  assert.doesNotMatch(
    htmlEmpty,
    new RegExp(`data-content-key=["']${focusedA.id}["']`),
    `no-focus rail must NOT carry the content-key of any real node; got: ${htmlEmpty}`,
  );
});

// ==================================================================
// Test 7 — Maturity badge band attribute
// ==================================================================
test("maturity badge: data-maturity-band attribute reflects the node's maturityLabel", () => {
  // Three nodes covering three distinct maturity ramps.
  const focal = nodeById(FOCAL_PRODUCT_ID); // prototype
  const commercial = nodeById(COMMERCIAL_ID); // commercially_available
  const lab = nodeById(LAB_PROVEN_LEAF_ID); // lab_proven

  // Oracle: confirm the fixture maturity labels haven't drifted.
  assert.equal(
    focal.maturityLabel,
    "prototype",
    "oracle: focal product must be `prototype` in the dataset",
  );
  assert.equal(
    commercial.maturityLabel,
    "commercially_available",
    "oracle: industrial_area_scan_camera must be `commercially_available`",
  );
  assert.equal(
    lab.maturityLabel,
    "lab_proven",
    "oracle: parcels_per_hour must be `lab_proven`",
  );

  const cases: Array<{ node: Node; expected: string }> = [
    { node: focal, expected: "prototype" },
    { node: commercial, expected: "commercially_available" },
    { node: lab, expected: "lab_proven" },
  ];

  for (const { node, expected } of cases) {
    const html = render({
      graph,
      focusedNode: node,
      expanded: false,
      onToggleExpand: noop,
      onClose: noop,
    });
    // Pinned: the maturity badge element carries
    // `data-maturity-band="<raw maturityLabel>"`. This is the test
    // hook the GREEN commit wires to the colour ramp (which lives
    // in `src/lib/maturityVisual.ts`).
    assert.match(
      html,
      new RegExp(`data-maturity-band=["']${expected}["']`),
      `rail with focus=${node.id} must expose data-maturity-band="${expected}"; got: ${html}`,
    );
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// RED Slice B4 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md
// § "Slice B4 — Detail panel rail (P1 collapsed ↔ expanded)";
// ADR-0006 § "Detail panel").
//
// The detail panel becomes a right-edge rail with two states:
//
//   - Default (collapsed): 112px wide. Shows the focused node's name
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
import { ChokepointHeadline, NodeDetailContent } from "../src/components/NodeDetailPanel";
import { chokepointVerdictBandFor } from "../src/lib/chokepointScore";
import { ExposureLockProvider } from "../src/components/ExposureLockCta";
import { loadActiveGraphData, loadGraphData } from "../src/lib/graphLoader";
import type { GraphData, Node } from "../src/lib/schema";

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
const REDUCER_ID = "precision_reducer_gearbox";
const NABTESCO_ID = "org_nabtesco";
const SIEMENS_ID = "org_siemens";
const MAINTENANCE_ID = "maintenance_workflow";
const ABB_ROBOTICS_ID = "org_abb_robotics";
const END_EFFECTOR_ID = "end_effector_gripper_or_suction";
const AI_COMPUTE_ROOT_ID = "ai_accelerator_module_hbm_cowos";

const graph = loadGraphData();

function nodeById(id: string): Node {
  const node = graph.nodes.find((n) => n.id === id);
  assert.ok(node, `fixture node ${id} must exist in the loaded dataset`);
  return node!;
}

function nodeByIdIn(graphData: GraphData, id: string): Node {
  const node = graphData.nodes.find((n) => n.id === id);
  assert.ok(node, `fixture node ${id} must exist in the scoped dataset`);
  return node!;
}

// We cast NodeDetailRail to a permissive props type so the test can
// reference props that the GREEN commit will declare. The GREEN
// commit's actual signature must accept (at minimum) the fields used
// below.
type NodeDetailRailTestProps = {
  graph: GraphData;
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

function renderWithLockedExposure(
  props: NodeDetailRailTestProps,
  locked = [
    {
      domainTag: "ai_compute_chain",
      entitlement: "ai_compute",
      hiddenOrgCount: 77,
    },
  ],
): string {
  return renderToStaticMarkup(
    React.createElement(
      ExposureLockProvider,
      { locked },
      React.createElement(
        NodeDetailRail as unknown as React.FC<NodeDetailRailTestProps>,
        props,
      ),
    ),
  );
}

function detailReaderPriority(html: string): string {
  const match = html.match(/<section[^>]*data-testid="detail-reader-priority"[\s\S]*?<\/section>/);
  assert.ok(match, `reader priority section should be addressable; got: ${html}`);
  return match[0];
}

function detailDisclosure(html: string, testId: string): string {
  const marker = `data-testid="${testId}"`;
  const markerIndex = html.indexOf(marker);
  assert.ok(markerIndex >= 0, `detail block ${testId} should be addressable; got: ${html}`);
  const openIndex = html.lastIndexOf("<", markerIndex);
  const tag = html.slice(openIndex + 1).match(/^([a-z0-9-]+)/i)?.[1];
  assert.ok(tag, `detail block ${testId} should have an opening tag; got: ${html.slice(openIndex, markerIndex + marker.length)}`);
  const close = `</${tag}>`;
  const closeIndex = html.indexOf(close, markerIndex);
  assert.ok(closeIndex >= 0, `detail block ${testId} should have a closing ${close}; got: ${html}`);
  return html.slice(openIndex, closeIndex + close.length);
}

function detailRegionBetween(html: string, startTestId: string, endTestId: string): string {
  const start = html.indexOf(`data-testid="${startTestId}"`);
  const end = html.indexOf(`data-testid="${endTestId}"`);
  assert.ok(start >= 0, `detail block ${startTestId} should be addressable; got: ${html}`);
  assert.ok(end > start, `detail block ${endTestId} should follow ${startTestId}; got: ${html}`);
  return html.slice(start, end);
}

function textFromMarkup(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const noop = () => {};

// ==================================================================
// Test 1 — Default collapsed render: 112px wide, name + maturity badge
// ==================================================================
test("collapsed: 112px-wide rail shows the focused node's name and one maturity badge", () => {
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
  // up the actual CSS width (112px); the attribute is the test hook.
  assert.match(
    html,
    /data-rail-width=["']112["']/,
    `collapsed rail must expose data-rail-width="112"; got: ${html}`,
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
// Test 2 — Expanded render: 400px wide, reader-first detail
// ==================================================================
test("expanded: 400px-wide rail shows description without surfacing raw metrics", () => {
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

  // Raw metric nodes stay in graph data, but the paid-user detail
  // surface should not expose a first-class Metrics section.
  assert.match(
    html,
    /Supplier and listed-company leads/,
    `expanded rail must keep the reader path focused on evidence and company/ticker leads; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /data-testid="detail-metric-details"/,
    `raw metric appendix should not be rendered in the paid-user detail UI; got: ${html}`,
  );
});

// ==================================================================
// Test 3 — No focus: placeholder, still 112px wide
// ==================================================================
test("no focus: rail renders a 'no selection' placeholder at 112px", () => {
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

  // Width stays at 112 even if `expanded === false`. The contract:
  // an empty rail can never be 400px — there's nothing to expand
  // to. The GREEN commit should either force width=112 in the
  // no-focus branch or refuse to render the expanded shell.
  assert.match(
    html,
    /data-rail-width=["']112["']/,
    `no-focus rail must stay at data-rail-width="112"; got: ${html}`,
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

test("expanded: component detail surfaces manufacturer candidates with share and ticker context", () => {
  const focused = nodeById(REDUCER_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Supplier and listed-company leads/,
    `expanded component detail must surface the supplier/listed-company diligence path; got: ${html}`,
  );
  assert.match(
    html,
    /Supply-chain position/,
    `supplier cards must expose the company's supply-chain position; got: ${html}`,
  );
  assert.match(
    html,
    /Association basis/,
    `supplier cards must expose the evidence-backed association basis; got: ${html}`,
  );
  assert.match(
    html,
    /Evidence links/,
    `expanded supplier cards must expose evidence links after expansion; got: ${html}`,
  );
  assert.match(html, /Nabtesco/, `reducer detail must list Nabtesco as a manufacturer candidate; got: ${html}`);
  assert.match(html, /60%/, `manufacturer section must surface Nabtesco's share metric; got: ${html}`);
  assert.match(html, /6268\.T/, `manufacturer section must surface Nabtesco's public listing; got: ${html}`);
  assert.match(
    html,
    /6268\.T · Tokyo/,
    `non-US ticker chips should clarify the trading venue for US retail users; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Status:\s*(?:reviewed|unreviewed)|reviewStatus|unreviewed/i,
    `public manufacturer section must not surface internal review state; got: ${html}`,
  );
  assert.match(
    html,
    /Company-claimed approximately 60% global share/,
    `manufacturer section must surface edge context and limitations; got: ${html}`,
  );
});

test("expanded: supplier cards use the final collapsed fields and keep evidence inside expansion", () => {
  const focused = nodeById(REDUCER_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const exposureSummary = detailDisclosure(html, "detail-exposure-evidence-summary");

  assert.match(exposureSummary, /Supplier and listed-company leads/);
  assert.match(exposureSummary, /Nabtesco/);
  assert.match(exposureSummary, /6268\.T · Tokyo/);
  assert.match(exposureSummary, /Supply-chain position/);
  assert.match(exposureSummary, /Association basis/);
  assert.match(
    exposureSummary,
    /Nabtesco is a major robot-joint precision reducer supplier/,
    `association basis should use the edge claim when available; got: ${exposureSummary}`,
  );
  assert.match(exposureSummary, /<summary[\s\S]*Nabtesco[\s\S]*6268\.T · Tokyo[\s\S]*Supply-chain position[\s\S]*Association basis/);
  const nabtescoCollapsed = exposureSummary.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? "";
  assert.doesNotMatch(nabtescoCollapsed, /Evidence links|reviewed|unreviewed|Commercial signal|Relation type|Role/i);
  assert.match(exposureSummary, /Evidence links/);
  assert.match(exposureSummary, /BOM status/);
});

test("expanded: supplier cards expose relationship confidence and source limitations when opened", () => {
  const scopedGraph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const focused = nodeByIdIn(scopedGraph, "humanoid_thermal_management_system");
  const html = render({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const exposureSummary = detailDisclosure(html, "detail-exposure-evidence-summary");

  assert.match(exposureSummary, /Sanhua|Henkel/, `thermal supplier leads should render; got: ${exposureSummary}`);
  assert.match(exposureSummary, /Relationship type/, `supplier card must name the graph relation; got: ${exposureSummary}`);
  assert.match(
    exposureSummary,
    /reported capable supplier|reported_capable_supplier/i,
    `supplier card must distinguish reported-capable leads from confirmed manufacturers; got: ${exposureSummary}`,
  );
  assert.match(exposureSummary, /Relationship confidence/, `supplier card must expose edge confidence; got: ${exposureSummary}`);
  assert.match(exposureSummary, /low confidence/i, `low-confidence supplier edges must be visible as low confidence; got: ${exposureSummary}`);
  assert.match(exposureSummary, /Review state/, `supplier card must expose public review state; got: ${exposureSummary}`);
  assert.match(
    exposureSummary,
    /Needs human review/,
    `unreviewed supplier edges must be labeled as needing human review without raw reviewStatus leakage; got: ${exposureSummary}`,
  );
  assert.match(exposureSummary, /Evidence limitations/, `supplier card must expose source limitations; got: ${exposureSummary}`);
  assert.match(
    exposureSummary,
    /does NOT mention robots|Robotics is not named|not named in the fetched primary body/i,
    `supplier card must show the evidence caveat that bounds reported-capable claims; got: ${exposureSummary}`,
  );
  assert.doesNotMatch(exposureSummary, /reviewStatus|unreviewed/i, `supplier card must avoid raw reviewStatus tokens; got: ${exposureSummary}`);
});

test("expanded: product route rolls up supplier cards from deeper component layers", () => {
  const scopedGraph = loadActiveGraphData("spacex_reusable_launch_stack");
  const focused = nodeByIdIn(scopedGraph, "falcon9_reusable_launch_branch");
  const html = render({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const exposureSummary = detailDisclosure(html, "detail-exposure-evidence-summary");

  assert.match(exposureSummary, /Supplier and listed-company leads/);
  assert.doesNotMatch(
    exposureSummary,
    /No company or ticker candidates are modeled here yet/i,
    `upper route nodes should roll up supplier leads from descendant components; got: ${exposureSummary}`,
  );
  assert.match(
    exposureSummary,
    /Toray|Hexcel|Teijin|Moog|Woodward|Parker Hannifin|Velo3D|Carpenter Technology/i,
    `Falcon 9 route should surface deeper launch-component supplier cards instead of only route-level ownership; got: ${exposureSummary}`,
  );
});

test("expanded: product supplier cards prioritize supplier exposure over owner or comparable exposure", () => {
  const scopedGraph = loadActiveGraphData("spacex_reusable_launch_stack");
  const focused = nodeByIdIn(scopedGraph, "spacex_reusable_launch_stack");
  const html = render({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const exposureSummary = detailDisclosure(html, "detail-exposure-evidence-summary");
  const cardNames = [...exposureSummary.matchAll(/detail-supplier-card-head"><span>([^<]+)<\/span>/g)]
    .map((match) => match[1]);

  assert.ok(cardNames.length >= 3, `SpaceX root should have enough rolled-up supplier cards; got: ${exposureSummary}`);
  const firstThree = cardNames.slice(0, 3).join(" ");
  assert.match(
    firstThree,
    /Outokumpu|Linde|Toray|Hexcel|Teijin|Moog|Woodward|Parker Hannifin|Velo3D|Carpenter Technology/i,
    `top supplier cards should favor actual supplier exposure over owner/comparable orgs; got: ${firstThree}`,
  );
  assert.doesNotMatch(
    firstThree,
    /Rocket Lab|SpaceX/,
    `owner/comparable organizations should not crowd out supplier leads in the collapsed top cards; got: ${firstThree}`,
  );
});

test("expanded: vacuum end-effector parent surfaces key suction EOAT supplier candidates", () => {
  const focused = nodeById(END_EFFECTOR_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Supplier and listed-company leads/,
    `expanded EOAT parent detail must surface candidate supplier/ticker leads; got: ${html}`,
  );

  for (const supplier of ["SMC", "Schmalz", "Piab", "Festo", "OnRobot"]) {
    assert.match(
      html,
      new RegExp(supplier),
      `EOAT parent detail must list ${supplier} as a candidate supplier; got: ${html}`,
    );
  }

  assert.match(
    html,
    /exact parcel-cell BOM and supplier share not verified/,
    `EOAT parent supplier exposure must preserve the candidate-evidence caveat; got: ${html}`,
  );
});

test("expanded: bottleneck role is distinct from downstream bottleneck count", () => {
  const focused = nodeById("low_cost_realtime_vision_compute_integration");
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.doesNotMatch(
    html,
    /Bottleneck role/,
    `bottleneck role must not appear as a low-value secondary signal block; got: ${html}`,
  );
  assert.match(
    html,
    /Constraint mechanism: Technical maturity · Integration \/ commissioning · Capacity \/ scale/,
    `bottleneck mechanism should be integrated into the bottom-line thesis; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /<span>Bottlenecks<\/span><strong>0<\/strong>/,
    `a node that is itself a bottleneck must not render the misleading "Bottlenecks 0" priority tile; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Downstream bottleneck children/,
    `duplicate downstream bottleneck lists should stay out of the reader UI; got: ${html}`,
  );
});

test("expanded: full detail is summary-first before raw technical metadata", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const thesisIndex = html.indexOf('data-testid="detail-bottleneck-thesis"');
  const exposureSummaryIndex = html.indexOf('data-testid="detail-exposure-evidence-summary"');
  const evidenceStatusIndex = html.indexOf("Evidence status");
  const decisionBriefIndex = html.indexOf('data-testid="detail-decision-brief"');
  const decompositionIndex = html.indexOf('data-testid="detail-decomposition-rationale"');
  const evidenceSummaryIndex = html.indexOf('data-testid="detail-evidence-summary"');
  const secondaryResearchIndex = html.indexOf('data-testid="detail-secondary-research"');
  const supplementaryIndex = html.indexOf('data-testid="detail-supplementary-appendix"');
  const technicalMetadataIndex = html.indexOf('data-testid="detail-technical-metadata"');
  const metricsIndex = html.indexOf('data-testid="detail-metric-details"');
  const relationshipListsIndex = html.indexOf('data-testid="detail-relationship-lists"');
  const downstreamListIndex = html.indexOf("Downstream bottleneck children");
  const evidenceListIndex = html.indexOf('data-testid="evidence-list"');

  assert.ok(thesisIndex >= 0, `full detail must start with bottleneck thesis; got: ${html}`);
  assert.ok(decisionBriefIndex >= 0, `core readout should be present; got: ${html}`);
  assert.ok(decisionBriefIndex < thesisIndex, `core readout should lead into node interpretation; got: ${html}`);
  assert.ok(thesisIndex < decompositionIndex, `node interpretation should lead directly into decomposition; got: ${html}`);
  assert.ok(decompositionIndex < evidenceSummaryIndex, `decomposition should precede evidence trail; got: ${html}`);
  assert.ok(exposureSummaryIndex > evidenceSummaryIndex, `supplier/evidence quick path should follow the evidence summary; got: ${html}`);
  assert.equal(html.indexOf('data-testid="detail-inspect-next"'), -1, `detail should not render a separate Inspect next section; got: ${html}`);
  assert.ok(secondaryResearchIndex > exposureSummaryIndex, `secondary research follow-ups should sit below the first-screen workflow; got: ${html}`);
  assert.ok(supplementaryIndex > secondaryResearchIndex, `supplementary appendix should be the final collapsed layer; got: ${html}`);
  assert.doesNotMatch(
    html,
    /<details[^>]*data-testid="detail-(full-evidence-list|technical-metadata|relationship-lists)"/,
    "full evidence should be the single supplementary appendix section, not nested accordions",
  );
  assert.equal(evidenceStatusIndex, -1, `public detail must not expose internal evidence status language; got: ${html}`);
  assert.equal(technicalMetadataIndex, -1, `public detail must not expose raw technical metadata; got: ${html}`);
  assert.equal(metricsIndex, -1, `raw metrics should not render as a user-facing detail section; got: ${html}`);
  assert.equal(relationshipListsIndex, -1, `public detail must not expose duplicate relationship lists; got: ${html}`);
  assert.equal(downstreamListIndex, -1, `public detail must not repeat graph upstream/downstream lists; got: ${html}`);
  assert.equal(html.indexOf('data-testid="detail-where-stuck"'), -1, `sample-style detail must not add a separate where-stuck section; got: ${html}`);
  assert.ok(evidenceSummaryIndex < evidenceListIndex, "evidence summary should appear before the full evidence list");
  assert.match(html, /Node interpretation/i, `full detail should include node interpretation after the core readout; got: ${html}`);
  assert.doesNotMatch(html, /Where it is stuck|具体卡点/i, `sample-style detail should not expose a separate stuck section; got: ${html}`);
  assert.match(html, /Core readout/i, `full detail should include the v4 core readout; got: ${html}`);
  assert.match(html, /Load-bearing scope/i, `core readout should state the node's scope; got: ${html}`);
  assert.match(html, /Substitution feasibility/i, `core readout should state substitution feasibility; got: ${html}`);
  assert.match(html, /Blocking mode/i, `core readout should classify the blocking mode; got: ${html}`);
  assert.match(html, /Current status/i, `core readout should state current status; got: ${html}`);
  assert.match(html.slice(supplementaryIndex, supplementaryIndex + 260), /Supplementary appendix/i);
  assert.match(
    detailDisclosure(html, "detail-full-evidence-list"),
    /data-testid="evidence-list"/,
    "full evidence list should be behind a collapsed disclosure after the summary",
  );
  assert.doesNotMatch(
    detailDisclosure(html, "detail-full-evidence-list"),
    /Status:\s*unreviewed|Status:\s*reviewed|reviewStatus/i,
    "public evidence list should not expose raw review-state bookkeeping",
  );
});

test("expanded: selected-node detail follows the commercial supplier IA order", () => {
  const scopedGraph = loadActiveGraphData(AI_COMPUTE_ROOT_ID);
  const focused = nodeByIdIn(scopedGraph, "foundry_capacity_tsmc");
  const html = renderWithLockedExposure({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const coreIndex = html.indexOf('data-testid="detail-decision-brief"');
  const interpretationIndex = html.indexOf('data-testid="detail-bottleneck-thesis"');
  const decompositionIndex = html.indexOf('data-testid="detail-decomposition-rationale"');
  const evidenceIndex = html.indexOf('data-testid="detail-evidence-summary"');
  const supplierIndex = html.indexOf('data-testid="detail-exposure-evidence-summary"');
  const supplementaryIndex = html.indexOf('data-testid="detail-supplementary-appendix"');
  const coreReadout = html.slice(coreIndex, interpretationIndex);
  const interpretation = html.slice(interpretationIndex, decompositionIndex);
  const decomposition = html.slice(decompositionIndex, evidenceIndex);
  const evidence = html.slice(evidenceIndex, supplierIndex);
  const supplementary = html.slice(supplementaryIndex);

  assert.match(coreReadout, /Core readout/i, `core readout should use the v4 IA title; got: ${coreReadout}`);
  assert.match(coreReadout, /Load-bearing scope/i, `core readout should expose the scope tile; got: ${coreReadout}`);
  assert.match(coreReadout, /Substitution feasibility/i, `core readout should expose the substitution tile; got: ${coreReadout}`);
  assert.match(coreReadout, /Blocking mode/i, `core readout should expose the blocking-mode tile; got: ${coreReadout}`);
  assert.match(coreReadout, /Current status/i, `core readout should expose the current-status tile; got: ${coreReadout}`);
  assert.doesNotMatch(
    coreReadout,
    /Chokepoint verdict|Leading reason|Cost-scale proxy|Relief timing|Chokepoint axes|Model breakdown|卡点四轴/i,
    `raw model-axis diagnostics belong in the supplementary appendix, not the sample-style core readout; got: ${coreReadout}`,
  );
  assert.doesNotMatch(coreReadout, /Evidence strength|Evidence trail|source trail/i, `evidence status belongs in Evidence trail, not the core readout; got: ${coreReadout}`);
  assert.match(interpretation, /Node interpretation/i, `detail should use the v4 IA interpretation title; got: ${interpretation}`);
  assert.doesNotMatch(
    html.slice(interpretationIndex, decompositionIndex),
    /data-testid="detail-where-stuck"|Where it is stuck|具体卡点/i,
    `sample-style detail should go from interpretation directly to decomposition; got: ${html}`,
  );
  assert.match(decomposition, /Decomposition/i, `detail should use the v4 IA decomposition title; got: ${decomposition}`);
  assert.match(evidence, /Evidence trail/i, `detail should use the v4 IA evidence title; got: ${evidence}`);
  assert.match(
    supplementary,
    /data-testid="detail-chokepoint-axes"/,
    `model-axis diagnostics should remain available in the collapsed appendix; got: ${supplementary}`,
  );

  assert.ok(coreIndex >= 0, `core readout should be present; got: ${html}`);
  assert.ok(coreIndex < interpretationIndex, `Core readout should precede Node interpretation; got: ${html}`);
  assert.ok(interpretationIndex < decompositionIndex, `Node interpretation should precede Decomposition; got: ${html}`);
  assert.ok(decompositionIndex < evidenceIndex, `Decomposition should precede Evidence trail; got: ${html}`);
  assert.ok(evidenceIndex < supplierIndex, `Evidence trail should precede Supplier and listed-company leads; got: ${html}`);
});

test("expanded: AI logic die core readout uses the four product-design fields", () => {
  const scopedGraph = loadActiveGraphData(AI_COMPUTE_ROOT_ID);
  const focused = nodeByIdIn(scopedGraph, "logic_die_fabrication");
  const html = renderWithLockedExposure({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const coreReadout = detailRegionBetween(html, "detail-decision-brief", "detail-bottleneck-thesis");

  assert.match(coreReadout, /Core readout/i);
  assert.match(coreReadout, /Load-bearing scope/i);
  assert.match(coreReadout, /Substitution feasibility/i);
  assert.match(coreReadout, /Blocking mode/i);
  assert.match(coreReadout, /Current status/i);
  assert.match(coreReadout, /Product mainline/i);
  assert.match(coreReadout, /No equivalent substitute/i);
  assert.match(coreReadout, /Capacity \/ scale/i);
  assert.match(coreReadout, /Yield ramp/i);
  assert.match(coreReadout, /Equipment lead time/i);
  assert.match(coreReadout, /Expansion relief/i);
  assert.match(coreReadout, /24 months/i);
  assert.doesNotMatch(
    coreReadout,
    /Cost-scale proxy|Leading reason/i,
    `core readout should not keep the old economic-signal hierarchy; got: ${coreReadout}`,
  );
});

test("expanded: selected-node detail carries the commercial supplier visual shell", () => {
  const scopedGraph = loadActiveGraphData(AI_COMPUTE_ROOT_ID);
  const focused = nodeByIdIn(scopedGraph, "foundry_capacity_tsmc");
  const html = renderWithLockedExposure({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const priority = detailReaderPriority(html);

  assert.match(html, /class="[^"]*detail-commercial-supplier-ia/, `detail should opt into the v4 visual shell; got: ${html}`);
  assert.match(html, /class="[^"]*detail-reader-hero/, `detail should render the sample-style node identity header; got: ${html}`);
  assert.match(html, /class="[^"]*detail-reader-quote/, `detail should render the sample-style leading quote block; got: ${html}`);
  assert.match(priority, /class="[^"]*detail-decision-tile[^"]*tone-scope/, `core readout needs a scope tile; got: ${priority}`);
  assert.match(priority, /class="[^"]*detail-decision-tile[^"]*tone-substitution/, `core readout needs a substitution tile; got: ${priority}`);
  assert.match(priority, /class="[^"]*detail-decision-tile[^"]*tone-blocking/, `core readout needs a blocking-mode tile; got: ${priority}`);
  assert.match(priority, /class="[^"]*detail-decision-tile[^"]*tone-status/, `core readout needs a current-status tile; got: ${priority}`);
  assert.match(priority, /class="[^"]*detail-decomposition-table/, `decomposition should use the sample table/card treatment; got: ${priority}`);
  assert.match(priority, /class="[^"]*detail-evidence-card/, `evidence trail should use the sample evidence-card treatment; got: ${priority}`);
  assert.match(priority, /class="[^"]*detail-supplier-card/, `supplier leads should use sample-style company cards; got: ${priority}`);
});

test("expanded: selected-node core readout uses a stable 2x2 rail layout", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const baseGrid = css.match(/\.detail-decision-grid\s*\{[\s\S]*?\}/)?.[0] ?? "";
  const sampleGrid = css.match(/\.detail-commercial-supplier-ia \.detail-decision-grid\s*\{[\s\S]*?\}/)?.[0] ?? "";

  assert.match(
    baseGrid,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    `base core readout grid should be 2x2 in the rail; got: ${baseGrid}`,
  );
  assert.match(
    sampleGrid,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    `sample-style core readout grid should be 2x2 in the rail; got: ${sampleGrid}`,
  );
  assert.doesNotMatch(
    sampleGrid,
    /repeat\(4/,
    `sample-style rail must not force four cramped columns; got: ${sampleGrid}`,
  );
});

test("expanded: primary path has one source summary and exposure stays focused on company leads", () => {
  const focused = nodeById(AI_COMPUTE_ROOT_ID);
  const html = renderWithLockedExposure({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const priority = detailReaderPriority(html);
  const exposureSummary = detailDisclosure(html, "detail-exposure-evidence-summary");
  const sourceSummaryCount =
    (priority.match(/Evidence trail/g) ?? []).length +
    (priority.match(/Source quick path/g) ?? []).length;

  assert.equal(
    sourceSummaryCount,
    1,
    `primary reader path should expose exactly one source summary concept; got: ${priority}`,
  );
  assert.match(priority, /Evidence trail/i, `the single source summary should stay in the evidence slot; got: ${priority}`);
  assert.doesNotMatch(
    exposureSummary,
    /Source quick path|Best source|sources?\. Best source/i,
    `exposure section should focus on company/ticker leads instead of repeating the evidence summary; got: ${exposureSummary}`,
  );
  assert.match(
    exposureSummary,
    /Top connected leads|not a complete exposure list/i,
    `company/ticker leads should clarify they are ranked leads, not a full exposure list; got: ${exposureSummary}`,
  );
});

test("expanded: primary reader path has no nested disclosure controls", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const priority = detailReaderPriority(html);
  const exposureIndex = priority.indexOf('data-testid="detail-exposure-evidence-summary"');
  const beforeExposure = exposureIndex >= 0 ? priority.slice(0, exposureIndex) : priority;
  const exposure = detailDisclosure(html, "detail-exposure-evidence-summary");

  assert.doesNotMatch(
    beforeExposure,
    /<details\b/i,
    `bottom-line, decision, and evidence sequence should stay directly visible before supplier cards; got: ${beforeExposure}`,
  );
  assert.doesNotMatch(
    beforeExposure,
    /<summary\b/i,
    `bottom-line, decision, and evidence sequence should not require opening a summary row; got: ${beforeExposure}`,
  );
  assert.match(
    exposure,
    /<details\b/i,
    `supplier cards should use disclosure controls for evidence links and BOM state; got: ${exposure}`,
  );
});

test("expanded: AI compute detail treats locked exposure input as silently available", () => {
  const focused = nodeById(AI_COMPUTE_ROOT_ID);
  const html = renderWithLockedExposure({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const readerPriority = detailReaderPriority(html);

  assert.doesNotMatch(readerPriority, /Full-free flagship demo/i);
  assert.doesNotMatch(readerPriority, /exposure included/i);
  assert.doesNotMatch(readerPriority, /Exposure layer locked/i);
  assert.doesNotMatch(readerPriority, /77 suppliers hidden/i);
  assert.doesNotMatch(
    detailReaderPriority(html).match(/<div[^>]*data-testid="detail-bottleneck-thesis"[\s\S]*?<\/div>/)?.[0] ?? "",
    /ASML|TSMC|NVIDIA|Broadcom/i,
    `AI compute bottleneck thesis should stay about the node, not supplier names; got: ${readerPriority}`,
  );
  const thesis = detailReaderPriority(html).match(/<div[^>]*data-testid="detail-bottleneck-thesis"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.match(
    thesis,
    /AI infrastructure|capacity|yield|supplier-concentration/i,
    `AI compute thesis should lead with industrial importance, not internal graph rationale; got: ${thesis}`,
  );
  assert.doesNotMatch(
    thesis,
    /because direct evidence is still thin|because the graph treats it as a candidate constraint/i,
    `AI compute thesis should not lead with graph/evidence bookkeeping; got: ${thesis}`,
  );
});

test("expanded: AI compute root explains real constraint mechanisms instead of evidence fallback", () => {
  const focused = nodeById(AI_COMPUTE_ROOT_ID);
  const html = renderWithLockedExposure({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const priorityText = textFromMarkup(detailReaderPriority(html));

  assert.doesNotMatch(
    priorityText,
    /evidence is still thin|Flagship AI accelerator module architecture/i,
    `AI compute root should explain the industrial constraint, not fall back to evidence or architecture copy; got: ${priorityText}`,
  );
  assert.match(
    priorityText,
    /HBM capacity|advanced packaging|yield|supplier concentration/i,
    `AI compute root should name the capacity/yield/supplier-concentration bottlenecks; got: ${priorityText}`,
  );
  assert.doesNotMatch(priorityText, /Where it is stuck|具体卡点/i);
});

test("expanded: AI compute root explains why the first-layer modules are the partition", () => {
  const focused = nodeById(AI_COMPUTE_ROOT_ID);
  const html = renderWithLockedExposure({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const rationaleStart = html.indexOf('data-testid="detail-decomposition-rationale"');
  const evidenceStart = html.indexOf('data-testid="detail-evidence-summary"');
  assert.ok(rationaleStart >= 0, `decomposition rationale should be visible; got: ${html}`);
  assert.ok(evidenceStart > rationaleStart, `decomposition rationale should precede evidence summary; got: ${html}`);
  const rationale = html.slice(rationaleStart, evidenceStart);
  const rationaleText = textFromMarkup(rationale).replace(/&amp;/g, "&");

  assert.match(rationale, /Decomposition/i, `decomposition rationale should be visible; got: ${rationale}`);
  assert.match(
    rationaleText,
    /AI chip \/ GPU compute module/i,
    `root detail should use the reader-friendly AI chip/GPU name; got: ${rationale}`,
  );
  for (const label of [
    "Leading-edge logic die fabrication",
    "Advanced packaging",
    "High-bandwidth memory",
    "Package substrate & interposer",
    "Interconnect & optics",
    "Power delivery",
    "Thermal management & cooling",
  ]) {
    assert.match(rationaleText, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `missing ${label}; got: ${rationale}`);
  }
  assert.match(
    rationale,
    /Logic, HBM memory, package\/substrate, links, power, and cooling/i,
    `rationale should explain why these are the first split; got: ${rationale}`,
  );
});

test("expanded: AI compute first-layer modules use decomposition mechanisms instead of holder coverage as the primary reason", () => {
  for (const [id, expected] of [
    ["logic_die_fabrication", /Leading-edge foundry allocation|EUV lithography\/tool cycles|Process yield ramp/i],
    ["substrate_and_interposer", /Organic substrate build-up|Silicon interposer \/ RDL|Dense substrate PDN/i],
    ["power_delivery", /Module-level VRM|Power-stage semiconductors|48V rack conversion/i],
  ] as const) {
    const focused = nodeById(id);
    const html = renderWithLockedExposure({
      graph,
      focusedNode: focused,
      expanded: true,
      onToggleExpand: noop,
      onClose: noop,
    });
    const priorityText = textFromMarkup(detailReaderPriority(html));

    assert.doesNotMatch(priorityText, /Holder coverage gap|Modeled holders|holder 覆盖缺口|供应方覆盖/i, `${id} should not use holder coverage as the concrete reason; got: ${priorityText}`);
    assert.match(priorityText, expected, `${id} should show concrete decomposition mechanisms; got: ${priorityText}`);
    assert.doesNotMatch(priorityText, /Where it is stuck|具体卡点/i);
  }
});

test("expanded: AI compute detail exposes supplier tickers after the sample-style reasoning sequence without graph appendix noise", () => {
  const focused = nodeById(AI_COMPUTE_ROOT_ID);
  const html = renderWithLockedExposure({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const summaryIndex = html.indexOf('data-testid="detail-exposure-evidence-summary"');
  const evidenceSummaryIndex = html.indexOf('data-testid="detail-evidence-summary"');
  const decompositionIndex = html.indexOf('data-testid="detail-decomposition-rationale"');
  const relationshipListsIndex = html.indexOf('data-testid="detail-relationship-lists"');
  const supplementaryIndex = html.indexOf('data-testid="detail-supplementary-appendix"');
  const summaryStart = html.lastIndexOf("<div", summaryIndex);
  const summary = html.slice(summaryStart, supplementaryIndex);
  const thesis = detailReaderPriority(html).match(/<div[^>]*data-testid="detail-bottleneck-thesis"[\s\S]*?<\/div>/)?.[0] ?? "";

  assert.ok(summaryIndex >= 0, `supplier/evidence summary should be present; got: ${html}`);
  assert.ok(evidenceSummaryIndex > 0, `key evidence summary should be present; got: ${html}`);
  assert.ok(decompositionIndex < evidenceSummaryIndex, `decomposition should appear before key evidence; got: ${html}`);
  assert.ok(summaryIndex > evidenceSummaryIndex, `supplier/ticker quick path should appear after bottom line/decomposition/evidence; got: ${html}`);
  assert.equal(relationshipListsIndex, -1, `supplier/ticker summary must not be followed by duplicate Relationship lists; got: ${html}`);
  assert.ok(supplementaryIndex > summaryIndex, `supplier/ticker summary should appear before the collapsed supplementary evidence appendix; got: ${html}`);
  assert.doesNotMatch(
    thesis,
    /carried on a high-layer-count organic substrate/i,
    `bottleneck thesis should stay compact enough for the supplier/evidence quick path to be visible; got: ${thesis}`,
  );
  assert.match(summary, /TSMC|SK Hynix|ASE Technology Holding|Samsung Electronics/i);
  assert.match(summary, /2330\.TW|000660\.KS|2311\.TW|005930\.KS/);
  assert.match(
    summary,
    /(2330\.TW|2311\.TW) · Taiwan|(000660\.KS|005930\.KS) · Korea/,
    `supplier ticker chips should clarify non-US trading venues; got: ${summary}`,
  );
  assert.doesNotMatch(summary, /Source quick path/i);
  assert.doesNotMatch(summary.trim(), /^0 reviewed/i);
  assert.doesNotMatch(summary, /77 suppliers hidden|paid exposure layer/i);
});

test("expanded: supplier/ticker intent highlights the exposure summary at the point of need", () => {
  const focused = nodeById("high_bandwidth_memory");
  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, {
      graph,
      node: focused,
      defaultOpenExposureSummary: true,
    }),
  );
  const exposureSummary = detailDisclosure(html, "detail-exposure-evidence-summary");

  assert.match(exposureSummary, /data-point-of-need="true"/, `supplier/ticker intent should mark the exposure block as the active point of need; got: ${html}`);
  assert.match(exposureSummary, /<details\b|<summary\b/i, `supplier cards should use per-company disclosure for evidence links and BOM details; got: ${exposureSummary}`);
  assert.match(exposureSummary, /SK Hynix|Samsung Electronics|Micron Technology/i);
  assert.match(exposureSummary, /000660\.KS|005930\.KS|MU/i);
});

test("expanded: locked paid-domain exposure says gated instead of missing data", () => {
  const scopedGraph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const focused = nodeByIdIn(scopedGraph, "humanoid_reducer_transmission_stack");
  const html = renderWithLockedExposure(
    {
      graph: scopedGraph,
      focusedNode: focused,
      expanded: true,
      onToggleExpand: noop,
      onClose: noop,
    },
    [
      {
        domainTag: "humanoid_robotics",
        entitlement: "humanoid",
        hiddenOrgCount: 12,
      },
    ],
  );

  assert.match(
    html,
    /Supplier\/ticker exposure is gated/i,
    `locked paid-domain detail should name the paywall at the point of need; got: ${html}`,
  );
  assert.match(
    html,
    /12 organization records/i,
    `locked paid-domain detail should show modeled exposure exists without revealing it; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /No company or ticker candidates are modeled here yet/i,
    `locked paid-domain detail must not mislead the user into thinking supplier/ticker data is absent; got: ${html}`,
  );
});

test("expanded: locked supplier/ticker state stays out of the first-screen decision brief", () => {
  const scopedGraph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const focused = nodeByIdIn(scopedGraph, "humanoid_reducer_transmission_stack");
  const html = renderWithLockedExposure(
    {
      graph: scopedGraph,
      focusedNode: focused,
      expanded: true,
      onToggleExpand: noop,
      onClose: noop,
    },
    [
      {
        domainTag: "humanoid_robotics",
        entitlement: "humanoid",
        hiddenOrgCount: 12,
      },
    ],
  );
  const decisionBrief = detailRegionBetween(html, "detail-decision-brief", "detail-bottleneck-thesis");

  assert.doesNotMatch(
    decisionBrief,
    /Supplier\/ticker/i,
    `decision brief should answer the research question before advertising the lock; got: ${decisionBrief || html}`,
  );
  assert.doesNotMatch(
    decisionBrief,
    /12 organization records gated/i,
    `decision brief should keep gated organization counts out of the first screen; got: ${decisionBrief || html}`,
  );
  assert.match(
    html,
    /Supplier\/ticker exposure is gated/i,
    `locked supplier/ticker state should still appear at the supplier/ticker point of need; got: ${html}`,
  );
});

test("expanded: detail bottleneck thesis stays compact so the decision brief is visible early", () => {
  const scopedGraph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const focused = nodeByIdIn(scopedGraph, "humanoid_reducer_transmission_stack");
  const html = render({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const thesis = detailReaderPriority(html).match(/<div[^>]*data-testid="detail-bottleneck-thesis"[\s\S]*?<\/div>/)?.[0] ?? "";

  assert.doesNotMatch(
    thesis,
    /depends on this constraint scaling/i,
    `detail thesis should explain the concrete constraint mechanism, not generic scaling dependence; got: ${thesis}`,
  );
  assert.match(
    thesis,
    /Constraint mechanism|Component availability|Capacity \/ scale|Technical maturity/i,
    `detail thesis should name concrete constraint factors; got: ${thesis}`,
  );
  assert.doesNotMatch(thesis, /Constraint type:|Relief:|Evidence:/i, `detail thesis should not duplicate the investor brief; got: ${thesis}`);
  assert.doesNotMatch(
    thesis,
    /Current signal:/i,
    `detail thesis should not spend first-screen space on internal graph-signal phrasing; got: ${thesis}`,
  );
  assert.ok(
    html.indexOf('data-testid="detail-decision-brief"') < html.indexOf('data-testid="detail-bottleneck-thesis"') &&
      html.indexOf('data-testid="detail-bottleneck-thesis"') < html.indexOf('data-testid="detail-decomposition-rationale"') &&
      html.indexOf('data-testid="detail-decomposition-rationale"') < html.indexOf('data-testid="detail-evidence-summary"'),
    `detail should show core readout, node interpretation, decomposition, then evidence; got: ${html}`,
  );
  assert.equal(html.indexOf('data-testid="detail-where-stuck"'), -1, `detail should not add a separate stuck section; got: ${html}`);
});

test("expanded: AI compute HBM detail does not repeat the same role sentence in the primary copy", () => {
  const scopedGraph = loadActiveGraphData(AI_COMPUTE_ROOT_ID);
  const focused = nodeByIdIn(scopedGraph, "high_bandwidth_memory");
  const html = renderWithLockedExposure({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const priorityText = textFromMarkup(detailReaderPriority(html));
  const repeated = priorityText.match(/High-bandwidth memory stacks co-packaged with the logic die\./gi) ?? [];

  assert.equal(
    repeated.length,
    1,
    `HBM detail should not repeat the same sentence across primary sections; got: ${priorityText}`,
  );
});

test("expanded: AI compute substrate detail uses structural signal instead of unclassified stuck copy", () => {
  const scopedGraph = loadActiveGraphData(AI_COMPUTE_ROOT_ID);
  const focused = nodeByIdIn(scopedGraph, "substrate_and_interposer");
  const html = renderWithLockedExposure({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const priorityText = textFromMarkup(detailReaderPriority(html));

  assert.match(
    priorityText,
    /Organic substrate build-up|Silicon interposer \/ RDL|Dense substrate PDN/,
    `substrate detail should expose the concrete structural signal; got: ${priorityText}`,
  );
  assert.doesNotMatch(
    priorityText,
    /Holder coverage gap|holder 覆盖缺口/i,
    `holder coverage gaps must not be promoted over concrete substrate/interposer mechanisms; got: ${priorityText}`,
  );
  assert.match(
    priorityText,
    /Estimated 24 months; proxy based on capacity, tooling, and qualification cycle/i,
    `substrate relief timing should use a capacity/tooling proxy, not mature-commodity sourcing; got: ${priorityText}`,
  );
  assert.doesNotMatch(
    priorityText,
    /Where it is stuck\s+Constraint type not yet clear|具体卡点\s+约束类型尚不清楚/i,
    `detail should not present an unknown constraint type as the specific chokepoint; got: ${priorityText}`,
  );
  assert.doesNotMatch(priorityText, /Supply sources unverified|供应来源未验证|证据还比较薄/i);
});

test("expanded: bottleneck detail surfaces structured constraint factors without a separate stuck block", () => {
  const focused = nodeById("low_cost_realtime_vision_compute_integration");
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const priorityText = textFromMarkup(detailReaderPriority(html));
  assert.doesNotMatch(
    html,
    /Constraint factors/,
    `constraint factors should not be exposed as a separate metadata section; got: ${html}`,
  );
  assert.equal(html.indexOf('data-testid="detail-where-stuck"'), -1, `sample-style detail should not add a separate stuck block; got: ${html}`);
  assert.match(
    priorityText,
    /Integration \/ commissioning/,
    `primary detail must show integration/commissioning as a limiting factor; got: ${html}`,
  );
  assert.match(
    priorityText,
    /Technical maturity/,
    `primary detail must show technical maturity as a limiting factor; got: ${html}`,
  );
});

test("expanded: detail primary explanation keeps maturity score out of the sample path", () => {
  const scopedGraph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const focused = nodeByIdIn(scopedGraph, "humanoid_reducer_transmission_stack");
  const html = render({
    graph: scopedGraph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const priority = detailReaderPriority(html);
  const decisionIndex = priority.indexOf('data-testid="detail-decision-brief"');
  const evidenceIndex = priority.indexOf('data-testid="detail-evidence-summary"');
  const decompositionIndex = priority.indexOf('data-testid="detail-decomposition-rationale"');
  assert.equal(priority.indexOf('data-testid="detail-where-stuck"'), -1, `detail should not include a separate where-stuck block; got: ${priority}`);
  assert.ok(decisionIndex < decompositionIndex, `core readout should precede decomposition; got: ${priority}`);
  assert.ok(decompositionIndex < evidenceIndex, `decomposition should precede evidence; got: ${priority}`);
  const priorityText = textFromMarkup(priority);
  const interpretationText = textFromMarkup(detailRegionBetween(priority, "detail-bottleneck-thesis", "detail-decomposition-rationale"));

  assert.match(priorityText, /Component availability/i);
  assert.match(priorityText, /Capacity \/ scale/i);
  assert.match(priorityText, /Technical maturity/i);
  assert.doesNotMatch(
    interpretationText,
    /Maturity 50\/100|early_deployment|Not priceable|RMB/i,
    `node interpretation should explain the constraint type, not expose a raw maturity score; got: ${interpretationText}`,
  );
});

test("expanded: detail interpretation distinguishes component, material, and economic relief timing", () => {
  const fusionGraph = loadActiveGraphData("controlled_fusion_route_portfolio");
  const spaceGraph = loadActiveGraphData("spacex_orbital_data_center_system");
  const renderInterpretation = (graphData: GraphData, nodeId: string) => {
    const html = render({
      graph: graphData,
      focusedNode: nodeByIdIn(graphData, nodeId),
      expanded: true,
      onToggleExpand: noop,
      onClose: noop,
    });
    return detailRegionBetween(html, "detail-bottleneck-thesis", "detail-decomposition-rationale");
  };

  assert.match(
    renderInterpretation(fusionGraph, "fusion_breeding_blanket_heat_extraction"),
    /material supply and qualification must scale together/i,
  );
  assert.match(
    renderInterpretation(spaceGraph, "high_volume_compute_satellite_factory_line"),
    /qualified components or alternate suppliers must scale/i,
  );
  assert.match(
    renderInterpretation(spaceGraph, "orbital_compute_business_model_validation"),
    /Unknown until demand, utilization, and unit economics are validated/i,
  );
});

test("expanded: detail core readout keeps explicit cost disclosure gaps out of the first screen", () => {
  const scopedGraph: GraphData = {
    graphVersion: "detail-cost-disclosure-test",
    evidence: [],
    nodes: [
      {
        id: "frontier_product",
        name: "Frontier product",
        kind: "product",
        domain: ["test"],
      },
      {
        id: "cost_unknown_node",
        name: "Cost unknown node",
        kind: "engineering_method",
        domain: ["test"],
        description: "Qualification path is not yet commercially priced.",
        maturityScore: 20,
        maturityLabel: "prototype",
        maturityAsOf: "2026-06",
        capacityLeadTimeMonths: 24,
        transactability: "must_build",
        tags: ["constraint_technical_maturity"],
        metrics: [
          {
            name: "Cost disclosure",
            unit: "audit status",
            currentValue: "not priceable from reviewed data",
            description: "No reviewed source prices the qualification and utilization reserve.",
          },
        ],
      },
    ],
    edges: [
      { id: "e_frontier_unknown", source: "frontier_product", target: "cost_unknown_node", relation: "requires" },
    ],
  };
  const html = render({
    graph: scopedGraph,
    focusedNode: nodeByIdIn(scopedGraph, "cost_unknown_node"),
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const decision = detailRegionBetween(html, "detail-decision-brief", "detail-bottleneck-thesis");
  const interpretation = detailRegionBetween(html, "detail-bottleneck-thesis", "detail-decomposition-rationale");

  assert.match(decision, /Load-bearing scope/i);
  assert.match(decision, /Blocking mode/i);
  assert.match(decision, /Current status/i);
  assert.match(decision, /24 months/i);
  assert.doesNotMatch(decision, /Cost gap unknown|Needed evidence|public source prices|BOM|RMB/i);
  assert.doesNotMatch(
    interpretation,
    /Not priceable|reviewed price|BOM|RMB/i,
    `node interpretation should not mix in cost audit gaps; got: ${interpretation}`,
  );
});

test("expanded: missing relief timing and supplier scale render labeled proxy estimates", () => {
  const scopedGraph: GraphData = {
    graphVersion: "detail-commercial-proxy-test",
    evidence: [],
    nodes: [
      {
        id: "proxy_product",
        name: "Proxy product",
        kind: "product",
        domain: ["test"],
        maturityLabel: "prototype",
        maturityAsOf: "2026-06",
      },
      {
        id: "proxy_constraint",
        name: "Proxy constrained process",
        kind: "manufacturing_process",
        domain: ["test"],
        description: "Capacity scale depends on a qualified process window.",
        maturityLabel: "prototype",
        maturityAsOf: "2026-06",
        transactability: "must_build",
        tags: ["constraint_capacity_scale"],
      },
      {
        id: "proxy_supplier",
        name: "Proxy Supplier Inc.",
        kind: "organization",
        domain: ["test"],
        listingStatus: "public",
        ticker: "PSI",
      },
    ],
    edges: [
      { id: "e_proxy_product_constraint", source: "proxy_product", target: "proxy_constraint", relation: "requires" },
      { id: "e_proxy_constraint_supplier", source: "proxy_constraint", target: "proxy_supplier", relation: "manufactured_by" },
    ],
  };
  const html = render({
    graph: scopedGraph,
    focusedNode: nodeByIdIn(scopedGraph, "proxy_constraint"),
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const decision = detailRegionBetween(html, "detail-decision-brief", "detail-bottleneck-thesis");
  const interpretation = detailRegionBetween(html, "detail-bottleneck-thesis", "detail-decomposition-rationale");
  const exposure = detailDisclosure(html, "detail-exposure-evidence-summary");

  assert.match(decision, /Current status/i);
  assert.match(interpretation, /Estimated 24 months/i);
  assert.doesNotMatch(decision, /Lead-time not yet quantified/i);
  assert.match(exposure, /Financial \/ capacity clues/i);
  assert.match(exposure, /Public-market scale proxy/i);
  assert.match(exposure, /PSI/);
});

test("expanded: detail core readout does not label modeled cost as a primary readout", () => {
  const html = render({
    graph,
    focusedNode: nodeById(REDUCER_ID),
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });
  const decision = detailRegionBetween(html, "detail-decision-brief", "detail-bottleneck-thesis");

  assert.match(decision, /Load-bearing scope/i);
  assert.match(decision, /Substitution feasibility/i);
  assert.match(decision, /Blocking mode/i);
  assert.match(decision, /Current status/i);
  assert.doesNotMatch(decision, /Cost\/capex proxy|supplier quote|audited BOM|RMB/i);
  assert.doesNotMatch(decision, /Basis: graph model|Basis:/i);
  assert.doesNotMatch(
    decision,
    /\bp50\b/i,
    `decision brief should not expose p50 jargon; got: ${decision}`,
  );
});

test("expanded: frontier callout hides internal audit suffixes from users", () => {
  const scopedGraph: GraphData = {
    graphVersion: "frontier-note-sanitizer-test",
    evidence: [],
    nodes: [
      {
        id: "frontier_node",
        name: "Frontier node",
        kind: "engineering_method",
        domain: ["test"],
        description: "Field recovery workflow.",
        tags: ["decomposition_frontier", "constraint_integration_commissioning"],
        notes:
          "Expansion frontier: needs field evidence for jam modes and operator intervention rate. transactability=must_build (agent backfill 2026-06-10, needs review): integrator-built recovery logic",
      },
    ],
    edges: [],
  };
  const html = render({
    graph: scopedGraph,
    focusedNode: nodeByIdIn(scopedGraph, "frontier_node"),
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const frontier = html.match(/<div class="frontier-callout">[\s\S]*?<\/div>/)?.[0] ?? html;
  assert.match(frontier, /Expansion frontier: needs field evidence for jam modes and operator intervention rate/i);
  assert.doesNotMatch(frontier, /transactability=/i);
  assert.doesNotMatch(frontier, /agent backfill/i);
  assert.doesNotMatch(frontier, /needs review/i);
});

test("expanded: organization detail surfaces the components it supplies", () => {
  const focused = nodeById(NABTESCO_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Modeled supplier exposure/,
    `expanded organization detail must surface a dedicated supplier exposure section; got: ${html}`,
  );
  assert.match(
    html,
    /Precision reducer \/ gearbox/,
    `Nabtesco organization detail must link back to the supplied reducer component; got: ${html}`,
  );
});

test("expanded: maintenance workflow surfaces service implementation candidates", () => {
  const focused = nodeById(MAINTENANCE_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Service candidates/,
    `maintenance workflow detail must surface a dedicated service candidate section; got: ${html}`,
  );
  assert.match(
    html,
    /ABB Robotics/,
    `maintenance workflow must list ABB Robotics as a service candidate; got: ${html}`,
  );
  assert.match(
    html,
    /FANUC/,
    `maintenance workflow must list FANUC as a service candidate; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /unreviewed/,
    `public service candidate section must not surface raw edge review status; got: ${html}`,
  );
});

test("expanded: organization detail keeps raw metrics out of the main UI while preserving evidence", () => {
  const focused = nodeById(SIEMENS_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.doesNotMatch(
    html,
    /Organization metrics \/ investor exposure/,
    `organization detail should not expose raw node-level metrics as a main UI section; got: ${html}`,
  );
  const mainUi = html.slice(0, html.indexOf('data-testid="detail-supplementary-appendix"'));
  assert.doesNotMatch(
    mainUi,
    /FY2025 Digital Industries revenue/,
    `organization detail must not expose raw revenue metrics in the main reader UI; got: ${html}`,
  );
  assert.doesNotMatch(mainUi, /17\.788/, `organization detail must not expose raw revenue values in the main reader UI; got: ${html}`);
  assert.match(
    html,
    /Siemens Annual Report 2025/,
    `Siemens detail must still show the annual-report evidence backing the metric; got: ${html}`,
  );
});

test("expanded: product top blockers surface limiting-factor categories", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(html, /Top blockers/, `product detail must include a top blockers section; got: ${html}`);
  assert.match(
    html,
    /Technical maturity/,
    `top blockers must expose whether a blocker is technically constrained; got: ${html}`,
  );
  assert.match(
    html,
    /Integration \/ commissioning/,
    `top blockers must expose whether a blocker is integration constrained; got: ${html}`,
  );
  assert.match(
    html,
    /Capacity \/ scale/,
    `top blockers must expose whether a blocker is capacity/scale constrained; got: ${html}`,
  );
  // ADR-0010 / §2: "Barrier" absorbs the old "maturity"; the readiness gap
  // (100 − maturityScore) is labelled "Barrier gap", never the deprecated
  // "Maturity" wording (QA finding #4 — vocabulary residue).
  assert.match(
    html,
    /Barrier gap/,
    `top blockers must explain that risk is partly driven by the barrier (readiness) gap; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Maturity gap/,
    `top blockers must not use the deprecated "Maturity gap" wording; got: ${html}`,
  );
  assert.match(
    html,
    /cost estimate/,
    `top blockers must explain that risk is partly driven by rolled-up cost estimates; got: ${html}`,
  );
});

test("expanded: product detail surfaces a reader-facing product readout, not an internal investor label", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.doesNotMatch(
    html,
    /Investor answer panel/,
    `product detail must not expose the internal "Investor answer panel" module label; got: ${html}`,
  );
  assert.match(
    html,
    /Product bottleneck readout/,
    `product detail must include a reader-facing product readout; got: ${html}`,
  );
  assert.match(
    html,
    /Not investment advice\./,
    `product readout must carry a same-screen non-investment-advice caveat; got: ${html}`,
  );
  assert.match(
    html,
    /Top risk bottleneck/,
    `product readout must explicitly identify the top risk bottleneck; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Heat \d+\/100/,
    `product readout must not expose internal Heat scores by default; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Risk \d+%/,
    `investor panel must not display risk scores as probability-like percentages; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Relative pressure signal:/,
    `product readout should not need an internal score tooltip when Heat is hidden; got: ${html}`,
  );
  assert.match(
    html,
    /Conveyor integration/,
    `investor panel must surface the highest-risk product-layer artifact subsystem; got: ${html}`,
  );
  assert.doesNotMatch(
    html.match(/<div[^>]*data-testid="detail-product-readout"[\s\S]*?<\/div>/)?.[0] ?? "",
    /Maintenance workflow/,
    `product-level top risk must not be an operational workflow hidden from the canvas artifact layer; got: ${html}`,
  );
  assert.match(
    html,
    /Cost gap/,
    `investor panel must summarize rolled-up cost against the target; got: ${html}`,
  );
  assert.match(
    html,
    /\d[\d,]* RMB over target/,
    `investor panel must quantify the estimated cost gap; got: ${html}`,
  );
  assert.match(
    html,
    /Top cost driver/,
    `investor panel must identify the highest estimated cost driver; got: ${html}`,
  );
  assert.match(
    html,
    /Throughput constraints/,
    `investor panel must summarize why production throughput cannot increase; got: ${html}`,
  );
  assert.match(
    html,
    /Parcel induction and spacing control/,
    `investor panel must name the top throughput-limiting workflow; got: ${html}`,
  );
  assert.match(
    html,
    /Constraint types/,
    `investor panel must classify whether throughput is constrained by technology, capacity, supply, or operations; got: ${html}`,
  );
  assert.match(
    html,
    /Integration \/ commissioning/,
    `investor panel must include integration/commissioning as a throughput constraint type; got: ${html}`,
  );
  assert.match(
    html,
    /Capacity \/ scale/,
    `investor panel must include capacity/scale as a throughput constraint type; got: ${html}`,
  );
  assert.match(
    html,
    /Throughput constraints[\s\S]*Current:[\s\S]*est\. 1,500 \(range 325–1,800\) parcels\/hour[\s\S]*Target:[\s\S]*1,500 parcels\/hour[\s\S]*Top cost driver/,
    `investor panel throughput row must include current and target pph before the next row; got: ${html}`,
  );
  assert.match(
    html,
    /Top cost driver[\s\S]*Cost\/capex proxy:/,
    `investor panel must surface the highest estimated cost driver with a cost signal; got: ${html}`,
  );
  assert.doesNotMatch(html, /\bp50\b/i);
  assert.match(
    html,
    /Company\/ticker leads/,
    `investor panel must summarize candidate supplier exposure; got: ${html}`,
  );
  assert.match(
    html,
    /Company\/ticker leads:[\s\S]*Public listing/,
    `investor panel must include public listing context for supplier exposure; got: ${html}`,
  );
  assert.match(
    html,
    /Top startup opportunities/,
    `investor panel must surface a ranked global startup opportunity list; got: ${html}`,
  );
  assert.match(
    html,
    /#1[\s\S]*PLC and WCS integration[\s\S]*Opportunity score 26[\s\S]*Cost signal:[\s\S]*26k RMB/,
    `investor panel must rank the PLC/WCS integration opportunity with direct cost-driver context; got: ${html}`,
  );
  assert.match(
    html,
    /#2[\s\S]*Reducer lubrication and life testing[\s\S]*Technical maturity[\s\S]*Maintenance \/ operations/,
    `investor panel must include reducer testing as a ranked startup opportunity with constraint rationale; got: ${html}`,
  );
  assert.match(
    html,
    /#3[\s\S]*Parcel induction and spacing control[\s\S]*Capacity \/ scale/,
    `investor panel must include induction/gapping as a ranked throughput opportunity; got: ${html}`,
  );
});

test("expanded: SpaceX product readout uses the same bottleneck signal as the route rail", () => {
  const cases = [
    "spacex_reusable_launch_stack",
    "spacex_orbital_data_center_system",
  ];

  for (const rootId of cases) {
    const scopedGraph = loadActiveGraphData(rootId);
    const focused = nodeByIdIn(scopedGraph, rootId);
    const html = render({
      graph: scopedGraph,
      focusedNode: focused,
      expanded: true,
      onToggleExpand: noop,
      onClose: noop,
    });
    const topRiskRow = html.match(/Top risk bottleneck[\s\S]*?<\/li>/)?.[0] ?? "";

    assert.match(
      topRiskRow,
      /Top risk bottleneck/,
      `SpaceX product readout should still identify the top bottleneck for ${rootId}; got: ${topRiskRow || html}`,
    );
    assert.doesNotMatch(
      topRiskRow,
      /Heat \d+\/100/,
      `SpaceX product readout must not show an internal Heat score for ${rootId}; got: ${topRiskRow}`,
    );
  }
});

test("expanded: product detail promotes the investor answer and suppresses raw metric-heavy sections", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const investorIndex = html.indexOf("Product bottleneck readout");
  const exposureIndex = html.indexOf('data-testid="detail-exposure-evidence-summary"');
  const metricsIndex = html.indexOf('data-testid="detail-metric-details"');
  const costRollupIndex = html.indexOf("cost-rollup-card");

  assert.ok(investorIndex >= 0, `product detail must render the product bottleneck readout; got: ${html}`);
  assert.ok(exposureIndex >= 0, `product detail must render the supplier/evidence quick path; got: ${html}`);
  assert.ok(
    exposureIndex < investorIndex,
    `product detail should keep supplier/company leads before the product readout without a separate Inspect next section; got: ${html}`,
  );
  assert.equal(html.indexOf('data-testid="detail-inspect-next"'), -1, `product detail should not render Inspect next; got: ${html}`);
  assert.equal(metricsIndex, -1, `product detail must not render a raw metrics section; got: ${html}`);
  assert.equal(costRollupIndex, -1, `product detail must not expose the internal cost-rollup card; got: ${html}`);
});

test("expanded: product detail surfaces startup opportunity candidates with supplier exposure", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Startup opportunity candidates/,
    `product detail must include a dedicated startup opportunity section; got: ${html}`,
  );
  assert.match(
    html,
    /Low-cost real-time vision compute integration/,
    `opportunity section must surface the low-cost vision stack wedge; got: ${html}`,
  );
  assert.match(
    html,
    /NVIDIA/,
    `opportunity section must surface candidate investable exposure for the vision stack; got: ${html}`,
  );
  assert.match(
    html,
    /Intel/,
    `opportunity section must surface multiple candidate exposures for the vision stack; got: ${html}`,
  );
  assert.match(
    html,
    /Parcel induction and spacing control/,
    `opportunity section must surface the induction/gapping throughput wedge; got: ${html}`,
  );
  assert.match(
    html,
    /Wayzim/,
    `opportunity section must surface candidate supplier exposure for induction/gapping; got: ${html}`,
  );
  assert.match(
    html,
    /Public listing: 688211\.SH/,
    `opportunity section must include candidate exposure summaries, not only company names; got: ${html}`,
  );
});

test("expanded: internal cost-rollup warnings stay out of the user-facing detail UI", () => {
  const focused = nodeById(SUBSYSTEM_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.doesNotMatch(html, /direct metric is below child rollup/);
  assert.doesNotMatch(html, /using child rollup as the cost basis/);
  assert.doesNotMatch(html, /likely data-entry mistake/);
});

test("expanded: organization detail surfaces workflows it implements", () => {
  const focused = nodeById(ABB_ROBOTICS_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Modeled implementation exposure/,
    `organization detail must surface a dedicated implementation exposure section; got: ${html}`,
  );
  assert.match(
    html,
    /Maintenance workflow/,
    `ABB Robotics organization detail must link back to maintenance workflow; got: ${html}`,
  );
});

// ==================================================================
// Task 3 — First-glance chokepoint headline (docs/ACCEPTANCE.md §3a).
// The detail surface must LEAD with the chokepoint verdict + the
// elevated axis stated as a concrete sentence (never a raw `maturity:`
// tag), and the four-axis breakdown must be available on drill-in. The
// headline is NOT gated on the canvas colorMode (NodeDetailContent has
// no colorMode prop), so it persists across lens switch / node drill.
// ==================================================================
test("expanded: detail leads with a first-glance chokepoint headline (elevated axis as a concrete sentence)", () => {
  // `industrial_robot_arm_body` is a top-band chokepoint whose elevated axis is
  // Dependency (it is load-bearing: two subsystems depend on it), so the
  // headline must read "Chokepoint" + the Dependency sentence concretely.
  const focused = nodeById("industrial_robot_arm_body");
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const headline = detailDisclosure(html, "detail-chokepoint-headline");

  // Top-band composite verdict.
  assert.match(
    headline,
    /Chokepoint/,
    `a top-band node must read as a Chokepoint; got: ${headline}`,
  );
  // The elevated chokepoint axis is a concrete sentence drawn ONLY from the
  // chokepoint axes {Dependency, Concentration, Barrier} — never Cost (§3a).
  // Here Dependency is the top structural axis (two subsystems depend on it).
  assert.match(
    headline,
    /Load-bearing · \d+ subsystems depend on it/,
    `Dependency elevated-axis sentence must state how many subsystems depend on it; got: ${headline}`,
  );
  // §3a: the "Chokepoint: <axis>" composite line is removed — the verdict and
  // the why-line carry the framing, and Cost is never labelled a chokepoint.
  assert.doesNotMatch(
    headline,
    /Chokepoint:/,
    `headline must not render a "Chokepoint: <axis>" line that frames an axis (esp. Cost) as the chokepoint; got: ${headline}`,
  );
  assert.doesNotMatch(
    headline,
    /maturity:/i,
    `headline must never expose a raw "maturity: <label>" tag; got: ${headline}`,
  );

  // First-glance: the headline lives at the top of the reader-priority
  // surface, before the bottleneck thesis.
  const priority = detailReaderPriority(html);
  assert.ok(
    priority.indexOf("detail-chokepoint-headline") <
      priority.indexOf("detail-bottleneck-thesis"),
    `chokepoint headline must lead the reader-priority surface; got: ${priority}`,
  );

  // Drill-in: the full four-axis model breakdown is available, but only in the
  // collapsed supplementary appendix. It must not compete with the sample-style
  // first reader path.
  const supplementary = detailDisclosure(html, "detail-supplementary-appendix");
  assert.doesNotMatch(
    priority,
    /data-testid="detail-chokepoint-axes"|Chokepoint axes|Model breakdown|卡点四轴/i,
    `four-axis model diagnostics must not render in the first reader path; got: ${priority}`,
  );
  assert.match(
    supplementary,
    /data-testid="detail-chokepoint-axes"/,
    `four-axis breakdown must remain available in the collapsed appendix; got: ${supplementary}`,
  );
  for (const axis of ["cost", "criticality", "concentration", "barrier"]) {
    assert.match(
      supplementary,
      new RegExp(`data-axis="${axis}"`),
      `axis breakdown must list the ${axis} axis row; got: ${supplementary}`,
    );
  }
});

test("chokepoint headline does not present zero holders as a confirmed supplier count", () => {
  const zeroHolderNode: Node = {
    id: "zero_holder_module",
    name: "Zero holder module",
    kind: "module",
    domain: ["test"],
  };
  const zeroHolderGraph: GraphData = {
    graphVersion: "test-zero-holder",
    nodes: [zeroHolderNode],
    edges: [],
    evidence: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(ChokepointHeadline, {
      graph: zeroHolderGraph,
      node: zeroHolderNode,
    }),
  );

  assert.doesNotMatch(
    html,
    /(?:0 makers|0 suppliers)/i,
    `zero holder concentration is a scarcity/data-gap signal, not a confirmed supplier count; got: ${html}`,
  );
  assert.match(
    html,
    /Holder coverage gap/,
    `zero holder concentration should read as a modeled holder-coverage gap; got: ${html}`,
  );
});

test("chokepoint headline presents one modeled holder as coverage, not sole-source proof", () => {
  const oneHolderNode: Node = {
    id: "one_holder_module",
    name: "One holder module",
    kind: "module",
    domain: ["test"],
  };
  const oneHolderOrg: Node = {
    id: "org_one_holder",
    name: "Modeled holder",
    kind: "organization",
    domain: ["test"],
  };
  const oneHolderGraph: GraphData = {
    graphVersion: "test-one-holder",
    nodes: [oneHolderNode, oneHolderOrg],
    edges: [
      {
        id: "e_one_holder_module__manufactured_by__org_one_holder",
        source: oneHolderNode.id,
        target: oneHolderOrg.id,
        relation: "manufactured_by",
        claim: "Modeled holder is a supplier candidate for this module; this is not a sole-source claim.",
      },
    ],
    evidence: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(ChokepointHeadline, {
      graph: oneHolderGraph,
      node: oneHolderNode,
    }),
  );

  assert.doesNotMatch(
    html,
    /(?:only|sole|exclusive|唯一|仅)\s*1?/i,
    `one modeled holder must not read as sole-source proof; got: ${html}`,
  );
  assert.match(
    html,
    /Modeled holders · 1/i,
    `one holder concentration should be framed as modeled coverage; got: ${html}`,
  );
});

test("AI compute substrate headline does not promote holder coverage gap as the chokepoint reason", () => {
  const focused = nodeById("substrate_and_interposer");
  const html = renderToStaticMarkup(
    React.createElement(ChokepointHeadline, {
      graph,
      node: focused,
    }),
  );

  assert.doesNotMatch(
    html,
    /Holder coverage gap/i,
    `holder coverage gaps must not be first-glance chokepoint reasons; got: ${html}`,
  );
  assert.match(
    html,
    /Organic substrate build-up|Silicon interposer \/ RDL|Dense substrate PDN/i,
    `headline should use a concrete substrate/interposer mechanism; got: ${html}`,
  );
});

test("expanded: a structural root product reads as 'not itself a chokepoint'", () => {
  const focused = nodeById(FOCAL_PRODUCT_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const headline = detailDisclosure(html, "detail-chokepoint-headline");
  assert.match(
    headline,
    /Structural root/,
    `a structurally-incomplete product must read as a structural root; got: ${headline}`,
  );
  assert.match(
    headline,
    /not itself a chokepoint/,
    `structural-root copy must clarify the product is not itself the chokepoint; got: ${headline}`,
  );
});

// ==================================================================
// REGRESSION (docs/ACCEPTANCE.md §3a + §3b) — the live app colours and
// reads off the SCOPED ACTIVE graph (loadActiveGraphData), NOT the full
// loadGraphData. The §3b contradiction (canvas says top chokepoint, detail
// says not) only reproduces there: an authored bottleneck whose RAW composite
// falls below the active graph's Q80 is forced to band 5 on the canvas via the
// authored override, but the detail headline used to call the RAW band. Both
// surfaces now read `chokepointVerdictBandFor`, so they can never disagree.
// ==================================================================
test("regression: an authored-bottleneck node reads 'Chokepoint' in the detail headline, matching the canvas band-5 override (active graph)", () => {
  const activeGraph = loadActiveGraphData();
  const verdictBandFor = chokepointVerdictBandFor(activeGraph);
  const authoredNode = nodeByIdIn(activeGraph, "conveyor_integration");

  // Precondition: this node is genuinely the §3b scenario — authored as a
  // bottleneck AND its computed composite is BELOW the top band, so the
  // authored override (⇒ band 5) is load-bearing. If the dataset ever changes
  // so the override no longer matters, this guard fails loudly rather than the
  // test silently going vacuous.
  assert.ok(
    (authoredNode.bottleneckOf?.length ?? 0) > 0,
    `fixture ${authoredNode.id} must be an authored bottleneck (bottleneckOf non-empty)`,
  );
  assert.equal(
    verdictBandFor(authoredNode.id),
    5,
    `an authored bottleneck must resolve to verdict band 5 (the canvas override); got ${verdictBandFor(authoredNode.id)}`,
  );

  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph: activeGraph, node: authoredNode }),
  );
  const headline = detailDisclosure(html, "detail-chokepoint-headline");

  // Canvas == detail: the headline's band attribute equals the shared verdict
  // band, and the verdict label reads "Chokepoint" (not "Not a top chokepoint").
  assert.match(
    headline,
    /data-chokepoint-band="5"/,
    `headline band must equal the shared verdict band (5); got: ${headline}`,
  );
  assert.match(
    headline,
    /<span class="detail-chokepoint-verdict">Chokepoint<\/span>/,
    `an authored-bottleneck node must read "Chokepoint", consistent with the canvas band-5 override; got: ${headline}`,
  );
  assert.doesNotMatch(
    headline,
    /Not a top chokepoint/,
    `the §3b contradiction must be gone — an authored bottleneck must not read "Not a top chokepoint"; got: ${headline}`,
  );
});

test("regression: no node frames Cost as a chokepoint — the literal 'Chokepoint: Cost' never renders, and Cost shows only as its own 'Cost driver' line (active graph)", () => {
  const activeGraph = loadActiveGraphData();
  // A cost-heavy NON-chokepoint: top-quintile cost rank but a low composite
  // band. Before the fix, Cost won the "elevated axis" sort and the headline
  // read "... · Chokepoint: Cost". Now Cost is a separate "Cost driver" line
  // and the verdict comes only from the chokepoint band.
  const costHeavyNode = nodeByIdIn(activeGraph, "industrial_robot_arm_body");
  const verdictBandFor = chokepointVerdictBandFor(activeGraph);
  assert.ok(
    verdictBandFor(costHeavyNode.id) < 5,
    `fixture ${costHeavyNode.id} must be a non-chokepoint (verdict band < 5) to exercise the cost-heavy case; got ${verdictBandFor(costHeavyNode.id)}`,
  );

  const costHeavyHtml = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph: activeGraph, node: costHeavyNode }),
  );
  const costHeavyHeadline = detailDisclosure(costHeavyHtml, "detail-chokepoint-headline");
  // Cost is its OWN line, not the chokepoint reason.
  assert.match(
    costHeavyHeadline,
    /Cost driver · \d+% of build cost/,
    `a cost-heavy node must surface a separate "Cost driver" line; got: ${costHeavyHeadline}`,
  );
  assert.match(
    costHeavyHeadline,
    /Not a top chokepoint/,
    `a cost-heavy non-chokepoint must still read "Not a top chokepoint"; got: ${costHeavyHeadline}`,
  );

  // The invariant across a representative sample of the active graph: the
  // literal "Chokepoint: Cost" (and any "Chokepoint: <axis>" framing) must
  // never appear in a rendered detail headline. Sample the highest-cost-rank
  // nodes — the ones that previously triggered the "Chokepoint: Cost" bug —
  // plus the product root, so the assertion targets the exact failure mode
  // without rendering all ~300 panels.
  const sampleIds = [
    "industrial_robot_arm_body",
    "conveyor_integration",
    "precision_reducer_gearbox",
    "end_effector_gripper_or_suction",
    "parcel_manipulation_or_diverter",
    FOCAL_PRODUCT_ID,
  ];
  for (const id of sampleIds) {
    const node = activeGraph.nodes.find((n) => n.id === id);
    if (!node) continue;
    const html = renderToStaticMarkup(
      React.createElement(NodeDetailContent, { graph: activeGraph, node }),
    );
    const headline = detailDisclosure(html, "detail-chokepoint-headline");
    assert.doesNotMatch(
      headline,
      /Chokepoint:\s*Cost/i,
      `[${id}] the literal "Chokepoint: Cost" must never render — Cost is not a chokepoint axis (§2/§3a); got: ${headline}`,
    );
    assert.doesNotMatch(
      headline,
      /Chokepoint:/,
      `[${id}] no "Chokepoint: <axis>" framing may render; got: ${headline}`,
    );
  }
});

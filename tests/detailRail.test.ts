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
const REDUCER_ID = "precision_reducer_gearbox";
const NABTESCO_ID = "org_nabtesco";
const SIEMENS_ID = "org_siemens";
const MAINTENANCE_ID = "maintenance_workflow";
const ABB_ROBOTICS_ID = "org_abb_robotics";
const END_EFFECTOR_ID = "end_effector_gripper_or_suction";

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
    /Candidate manufacturers \/ investable exposure/,
    `expanded component detail must surface a clearly caveated manufacturer section; got: ${html}`,
  );
  assert.match(html, /Nabtesco/, `reducer detail must list Nabtesco as a manufacturer candidate; got: ${html}`);
  assert.match(html, /60%/, `manufacturer section must surface Nabtesco's share metric; got: ${html}`);
  assert.match(html, /6268\.T/, `manufacturer section must surface Nabtesco's public listing; got: ${html}`);
  assert.match(html, /unreviewed/, `manufacturer section must surface edge review status; got: ${html}`);
  assert.match(
    html,
    /Company-claimed approximately 60% global share/,
    `manufacturer section must surface edge context and limitations; got: ${html}`,
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
    /Candidate manufacturers \/ investable exposure/,
    `expanded EOAT parent detail must surface candidate manufacturer exposure; got: ${html}`,
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

  assert.match(
    html,
    /Bottleneck role/,
    `a node that blocks an upstream product must surface its own bottleneck role; got: ${html}`,
  );
  assert.match(
    html,
    /Active/,
    `bottleneck-role tile must not read as a zero downstream-bottleneck count; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /<span>Bottlenecks<\/span><strong>0<\/strong>/,
    `a node that is itself a bottleneck must not render the misleading "Bottlenecks 0" priority tile; got: ${html}`,
  );
  assert.match(
    html,
    /Downstream bottleneck children/,
    `downstream bottleneck lists should be explicitly scoped to child nodes; got: ${html}`,
  );
});

test("expanded: bottleneck detail surfaces structured constraint factors", () => {
  const focused = nodeById("low_cost_realtime_vision_compute_integration");
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Constraint factors/,
    `expanded bottleneck detail must expose a dedicated constraint-factor section; got: ${html}`,
  );
  assert.match(
    html,
    /Technical maturity/,
    `constraint-factor section must show technical maturity as a limiting factor; got: ${html}`,
  );
  assert.match(
    html,
    /Integration \/ commissioning/,
    `constraint-factor section must show integration/commissioning as a limiting factor; got: ${html}`,
  );
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
    /Supplier exposure/,
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
  assert.match(
    html,
    /unreviewed/,
    `service candidate section must surface edge review status; got: ${html}`,
  );
});

test("expanded: organization detail surfaces its own investor metrics", () => {
  const focused = nodeById(SIEMENS_ID);
  const html = render({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  assert.match(
    html,
    /Organization metrics \/ investor exposure/,
    `organization detail must surface node-level investor metrics; got: ${html}`,
  );
  assert.match(
    html,
    /FY2025 Digital Industries revenue/,
    `Siemens detail must show its annual-report automation exposure metric; got: ${html}`,
  );
  assert.match(html, /17\.788/, `Siemens detail must show the revenue value; got: ${html}`);
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
  assert.match(
    html,
    /Maturity gap/,
    `top blockers must explain that risk is partly driven by maturity gap; got: ${html}`,
  );
  assert.match(
    html,
    /p50 cost/,
    `top blockers must explain that risk is partly driven by rolled-up p50 cost; got: ${html}`,
  );
});

test("expanded: product detail surfaces an investor answer panel", () => {
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
    /Investor answer panel/,
    `product detail must include a synthesized investor answer panel; got: ${html}`,
  );
  assert.match(
    html,
    /Top risk bottleneck/,
    `investor panel must explicitly identify the top risk bottleneck; got: ${html}`,
  );
  assert.match(
    html,
    /Parcel pick-and-place execution subsystem/,
    `investor panel must surface the highest-risk product subsystem; got: ${html}`,
  );
  assert.match(
    html,
    /Cost gap/,
    `investor panel must summarize rolled-up cost against the target; got: ${html}`,
  );
  assert.match(
    html,
    /151,829 RMB over target/,
    `investor panel must quantify the p50 cost gap; got: ${html}`,
  );
  assert.match(
    html,
    /Top cost driver/,
    `investor panel must identify the highest p50 cost driver; got: ${html}`,
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
    /Throughput constraints[\s\S]*Current:[\s\S]*p50 1,500 \(range 325–1,800\) parcels\/hour[\s\S]*Target:[\s\S]*1,500 parcels\/hour[\s\S]*Top cost driver/,
    `investor panel throughput row must include current and target pph before the next row; got: ${html}`,
  );
  assert.match(
    html,
    /Industrial robot arm body/,
    `investor panel must surface the highest p50 cost driver; got: ${html}`,
  );
  assert.match(
    html,
    /Candidate exposure/,
    `investor panel must summarize candidate supplier exposure; got: ${html}`,
  );
  assert.match(html, /FANUC/, `investor panel must include robot-arm supplier exposure; got: ${html}`);
  assert.match(html, /Estun/, `investor panel must include domestic robot-arm exposure; got: ${html}`);
  assert.match(
    html,
    /China industrial robot sales share: 10\.3%/,
    `investor panel must include FANUC's market-share context, not only its name; got: ${html}`,
  );
  assert.match(
    html,
    /Public listing: 6954\.T/,
    `investor panel must include FANUC's public listing context; got: ${html}`,
  );
  assert.match(
    html,
    /China industrial robot sales share: 9\.1%/,
    `investor panel must include Estun's market-share context, not only its name; got: ${html}`,
  );
  assert.match(
    html,
    /Public listing: 002747\.SZ/,
    `investor panel must include Estun's public listing context; got: ${html}`,
  );
  assert.match(
    html,
    /Top startup opportunities/,
    `investor panel must surface a ranked global startup opportunity list; got: ${html}`,
  );
  assert.match(
    html,
    /#1[\s\S]*PLC and WCS integration[\s\S]*Opportunity score[\s\S]*Cost signal:[\s\S]*43\.7k RMB/,
    `investor panel must rank the PLC/WCS integration opportunity with score and cost context; got: ${html}`,
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
    /Implementation exposure/,
    `organization detail must surface a dedicated implementation exposure section; got: ${html}`,
  );
  assert.match(
    html,
    /Maintenance workflow/,
    `ABB Robotics organization detail must link back to maintenance workflow; got: ${html}`,
  );
});

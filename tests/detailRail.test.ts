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
  const pattern = new RegExp(`<details[^>]*data-testid=["']${testId}["'][\\s\\S]*?</details>`);
  const match = html.match(pattern);
  assert.ok(match, `collapsed disclosure ${testId} should be addressable; got: ${html}`);
  return match[0];
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
    /Evidence, suppliers, tickers/,
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
    /Evidence, suppliers, tickers/,
    `expanded component detail must surface a clearly caveated supplier/ticker quick path; got: ${html}`,
  );
  assert.match(
    html,
    /Company \/ ticker candidates/,
    `supplier candidates must be labeled as company/ticker leads, not direct proof; got: ${html}`,
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
    /Evidence, suppliers, tickers/,
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

  assert.match(
    html,
    /Bottleneck role/,
    `a node that blocks an upstream product must surface its own bottleneck role; got: ${html}`,
  );
  assert.match(
    html,
    /Bottleneck for/,
    `bottleneck-role signal must name what the node blocks instead of relying on an "Active" tile; got: ${html}`,
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
  const whereIndex = html.indexOf('data-testid="detail-where-stuck"');
  const evidenceStatusIndex = html.indexOf("Evidence status");
  const decisionBriefIndex = html.indexOf('data-testid="detail-decision-brief"');
  const evidenceSummaryIndex = html.indexOf('data-testid="detail-evidence-summary"');
  const inspectIndex = html.indexOf('data-testid="detail-inspect-next"');
  const technicalMetadataIndex = html.indexOf('data-testid="detail-technical-metadata"');
  const rawDomainIndex = html.indexOf(focused.domain[0], technicalMetadataIndex);
  const rawKindIndex = html.indexOf(`>${focused.kind}<`, technicalMetadataIndex);
  const metricsIndex = html.indexOf('data-testid="detail-metric-details"');
  const relationshipListsIndex = html.indexOf('data-testid="detail-relationship-lists"');
  const downstreamListIndex = html.indexOf("Downstream bottleneck children");
  const evidenceListIndex = html.indexOf('data-testid="evidence-list"');
  const relationshipLists = detailDisclosure(html, "detail-relationship-lists");

  assert.ok(thesisIndex >= 0, `full detail must start with bottleneck thesis; got: ${html}`);
  assert.ok(decisionBriefIndex >= 0, `decision brief should be present; got: ${html}`);
  assert.ok(decisionBriefIndex < thesisIndex, `decision brief should be the first reader block after the title; got: ${html}`);
  assert.ok(whereIndex > thesisIndex, `where-stuck factors should follow the thesis; got: ${html}`);
  assert.ok(evidenceSummaryIndex > whereIndex, `key evidence summary should follow factors; got: ${html}`);
  assert.ok(exposureSummaryIndex > evidenceSummaryIndex, `supplier/evidence quick path should follow the evidence summary; got: ${html}`);
  assert.ok(inspectIndex > exposureSummaryIndex, `inspect next should follow the supplier/evidence quick path; got: ${html}`);
  assert.equal(evidenceStatusIndex, -1, `public detail must not expose internal evidence status language; got: ${html}`);
  assert.ok(technicalMetadataIndex >= 0, `technical metadata should still render after the reader block; got: ${html}`);
  assert.ok(rawDomainIndex >= 0, `raw domain tag should still render later; got: ${html}`);
  assert.ok(rawKindIndex >= 0, `raw kind tag should still render later; got: ${html}`);
  assert.equal(metricsIndex, -1, `raw metrics should not render as a user-facing detail section; got: ${html}`);
  assert.ok(relationshipListsIndex > technicalMetadataIndex, `graph appendix should sit below the primary evidence and metadata path; got: ${html}`);
  assert.ok(downstreamListIndex >= 0, `technical downstream lists should still render later; got: ${html}`);
  assert.ok(decisionBriefIndex < rawKindIndex, "decision brief should appear before the raw kind tag");
  assert.ok(thesisIndex < rawKindIndex, "reader thesis should appear before the raw kind tag");
  assert.ok(whereIndex < exposureSummaryIndex, "Where it is stuck should appear before the supplier/evidence quick path");
  assert.ok(evidenceSummaryIndex < rawDomainIndex, "evidence summary should appear before raw domain tags");
  assert.ok(evidenceSummaryIndex < evidenceListIndex, "evidence summary should appear before the full evidence list");
  assert.ok(evidenceListIndex < relationshipListsIndex, "full evidence should appear before the duplicate graph appendix");
  assert.match(html, /Bottleneck thesis/i, `full detail should lead with a bottleneck thesis; got: ${html}`);
  assert.match(html, /Where it is stuck/i, `full detail should expose stuck factors before raw metadata; got: ${html}`);
  assert.match(html, /Decision brief/i, `full detail should lead with a concise investor research decision brief; got: ${html}`);
  assert.match(html, /Supply constraint/i, `decision brief should classify the bottleneck reason; got: ${html}`);
  assert.match(html, /Relief timing/i, `decision brief should say whether the constraint is quick or slow to relieve; got: ${html}`);
  assert.match(html, /Inspect next/i, `full detail should give the reader next inspection targets; got: ${html}`);
  assert.match(
    detailDisclosure(html, "detail-technical-metadata"),
    /<summary[\s\S]*Technical details[\s\S]*<\/summary>/,
    "raw kind/domain/targetContext should be behind a collapsed technical details disclosure",
  );
  assert.match(
    detailDisclosure(html, "detail-relationship-lists"),
    /<summary[\s\S]*Graph appendix[\s\S]*<\/summary>/,
    "upstream/downstream/sibling lists should be demoted into a collapsed graph appendix",
  );
  assert.doesNotMatch(
    relationshipLists,
    /<button[^>]*class="link-button"/,
    "graph appendix should be static audit context and must not change the focused node",
  );
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

test("expanded: AI compute detail exposes supplier tickers after the why/stuck/evidence sequence and before relationship lists", () => {
  const focused = nodeById(AI_COMPUTE_ROOT_ID);
  const html = renderWithLockedExposure({
    graph,
    focusedNode: focused,
    expanded: true,
    onToggleExpand: noop,
    onClose: noop,
  });

  const summaryIndex = html.indexOf('data-testid="detail-exposure-evidence-summary"');
  const whereStuckIndex = html.indexOf('data-testid="detail-where-stuck"');
  const evidenceSummaryIndex = html.indexOf('data-testid="detail-evidence-summary"');
  const relationshipListsIndex = html.indexOf('data-testid="detail-relationship-lists"');
  const secondarySignalsIndex = html.indexOf("detail-reader-signal-grid");
  const summaryStart = html.lastIndexOf("<div", summaryIndex);
  const summary = html.slice(summaryStart, secondarySignalsIndex);
  const relationshipLists = detailDisclosure(html, "detail-relationship-lists");
  const thesis = detailReaderPriority(html).match(/<div[^>]*data-testid="detail-bottleneck-thesis"[\s\S]*?<\/div>/)?.[0] ?? "";

  assert.ok(summaryIndex >= 0, `supplier/evidence summary should be present; got: ${html}`);
  assert.ok(whereStuckIndex >= 0, `Where it is stuck should be present; got: ${html}`);
  assert.ok(evidenceSummaryIndex > whereStuckIndex, `key evidence summary should appear after Where it is stuck; got: ${html}`);
  assert.ok(summaryIndex > evidenceSummaryIndex, `supplier/ticker quick path should appear after why/stuck/evidence; got: ${html}`);
  assert.ok(relationshipListsIndex > summaryIndex, `supplier/ticker summary must appear before Relationship lists; got: ${html}`);
  assert.ok(secondarySignalsIndex > summaryIndex, `supplier/ticker summary should appear before secondary Heat/Evidence signals; got: ${html}`);
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
  assert.match(summary, /Source quick path/i);
  assert.doesNotMatch(summary.trim(), /^0 reviewed/i);
  assert.doesNotMatch(summary, /77 suppliers hidden|paid exposure layer/i);
  assert.doesNotMatch(relationshipLists, /Supplier \/ evidence quick path|Evidence quick path/i);
  assert.doesNotMatch(relationshipLists, /2330\.TW|000660\.KS|2311\.TW|005930\.KS/);
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

test("expanded: locked supplier/ticker state is visible inside the decision brief", () => {
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
  const decisionBrief = html.match(/<div[^>]*data-testid="detail-decision-brief"[\s\S]*?<\/div><\/div>/)?.[0] ?? "";

  assert.match(
    decisionBrief,
    /Supplier\/ticker/i,
    `locked supplier/ticker state should be in the first-screen decision brief; got: ${decisionBrief || html}`,
  );
  assert.match(
    decisionBrief,
    /12 organization records gated/i,
    `decision brief should say modeled exposure exists but is gated; got: ${decisionBrief || html}`,
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

  assert.match(thesis, /Why it matters:/i, `detail thesis should still explain why the node matters; got: ${thesis}`);
  assert.doesNotMatch(
    thesis,
    /Current signal:/i,
    `detail thesis should not spend first-screen space on internal graph-signal phrasing; got: ${thesis}`,
  );
  assert.ok(
    html.indexOf('data-testid="detail-decision-brief"') < html.indexOf('data-testid="detail-bottleneck-thesis"'),
    `decision brief should appear before the compact thesis block; got: ${html}`,
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

test("expanded: detail where-stuck keeps maturity score out of the primary explanation", () => {
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
  const whereIndex = priority.indexOf('data-testid="detail-where-stuck"');
  const evidenceIndex = priority.indexOf('data-testid="detail-evidence-summary"');
  assert.ok(whereIndex >= 0, `detail should include where-stuck factors; got: ${priority}`);
  assert.ok(evidenceIndex > whereIndex, `evidence summary should follow where-stuck; got: ${priority}`);
  const whereStuck = priority.slice(whereIndex, evidenceIndex);

  assert.match(whereStuck, /Component availability/i);
  assert.match(whereStuck, /Capacity \/ scale/i);
  assert.match(whereStuck, /Technical maturity/i);
  assert.doesNotMatch(
    whereStuck,
    /Maturity 50\/100|early_deployment/i,
    `Where it is stuck should explain the constraint type, not expose a raw maturity score; got: ${whereStuck}`,
  );
});

test("expanded: detail relief timing distinguishes component, material, and economic constraints", () => {
  const fusionGraph = loadActiveGraphData("controlled_fusion_route_portfolio");
  const spaceGraph = loadActiveGraphData("spacex_orbital_data_center_system");
  const renderDecisionBrief = (graphData: GraphData, nodeId: string) => {
    const html = render({
      graph: graphData,
      focusedNode: nodeByIdIn(graphData, nodeId),
      expanded: true,
      onToggleExpand: noop,
      onClose: noop,
    });
    return html.match(/<div[^>]*data-testid="detail-decision-brief"[\s\S]*?<\/div><\/div>/)?.[0] ?? html;
  };

  assert.match(
    renderDecisionBrief(fusionGraph, "fusion_breeding_blanket_heat_extraction"),
    /material supply and qualification must scale together/i,
  );
  assert.match(
    renderDecisionBrief(spaceGraph, "high_volume_compute_satellite_factory_line"),
    /qualified components or second sources must scale/i,
  );
  assert.match(
    renderDecisionBrief(spaceGraph, "orbital_compute_business_model_validation"),
    /Unknown until demand, utilization, and unit economics are validated/i,
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
  assert.match(
    html,
    /Heat \d+\/100/,
    `investor panel must display the pressure score as Heat N/100 instead of a probability; got: ${html}`,
  );
  assert.doesNotMatch(
    html,
    /Risk \d+%/,
    `investor panel must not display risk scores as probability-like percentages; got: ${html}`,
  );
  assert.match(
    html,
    /Relative pressure signal: cost\/maturity where available, boosted by explicit bottleneck claims\. Not a probability\./,
    `heat score tooltip must explain the pressure signal is not a probability; got: ${html}`,
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
    /169,079 RMB over target/,
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
    /Company\/ticker leads/,
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
      /Heat (9[0-9]|100)\/100/,
      `SpaceX product readout should honor explicit bottleneck claims instead of showing a zero-cost fallback for ${rootId}; got: ${topRiskRow || html}`,
    );
    assert.doesNotMatch(
      topRiskRow,
      /Heat 0\/100/,
      `SpaceX product readout must not show a 0/100 top-risk contradiction for ${rootId}; got: ${topRiskRow}`,
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
  const metricsIndex = html.indexOf('data-testid="detail-metric-details"');
  const costRollupIndex = html.indexOf("cost-rollup-card");

  assert.ok(investorIndex >= 0, `product detail must render the product bottleneck readout; got: ${html}`);
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

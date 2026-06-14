import fs from "node:fs";

/**
 * Per ADR-0006 and slice A3 of the 2026-05-13 radial-progressive-
 * disclosure spec, the `/graph` surface was rewritten from a layered
 * ELK explorer with mode tabs, KPI strip, banners, ColorModeSelect and
 * advanced filters into a radial dot canvas. The old regressions
 * checked here (incremental ELK layout + double-click expand
 * handler + layout effect dependencies) no longer apply — those
 * helpers were deleted alongside the two-stage state machine.
 *
 * The checks below pin the new contract:
 *   1. ReactFlow fitView is not pinned via the legacy `fitView` boolean
 *      (which forces re-fit on every render); the radial canvas fits
 *      once on mount via the Controls button instead.
 *   2. zoomOnDoubleClick stays disabled so double-click is reserved
 *      for future Phase B exit-focus gesture (per ADR-0006 §Focus
 *      interaction).
 *   3. The graph canvas does NOT use ambient float animations
 *      (carried over from the original anti-jitter rule).
 *   4. The elk-worker static asset still ships at /public so any
 *      future code paths that load ELK have the worker available.
 *   5. GraphExplorer does NOT bundle the main ELK build inline.
 *
 * Slice A3 explicitly deletes the chrome enumerated in ADR-0006:
 * we verify those elements are gone so future edits don't quietly
 * re-introduce them.
 */

const graphExplorer = fs.readFileSync("src/components/GraphExplorer.tsx", "utf8");
const globals = fs.readFileSync("src/app/globals.css", "utf8");

const failures = [];

function requireMatch(name, condition) {
  if (!condition) failures.push(name);
}

// Per ADR-0006: chrome the radial slice deletes.
requireMatch(
  "GraphExplorer must not render the legacy ColorModeSelect dropdown (replaced by floating button in slice B1).",
  !/color-mode-select-wrapper|ColorModeSelect/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must not render the legacy mode-tabs segmented-control (mode tabs deleted per ADR-0006).",
  !/segmented-control[\s\S]{0,200}viewMode/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must not render the legacy KPI / graph-context-strip (deleted per ADR-0006).",
  !/graph-context-strip|graph-context-stat/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must not render legacy advanced-filters / display-options drawers.",
  !/advancedFilters|displayOptions/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must not maintain a two-stage state machine (single selection state only per slice A3).",
  !/setStage\(|useState<"overview"\s*\|\s*"focused">/.test(graphExplorer),
);

// Hold-the-line invariants carried over from the prior check script.
requireMatch(
  "GraphExplorer should not keep ReactFlow fitView enabled on every update.",
  !/\sfitView(?:\s|>|$)/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer should not use React Flow hover handlers for graph-wide state.",
  !/onNodeMouseEnter|onNodeMouseLeave|hoveredId/.test(graphExplorer),
);
requireMatch(
  "React Flow double-click viewport zoom must stay disabled so Phase B can adopt double-click for exit-focus.",
  /zoomOnDoubleClick=\{false\}/.test(graphExplorer),
);
requireMatch(
  "Main graph nodes should not use ambient float animation.",
  !/graphNodeFloat|animation:\s*graphNodeFloat/.test(globals),
);
requireMatch(
  "ELK worker should be served as a static asset.",
  fs.existsSync("public/elk-worker.min.js"),
);
requireMatch(
  "GraphExplorer should not import the bundled ELK main build.",
  !/elkjs\/lib\/elk\.bundled|from "elkjs";/.test(graphExplorer),
);

// Radial-render invariants introduced by slice A3.
requireMatch(
  "GraphExplorer must render a radial dot node type per slice A3.",
  /radialDot/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must read positions from radialLayout per slice A3.",
  /from "@\/lib\/radialLayout"/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must read fill from subsystemHue per slice A3.",
  /from "@\/lib\/subsystemHue"/.test(graphExplorer),
);

// Full-system route-led chrome invariants introduced by this redesign pass.
requireMatch(
  "GraphExplorer must mount the compact GraphControls surface.",
  /GraphControls/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must not mount the old ColorModeFloatingButton in the Full System first pass.",
  !/ColorModeFloatingButton/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must mount the route-first detail rail.",
  /RouteDetailRail/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must derive the active route from selectCostDriverRoute.",
  /selectCostDriverRoute/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must drive edge styles from edgeStyleFor per slice B1.",
  /from "@\/lib\/edgeStyleFor"/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must keep sector background tints structural and stable, not driven by color-mode aggregates.",
  !/from "@\/lib\/sectorAggregate"/.test(graphExplorer) &&
    /subsystemHue\(sub,/.test(graphExplorer),
);

// ADR-0007 invariants introduced by the Stable Balanced Radial Tree.
requireMatch(
  "GraphExplorer must not use old elastic sectorAngles geometry; ADR-0007 keeps branch highlight on the stable map.",
  !/from "@\/lib\/sectorAngles"/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must not remap node theta through applySectorAngles; radialLayout is the stable geometry source.",
  !/from "@\/lib\/applySectorAngles"/.test(graphExplorer),
);
requireMatch(
  "GraphExplorer must read balanced first-layer sector metadata from layout.sectors.",
  /layout\.sectors/.test(graphExplorer),
);

// B3 invariants introduced by slice B3, then updated for chromatic focus:
// non-focused nodes/edges should recede via opacity while preserving hue.
requireMatch(
  "GraphExplorer must derive node + edge dim flags via focusedSubset per slice B3.",
  /from "@\/lib\/focusedSubset"/.test(graphExplorer),
);
requireMatch(
  "globals.css must keep .radial-dim chromatic by dimming opacity instead of greyscale filtering.",
  /\.radial-dot\.radial-dim\s*\{[\s\S]{0,200}opacity:\s*0\.[0-9]+/.test(globals) &&
    /\.react-flow__edge\s+\.radial-dim\s*\{[\s\S]{0,200}opacity:\s*0\.[0-9]+/.test(globals) &&
    !/\.radial-dim\s*\{[\s\S]{0,200}filter:\s*(?:saturate\(0\)|grayscale)/i.test(globals),
);

if (failures.length) {
  console.error("Graph UX regression checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Graph UX regression checks passed.");

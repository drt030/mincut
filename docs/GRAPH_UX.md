# Graph UX Contract

This document defines the interaction and visualization rules for graph-facing product work. It applies to `GraphExplorer.tsx` and future graph views unless a task explicitly documents a different UX goal.

## Product Goal

Capability Graph Explorer is a research workspace, not a decorative network map. The graph should help a user answer concrete research questions:

- What is this product made of?
- Which subsystem, route, component, process, metric, or capability blocks maturity?
- What evidence supports a claim?
- What should be expanded or researched next?

Visual polish is valuable only when it improves orientation, comparison, or trust.

## Default View Model

Do not default to a full graph. Default to a focused dependency canvas:

- Start from one concrete product node.
- Show the immediate dependency layer first.
- Expand one selected subsystem, route, component, or bottleneck at a time.
- Keep full graph inspection available as an explicit mode.
- Keep the selected node visible and visually stable across interactions.

The graph should preserve spatial memory. Filtering, expanding, and focusing should update the layout without remounting the whole canvas whenever possible.

## Layout Rules

Use algorithmic layout for graph positions. Hand-written lane heuristics are not acceptable for production graph views.

For directed product-dependency graphs, prefer a layered layout:

- Main flow: product -> module -> route/component -> process/material/software/metric/bottleneck.
- Use generous node-to-node and layer spacing.
- Avoid node overlap by giving the layout engine real node dimensions.
- Keep coordinates stable; any ambient motion must happen inside the rendered node, not by changing graph coordinates.
- Keep the pointer hitbox stable. Hover effects must not translate, resize, or otherwise move the element that receives mouse events.

Current v0 implementation uses React Flow plus ELK. The ELK worker is served as a static asset from `public/elk-worker.min.js` so Next.js does not bundle the worker into the React graph route. If the project later evaluates yFiles, the UX contract stays the same: focused dependency canvas, incremental expansion, edge-label-on-demand, and semantic zoom.

## Edge Rules

Edges should explain structure without becoming visual noise.

- Do not show every edge label by default.
- Show edge labels when an edge is selected, hovered, connected to the selected/hovered node, or when the user filters to one relation type.
- Dim unrelated edges during hover or selection.
- Use relation-specific styling:
  - `requires`: primary dependency line.
  - `bottlenecked_by`: risk line, visually warm/red.
  - `measured_by`: subdued metric line.
  - `manufactured_by` / `regulated_by`: dashed support lines.
- Prefer path highlighting over persistent labels.

## Node Rules

Nodes are compact research cards.

- Show the localized node name, kind, and maturity score when available.
- Show risk state on bottleneck and placeholder breakthrough nodes.
- Show selected state with a stable border, not a continuous animation.
- Avoid ambient float effects in the main research canvas. Stability is more important than decorative motion.
- Do not animate real layout positions for ambience.
- If ambient motion is reintroduced later, apply it to inner content only. The outer node shell must remain stationary so hover cannot flicker at node edges.
- Use `nodeName(id, fallback)` for display names.

## Metric Folding

`metric`-kind nodes are first-class data but should not visually compete with the parent they describe. The graph view folds them when their relationship is unambiguous:

- A metric whose incoming `measured_by` edges resolve to **exactly one** visible non-metric parent node renders as a row in that parent's compact metrics strip (name, current/target value, unit). It does not render as a standalone graph node.
- A metric with **multiple** visible non-metric parents (shared metric) keeps its standalone node — folding into one parent would hide the cross-cutting relationship.
- A metric with **zero** visible non-metric parents (the parent is filtered or collapsed away) keeps its standalone node so the user can still reach it.
- Clicking a folded metric chip selects the metric node and opens the standard node detail panel (evidence, confidence, history) — folding is purely a display-layer choice; the underlying graph data is unchanged.
- The metrics strip is height-bounded (~60px) and lives inside the parent card so the outer hover/select hitbox stays stable per the Node Rules.
- A "Show metrics as nodes" toggle in the toolbar (default off) opts out of folding and reverts to the legacy behavior. This is the audit/debug escape hatch; the folded view is the research default.

## Interaction Rules

Primary interactions:

- Click node: select it and update the detail panel.
- Double-click node: expand or collapse the next dependency layer.
- Hover node: use local visual feedback only unless the interaction has been tested for flicker on real browsers.
- Filter relation: show the selected relation clearly and reveal its edge labels.
- Reset: return to the root product, initial expansion, and broad relation view.

Avoid adding text instructions inside the canvas. The UI should communicate through state, highlighting, layout, and controls.

## View Modes

Future graph work should keep these conceptual modes separate:

- Dependency Map: default layered dependency view.
- Bottleneck Map: reduced graph emphasizing blockers and risk paths.
- Maturity Map: color and badges emphasize maturity, evidence coverage, and review status.
- Sibling-Product Compare: alternative Product candidates under one Capability compared in a table or structured lane view rather than a dense all-edge graph (per ADR-0004; replaces the earlier "Route Compare" framing now that intra-Product routes are not used in v0 data).
- Overview: full graph inspection for audit and debugging, not the default research workflow.

## Implementation Guardrails

- Do not remount React Flow on normal filter changes.
- Do not run layout from hover-only state. Layout dependencies should be structural: visible nodes, visible edges, filter mode, and expansion state.
- Do not run layout from selection-only state. Selection should update styling and the detail panel, not node coordinates.
- Do not keep auto-fit behavior active on every graph update; repeated viewport fitting makes expansion feel like the graph is sliding away.
- Keep layout code isolated from node rendering code.
- Keep graph styling driven by node kind, relation, maturity, and review/evidence state.
- Run `npm run lint` and `npm run build` for UI changes.
- Update this document when introducing a new graph interaction pattern.

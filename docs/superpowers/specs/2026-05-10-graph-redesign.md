# Graph Redesign — cost honesty, color modes, layout reflow, two-stage exploration

**Date**: 2026-05-10
**Author**: ralph-loop session (Claude Opus 4.7)
**Status**: **superseded 2026-05-13 by ADR-0006** (`docs/adr/0006-radial-progressive-disclosure-graph.md`). Slice 1 (cost honesty) **landed and remains valid**. Slices 2 (color modes via `edgeTintFor`), 3 (`explorationLayout` recompute-on-focus), and 4 (two-stage overview/focused) are **deprecated** — the radial progressive-disclosure model in `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md` replaces them. The text below is preserved for historical context and should not be acted on.

## Goal

Make `/graph` answer the user's "一眼看到瓶颈线 + 各子系统的成熟度" question while keeping detail one click away. Today the graph is a static layered DAG with relation-type-colored edges, no global+local affordances, and a cost rollup that surfaces a subsystem (机械臂 60k) priced above its parent (抓取系统 4k).

## Non-goals

- New ADRs other than a small amendment to ADR-0003 capturing the cost-walker semantic change
- New schema fields
- Multi-product comparison views (sibling-product navigation stays as-is)
- A new test framework (use Node 18+ built-in `node --test`)

## Architecture

Four independent vertical slices, each shipped as RED → GREEN commit pair:

1. **Cost honesty** — change walker to `max(direct, sum × 1.15)` so a parent's rolled-up cost never reads below its children's sum. Surface direct/children breakdown in detail panel with a ⚠ badge when direct < children.
2. **Color modes** — pure function `edgeTintFor(targetNode, mode, graph)` mapping a node to an edge stroke color across 5 modes: Relation (current default), Cost (blue→red heat), Maturity (red→green), Overall (gradient), Bottleneck-risk (highlights both edges and node fill).
3. **Layout reflow on expand** — pure function `explorationLayout({graph, focusId, expandedIds, stage})` that recomputes positions on every state change; React Flow node CSS `transition: transform 150ms ease` smooths the jump.
4. **Two-stage exploration** — overview stage: zoom 0.3, all cards compact (icon + title + color block), bottleneck path glowing; focus stage: zoom 0.8, target node centered, 3 hops of neighbors as full cards, others dimmed to 30%. ESC or "回到全局" button returns to overview.

```
src/lib/
  costRollup.ts          (modified: max-of-direct-or-children)
  edgeTint.ts            (new)
  nodeRisk.ts            (new — risk = (1 - maturity/100) × cost_share)
  explorationLayout.ts   (new — reads graph + state, returns positions Map)

src/components/
  GraphExplorer.tsx      (modified: stage / colorMode state, ColorModeSelect wire-in, edge style.stroke, ELK reflow on expand, semantic-zoom class switch)
  NodeDetailPanel.tsx    (modified: direct/children cost breakdown, ⚠ inversion badge)
  ColorModeSelect.tsx    (new — 5-option dropdown)

src/app/globals.css      (modified: .graph-node-card.compact, 4 color-ramp CSS vars, transition on .react-flow__node)

tests/
  fixtures/              (small graphs hand-built for assertions)
  costRollup.test.mjs    (asserts max-of-direct-or-children)
  edgeTint.test.mjs      (asserts each mode's tint endpoints)
  nodeRisk.test.mjs      (asserts risk formula edges)
  explorationLayout.test.mjs (asserts reflow on expand)
  ux-tour.test.mjs       (golden-path assertions; chrome-devtools driven inside ralph-loop iters)
```

## Slice contracts

### Slice 1 — Cost honesty

**RED test**:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { rollupCost } from "../src/lib/costRollup.ts";
import { loadFixture } from "./fixtures/loader.mjs";

test("cost rollup uses max(direct, sum × 1.15) when direct < children sum", () => {
  const graph = loadFixture("cost-inversion.json"); // parent direct=4k, child direct=60k
  const result = rollupCost(graph, "parent");
  assert.ok(result.rolledUp.typical >= 60_000 * 1.15, `expected ≥ 69000, got ${result.rolledUp.typical}`);
  assert.equal(result.directLowerThanChildren, true);
  assert.ok(result.directOnly.typical === 4_000);
  assert.ok(result.fromChildren.typical >= 60_000 * 1.15);
});
```

**GREEN impl**: walker computes both `direct` and `sum × 1.15`, returns max; result type extends with `directOnly`, `fromChildren`, `directLowerThanChildren`.

**ADR-0003 amendment**: append a "cost-walker max-of semantic" section explaining the change and why (parent-below-child violates the intuition that a system's price ≥ its parts).

### Slice 2 — Color modes

**RED test** (one per mode):

```js
test("edgeTintFor returns warm color for high-cost target in cost mode", () => {
  const graph = loadFixture("two-cost-targets.json"); // 5k vs 95k targets
  const cheap = edgeTintFor(graph.nodeById("cheap"), "cost", graph);
  const pricey = edgeTintFor(graph.nodeById("pricey"), "cost", graph);
  assert.notEqual(cheap, pricey);
  assert.match(pricey, /#dc|#ef|red|amber/i, "pricey should be warm");
  assert.match(cheap, /#3b|#60|blue|cyan/i, "cheap should be cool");
});
```

Repeat for `maturity` (red→green ramp), `overall` (gradient), `bottleneck` (uses `nodeRisk`).

**GREEN impl**: pure function in `src/lib/edgeTint.ts` with explicit ramps. No React dependency.

### Slice 3 — Layout reflow on expand

**RED test**:

```js
test("explorationLayout shifts siblings down when a node expands", () => {
  const graph = loadFixture("tiny-5node.json"); // A → {B, C, D, E, F}
  const posBefore = explorationLayout({ graph, focusId: "A", expandedIds: new Set(["A"]), stage: "focused" });
  const posAfter = explorationLayout({ graph, focusId: "A", expandedIds: new Set(["A", "B"]), stage: "focused" });
  // B's children should appear in posAfter (not in posBefore)
  assert.ok(posAfter.size > posBefore.size);
  // Siblings of B (C, D, E, F) should shift down (higher y) to make room for B's children
  for (const sibling of ["C", "D", "E", "F"]) {
    assert.ok(posAfter.get(sibling).y >= posBefore.get(sibling).y, `${sibling} should not move up`);
  }
});
```

**GREEN impl**: extract layout into pure function; current `useEffect` in GraphExplorer calls it and sets state. ELK incrementalLayout's early-return-on-empty-Map bug fixed by checking the actual change set rather than referential equality.

### Slice 4 — Two-stage exploration

UI state machine; testing is screenshot + heuristic, not unit-test.

**Screenshot acceptance**:

1. `/graph` initial load: stage = "overview", `transform: scale(0.3..0.55)`, all cards have class `compact`, bottleneck-risk path edges have stroke ≠ default gray
2. Click a node: within 350ms, `transform: scale(0.7..0.9)`, target node has class `selected`, neighbors visible with class `related`, others have opacity ≤ 0.4
3. ESC pressed: returns to (1)

**Implementation**:

- New state: `stage: "overview" | "focused"`, default `overview`
- New state: `colorMode: "relation" | "cost" | "maturity" | "overall" | "bottleneck"`, default `bottleneck`
- `useEffect` watches `stage` and `selectedId`, calls `instance.fitView()` or `instance.setCenter(x, y, { zoom: 0.8, duration: 350 })`
- Zoom listener (debounced via `requestAnimationFrame`): if `zoom < 0.5`, add `compact` class to all cards; else remove
- `Esc` keyboard handler on canvas wrapper
- ColorModeSelect rendered next to existing view-mode buttons

## Data flow

```
state: { stage, focusId, expandedIds, colorMode, filters }
  │
  ├─→ explorationLayout(graph, focusId, expandedIds, stage)  ───→ positions
  ├─→ For each visible node: <NodeCard semanticClass={zoom < 0.5 ? "compact" : "full"} />
  └─→ For each edge: style.stroke = edgeTintFor(targetNode, colorMode, graph)

interactions:
  click node     → setStage("focused"); setFocusId(id); reactFlow.setCenter(...)
  ESC            → setStage("overview"); reactFlow.fitView(...)
  ColorModeSelect onChange → setColorMode(mode)   (only re-renders edges; no relayout)
  expand/collapse → setExpandedIds(next)  (triggers relayout via deps)
```

## Testing strategy

- **Test runner**: Node 18+ `node --test`. Zero new deps. TAP output.
- **Each slice ships RED → GREEN as two commits.** The RED commit must show a failing test in its body (paste the TAP failure). The GREEN commit makes it pass.
- **Fixtures**: hand-built tiny graphs (3–10 nodes) under `tests/fixtures/`. Each fixture documents its hand-computed expected output in a top-of-file comment.
- **UX golden-path tour**: every iter that touches UI runs the 7-step tour via chrome-devtools MCP (the agent itself), screenshots into `.tmp/civ-ralph/iter-NN/`, scores each step 0–5 on clarity / responsiveness / fit-for-purpose, writes scores into `docs/agent-memory.md`. Scores < 3 become next iter's priority.
- **Existing checks**: `npm run lint` and `npm run check:graph-ux` run every iter. Never run `npm run build` while dev server is up (it clobbers `.next/`).

## Error handling and edges

- **Cost direct < children**: walker returns max; result carries `directLowerThanChildren: true`; detail-panel shows ⚠ "录入直接成本低于子件 rollup，可能录入错误" badge.
- **Missing maturity / cost on a node**: `edgeTintFor` returns neutral `#94a3b8`; never throws.
- **focusId filtered out**: fall back to rootId; `console.warn` once.
- **Semantic-zoom thrash**: rAF-throttle zoom listener; never re-render mid-frame.
- **ELK still hangs**: if `incrementalLayout` returns null, fall back to fallback layout, but still call `explorationLayout` to apply expand/focus reflow on top.
- **Color-mode change during transition**: edges get new color immediately; positions don't change.

## Scope: what's out

- Multi-target product comparison
- Animated transitions between color modes (just snap)
- Persisted user preferences (color mode resets per session)
- Side outline tree (user rejected this in brainstorm — replaced by two-stage exploration)
- Mobile / narrow-viewport optimization (graph is desktop-only by design)

## Acceptance

Session is done when:
1. All four slices have RED + GREEN commits on master
2. ADR-0003 amendment merged
3. `node --test tests/` passes
4. `npm run lint` and `npm run check:graph-ux` pass
5. Golden-path screenshot tour run on final HEAD with average score ≥ 3.5 across the 7 steps
6. `docs/morning-handoff-2026-05-11.md` written summarizing what landed and what's next

## Risks

- **ELK reflow hard to fix** — incrementalLayout has been hanging the whole session; the proper fix may require understanding its early-return logic deeply. Mitigation: slice 3 can be ELK-bypassing if needed (use only fallback + explorationLayout).
- **Bottleneck-risk formula tuning** — `(1 - maturity/100) × cost_share` may not match user intuition. Mitigation: make weights configurable as constants at top of `nodeRisk.ts`; ralph-loop iter can tune them if tour scores stay low.
- **Two-stage exploration animation jank** — if React Flow's setCenter + node-position-change happen simultaneously, the user sees a double-jump. Mitigation: set positions first, then defer setCenter to the next frame.

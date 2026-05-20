# Graph Radial Progressive Disclosure — implementation slices

**Date**: 2026-05-13
**Author**: grilling session (Claude Opus 4.7)
**Status**: historical; amended by `docs/superpowers/specs/2026-05-20-stable-balanced-radial-tree-design.md`
**ADR**: `docs/adr/0006-radial-progressive-disclosure-graph.md`
**Supersedes**: slices 2/3/4 of `docs/superpowers/specs/2026-05-10-graph-redesign.md`

> **2026-05-20 note**: This spec captured the ADR-0006 rollout and is no longer the current target where it requires equal fixed sectors, click-to-elastic sector expansion as the main focus mechanism, or recursive Level-2 elastic geometry. The current graph UX direction is the Stable Balanced Radial Tree in `docs/superpowers/specs/2026-05-20-stable-balanced-radial-tree-design.md`.

## Goal

Re-implement `/graph` as a radial progressive-disclosure surface per ADR-0006. Three target outcomes for the user, validated by the UX-flow tour:

1. **First viewport at lowest zoom shows all 77 structural nodes** as a coherent radial pattern; "which subsystem is most complex" is answerable by gaze alone.
2. **Clicking a node never breaks spatial continuity.** The focal product stays at canvas origin; the clicked sector expands elastically; viewport softly zooms. Users can always tell "where I came from."
3. **Color mode (cost / maturity / risk) reads at every zoom level**, via redundantly encoded edge color + thickness + sector background tint.

## Non-goals

- Sibling product compare (deferred to Phase D or later)
- Cmd+K full implementation (Phase C only stubs the keymap; surface lives in a future iteration)
- New data model fields beyond `bottleneckOf` / `frontierFor` attributes
- Removal of the 2026-05-10 cost-honesty slice — that stays
- Schema redesign — only deprecations + 2 optional fields

## Phased rollout

### Phase A — Minimum viable progressive discovery (4 slices)

The default `/graph` displays a static radial overview of all 77 structural nodes with subsystem hue families. Clicking does nothing yet (or falls back to current detail panel). Goal: ship the canvas and prove the layout is legible.

### Phase B — Focus interaction (4 slices)

Click → elastic sector expansion + greyscale focus + detail rail. Color mode K4 (edge color + thickness + sector tint).

### Phase C — Polish and replace exceptions (3 slices)

Recursive Level-2 elastic. Cmd+K search. Glyph language for top-N priorities (retires the high-risk pill banner exception).

---

## Slices

Each slice ships as a RED commit (failing test) → GREEN commit (implementation passing test) pair, following the 2026-05-10 spec pattern.

### Slice A1 — Schema attributes for bottleneck / frontier

**Files touched**: `src/lib/schema.ts`, `tests/schema.test.mjs`, `data/nodes/parcel_sorting_robot.json`, migration script under `scripts/`.

**RED test**: parse a node with `bottleneckOf: ["cap_x"]` — current schema rejects (or accepts an unknown field silently). The test asserts the field is recognized and validated.

**GREEN**: extend Zod node schema with two optional `string[]` fields. Add migration script `scripts/migrate-bottleneck-to-attr.mjs` that rewrites existing `bottleneck`-kind nodes into attributes on the modules they bottleneck (read `bottlenecked_by` edges, attach `bottleneckOf` to source), then deletes the bottleneck nodes and edges. Same for `placeholder_breakthrough` → `frontierFor`. Update fixtures.

### Slice A2 — Pure `radialLayout` function

**Files touched**: `src/lib/radialLayout.ts` (new), `tests/radialLayout.test.mjs` (new).

**RED tests**:
1. Given fixture graph (product + 12 subsystems + 3 levels of descendants), returns Map<id, {r, theta}> for every structural node.
2. Product is at (r=0, theta=0).
3. The 12 first-layer subsystems are at r = R₁ and theta = i × 30° for i ∈ [0, 12).
4. Descendants of subsystem i fall within theta range [i × 30°, (i+1) × 30°].
5. Shared node with 3 parents has exactly one position (canonical sector by heuristic); cross-sector edges are returned in a parallel `Map<edgeId, {style: 'primary'|'cross'}>`.
6. Materials are at r = R_outer regardless of which subsystems consume them.

**GREEN**: implement deterministic radial layout. Accepts `GraphData`, returns positions + edge metadata. No state; pure.

### Slice A3 — Render radial canvas with subsystem hues (band 1 only)

**Files touched**: `src/components/GraphExplorer.tsx`, `src/lib/subsystemHue.ts` (new), `tests/subsystemHue.test.mjs`, `src/app/globals.css`.

**RED test**: `subsystemHue(nodeId, graph)` returns the same HSL hue for every descendant of a given first-layer subsystem; returns a special `neutral-grey` value for materials and arbitrary-canonical-parent shared nodes.

**GREEN**:
1. Convert `GraphExplorer` to read `radialLayout` output for positions (polar → cartesian).
2. Replace existing node component with a band-1 dot renderer (5px circle, fill = `subsystemHue`).
3. Replace existing edge renderer with thin grey lines for now (no color mode yet).
4. Delete: ColorModeSelect wiring, mode tabs, top blockers banner, KPI row, advanced filters, display options. Only the header and the canvas remain.

This slice is large but well-bounded — most of it is deletion.

### Slice A4 — LOD bands (3 bands)

**Files touched**: `src/components/GraphExplorer.tsx`, `src/components/RadialNode.tsx` (new), `src/components/RadialEdge.tsx` (new), `tests/lod.test.mjs`.

**RED test**: render a single node at zoom 0.3, 1.0, 2.0 — assert the node component returns a 5px dot, 12px marker, and 80×40 card respectively. Same for edges.

**GREEN**: implement LOD subscription via `useStore((s) => Math.floor(s.transform[2] * 2))` to discretize zoom changes. Each LOD band renders a different sub-component:
- Band 1: pure SVG circle, no DOM children
- Band 2: SVG circle + foreignObject label (truncated name) + outline
- Band 3: full HTML card

End of Phase A — the `/graph` shows all 77 nodes as a colored radial pattern; zoom in / out works; nothing else does. Ship and validate via UX-flow tour.

---

### Slice B1 — Color mode K4 (edge color + thickness + sector tint + node outline)

**Files touched**: `src/lib/edgeStyleFor.ts` (new — supersedes old `edgeTint.ts`), `src/lib/sectorAggregate.ts` (new), `src/components/ColorModeFloatingButton.tsx` (new), `tests/edgeStyleFor.test.mjs`, `tests/sectorAggregate.test.mjs`.

**RED tests**:
1. `edgeStyleFor(edge, mode, graph)` returns `{stroke: hex, width: number}` with the 5-band binning; width and color always come from the same band.
2. `sectorAggregate(subsystemId, mode, graph)` returns mean/sum/max as appropriate per mode.
3. Floating button bottom-left renders; clicking it opens the 5-mode selector + legend.

**GREEN**: 5-band color and thickness pipelines aligned to the same thresholds. Sector tint applied as a translucent SVG arc behind each sector's fan of nodes. Band-2+ node outline = mode band. Replace removed ColorModeSelect with bottom-left floating button.

### Slice B2 — Click → elastic sector expansion (Level 1)

**Files touched**: `src/lib/sectorAngles.ts` (new), `src/components/GraphExplorer.tsx`, `tests/sectorAngles.test.mjs`.

**RED tests**:
1. `sectorAngles(focusedSubsystemId, allSubsystemIds)` returns 12 angle assignments: focused = 120°, others split 240° equally (~22° each).
2. With no focus, returns 12 equal angles of 30°.
3. The function is deterministic; same input → same output.

**GREEN**: hook `sectorAngles` into the radial layout: when state has `focusedId`, recompute the angle assignment and animate node positions via CSS transition (`transition: cx 600ms cubic-bezier(0.33, 1, 0.68, 1), cy 600ms cubic-bezier(...)`). Viewport softly zooms via `setViewport(target, { duration: 600 })`. No re-rooting — product stays at (0, 0).

### Slice B3 — Greyscale focus

**Files touched**: `src/lib/focusedSubset.ts` (new), `src/components/RadialNode.tsx`, `src/components/RadialEdge.tsx`, `tests/focusedSubset.test.mjs`.

**RED tests**:
1. `focusedSubset(focusId, graph)` returns the set of nodes that should stay full saturation: focusId + descendants via `requires`.
2. All other nodes appear in the desaturated set.
3. Edges connecting two focused nodes are full; otherwise desaturated.

**GREEN**: apply `saturate(0)` filter via CSS class to non-focused nodes and edges. Use `transition: filter 400ms` so the cross-fade is smooth on focus change.

### Slice B4 — Detail panel rail (P1 collapsed ↔ expanded)

**Files touched**: `src/components/NodeDetailPanel.tsx` (significant rewrite), `src/app/graph/page.tsx`, `tests/detailRail.test.mjs`.

**RED tests**:
1. Default state renders a 64px-wide rail with focused node name + maturity badge.
2. Clicking the rail expands to 400px and reveals description, metrics, evidence, etc.
3. Switching focus (state change) keeps the rail/expanded state and cross-fades content.
4. Pressing Esc collapses the panel and clears focus.

**GREEN**: rewrite NodeDetailPanel as a controlled component with two states. Content stays the same as today's panel (metrics, evidence, upstream/downstream, sibling products, cost rollup) but rendered inside the 400px expanded panel. Cross-fade content via `key={focusId}` + CSS opacity transition.

End of Phase B — the surface delivers progressive discovery: default radial overview, click-to-focus with elastic sector expansion and greyscale, color mode at three layers, detail panel that doesn't dominate.

---

### Slice C1 — Recursive Level-2 elastic

**Files touched**: `src/lib/sectorAngles.ts`, `src/components/GraphExplorer.tsx`, `tests/sectorAngles.test.mjs`.

**RED tests**:
1. When `focusedPath = [subsystemId, subSubsystemId]`, the sub-subsystem's sub-angle within the parent's 120° expands from default to 80°.
2. Levels deeper than 2 do not modify geometry — they only change viewport zoom.

**GREEN**: generalize `sectorAngles` to take a focus *path*, not just a single id. Recursive elastic expansion limited to 2 levels; level 3+ keeps geometry static.

### Slice C2 — Cmd+K search

**Files touched**: `src/components/CmdKSearch.tsx` (new), `src/components/AppHeader.tsx` (register hotkey), `tests/cmdK.test.mjs`.

**RED tests**:
1. Pressing Cmd+K (Ctrl+K on Linux/Windows) opens a centered modal with a search input.
2. Typing fuzzy-matches against node names, metric titles, evidence summaries.
3. Pressing Enter on a result calls the graph's flyTo + focus action.

**GREEN**: minimal implementation. Use a small fuzzy library (Fuse.js if not already in package.json — else implement minimal levenshtein). Modal closes on Esc and on selection.

### Slice C3 — Glyph language for top-N priorities (retires the pill banner)

**Files touched**: `src/components/GraphExplorer.tsx`, `src/components/TopNGlyph.tsx` (new), `tests/topNGlyph.test.mjs`, update `docs/design-principles.md` exceptions table.

**RED tests**:
1. The current high-risk pill banner is removed from the DOM.
2. The top-N highest-risk nodes (by current color mode) render with a visible glyph overlay (small star, ring, or other agreed marker) at band 2+.
3. The glyph is configurable: top-3, top-5, top-10.

**GREEN**: design and ship one glyph treatment. Update `docs/design-principles.md` to mark the exception as retired with the date and PR link.

End of Phase C — all design principles are observed without exceptions; the surface is feature-complete for v1.

---

## Out of scope for this spec

- Sibling product compare. The 6 sibling product nodes under the parcel-sorting capability continue to navigate via `/product/<id>` until a future spec designs a compare surface in the radial view.
- Entry animation (radial fan-out from product center).
- Mobile / small-screen adaptation. The radial view assumes a desktop viewport (≥ 1280×720).

## Verification per slice

Each slice's PR runs:

- `npm run lint`
- `npm run check:graph-ux`
- `npm test` (unit tests added in the slice)
- `npm run verify`
- Per slice's RED → GREEN: confirm the RED commit's test fails on `main` and passes on the GREEN commit.

End of each phase: full UX-flow tour (`docs/ux-flow-tours.md`) for the affected flows, written report under `docs/ux-flow-reports/`.

## Risk register

| Risk | Mitigation |
|---|---|
| Custom radial layout has unforeseen edge cases (e.g., a subsystem with 30+ descendants overflowing its 30° default sector) | Slice A2 includes a fixture with one extreme subsystem; assertion ensures node spacing remains > 2× node diameter |
| LOD band switch causes flicker at exact boundary | Quantize zoom subscriber to `Math.floor(zoom * 2)` so band change fires once, not repeatedly |
| Cross-sector arcs visually overwhelm at default zoom (band 1) | Render cross-arcs at 30% opacity at band 1, full at band 2+ |
| Schema migration of bottleneck nodes loses data | Migration script is dry-run-by-default; manually inspect the diff before committing |
| Color-blind users still can't read mode bands despite redundant encoding | Redundant edge thickness + sector tint give 2 fallback channels; future addition: a pattern overlay if users report issues |

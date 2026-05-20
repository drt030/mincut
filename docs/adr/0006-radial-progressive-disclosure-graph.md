---
status: accepted, amended by ADR-0007
---

# Radial progressive-disclosure graph

> **2026-05-20 amendment**: ADR-0007 (`docs/adr/0007-stable-balanced-radial-tree.md`) supersedes the equal fixed-sector and recursive elastic-sector parts of this ADR. The retained direction is radial progressive disclosure, stable spatial memory, semantic zoom, analysis overlays, and a detail rail/lens. The amended direction is a Stable Balanced Radial Tree: first make the radial tree readable and evenly distributed, then express subsystem grouping as a soft visual layer.

## Context

The `/graph` surface as of 2026-05-12 (HEAD 38cb47b) has three deep UX failures, confirmed during a 2026-05-13 grilling session against fresh 1440×900 screenshots:

1. **Information overload at default.** First viewport at 1440×900 shows simultaneously: 3 mode tabs, 5 toolbar buttons, color-mode dropdown + 5-stop legend, 4 high-risk dependency banner pills, 5 high-risk pills, 3-row KPI counter, 13-node canvas (with cost/maturity badges on every card), and a 200px detail panel. New users cannot tell what to attend to.

2. **Click loses spatial context.** Clicking a node re-roots the layout (the clicked `focusId` becomes the new layout center via `explorationLayout`), the page auto-scrolls to the new canvas mid-region, the toolbar leaves the viewport, the focused node visually transforms from a green overview card to a small blue focused card. Users report "I don't know where I am anymore."

3. **DAG rendered as fake tree.** `explorationLayout` truncates shared edges; a shared node (e.g., `alloy_steel_precision_material` with 6 `requires` parents) only renders under whichever parent reaches it first during DFS. The BOM topology of the data — which the user actually cares about — is invisible.

The 2026-05-10 redesign (`docs/superpowers/specs/2026-05-10-graph-redesign.md`) made the surface usable (it shipped two-stage overview/focused, color modes, layout reflow on expand) but did not address spatial continuity, DAG honesty, or information density.

## Decision

Replace the rectangular-Sugiyama React Flow graph with a **radial progressive-disclosure** model.

The full DAG of all *structural* nodes is laid out once at startup in polar coordinates around the focal product. *Descriptive* nodes appear only in the detail panel as text. Interaction is via semantic zoom and elastic sector expansion. Spatial coordinates of nodes never change — only the angular distribution of sectors, the viewport, and visual saturation.

### Node classification

| Category | Count (current data) | Where shown |
|---|---|---|
| **Structural** (`product`, `module`, `material`, `engineering_method`, `manufacturing_process`) | 77 | Canvas |
| **Descriptive** (`metric`, `bottleneck`, `placeholder_breakthrough`, `scientific_principle`, `empirical_principle`, `standard_or_regulation`, `capability`) | 33 | Detail panel only (as text) |

Bottleneck and frontier status, currently encoded as dedicated `kind`s, become **attributes** on the affected structural nodes. A node is a "bottleneck" because of its mode-derived color (low maturity, high cost, high risk), not because it has a separate placeholder node sitting next to it.

### Layout

- Focal product at canvas origin (0, 0).
- 12 first-layer subsystem modules positioned at equal angular spacing on a ring of radius R₁ around the product (default 30° each).
- Each first-layer subsystem owns an angular sector. All `requires`-descendants of that subsystem are placed in concentric radial layers within its sector.
- Shared nodes (modules with 2+ `requires` parents — 19 in current data) are assigned to a canonical primary parent's sector by deterministic heuristic (highest parent count, ties broken by id hash). Secondary parents render as dashed cross-sector arcs to the canonical position.
- Materials (10 nodes) sit in an outermost ring at radius R_outer, rendered in neutral grey. Each material has dotted cross-sector links from every subsystem that consumes it.
- Position is computed once for the full DAG and **never recomputed on focus** — only sector angles and viewport change.

### Color

- Each first-layer subsystem owns one of 12 distinct hue families (HSL hues spread across the wheel).
- Descendants within a sector inherit the family hue.
- At LOD band 1 (zoom < 0.5, ~5px nodes), node fill = pure family hue, no lightness variation.
- At LOD band 2+, node fill applies a 3-step lightness gradient by depth within sector (root brightest, leaves dimmest).
- Materials and shared cross-cutting modules whose primary-parent assignment is arbitrary use neutral grey.
- Node fill is **never overridden** by color mode — subsystem hue is the permanent spatial identity signal.

### Color mode (cost / maturity / risk) — K4 layering

Three concurrent layers, redundantly encoded:

| Channel | Encodes |
|---|---|
| Edge stroke color | Target node's mode band (5 steps, cool→warm) |
| Edge stroke width | Same 5 bands (0.5 / 1 / 1.5 / 2.5 / 4 px) — redundant with color for accessibility and small-scale legibility |
| Sector background tint | Aggregate of nodes in sector (max for risk, p50 sum for cost, mean for maturity), <15% opacity |
| Node outline (band 2+) | Per-node mode band |
| Node fill | Subsystem hue — never overridden |

Bin alignment: edge color bands and edge thickness bands use the same thresholds, so a thick edge is always also the corresponding color. Mismatched binning would create visual contradiction.

### LOD (semantic zoom)

Three discrete bands; node and edge components subscribe via `useStore((s) => Math.floor(s.transform[2] * 2))` so they re-render only on band crossing, not on every zoom delta:

- **Band 1** (zoom < 0.5): 5px circular dots; no labels; edges 0.5–4px per mode band.
- **Band 2** (0.5 ≤ zoom < 1.5): 12px markers with truncated name; lightness gradient on; mode-band outline.
- **Band 3** (zoom ≥ 1.5): 80×40 cards with full name + 1 mode-relevant badge; cross-edges show arrowheads; sector labels at outer perimeter become visible.

Subsystem name labels are rendered **inside the canvas** at each sector's outer perimeter (band 2+), not as toolbar chrome.

### Focus interaction

Click a structural node X:

1. X's sector expands radially from 30° → 120° over 600ms (cubic-out easing).
2. Other 11 sectors compress proportionally (~22° each).
3. X and all of X's descendants stay full saturation; ancestors, siblings, sibling subtrees, and all other sectors desaturate to greyscale (positions preserved).
4. Viewport pans and zooms (≈ 1.5× total zoom) to roughly center X.
5. No re-rooting; the focal product remains at canvas origin throughout.

**Level 2** (click a node within an already-expanded sector): the clicked sub-subsystem expands its sub-angle 30° → 80° within the sector's 120°; greyscale and zoom recursion compose.

**Level 3+**: pure viewport zoom; geometry no longer changes.

**Exit focus**: Esc / empty click / double-click current focus → reverse animation to the next-higher level. From Level 1, returns to full overview.

**Cross-focus**: click a node in a different sector → previous sector contracts to 30°, target sector expands to 120°, saturation cross-fades. No camera jump.

### Detail panel

Right-edge rail, replacing the current side panel:

- **Default state**: 64px wide. Shows focused node name + 1 critical badge (maturity or cost). Hints "more detail available."
- **Expanded state**: clicks-to-400px wide. Shows description, metrics (folded from `kind: "metric"` records), evidence, bottleneck description (from former bottleneck-kind nodes), frontier note (from former placeholder_breakthrough nodes), upstream / downstream summary, sibling products, cost rollup, regulations, principles.
- Content cross-fades on focus change; rail/expanded state persists.

### Chrome (toolbar)

**Deleted entirely**:
- 3 mode tabs (overview / bottleneck / full graph)
- "收起所选" / "查看瓶颈" / "回到全局" buttons (replaced by Esc, empty click, double-click)
- Display options (toggle metric-as-node — metrics are never on canvas anymore)
- Advanced filters (4 dropdowns: domain / kind / relation / maturity)
- KPI counter row ("visible nodes / direct deps / bottlenecks")
- "图谱浏览器" page heading (redundant with route)

**Kept, relocated**:
- Color mode + 5-stop legend: bottom-left floating icon button, expands to full selector on click.
- Subsystem name labels: rendered inside the canvas at sector outer perimeters (band 2+).
- Cmd+K search: no visible button; fuzzy-searches node names and metric/evidence text; Enter flies-to.
- Zoom +/-/0: keyboard only.
- Global header (能力图谱探索器 + 中英 + nav): unchanged.

**Transitional exception** (see `docs/design-principles.md`):
- High-risk dependency pill banner survives at the top of the canvas until a glyph language for top-N priorities exists. Retire in Phase C.

### Data model implications

- `kind: "bottleneck"` (3 nodes) and `kind: "placeholder_breakthrough"` (2 nodes) become deprecated. New optional attributes on existing structural nodes:
  - `bottleneckOf?: string[]` — id list of capabilities this node currently bottlenecks
  - `frontierFor?: string[]` — id list of capabilities this node is a decomposition frontier for
  - Walker (`costRollup`, `nodeRisk`) and gate reporter read these attributes.
- `kind: "metric"` (24 nodes) is no longer rendered on canvas. Records remain; `measured_by` edges remain; folding happens at the render layer.
- `bottlenecked_by` edges (9 in current data) become deprecated; semantic moves into the `bottleneckOf` attribute.

Migration script ships with the schema update; existing graph data is rewritten in place.

## Consequences

**Positive**

- Spatial memory is preserved across all interactions. The focal product is always at canvas origin; each subsystem always lives in the same angular range. Users always know where they came from.
- DAG topology is honest. Shared materials and shared infrastructure are visually first-class via cross-sector arcs and the material ring.
- Information density at default drops dramatically. ~110 small markers, almost no chrome competing for attention. The three design principles (progressive discovery, geometry is the answer, visual language not lists — see `docs/design-principles.md`) are observable directly in the default view.
- Color mode and node hue coexist instead of competing. Redundant encoding (color + thickness) makes mode signals legible at small scale and for color-blind users.

**Negative**

- Implementation cost: 9–10 spec slices, replaces large parts of `GraphExplorer.tsx` and `explorationLayout.ts`. Estimated multi-week effort phased across A / B / C in the slice spec.
- Custom radial layout (no off-the-shelf engine for our shared-node + outer-ring requirements) — we write `radialLayout.ts` as a pure function over the static graph.
- Some advanced power-user features (filter dropdowns, mode tabs) disappear from v1. Filtering returns as a future surface after the progressive-discovery flow stabilizes.
- The transitional exception (top-N pill banner) is debt until Phase C designs its glyph replacement.

**Deferred to future work**

- Sibling product compare in the radial view (mentioned in old `GRAPH_UX.md`; the current 6 sibling products under the parcel-sorting capability still navigate via `/product`).
- Entry animation (radial fan-out from product center).
- Full cmd+K implementation.
- Glyph language for top-N priorities (the retirement criterion for the high-risk pill banner).

## Status

Accepted 2026-05-13 after a grilling session captured in this ADR's context.

**Supersedes**:
- `docs/superpowers/specs/2026-05-10-graph-redesign.md` slices 2 (color modes), 3 (explorationLayout reflow), 4 (two-stage exploration) — the radial model replaces them.
- `docs/GRAPH_UX.md` rules under "Default View Model", "Layout Rules", "Edge Rules", "Node Rules", "Interaction Rules", "View Modes" — those sections updated to reference this ADR.

**Implementation**: `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`.

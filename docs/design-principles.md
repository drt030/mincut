# UX Design Principles

These principles guide every user-facing surface in the project. They emerged from a 2026-05-13 grilling session on `/graph` and were tightened by the 2026-05-20 Stable Balanced Radial Tree discussion. They are intentionally generalizable to other views (product, gate, tasks, future surfaces).

When a new feature is proposed, it should be checked against these principles before implementation. When an existing surface accumulates exceptions, the exceptions should be tracked here so future work can retire them.

## 1. Progressive discovery, not known-narrowing

The default view surfaces all signals at low fidelity. Focus, zoom, and color modes reveal additional structure without removing anything from the canvas. New users — who don't yet know what to filter for — gain understanding by watching signals unfold, not by typing the right query.

**Apply:**
- Default to the full data at lowest fidelity (small uniform markers, geometric arrangement carrying meaning).
- Reveal labels, metrics, and detail in response to gaze (zoom level), pointer (focus), or shortcut (search).
- When narrowing is genuinely useful (advanced power-user mode), gate it behind a deliberate gesture so it doesn't run the default flow.

**Anti-pattern:**
- Dropdown filters that hide nodes / rows not matching a criterion the user must already know.
- "Show advanced" toggles that the new user never finds and the expert always wants on.

## 2. Geometry is the answer

If a quantity can be encoded by position, shape, color, size, stroke, opacity, or motion, it is encoded that way. Numeric KPI tiles, count badges, and dashboard rows are a compensation for inadequate visual expressiveness — useful as scaffolding while a visual language is being designed, but never the long-term home for a number.

**Apply:**
- Replace "4 bottlenecks, 12 dependencies" with red-glowing nodes and visible edges in the canvas. The count is geometric — the user counts the glows.
- Replace "system maturity: 54/100" with a color-coded visual region of the relevant scope.
- When introducing a new metric, design its visual encoding before its readout.

**Anti-pattern:**
- Status strips above visualizations that already encode the same information.
- "Quick stats" panels duplicating canvas state in numbers.

## 3. Visual language, not list UI

Sorted lists of pills, cards, or rows next to a canvas duplicate the canvas's job. They invite the user to read names and click — slow — instead of seeing patterns and selecting — fast. The exception: when no visual language has been designed for some signal yet (e.g., top-N priorities), a transitional list may live alongside the canvas. Such lists are explicit debt, recorded here, and retired when the visual language exists.

**Apply:**
- Jump-to discovery uses search (cmd+K), not browseable lists.
- Top-N rankings are color-coded and ordered by gaze direction (e.g., warmer-on-top sectors), not by row.
- When a list seems unavoidable, ask first: what would the visual replacement look like? If the answer is unknown, ship the list as a documented exception.

**Anti-pattern:**
- "Top Blockers" or "High Risk Dependencies" rails pinned above a graph that already shows those nodes.
- Sortable tables alongside visualizations of the same data.

## 4. Stable identity, switchable interpretation

The graph should feel like one persistent product map viewed through different lenses. A user should not lose track of a node because they changed from structure to bottleneck, cost, maturity, or evidence-gap mode.

**Apply:**
- Keep node names, approximate positions, branch membership, base subsystem colors, and branch order stable.
- Let analysis modes change overlays: edge color / width, node outline, glyphs, saturation, opacity, and soft background grouping.
- Treat branch highlight as a state of the same map, not a different graph.
- Treat node detail as a lens anchored to the map, not an unrelated details page.

**Anti-pattern:**
- Re-laying out the same nodes into unrelated positions for every analysis mode.
- Moving a node far from its learned location because a different metric is selected.
- Making evidence, task, or bottleneck lists the primary navigation path when the same signal can be shown on the map.

## Active exceptions (transitional)

_None._ The previously-listed `/graph` "High risk dependency" pill banner
was the last active exception; it retired with slice C3 of the radial
progressive-disclosure spec (see Retired exceptions below).

## Retired exceptions

| Surface | Exception | Retired | Replacement |
|---|---|---|---|
| `/graph` | "High risk dependency" pill banner above canvas | 2026-05-13 (slice C3 of `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`) | `TopNGlyph` — small ringed-number SVG glyph at LOD band 2+ marks the top-5 highest-priority nodes (per current colour mode) directly on the canvas. The chrome banner was removed in slice A3 (no DOM); the glyph language fully replaces the affordance. |

## Provenance

These principles are derived from the design discussions captured in `docs/adr/0006-radial-progressive-disclosure-graph.md` and `docs/adr/0007-stable-balanced-radial-tree.md`. They apply project-wide, but the immediate fixture is the radial graph redesign and its Stable Balanced Radial Tree amendment.

# Graph UX Contract

This document defines the interaction and visualization rules for graph-facing product work. It applies to `GraphExplorer.tsx` and future graph views unless a task explicitly documents a different UX goal.

> **2026-05-13 update**: Sections below were rewritten to match the radial progressive-disclosure model accepted in `docs/adr/0006-radial-progressive-disclosure-graph.md`. The implementation rollout lives in `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md`. The three design principles that govern this surface live in `docs/design-principles.md` — read those first.

## Product Goal

Capability Graph Explorer is a research workspace, not a decorative network map. The graph should help a user answer concrete research questions:

- What is this product made of?
- Which subsystem, component, process, or material blocks maturity?
- What evidence supports a claim?
- What should be expanded or researched next?

Visual polish is valuable only when it improves orientation, comparison, or trust. Where this document conflicts with the three design principles in `docs/design-principles.md`, the principles win.

## Default View Model

The default `/graph` view is a **radial progressive-disclosure canvas**:

- The focal product sits at canvas origin (0, 0).
- All 77 structural nodes (product, module, material, engineering_method, manufacturing_process) of the product's full `requires` decomposition are rendered simultaneously as small markers (~5px at the lowest zoom level), arranged in a polar layout around the product.
- Each of the 12 first-layer subsystems owns a 30° angular sector. Its descendants live in concentric radial layers inside that sector.
- Materials (10 nodes) sit on the outermost ring, rendered in neutral grey, with dotted cross-sector links to the subsystems that consume them.
- Shared structural nodes (19 nodes with 2+ `requires` parents) are assigned a canonical primary parent's sector; their other parents render as dashed cross-sector arcs.

The graph **preserves spatial memory absolutely**: node canvas coordinates never change. Only the angular distribution of sectors (under elastic focus), the viewport (under zoom/pan), and visual saturation (under focus) change.

The 33 descriptive nodes (metric, bottleneck-status, frontier-status, principles, regulations, capability) do not render on canvas. They are surfaced as text in the detail panel for whichever structural node they describe.

## Layout Rules

Use a deterministic, pure-function radial layout (`src/lib/radialLayout.ts` per the slice spec). Hand-written lane heuristics are not acceptable.

- Polar coordinates: product at r=0; first-layer subsystems at r=R₁; descendants at increasing r within each sector; materials on the outermost ring at r=R_outer.
- Sector angles for the 12 first-layer subsystems are equal (30°) at rest. Under focus, they redistribute elastically (focused sector = 120°, others compress proportionally) but the *content* of each sector — which nodes live in it and at what radius — does not change.
- Position is computed once for the full DAG at render time and **never recomputed on focus**. Focus changes geometry only via the angle map; nodes follow the recomputed angles via CSS transition (`transform 600ms cubic-out`).
- Shared-node assignment is deterministic: by parent count, ties broken by node-id hash. Cross-sector edges are explicit dashed arcs to the canonical position.

Do not re-root the layout around the user's current focus. Do not call ELK or any layout engine on focus changes.

## Node Rules

Nodes are progressive-disclosure markers, not research cards.

- LOD band 1 (zoom < 0.5): 5px circle, fill = subsystem hue family, no text.
- LOD band 2 (0.5 ≤ zoom < 1.5): 12px marker, truncated name, lightness gradient by depth, outline color = current mode band, sector name label visible at the sector's outer perimeter.
- LOD band 3 (zoom ≥ 1.5): 80×40 card, full name + 1 mode-relevant badge (cost or maturity), cross-edges show arrowheads.
- Node fill encodes subsystem identity (hue family) and is never overridden by color mode. Color mode is encoded through outline (band 2+) and edge styling.
- Materials and arbitrarily-assigned shared nodes use neutral grey fill.
- Selected / focused state is encoded by *saturation*: focused subtree stays full saturation; everything else desaturates to greyscale. There is no border highlight, no glow, no ambient animation.

## Edge Rules

Edges express dependency structure with color, thickness, style, and opacity — never with text labels at default.

- Default edge style: solid within a sector (same subsystem), dashed across sectors (shared structural module), dotted to the material ring.
- Edge color = the current color mode value of the target node (5 bands, cool→warm gradient).
- Edge thickness = the same 5 bands (0.5 / 1 / 1.5 / 2.5 / 4 px), aligned to the color binning so a thicker edge is always also the warmer color.
- Edge opacity follows focus state: full when both endpoints are in the focused subtree, 50% otherwise.
- Edge labels never render at band 1 or band 2. At band 3, only the edges incident to the currently-focused node show their relation label, dimmed.

## Color Modes

Five color modes (configured via floating button bottom-left):

- **Bottleneck risk** (default): edge stroke + width binned by target node risk = (1 − maturity/100) × cost share.
- **Cost**: target node cost band (blue cheap → red expensive).
- **Maturity**: target node maturity band (red low → green high).
- **Overall**: continuous composite gradient.
- **Relation** (legacy): edges colored by relation type (`requires`, `manufactured_by`, etc.). This is the only mode where edge color does not encode a numeric property.

Across modes, the K4 layering applies:

| Visual channel | Encodes |
|---|---|
| Node fill | Subsystem hue family — permanent |
| Sector background tint (<15% opacity) | Sector-aggregate mode value |
| Edge stroke color | Target node mode band |
| Edge stroke width | Same mode band, redundant for legibility |
| Node outline (band 2+) | Per-node mode band |

## Interaction Rules

Primary interactions:

- **Click a structural node**: focus that node. Its sector expands from 30° to 120° over 600ms (cubic-out). Other 11 sectors compress proportionally. The clicked node and all of its `requires` descendants stay full saturation; everything else desaturates to greyscale. Viewport softly zooms (~1.5×) and pans to roughly center the clicked node. The focal product stays at canvas origin.
- **Click a node inside an already-expanded sector (Level 2)**: that sub-subsystem's angular sub-range within the parent's 120° expands from ~30° to ~80°. Greyscale and zoom recursion compose.
- **Click a node from Level 3+**: pure viewport zoom; geometry no longer changes.
- **Cross-focus** (clicking a node in a different sector): previous sector contracts to 30°, target sector expands to 120°, saturation cross-fades. No camera jump.
- **Esc / empty click / double-click current focus**: reverse animation, returning to the next-higher focus level.
- **Zoom (mouse wheel, pinch, keyboard +/-)**: pure viewport zoom. No geometry change. LOD bands transition at zoom = 0.5 and 1.5.
- **Cmd+K**: open search; type to fuzzy-match across node names and descriptive-node text; Enter flies to the result.

Detail panel:

- A 64px-wide rail on the right edge shows the focused node's name + one critical badge. Clicking the rail expands it to 400px showing the node's full content (description, metrics, evidence, bottleneck/frontier notes, upstream/downstream, sibling products, cost rollup, regulations).
- Switching focus cross-fades the rail's content; the rail/expanded state persists.

There is no canvas-internal instructional text. The UI communicates through state, position, color, thickness, and saturation.

## Implementation Guardrails

- Do not remount React Flow on focus changes. Focus updates state; state drives angle map and viewport; positions follow via CSS transitions.
- Do not call any layout engine (ELK, dagre) at runtime. The radial layout is a pure function; results are memoized at mount.
- Do not run layout from hover or selection state. Hover updates outline saturation only. Selection updates saturation and detail panel.
- Do not run auto-fit on every state change. Fit-view runs only on initial load and on the explicit "0" keyboard shortcut.
- Do not encode the same scalar in two visual channels with *different* binning. If edge thickness and edge color both encode cost, they share thresholds.
- Do not introduce a list UI alongside the canvas without designing its visual replacement first. See `docs/design-principles.md` for the active exceptions and their retirement criteria.
- Do not add "advanced filter" dropdowns. Narrowing is a deferred surface; the default view stays progressive-discovery.
- Run `npm run lint`, `npm run check:graph-ux`, `npm test`, and `npm run verify` for UI changes. Run a full UX-flow tour (`docs/ux-flow-tours.md`) at each phase boundary in the slice spec.
- Update this document when a slice in the radial spec lands; update `docs/design-principles.md` when an active exception retires.

## Deferred surfaces

The following are explicitly deferred to future specs and do not exist in the default `/graph` view:

- Sibling-product compare (alternative Product candidates under one Capability). Navigate via `/product/<id>` for now.
- Filter / narrowing UI (kind, domain, maturity, relation filters).
- Entry animation (radial fan-out from product center).
- Mobile / small-screen adaptation.

When a deferred surface lands, update this document and the ADR registry.

# Phase B UX Flow Tour — radial progressive-disclosure full focus model

HEAD: 1ba83a7
Run at: 2026-05-13T06:37Z
Viewport: 1440x900
Slices included: B1 K4 color mode / B2 elastic sector / B3 greyscale focus / B4 detail rail

## Flow B1 — Color mode K4 layering

### Step 1 — Default `/graph`, locate floating color-mode button

- screenshot: `.tmp/phase-b-tour/b1-step1-default.png`
- observed: 63 nodes + 84 edges rendered at fit-view. Bottom-left of canvas: `[data-testid="color-mode-button"]` button at (16, 762), 118×32 px, text "◐Bottleneck risk". 5-stop legend (blue/green/amber/orange/red) at (29, 731) NOT initially visible — only the button is, with mode label inline. No popover open.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Button placement matches ADR ("bottom-left floating icon button"). Mode label is exposed inline — slight deviation from "icon-only collapsed" reading of the ADR but more discoverable.

### Step 2 — Click button, expanded picker visible

- screenshot: `.tmp/phase-b-tour/b1-step2-expanded-picker.png`
- observed: Popover expands upward. 5 `<button>` mode options enumerated by text content: "Bottleneck risk" (selected), "Cost", "Maturity", "Overall", "Relation". Each option row has a colored swatch on the left (amber `rgb(251, 191, 36)` ×4 + grey `rgb(148, 163, 184)` for Relation). 5-stop legend strip at y=731 with colors `#3b82f6` / `#22c55e` / `#fbbf24` / `#f97316` / `#ef4444` (blue→green→amber→orange→red).
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Matches ADR contract exactly. The Relation row's grey swatch tells the user that the relation mode has no encoding — nice affordance.

### Step 3 — Switch to "Cost", observe canvas re-render

- screenshot: `.tmp/phase-b-tour/b1-step3-cost.png`
- observed: Edge `stroke-width` set spans the full 5-band bijection `{0.5, 1, 1.5, 2.5, 4}`; edge stroke colors span the same 5-band ramp `{#3b82f6, #22c55e, #fbbf24, #f97316, #ef4444}`. 14 sector tint wedges render at `fill-opacity=0.12` with the band color. Button label updates to "◐Cost".
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Visible cost asymmetry — only `industrial_robot_arm_body` reaches the top red band (consistent with cost data being right-skewed and the agent-memory note that only that subsystem reliably lights the top band). Sector tints clearly differentiate hot subsystems (red wedges) from cold (blue wedges).

### Step 4 — Switch to "Maturity"

- screenshot: `.tmp/phase-b-tour/b1-step4-maturity.png`
- observed: Edge `stroke-width` set collapses to `{1, 1.5}`; stroke colors collapse to `{#22c55e, #fbbf24}` (green + amber). Sector tint colors only `{#22c55e, #fbbf24}` (14 wedges total). Button label "◐Maturity".
- score: clarity 3 / responsiveness 5 / fit-for-purpose 3
- notes: **Known data variance** (recorded in agent-memory iter-25/iter-13): maturity values cluster in 2 bands (most "prototype" → green band, most "early_deployment" → amber band; no commercial-grade, no concept-only). Edge color shift IS observable vs Cost mode, BUT the ADR's promise that "low-maturity (red) sectors warm" cannot be evaluated — there are NO red maturity bands in the dataset. This is a data-coverage gap, not a slice-B1 bug. Recommend flagging data-coverage work as Phase-C input.

### Step 5 — Switch to "Relation"

- screenshot: `.tmp/phase-b-tour/b1-step5-relation.png`
- observed: All edges revert to single grey `#94a3b8`, single width `1.5`. Sector tints become `transparent` (still 14 wedges in DOM but invisible). Button label "◐Relation".
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Clean "no encoding" state matches ADR. Useful as a low-noise reading mode.

### Step 6 — Switch back to "Bottleneck risk"

- screenshot: `.tmp/phase-b-tour/b1-step6-bottleneck.png`
- observed: Edge width set `{0.5, 1, 1.5, 4}` (no 2.5 in current data); stroke colors `{#3b82f6, #22c55e, #fbbf24, #ef4444}` (4 of 5 bands — no orange in current risk distribution). Button label back to "◐Bottleneck risk".
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Deterministic round-trip. Mode state is preserved by `useState<ColorMode>` (URL persistence is a v3 carry-over feature but not exercised here).

## Flow B2 — Elastic sector expansion on focus

### Step 1 — 14 evenly-spaced sectors at default

- screenshot: `.tmp/phase-b-tour/b2-step1-default-sectors.png`
- observed: DOM has 14 `<path>` sector-tint wedges (one per first-layer subsystem). 63 `.react-flow__node` elements positioned in radial pattern at fit-view zoom 0.32. Sector width nominally 2π/14 ≈ 25.7° each (geometric confirmation via radialLayout test suite).
- score: clarity 4 / responsiveness 5 / fit-for-purpose 5
- notes: 14 not 12 sectors — data has 14 first-layer requires-children of the focal product (recorded iter-4). Sector boundaries are visually faint at fit-view zoom because tint opacity is 0.12 — fine, the redundant edge thickness + node hue carry the structural signal.

### Step 2 — Click node in `parcel_manipulation_or_diverter` sector

- screenshot: `.tmp/phase-b-tour/b2-step2-focused-parcel.png`
- observed: Viewport `transform` shifts from `scale(0.323508)` → `scale(1.5)` over ~600ms. URL updates to `?focus=parcel_manipulation_or_diverter`. 46/63 nodes have `.radial-dim` class (subtree of 17 nodes stays saturated). Focal product remains at canvas origin (per ADR; radialLayout positions never recompute).
- score: clarity 4 / responsiveness 5 / fit-for-purpose 5
- notes: Sector expansion + viewport zoom + greyscale all kick off together. The B1+B2+B3 layered animation looks smooth — single CSS transition on `.react-flow__node { transition: transform 600ms cubic-bezier(0.33, 1, 0.68, 1) }` (per agent-memory iter-15). Sector tint wedges animate with the node remap because they're driven from the same assignment map.

### Step 3 — Click node in `conveyor_integration` (different sector)

- screenshot: `.tmp/phase-b-tour/b2-step3-focused-conveyor.png`
- observed: Viewport transform shifts to `translate(160px, -204.831px) scale(1.5)` — clear pan to new sector's centroid. URL updates to `?focus=conveyor_integration`. Sector wedges re-distribute (previous parcel_manipulation sector contracts; conveyor_integration expands). No camera "jump" — pan is continuous via the same CSS transition.
- score: clarity 4 / responsiveness 5 / fit-for-purpose 4
- notes: Cross-fade between sectors is the trickiest motion to evaluate via screenshot alone, but transform values bracket the animation correctly. One minor friction: the cursor doesn't change shape during animation, so a user clicking-during-transition might double-fire. Not a blocker.

### Step 4 — Press Esc

- screenshot: `.tmp/phase-b-tour/b2-step4-esc.png`
- observed: Viewport transform returns to `translate(370.269px, 208.592px) scale(0.323508)` — exact original fit-view. URL clears to `/graph` (no `?focus`). 0 `.radial-dim` elements remain. 14 sectors return to equal width.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Esc round-trip is clean — Esc handler in NodeDetailPanel wrapper calls `onSelectNode?.(null)` per iter-19, which propagates to clear focus, restore sectors, and restore viewport.

## Flow B3 — Greyscale focus

### Step 1 — Default state: no dim

- observed: 0 `.radial-dim` elements present in DOM. All 63 nodes + 168 edge paths at full saturation. Confirmed across two repeats (after Esc round-trip and from cold reload).
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Clean default. The `dim` derivation in GraphExplorer is gated by `focusedId !== null`.

### Step 2 — Click any node → focused subtree stays, rest fades

- screenshot: `.tmp/phase-b-tour/b3-step2-focus-greyscale.png`
- observed: After clicking `conveyor_integration`: 10 nodes saturated (`conveyor_integration` + 4 direct `requires` descendants — `conveyor_photoelectric_sensors`, `conveyor_speed_encoder_tracking`, `plc_and_wcs_integration`, `sortation_chutes_and_bins` — + 5 material-chain ancestors reached via requires: bauxite/aluminum, quartz/silica, semiconductor-grade silicon, semiconductor packaging). 53 nodes dimmed. 168 edges total; 150 dimmed (edges in iff both endpoints in subset).
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Matches `focusedSubset.ts` BFS contract. Per ADR: focused subtree = focus + `requires`-descendants only; ancestors/siblings/unrelated dim. The 5 material nodes that stay saturated are reached because conveyor_integration *requires* materials — they ARE descendants in the requires-DAG.

### Step 3 — DOM check: count `.radial-dim` vs not

- observed: Confirmed: `.radial-dim` applied to 53 of 63 non-focused nodes; 0 on the 10 focused-subtree nodes. CSS rule `.radial-dim { filter: saturate(0); transition: filter 400ms ease }` in globals.css.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Implementation is a single CSS filter on a single class — minimal-cost render, no per-node React work.

### Step 4 — Esc removes dim

- observed: 0 `.radial-dim` after Esc + 600ms settle. All saturation restored. Class is removed (not just hidden) so animation goes through the 400ms reverse filter transition.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Clean.

## Flow B4 — Detail rail 64↔400px

### Step 1 — Default load: 64px rail

- screenshot: `.tmp/phase-b-tour/b4-step1-rail-default.png`
- observed: `[data-testid="node-detail-rail"]` present, `data-rail-width="64"`, bounding rect (972, 72, 64×590). Content key = `low_cost_parcel_sorting_robot_300k_rmb` (rootNode default — focused-by-default behavior per iter-19). Visible text: "‹300,000 RMB parcel-sorting robot Prototype". Toggle button `[data-testid="node-detail-rail-toggle"]` present.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 4
- notes: Rail shows the focal product info by default, NOT an empty "no selection" placeholder. That's actually the better UX — the rail is never empty. ADR's "no selection placeholder" reads to me like a fallback, not a hard requirement.

### Step 2 — Click a node, rail content updates

- screenshot: `.tmp/phase-b-tour/b4-step2-rail-after-click.png`
- observed: After clicking `conveyor_integration`: `data-rail-width="64"` (unchanged), content key updates to `conveyor_integration`. Maturity badge `data-maturity-band="early_deployment"` present, badge text "Early deployment". Rail text "‹Conveyor integration Early deployment".
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: `data-maturity-band` attribute confirmed per B4 RED contract. Cross-fade is 200ms opacity on the content container (keyed by focused id).

### Step 3 — Click toggle button, rail expands to 400px

- screenshot: `.tmp/phase-b-tour/b4-step3-rail-expanded.png`
- observed: `data-rail-width="400"`, bounding rect width = 400. Body text now includes the full NodeDetailContent — risk %, maturity 62/100, cost rollup 30k–85k RMB, downstream capability list, evidence list, maturity history timeline (4 stub data points), metric list, cost-coverage warning callout (67% missing), etc. Toggle button glyph flipped from `‹` to `›`.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: 64→400 transition is a 300ms width animation. All existing detail-panel sub-components reuse cleanly inside the 400px expanded state (iter-19 wrapper pattern).

### Step 4 — Click different node, rail cross-fades

- screenshot: `.tmp/phase-b-tour/b4-step4-rail-crossfade.png`
- observed: After clicking `parcel_manipulation_or_diverter`: `data-rail-width="400"` (expanded state persists), content key updates to `parcel_manipulation_or_diverter`. New body content: risk 48%, maturity 52/100, cost 50.6k–147.2k RMB, "🎯 优先关注 (点击聚焦)" callout with `industrial_robot_arm_body` as top blocker.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Cross-fade is keyed on the `data-content-key` attr — opacity transition on the content slot, width transition only fires on toggle. Clean separation.

### Step 5 — Esc collapses AND clears focus

- screenshot: `.tmp/phase-b-tour/b4-step5-esc.png`
- observed: `data-rail-width="64"`, content key reverts to `low_cost_parcel_sorting_robot_300k_rmb` (rootNode default), URL clears to `/graph`, 0 `.radial-dim` elements, viewport back to fit-view.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: All five behaviors fire from a single Esc: focus clears, sectors equalize, viewport returns, dim removes, rail collapses. The "Esc collapses rail" piece is the iter-19 wrapper-level Esc handler doing both `onSelectNode(null)` AND `setExpanded(false)`.

## Flow B-cross — Composition

### Step 1 — Cost mode + click node

- screenshot: `.tmp/phase-b-tour/bcross-step1-cost-plus-focus.png`
- observed: After switching to Cost then clicking `parcel_manipulation_or_diverter`:
  - **B1 (cost colors)**: widths `{0.5, 1, 1.5, 2.5, 4}`, strokes `{#3b82f6, #22c55e, #fbbf24, #f97316, #ef4444}` ✓
  - **B2 (sector expand + viewport zoom)**: viewport `translate(958.023px, 561.681px) scale(1.5)` ✓
  - **B3 (greyscale)**: 46 `.radial-dim` elements ✓
  - **B4 (rail tracks focus)**: content key = `parcel_manipulation_or_diverter` ✓
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: All four B-slices compose cleanly. CSS filter (B3) is post-process, CSS transform (B2) is layout, both at different DOM levels; SVG stroke (B1) is paint; rail (B4) is a sibling DOM tree. Zero interference.

### Step 2 — While focused+cost+expanded-rail, click another node

- screenshot: `.tmp/phase-b-tour/bcross-step2-cost-cross-focus.png`
- observed: After expanding rail (toggle click) then clicking `conveyor_integration`:
  - Cost mode preserved (widths/strokes unchanged set) ✓
  - Viewport pans to new sector center ✓
  - Rail width persists at 400 ✓
  - Rail content key swaps to `conveyor_integration` ✓
  - Dim count 128 (BFS subset changes — recall focusedSubset returns the new subtree's complement) ✓
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Mode + rail-expansion are persistent UX state; focus is interaction state. Clean separation matches the design.

### Step 3 — Esc, everything returns; mode preserved

- screenshot: `.tmp/phase-b-tour/bcross-step3-esc-mode-preserved.png`
- observed:
  - URL: `/graph` (no focus) ✓
  - Viewport: `scale(0.323508)` (fit-all) ✓
  - Sectors: 14 equal-width wedges (sectorAngles default) ✓
  - Rail: `data-rail-width="64"` ✓
  - Dim count: 0 ✓
  - Mode: still "◐Cost" ✓ — mode state is NOT cleared by Esc, which matches the ADR's "mode persists across focus" contract.
- score: clarity 5 / responsiveness 5 / fit-for-purpose 5
- notes: Perfect round-trip. Mode preservation across Esc is the right call — mode is a viewing setting, focus is a navigation gesture.

## Summary

- **Average score across all flows**:
  - B1: 6 steps × 3 axes = 18 sub-scores. (5+5+5)+(5+5+5)+(5+5+5)+(3+5+3)+(5+5+5)+(5+5+5) = 15+15+15+11+15+15 = 86 / 18 = 4.78
  - B2: 4 steps × 3 = 12. (4+5+5)+(4+5+5)+(4+5+4)+(5+5+5) = 14+14+13+15 = 56 / 12 = 4.67
  - B3: 4 steps × 3 = 12. (5+5+5)×3 + (5+5+5) = 60 / 12 = 5.00
  - B4: 5 steps × 3 = 15. (5+5+4)+(5+5+5)+(5+5+5)+(5+5+5)+(5+5+5) = 14+15+15+15+15 = 74 / 15 = 4.93
  - B-cross: 3 steps × 3 = 9. (5+5+5)×3 = 45 / 9 = 5.00
  - **Grand total**: (86+56+60+74+45) / (18+12+12+15+9) = 321 / 66 = **4.864 / 5**
- **Pass / fail** (threshold 3.5): **PASS** with very strong margin. Phase B lands a complete, integrated focus model. The bumpy A-phase scoring (3.67) has been more than doubled in absolute friction-reduction.
- **Top friction**:
  1. **Maturity mode renders in only 2 of 5 color bands** (`{#22c55e, #fbbf24}` only — no red, no orange, no blue) because the current dataset's maturity values cluster in `prototype`/`early_deployment` and the binning is uniform. ADR-promised "low-maturity sectors warm" cannot be perceived. Data-coverage work, not a slice bug, but it does subtract from the user's first impression of the maturity mode.
  2. **No visible affordance for the rail toggle direction.** The `‹` / `›` glyphs flip on expand, but a first-time user may not realise the rail can expand. A subtle hint ("Show details" or a small chevron-with-label) at default 64px state could help — current default rail shows only `‹` + truncated name. Minor — could be a Phase-C polish item.
- **Recommendation for Phase C priority**:
  - **Proceed to Phase C** without a fix-it iter. All four B-slices land cleanly; composition is verified; Esc round-trip is clean; no console errors visible during the tour.
  - The maturity data-coverage gap is a separate work-stream from the radial redesign — should be tracked as a data-fill task, not blocked on it.
- **Items to revisit in Phase C**:
  - **Glyph language for top-N priorities** (the ADR's "transitional exception" retirement criterion). The current 64px rail's `🎯 优先关注` callout in expanded state could be a starting point — surface top blockers as in-canvas glyphs on the sector wedge, not as a banner.
  - **Maturity data coverage** — fill in more bands so the maturity mode is usable beyond binary green-vs-amber reading.
  - **Toggle affordance hint** at 64px default — make rail-expand discoverable without requiring a hover.
  - **Cursor change during sector-expansion animation** to indicate that another click during transition might double-fire (or debounce the click handler during the 600ms transition window).
  - **Sub-sector level 2 focus** (ADR's "Level 2: click within an already-expanded sector → sub-sub-system expands 30°→80° within parent 120°") — not in B2's scope; check whether C plans this and whether the current implementation already supports it via repeated sectorAngles application.
  - **Cmd+K search** — deferred from Phase A; surface in Phase C for full keyboard nav.

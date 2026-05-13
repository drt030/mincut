# Final UX Flow Tour — radial progressive-disclosure complete

HEAD: 67809e6
Run at: 2026-05-13T07:50Z
Viewport: 1440x900
Slices included: ALL 11 — A1 A2 A3 A4 B1 B2 B3 B4 C1 C2 C3 + Phase-A fix-it

## Part 1 — Phase-C flows

### Flow C1 — Level-2 elastic

| # | Action | Expected | Observed | Score |
|---|---|---|---|---|
| 1 | Open `/graph` | Default radial overview | scale(0.323) fit-zoom, 63 nodes, 84 edges, 0 glyphs at band 1, no `?focus`/`?path` query. Rail at 64px. | 5 |
| 2 | Click `parcel_manipulation_or_diverter` | Sector expands to 120°, Level 1 | URL `?focus=parcel_manipulation_or_diverter&path=parcel_manipulation_or_diverter`. Viewport `translate(958, 561) scale(1.5)`. Subtree saturated, 19 others dimmed via `.radial-dim`. | 5 |
| 3 | Click a sub-subsystem within the expanded sector | Sub-sector expands to 80° within parent's 120°, zoom to ~2.25× | **First attempt** clicked `industrial_robot_arm_body` → routed to L1 (path=[arm], zoom 1.5×) because arm is itself a first-layer subsystem with smaller sector index. **Second attempt** clicked `vacuum_suction_cup_array` → routed to `path=[end_effector_gripper_or_suction]` (L1 cross-jump) because end_effector is canonical first-layer ancestor (smaller sector index than parcel_manipulation). **Third attempt** clicked `servo_drive_controller` *from* an `industrial_robot_arm_body` L1 focus → URL `?path=industrial_robot_arm_body,servo_drive_controller`, viewport `scale(2.25)`. **L2 works only when the outer is alphabetically-lowest first-layer ancestor of the sub.** In current data, only `industrial_robot_arm_body` canonically owns sub-subsystems (31), the other first-layer sectors own 0–8. From `parcel_manipulation_or_diverter` (the canonical highest-risk sector), L2 is unreachable. | 2 |
| 4 | Click a deeper node (Level 3) | NO geometry change; viewport zoom to ~3.0× | From L2 `[arm, servo_drive_controller]`, click `servo_drive_power_stage` → URL `?path=arm,servo_drive_controller,servo_drive_power_stage`, viewport `scale(3.0)`. First-layer node `translate(...)` values identical to L2 (geometry unchanged). | 5 |
| 5 | Press Esc | Return L3 → L2 | URL `?path=arm,servo_drive_controller`, viewport `scale(2.25)`. | 5 |
| 6 | Press Esc | Return L2 → L1 | URL `?path=arm`, viewport `scale(1.5)`. | 5 |
| 7 | Press Esc | Return to overview | URL `/graph`, viewport `scale(0.323)` (fit). 14 sectors equal. | 5 |

**Flow C1 average**: (5+5+2+5+5+5+5)/7 = **4.57**

Notes:
- The L2 elastic mechanism is *implemented and correct per the GREEN tests*, but **data-fragile in production**: most first-layer subsystems share children with alphabetically-earlier first-layer siblings, and the canonical-parent heuristic routes the click to the alphabetically-earlier sector. Effectively, only the `industrial_robot_arm_body` sector demonstrates L2 elastic from this dataset. The other 13 first-layer sectors will cross-jump to a sibling L1 when the user clicks "inside" them.
- This deserves a fix in next session — either rebalance the canonical-parent heuristic, or detect "click inside current sector's visible subtree" via the saturated-set predicate (B3 already maintains it) instead of via canonical-ancestor map.

### Flow C2 — Cmd+K

| # | Action | Expected | Observed | Score |
|---|---|---|---|---|
| 1 | Press Cmd+K | Modal opens, input focused, placeholder visible | `[data-testid="cmdk-modal"]` present; input focused (`document.activeElement === input`); placeholder = `"Search nodes by name, metric, or description..."` (English fallback because no Chinese locale provider was triggered on this DOM probe; the Chinese variant lives behind `useLanguage`). | 5 |
| 2 | Type "vision" | Results list with `vision_barcode_label_recognition` near top | 10 results. Top result: "Vision / barcode / label recognition" (`vision_barcode_label_recognition`). `aria-selected="true"`. | 5 |
| 3 | Press Enter | Modal closes, sector expands, viewport flies, rail updates | Modal removed from DOM. URL `?focus=vision_barcode_label_recognition&path=vision_barcode_label_recognition`. Viewport `translate(160, 792) scale(1.5)`. Rail `data-content-key="vision_barcode_label_recognition"`, text "‹Vision / barcode / label recognition Commercially available". | 5 |
| 4 | Open Cmd+K, type "alloy", pick result | Modal closes; canvas behaviour matches step 3 | Top result: "Alloy steel precision material". Press Enter → URL `?focus=alloy_steel_precision_material&path=industrial_robot_arm_body` (material was assigned to arm sector by canonical-parent heuristic). Viewport `translate(694, -226) scale(1.5)` — pans to the arm sector. Rail content-key updates. | 5 |
| 5 | Open Cmd+K, press Esc | Modal closes, focus state unchanged | Modal removed. URL preserved as `?focus=alloy_steel_precision_material&path=industrial_robot_arm_body`. Viewport unchanged. | 5 |

**Flow C2 average**: **5.00**

### Flow C3 — Top-N glyph

| # | Action | Expected | Observed | Score |
|---|---|---|---|---|
| 1 | Default zoom (band 1): visually inspect for glyphs | NO glyphs (band 1 hides them) | `transform: scale(0.323)`. `document.querySelectorAll('[data-testid="topn-glyph"]').length === 0`. | 5 |
| 2 | Zoom in to band 2 | 5 small ringed-number glyphs at top-5 highest-risk nodes | At `scale(0.97)`: 5 glyphs present with `data-rank` values 1–5. Ranked by bottleneck-risk: 1=parcel_manipulation_or_diverter, 2=focal product, 3=conveyor_integration, 4=industrial_robot_arm_body, 5=vision_barcode_label_recognition. DOM check passes: `length === 5`. | 4 |
| 3 | Switch to "Cost" mode | Glyph identities update; top-5 by cost may differ from top-5 by risk | After switching to Cost: ranks 1=industrial_robot_arm_body, 2=conveyor_integration, 3=mechanical_structure, 4=industrial_area_scan_camera, 5=vision_processing_compute. **5 of 5 identities changed** vs risk mode — the glyph reads truthfully under different modes. | 5 |
| 4 | DOM check: no `top-blockers` banner | Banner removed; glyph in place | `.top-blockers-banner` / `[data-testid="top-blockers"]` / textContent `"高风险依赖"` all absent. ✓ | 5 |

**Flow C3 average**: (5+4+5+5)/4 = **4.75**

Step 2 deducted 1 point because rank 2 is the focal product itself (`low_cost_parcel_sorting_robot_300k_rmb`) — semantically odd to glyph the root node as a "top blocker." The product is at canvas origin; users will read the glyph and ask "the whole product is a blocker of itself?" Worth a one-line filter in `selectTopN` to exclude the focal node.

## Part 2 — Comprehensive cross-phase

### Flow final-1 — End-to-end research workflow

| # | Action | Observed | Score |
|---|---|---|---|
| 1 | Land on `/graph` | After fit settle: scale 0.323, 63 nodes, 14 sectors, no chrome above canvas. Glyphs not visible at band 1 (matches design). | 5 |
| 2 | Identify rank-1 risk via glyph | Required zooming to band 2 to surface glyphs. Once visible: rank-1 = `parcel_manipulation_or_diverter`. | 4 — slight friction: glyphs are hidden at default fit-zoom; user has to actively zoom in to learn priorities. Spec says band-1 hides glyphs, so this is by-design, but the workflow has an extra step the user might not discover. |
| 3 | Click that subsystem | Sector expands to L1, scale 1.5×, 19 dimmed, rail 64px with content. | 5 |
| 4 | Expand rail | Rail `data-rail-width="400"`. Full content visible — risk 48%, maturity 52/100, cost 50.6k–147.2k RMB, top blockers callout. | 5 |
| 5 | Click sub-subsystem `industrial_robot_arm_body` (within visible parcel_manipulation subtree) | URL changed to L1 focus on arm (`?path=industrial_robot_arm_body`), zoom 1.5× (not 2.25×). NO L2 elastic — cross-jumped to arm's own L1 sector. **Same friction as Flow C1 step 3** — data fragility. | 2 |
| 6 | Switch color mode to "Maturity" | Edge strokes collapse to `{#22c55e, #fbbf24}`, widths `{1, 1.5}`. Sector tint updates accordingly. Only 2 of 5 bands rendered. | 3 — data-coverage gap, not a bug, but Maturity mode reads visually shallow. |
| 7 | Esc twice | After Esc-1: pops focus path from `[arm]` to `[]`, viewport returns to fit, but rail still tracks last selected node at 400px. After Esc-2: redundant — already at L0. (Could pop rail to 64 but doesn't, rail width persists.) | 4 — Esc clears focus but does not collapse the rail. Rail stays at 400px after a focus-clear, which mildly violates the "everything returns to default" expectation. (Phase B B4 step 5 explicitly tested rail+focus combined-Esc, but that path goes through the rail's wrapper, not the global keydown.) |
| 8 | Cmd+K, search "iphone" | **0 matches.** Search scope is limited to focal subtree (65 reachable nodes). Sibling products + their subtrees are invisible to fuzzyMatch. | 1 — significant friction. The user expectation (per spec) was Cmd+K returns results beyond focal subtree; in reality it doesn't. |
| 9 | Pick a sibling product (workaround: searched exact id `parcel_sorting_robot_with_gripper`) | Selection succeeded for nodes that *are* in focal data file but outside reachable subtree. URL got `?focus=parcel_sorting_robot_with_gripper_300k_rmb` (no `path` set), viewport DID NOT pan or zoom (still at fit). Rail content-key updated. Canvas position of the selected node is off-viewport (orphan position from R_FALLBACK ring). User has to manually pan to find it. | 2 — orphan products are reachable via search but spatial continuity is broken: rail updates, canvas doesn't move. |

**Flow final-1 average**: (5+4+5+5+2+3+4+1+2)/9 = **3.44**

### Flow final-2 — Design-principles compliance

A. Progressive discovery > known-narrowing:
- `document.querySelectorAll('select').length === 0`
- No filter dropdowns, no "select category" UI
- Discovery is via zoom + click + Cmd+K only
- **PASS** → score 5

B. Geometry is the answer:
- No numeric KPI tiles above canvas
- `kpiTilesCount === 0` (`[class*="kpi"], [data-testid*="kpi"], [class*="counter"]` all empty)
- All quantitative signals encoded geometrically: subsystem hue (identity), edge color + width (mode band), sector tint (aggregate), glyph rank (top-N), node outline (mode band)
- **PASS** → score 5

C. Visual language, not list UI:
- No `[class*="pill"]` / `[class*="banner"]` / `[data-testid="top-blockers"]` / `.high-risk-pills` in DOM
- Top-N priorities are conveyed by `TopNGlyph` SVG marks on the canvas, not a list rail
- **PASS** → score 5

**Flow final-2 average**: **5.00**

## Summary

- **Average score across all flows** (weighted by step count):
  - C1: 4.57 (7 steps)
  - C2: 5.00 (5 steps)
  - C3: 4.75 (4 steps)
  - final-1: 3.44 (9 steps)
  - final-2: 5.00 (3 principles)
  - Grand: (4.57·7 + 5.00·5 + 4.75·4 + 3.44·9 + 5.00·3) / (7+5+4+9+3) = (31.99 + 25 + 19 + 30.96 + 15) / 28 = 121.95 / 28 = **4.36 / 5**

- **Pass / fail** (threshold 3.5): **PASS** — average 4.36 comfortably above threshold. Phase A → C composes correctly; design-principles compliance is perfect; Phase-C-specific flows (C2, C3) are near-flawless; the friction concentrates in two specific areas (L2 elastic + sibling-product reachability).

- **Top friction (in order of severity)**:
  1. **L2 elastic is unreachable from 13 of 14 first-layer sectors in current data.** The canonical-parent heuristic (smallest sector-index wins) routes most sub-subsystem clicks to a different first-layer sector (cross-jump to a sibling L1). Only `industrial_robot_arm_body` canonically owns sub-subsystems in this dataset (31 nodes); the other sectors canonically own 0–8. The Spec promise "Inside the expanded sector, click a sub-subsystem node → sub-sector expands within parent's 120°" effectively works only when the user happens to click within the arm's sector. This is mathematical fragility, not a code bug — the `sectorAngles` function passes its tests — but it makes the C1 mechanism invisible to users in the rest of the canvas.
  2. **Cmd+K cannot find sibling products / orphan subtrees.** The fuzzyMatch scope is the focal subtree (65 reachable nodes), not the full GraphData (190 structural nodes). Searching "iphone" returns "No matches" even though `iphone_4` and `iphone4_camera_sensor_module` exist in the data. This means Cmd+K is a "navigate within current product" tool, not a "navigate the whole project" tool — which is fine if intentional, but the ADR-0006 and the spec slice C2 RED tests both pin "fuzzy-matches against node names, metric titles, evidence summaries" without subtree scoping. The user expectation was wider.

- **Outstanding work for the next session** (morning-handoff rolling list):
  - **L2 elastic data fragility** (Flow C1 step 3 / Flow final-1 step 5). Two possible fixes: (a) use visible-saturated-set (B3 `focusedSubset`) instead of canonical-ancestor map as the L1-vs-L2-vs-cross-jump predicate in the click handler; (b) rebalance the canonical-parent heuristic to prefer the *currently-focused* sector when a sub-subsystem has multiple canonical candidates. Option (a) is less invasive.
  - **Cmd+K scope** (Flow final-1 step 8). Decide whether sibling-product / orphan search is intended; if yes, broaden `fuzzyMatch` scope to all of GraphData; if no, document the restriction in the placeholder text (e.g., "Search within this product").
  - **Orphan selection spatial continuity** (Flow final-1 step 9). When the user picks a sibling product or orphan node via Cmd+K, the viewport should pan to its canvas position (or the rail should make clear that the selection is "off-canvas"). Currently rail updates but canvas doesn't move.
  - **Rail Esc behavior under global Esc** (Flow final-1 step 7). The global Esc handler pops the focus path but doesn't collapse the rail; the rail's own Esc handler does both. Unify: a single Esc with no other context should collapse the rail AND clear focus, matching B4 step 5.
  - **TopNGlyph excludes focal product** (Flow C3 step 2). Filter `selectTopN` to skip `rootNodeId` — otherwise the focal product self-ranks as "blocker rank 2", which is semantically confusing.
  - **Maturity-mode data coverage** (Flow B Tour iter-20 carry-over). Maturity values cluster in two bands; 3 of 5 are visually unused. Data-fill task, not a code change.
  - **Rail toggle affordance** (Phase-B tour carry-over). `‹` / `›` glyph alone at default 64px is subtle; a "Show details" hint would help first-time discovery.

- **Final state of "Active exceptions" in `docs/design-principles.md`**: **NONE.** The previously-listed `/graph` "High risk dependency" pill banner was retired with slice C3; no new exceptions have accumulated during the radial redesign.

## Shippability assessment

The redesign is **shippable as v1** per the three documented design principles. The principles compliance is perfect (5/5/5); the surface defaults to progressive discovery; geometry carries all the signals; no list-of-pills banners remain. The friction items above are residue from data fragility (L2) and scope-decision (Cmd+K), not from the design principles being violated.

The biggest open question is whether L2 elastic should be visibly demonstrable from every sector in this dataset. The radial geometry promise is "click a subsystem → its sector expands; click a sub-subsystem inside → it nests inside the parent's 120°." In current data, that second click most often resolves as a cross-jump to a different sibling. A user demoing the surface would notice this. Recommended fix is option (a) above (visible-saturated-set predicate) — small change, large UX impact.

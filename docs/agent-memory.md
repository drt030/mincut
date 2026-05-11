# Agent Memory

Tracked handoff memory for unfinished work. Add entries only when useful for continuity across sessions.

## Entry Template

### YYYY-MM-DD `task-id` short label

- status:
- owner:
- branch:
- worktree:
- files/artifacts:
- commands/evidence:
- current findings:
- next steps:
- blockers/open questions:
- human feedback:
- feedback scope: `one-off` | `candidate default` | `confirmed default`
- promotion candidates:
- canonical doc follow-up:

---

### 2026-05-01 `grill-with-docs-backlog` Implementation backlog from /grill-with-docs session

- status: **most steps landed during ralph-loop session 2026-05-06/07**. Steps 1, 3, 4, 5, 7, 8, 9 + step 2 schema-tightening shipped. Remaining: step 6 (cosmetic _route ID rename), residual step 4 phase-2 schema promotion. See bottom of entry for ralph-loop landings.

**Ralph-loop landings (commits, in order)**:
- 26a3acb baseline • d6ca00e step 8 metric-fold • f9326eb step 5 route retirement • 214aa4a route-comparison gate question cleanup • d8edda3 install chrome-devtools-mcp • 87e8595/9cf4cec node visuals (bottleneck dashed + maturity-label pill + as-of pill) • e207407 gate-overall vs node-maturity disambig + Downstream metric filter • 7a43ebf capability cluster wiring • b9c880b step 4 hard_to_develop tag pass + 🔑 visual • d7720a9 step 3 decomposition stop + maturity backfill • c075799 step 1 review-status ladder • 49e7647/7096444 step 9 cost backend+UI • 6c61479 step 7 capability targetContext + step 2 tightening • aae44c2 14-subsystem cost data backfill • 796f165 P1 perf batch (DAG memo, module-globals, fallback memo, scoped cost cap) • 0af89c9 P0 fixes from review-1 • e0d90e3 frontier 🔭 glyph on cards • 6e8810a frontier toggle • e708c5b regenerate stale gate report • a91d999 north-star home page + README v0 features summary.

**Three-glyph visual signal layer** (north-star aligned): ⚠ bottleneck (dashed amber border), 🔑 key technology (hard_to_develop tag), 🔭 decomposition frontier (research goes here next). Plus maturity-label pill (red→amber→green) + maturityAsOf pill on every card and detail panel.

**Cost rollup** lands honestly: rolled-up typical 274.7k RMB vs 300k target, 3 of 64 subsystems still gap. Gate overall 2.94/5 (capped by unreviewed cost data per ADR-0001 cost-scoped cap).

**Final session state** (post iter 35 review pass 4): trust ~1% bug probability. 25 commits / ~6000 lines net since baseline 26a3acb. 4 review passes (iter 15, 20, 31, 35) all clean for last 2. Step 6 (44680bb naming + 3b392b3 _route rename) and step 2 schema-tightening (6c61479) shipped. Time-evolution stub: 5 nodes carry `maturityHistory` (b28aa0c) — schema field promoted from ADR-0002 reserved. Three review-pass-1 P0s (cost UI honesty, questionId, denominator drift, --allow-reviewed) and 4 P1s (DAG memo, module-globals, fallback memo, cost-scoped review cap) all fixed. Dev server clean on :3000 PID 81065 / 95625, serving HEAD code post iter-26 restart and iter-34 sub-agent bounce. Out-of-scope deferred: interactive time-slider (b28aa0c is the data + static timeline stub; slider component is the next ADR-class work).

**A11y pass** (iters 42-45): full audit + fixes landed. c9479ae closed 2 BLOCKERS (unlabeled graph filter selects, unfocusable-unlabeled graph node cards) + 1 MAJOR (no project-wide focus ring). ae8a278 closed 6 MAJORs (maturity-pill bg darkened to pass WCAG AA 4.5:1 on all 9 labels; graph card title kind-color mix bumped 70/30 for AA contrast; bottleneck warning glyph uses #b45309; cost-coverage indicator pairs colored dot with ✓/⚠/⨯ glyph so signal is not color-only; NodeDetailPanel root gains role=region aria-live=polite aria-labelledby; metric-strip role=list/listitem misuse → role=group). 51dda38 closed last MAJOR (chip kb parity confirmed — was already correct, audit speculative) + 4 MINORs (skip-to-content link, --muted darkened to #475569 for AA, role=img on glyph spans, h3/h4 headings inside historical-report <details>). WCAG AA target met for measured surfaces.


- owner: tbd
- branch: master (no branch yet)
- worktree: -
- files/artifacts:
  - `CONTEXT.md` — canonical glossary (created this session)
  - `docs/adr/0001-review-status-ladder.md` — 4-status semantics + gate effects
  - `docs/adr/0002-time-stamped-maturity.md` — `maturityAsOf` + reserved `maturityHistory`
  - `docs/adr/0003-cost-model.md` — range-valued metrics, prefer-direct-price rollup, multi-currency
  - `docs/adr/0004-capability-product-layering.md` — sibling Products under Capability; `has_route` retired in v0
  - `docs/adr/0005-decomposition-stop-and-key-technology.md` — commodified-leaf stop; `hard_to_develop` tag
  - `docs/plans/parcel-sorting-robot-v0.md` — Routes section replaced by Architecture (suction-committed)
  - `docs/roadmap.md` — Phase 1 exit criterion tightened to "gate overall (0–5)"
- commands/evidence: -
- current findings: full design tree resolved (Q1–Q11). Implementation deferred and batched.
- next steps (grouped, in implementation-order; each step is independently runnable but they share a schema-change wave for steps 1–4):
  1. **Review-status ladder (ADR-0001)** — `gateRunner.ts`: handle `disputed` (cap 2/5, generate "resolve dispute" task), exclude `deprecated` from `scopedClaims` / weak / trusted / coverage. `import:candidates`: reject `disputed`/`deprecated` for fresh records (extend `--allow-reviewed` semantics). `validate:data`: require `notes` on `disputed` (dispute reason) and `deprecated` (supersession reason). UI: hide `deprecated` by default.
  2. **Time-stamped maturity (ADR-0002)** — schema: add `maturityAsOf: string` (required when any maturity field is set), `maturityHistory?: array({asOf, score?, label?, source?})` (optional). `validate:data`: paired-presence check + temporal ordering on history. **Data backfill**: all existing nodes get `maturityAsOf: "2026-04"`. `import:candidates`: default `maturityAsOf` to current date when omitted. `NODE_EXPANSION.md`: mandate `maturityAsOf` whenever agent touches maturity.
  3. **Decomposition stop condition (ADR-0005)** — `gateRunner.ts` frontier judgment: from tag-only to "`decomposition_frontier` tag OR (`maturityLabel ∉ {mature, widely_adopted}` AND no expanded children)". `validate:data`: require `maturityLabel` on every node (otherwise stop condition is undefined).
  4. **Hard-to-develop tagging (ADR-0005)** — apply `tags: ["hard_to_develop"]` to applicable existing nodes (CV object recognition, motion planning, robust perception under variation, etc. — needs a domain pass). `validate:data`: require `notes` or `description` on tagged nodes. Phase 2: promote to `developmentDifficulty` schema field.
  5. **Route concept fully retired for v0 (ADR-0004)** — Product is committed to *one fixed architecture* (suction-based for `low_cost_parcel_sorting_robot_300k_rmb`); intra-product `has_route` is no longer used in v0 data. Cleanup:
     - Update `low_cost_parcel_sorting_robot_300k_rmb` `description` to commit explicitly to "vacuum suction end-effector"; consider adding `targetContext.targetEndEffector: "vacuum_suction"` (optional).
     - **Delete all 4** `kind: "technical_route"` nodes: `industrial_robot_arm_sorting_route`, `industrial_robot_arm_gripper_route`, `industrial_robot_arm_suction_route`, `integrated_robot_arm_sorting_cell_route`. Migrate their outgoing edges to `parcel_manipulation_or_diverter` (module-level) or to the Product node (product-level), per the Q9 table for the first/last two; gripper route's substantive content can be partially preserved into a new sibling Product (see next bullet); suction route's content folds into the existing Product or its module subtree.
     - **Delete the entire** `requiredParcelRoutes` array in `gateRunner.ts:47-52`. The product no longer has routes; gate questions about route comparison should be removed or repurposed (review `data/gate_questions/default_product_questions.json` for any route-comparison questions).
     - **Delete** `has_route` edges (4 of them).
     - **Delete** `LanguageProvider.tsx` translations for all 4 deleted route nodes.
     - **Create** new sibling Product node `parcel_sorting_robot_with_gripper_300k_rmb` (kind: `product`, attached under `affordable_small_warehouse_automation` capability via `requires` or `enables`). Description: "deferred neighbor product candidate, gripper-based variant of the 300k RMB parcel-sorting cell, not expanded in v0". Maturity fields unset. No children.
     - `check:active-graph-scope` continues to track only `low_cost_parcel_sorting_robot_300k_rmb`'s subgraph (gripper sibling stays out of active scope).
     - Run `validate:data` + `check:active-graph-scope` + `lint`.
  6. **Naming follow-up (CONTEXT.md flagged ambiguity)** — `*_route` suffix on `kind: "product"` neighbor nodes (delta, conveyor diverter, mobile, hybrid human-robot) is misleading. Rename to remove `_route` suffix when convenient. Not blocking.
  7. **Capability `targetContext` fill-in (CONTEXT.md `Capability node`)** — write `targetContext` on `affordable_small_warehouse_automation` (facility size, daily throughput, parcel-spec range, environment) so future capability-level scoring has its input ready. Maturity fields stay unset on Capability nodes per the deferral. No schema change needed (the field already exists). Update `validate:data` if/when you want to *encourage* targetContext on capabilities (probably warn-only, not enforce).
  8. **Metric-fold display rule (Q11 follow-up)** — ✅ **DONE** in `d6ca00e` (ralph iter 2, 2026-05-06). Single-parent metrics fold into compact strip; toggle defaults off; CDP-verified 88 cards / 1 strip / 9 chips on full graph. Known gaps logged: chip uses `node.metrics[0]` only; first-paint pre-ELK has ~60px clearance miss; kind-filter interaction could be more explicit. UI does **not** render `metric`-kind nodes that are connected via `measured_by` to a single visible non-metric node; instead fold them into the parent node's visualization (compact metrics strip showing name / currentValue / targetValue / unit; click opens metric detail panel with evidence, confidence, history). Shared metrics (multiple visible parents) still render as their own node. Add a "show metrics as nodes" toggle (default off). Document the rule in `docs/GRAPH_UX.md`. Implement in `GraphExplorer.tsx` (and node-detail panel for the metrics strip). Applies to all metrics (cost, throughput, accuracy, weight/size range, etc.), not just cost.
  9. **Cost model — full v0 spec (ADR-0003)** — Cost lives only on `metric`-kind nodes attached via `measured_by`. Product `targetContext.targetCost` becomes description-only (no number); authoritative number on `total_system_cost` metric. **Range-valued** `currentValue` / `targetValue`: union of `number | {min, typical, max}`. **`progressScore` field dropped.** New schema fields: `costAsOf` (year precision, default `"2025"`, mirrors `maturityAsOf`), `currency: enum("RMB","USD","EUR","JPY")` (default `"RMB"`). **Rollup priority**: (1) direct subsystem cost metric on the node → use it, no recursion; (2) commodified leaf with cost metric → use it; (3) fallback bottom-up: walk `requires` children, sum via interval arithmetic, multiply by 1.15 (per-layer integration overhead). FX conversion via `scripts/fx-constants.ts` constant table (2025 mid-rates: USD 7.20, EUR 7.85, JPY 0.048; revisit annually). Leaf-cost sourcing priority: industry reports → public market data → vendor catalogs (auto `vendor_claim`, weak) → agent online research (default `unreviewed`) → hand-set (`unreviewed` low confidence). Agent cost candidates **must** carry `evidenceIds`. Coverage_gap reporting: missing-cost nodes listed alongside the rolled-up range; gate scores penalize gap. Captured as ADR-0003 (to be written next).
- blockers/open questions: none for the captured scope. Three deferred topics that did **not** receive design grilling and remain for a future session: (a) gate competency-question coverage and product-specific tailoring, (b) hardware/software co-dependency UI representation (the plan's section is mostly UI-facing; needs separate validation against the running app), (c) `NODE_EXPANSION.md` rewrite to reflect all the new agent constraints (`maturityAsOf` mandatory, `hard_to_develop` tag protocol, commodified-leaf stop, cost `evidenceIds` requirement, no new `has_route` edges). Item (c) is best done as a focused doc pass during implementation step 1–4 and is implicitly scoped there.
- human feedback: chose batched implementation (option b) so grilling design tree stays coherent; user confirmed all design points to date.
- feedback scope: `one-off` (this batch); the *patterns* (capture in CONTEXT.md/ADRs first, code later) is `candidate default` for future grilling sessions.
- promotion candidates: -
- canonical doc follow-up: CONTEXT.md and ADRs are already up to date; no doc work pending other than what's listed above.

## 2026-05-10 ralph-loop iter-01 (HEAD 1689f4b)
- P0 fix: node title was being squeezed to ~13px by flex space-between against an unconstrained title element. Added `flex-shrink: 0` on `.graph-node-title`; bumped `DEFAULT_NODE_HEIGHT` 104 → 160, `TALL_NODE_HEIGHT` 124 → 160, `METRICS_STRIP_HEIGHT` 60 → 160, and `.graph-node-metrics { max-height: 60 → 160 }`. Verified: 0/22 titles truncated, 0/22 cards overflow inner, 0/17 chip names ellipsised.
- side effect: cards now visibly taller (flagship product 184 → 304px). ELK relayout absorbs this; canvas pans wider on default zoom. Will revisit in a later iter if the taller cards crowd the layered view.
- next iter (02): take observe-screenshot of /graph at 1.0 zoom (post-fitView) and identify the single highest-leverage UX nudge from the design指北 candidates a–g.

## 2026-05-10 ralph-loop iter-03 stumble
- mistake: ran `npm run build` while `npm run dev` (PID 38848) was active. The build wiped/replaced `.next/` with prod artifacts; dev server's chunk references 404'd; home rendered blank. Had to kill dev pid + `rm -rf .next` + restart `npm run dev` (now PID 7806).
- guidance: while ralph-loop runs against the live dev server, **only run `npm run lint`** and `npm run check:graph-ux` for verification. Skip `npm run build` per iter; one final `build` pass at end of session is enough.

## 2026-05-10 ralph-loop iter-03 (HEAD f6378ce)
- dynamic `metricsStripHeight(count)` replaces flat METRICS_STRIP_HEIGHT add. Cards with 1 chip: 188 (was 320). Avg 240 → 180. Bbox H unchanged at 3634 because ELK spacing dominates, not card height.
- false alarm explored: thought iter-1 made the graph "too tall" (3634 px) so default viewport showed nothing. git-stash test confirmed pre-iter-1 bbox is also 3634 — it's always been this tall, ELK spacing controls layout extent. The "default zoom shows nothing" is a pre-existing UX issue.
- next iter (04): real P1 — pick from candidates a/b/c/d/e/f/g. With current layout being naturally tall, the most-leverage might be (a) "Bottlenecks" view mode showing only relevant nodes (data has 0 right now though) OR (b) detail-panel "next-action" hint.

## 2026-05-10 ralph-loop iter-05 (HEAD 6c3ddae) — paused for user review
- /graph default landing: viewport now setCenter on selected (flagship) at zoom 0.7. Replaces translate(0,0)/scale(1) which showed empty canvas because flagship sits at y≈600 in a 3634-tall bbox.
- learning: ELK layout was returning early via `incrementalLayout` with empty Map for cold starts; cards on canvas were using fallback positions. So my first attempt to read `layoutPositions` state for selected coordinates always saw size=0. Switched to `instance.getNode(selectedId).position` which works regardless of which layout produced the positions.
- gotcha: `check:graph-ux` regex `/\sfitView(?:\s|>|$)/` matches the literal word "fitView" in comments too, not just the prop. Reworded the comment.
- pending review: visually flagship is centred but lots of empty space top/left; layered children extend RIGHT (out of frame). Iter-6 candidate: bias the centre target slightly leftward so the right-extending children fit on screen.

## 2026-05-10 ralph-loop v2 session — final state (HEAD c4fa7c1)
Spec `docs/superpowers/specs/2026-05-10-graph-redesign.md` shipped via 4 RED+GREEN slice pairs + polish:
- Slice 1: cost walker max(direct, sum × 1.15) + breakdown row + ⚠ badge + ADR-0003 amendment + CONTEXT.md cost line update
- Slice 2: edgeTint pure function + ColorModeSelect dropdown + 5 modes
- Slice 3: explorationLayout pre-order pure function replacing broken ELK pipeline
- Slice 4: overview/focused state machine + ESC handler + compact-mode 14px heat block + bottleneck-path stroke boost
- Polish: nodeRisk integration tests caught real bug (cost_share used direct not rolled-up → fixed); ProductView parity; gate report regen 2.94 → 2.89; CONTEXT.md graph visualization section
- Tests: 27/27 pass via `node --test` via `tsx --test`. Test runner is built into Node 18+, zero new deps.
- Smoke tour: tests/uxSmoke.test.ts HTTP-checks 4 routes for slice markup; skips gracefully when dev server is down.
- chrome-devtools MCP died early in session; could not be revived. Visual UX tour not run — user does the 7-step tour from `docs/morning-handoff-2026-05-11.md` tomorrow.

29 commits this session. Files map in the hand-off doc.

## 2026-05-10 evening — iter-22 user-reported layout chaos fix
- User report: "整个结构图很乱，节点之间甚至有重叠，边也非常乱". Cost OK confirmed.
- Root cause: 3 layout systems competing for same x-lanes. explorationLayout (focus subtree) at x∈[-1820, 1260]; fallbackPositionFor placed alt-product siblings at x=356 (lane-1), orphan metrics at x=854 (lane-3), capability at x=12 (below focus). All on same canvas with conflicting y.
- Fix HEAD 7874b43:
  1. switched explorationLayout from vertical-stack (depth→x) to top-down tree (depth→y) at 4129eb8
  2. extended explorationLayout to accept visibleIds; non-tree visibles placed in "context band" at y=-ROW_HEIGHT, sorted by kind (capability centre, products around, metrics outside)
- Result: clean 3-row band — context above, focus mid, deps below. No more overlap. 28/28 tests pass. User-visible improvement confirmed via screenshot.

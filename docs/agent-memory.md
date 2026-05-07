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

- status: pending — all design decisions captured in CONTEXT.md + ADRs (0001–0005); implementation work batched into the steps below.
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
  8. **Metric-fold display rule (Q11 follow-up)** — UI does **not** render `metric`-kind nodes that are connected via `measured_by` to a single visible non-metric node; instead fold them into the parent node's visualization (compact metrics strip showing name / currentValue / targetValue / unit; click opens metric detail panel with evidence, confidence, history). Shared metrics (multiple visible parents) still render as their own node. Add a "show metrics as nodes" toggle (default off). Document the rule in `docs/GRAPH_UX.md`. Implement in `GraphExplorer.tsx` (and node-detail panel for the metrics strip). Applies to all metrics (cost, throughput, accuracy, weight/size range, etc.), not just cost.
  9. **Cost model — full v0 spec (ADR-0003)** — Cost lives only on `metric`-kind nodes attached via `measured_by`. Product `targetContext.targetCost` becomes description-only (no number); authoritative number on `total_system_cost` metric. **Range-valued** `currentValue` / `targetValue`: union of `number | {min, typical, max}`. **`progressScore` field dropped.** New schema fields: `costAsOf` (year precision, default `"2025"`, mirrors `maturityAsOf`), `currency: enum("RMB","USD","EUR","JPY")` (default `"RMB"`). **Rollup priority**: (1) direct subsystem cost metric on the node → use it, no recursion; (2) commodified leaf with cost metric → use it; (3) fallback bottom-up: walk `requires` children, sum via interval arithmetic, multiply by 1.15 (per-layer integration overhead). FX conversion via `scripts/fx-constants.ts` constant table (2025 mid-rates: USD 7.20, EUR 7.85, JPY 0.048; revisit annually). Leaf-cost sourcing priority: industry reports → public market data → vendor catalogs (auto `vendor_claim`, weak) → agent online research (default `unreviewed`) → hand-set (`unreviewed` low confidence). Agent cost candidates **must** carry `evidenceIds`. Coverage_gap reporting: missing-cost nodes listed alongside the rolled-up range; gate scores penalize gap. Captured as ADR-0003 (to be written next).
- blockers/open questions: none for the captured scope. Three deferred topics that did **not** receive design grilling and remain for a future session: (a) gate competency-question coverage and product-specific tailoring, (b) hardware/software co-dependency UI representation (the plan's section is mostly UI-facing; needs separate validation against the running app), (c) `NODE_EXPANSION.md` rewrite to reflect all the new agent constraints (`maturityAsOf` mandatory, `hard_to_develop` tag protocol, commodified-leaf stop, cost `evidenceIds` requirement, no new `has_route` edges). Item (c) is best done as a focused doc pass during implementation step 1–4 and is implicitly scoped there.
- human feedback: chose batched implementation (option b) so grilling design tree stays coherent; user confirmed all design points to date.
- feedback scope: `one-off` (this batch); the *patterns* (capture in CONTEXT.md/ADRs first, code later) is `candidate default` for future grilling sessions.
- promotion candidates: -
- canonical doc follow-up: CONTEXT.md and ADRs are already up to date; no doc work pending other than what's listed above.

# Morning Hand-off — 2026-05-11

Session: ralph-loop v2, 2026-05-10 evening → overnight. HEAD `b54090f`. Baseline `6c3ddae` (earlier hand-off).

## TL;DR

The graph redesign spec (`docs/superpowers/specs/2026-05-10-graph-redesign.md`) landed in four TDD slices: cost honesty, color-mode dropdown, deterministic exploration layout, two-stage overview/focused exploration. Slice-by-slice acceptance is green on lint + `node --test` (11/11) + check:graph-ux. The remaining gap is **visual** verification: the chrome-devtools MCP died mid-session and could not be revived, so the golden-path screenshot tour wasn't run on final HEAD. Open `npm run dev` and walk through the 7 steps below to score yourself.

## What landed (4 slices, 14 commits)

### Slice 1 — Cost honesty
- `c2da3b6` test(slice-1): RED — cost-inversion fixture asserts max(direct, sum)
- `73e2421` feat(slice-1): GREEN — walker uses `max(direct, children × 1.15)` at every layer
- `6b30dd0` feat(slice-1): NodeDetailPanel direct/children breakdown + ⚠ inversion badge
- `9422f85` docs(adr): ADR-0003 amendment

**Visible change**: a node where direct cost is authored lower than its children's sum (e.g. `parcel_manipulation_or_diverter` direct 4k vs children 89.7k) now reads at the larger value with both branches surfaced and a ⚠ "direct < children" badge. Flagship rolled-up moved 274.7k → 283.5k typical (more honest, not really different). Coverage gap count moved 3 → 44 because the walker now descends past direct-cost ancestors and counts leaves — also more honest.

### Slice 2 — Color modes
- `f87b932` test(slice-2): RED — edgeTint assertions for cost / maturity / overall / bottleneck / relation
- `9f719d4` feat(slice-2): GREEN — `edgeTintFor` pure function
- `4f04220` feat(slice-2): wire ColorMode dropdown + edge style.stroke

**Visible change**: toolbar gains a "Color by" `<select>` with 5 options. Default is **Bottleneck risk**. Edge stroke now reflects the target node's property:
- Cost: blue → amber → red ramp, capped at 100k RMB
- Maturity: Likert mapping by label
- Overall: red → amber → green by maturityScore
- Bottleneck: heat ramp by `1 - maturityScore/100`
- Relation: legacy class-based stroke (current default behaviour)

### Slice 3 — Layout reflow on expand
- `74ff852` test(slice-3): RED — explorationLayout asserts expand reflows
- `5df10c0` feat(slice-3): GREEN — pre-order pure function
- `5fa6875` feat(slice-3): wire explorationLayout into GraphExplorer position lookup

**Visible change**: ELK's broken `incrementalLayout` (returning empty Map all session) is no longer load-bearing. `explorationLayout` provides deterministic positions for the selected node's `requires` subtree. Expanding/collapsing any card instantly reflows the subtree (no async wait). Pre-order y means expanding B pushes B's siblings strictly downward.

### Slice 4 — Two-stage exploration
- `b54090f` feat(slice-4): overview/focused state machine

**Visible change**:
- Land on `/graph` in `overview` stage — viewport fits the whole graph, every card is in `.compact` mode (title + small color block only)
- Click any card → enter `focused` — viewport setCenter at zoom 0.8, target plus a few neighbors are visible in full, "↩ Global view" button appears in toolbar
- Press ESC → return to overview
- The color-coded edges (from slice 2) are visible at both stages so the user can scan the bottleneck path before drilling in

## What you'll see at `/graph` (manual tour)

Suggested 7-step golden path with self-scoring (clarity / responsiveness / fit-for-purpose, 0–5 each):

1. `/graph` initial load → expect overview stage, ~22 compact cards, edges colored by Bottleneck risk
2. Click flagship product `300,000 RMB parcel-sorting robot` → expect 350ms zoom to 0.8, full cards visible, side panel updates
3. Click `parcel_manipulation_or_diverter` in side panel or in graph → expect the ⚠ "direct < children" badge and direct 4k / children-summed 89.7k breakdown row
4. Switch "Color by" to **Cost** → edges to expensive children turn warm; conveyor_integration (55k) and industrial_robot_arm_body (60k) should stand out
5. Press ESC → expect return to overview with cards compact again
6. Switch to **Maturity** mode in overview → edges to early-stage subsystems flush red/amber; commercially_available subsystems flush green
7. Click "Tasks" / "Gate" tabs → ensure the cost rollup propagation didn't break existing pages

Score each step. Anything < 3 is the next iter's priority.

## Honest gaps / known unfinished

- **Visual UX tour was not run**. chrome-devtools MCP died early in this session and would not respawn. All 14 commits were validated only by lint + node --test + check:graph-ux + reading the code. The first thing you should do tomorrow is run the 7-step tour and either confirm or file specific issues.
- **`nodeRisk(node, graph)` is a stub inside `edgeTint.ts`**. The proper risk formula `(1 - maturity/100) × cost_share(node, parent)` from the spec needs the rollup context to compute cost_share. Currently bottleneck mode falls back to the simpler `1 - maturity/100`. Spec §5 calls this out under "Risks".
- **Data quality on parcel_manipulation_or_diverter**: the direct 4k figure is the cause of the user's "subsystem priced above parent" report. The walker fix above makes the rolled-up display honest, but the underlying data is still wrong. Replace with a real "integration shell" cost (probably 8–15k RMB) when promoting from unreviewed.
- **Coverage gap denominator jumped 3 → 44** (see Slice 1). The gate report under `data/gate_reports/` was generated against the OLD walker. Re-run `npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb` and commit the regenerated report.
- **No tests for the GraphExplorer state machine itself**. Slice-4 acceptance leans on chrome-devtools screenshots, which weren't run. If you want regression protection for "click a node → stage becomes focused" you'd need either jsdom + React Testing Library (new dep) or just careful manual scoring each session.

## Next session candidates

1. **Run the 7-step golden tour** (highest priority). Capture any visual issues and decide whether to tune (a) compact-mode CSS (too little info? too much?), (b) Bottleneck-risk formula weighting, (c) overview-mode zoom (might over-shrink).
2. **`nodeRisk.ts` proper implementation + TDD**: take spec §5 risk formula, compute `cost_share = nodeTypicalCostRmb(node) / totalRolledUp` in a graph-local pass, ramp.
3. **Regenerate gate report** with new walker; check the gate score moves sensibly.
4. **`parcel_manipulation_or_diverter` data fix**: discuss with user whether to raise direct cost or rework as a wrapper module with no direct reading.
5. **Persist colorMode + stage** in URL state so a learner can bookmark a focused view.

## File map

- `src/lib/costRollup.ts` — walker + new directOnly / fromChildren / directLowerThanChildren fields
- `src/lib/edgeTint.ts` (new) — 5-mode pure function
- `src/lib/explorationLayout.ts` (new) — pre-order position function
- `src/components/GraphExplorer.tsx` — stage state, ColorModeSelect, ESC handler, click-to-focus, position pipeline
- `src/components/NodeDetailPanel.tsx` — cost breakdown row + inversion badge
- `src/components/LanguageProvider.tsx` — new i18n keys (colorMode*, backToOverview, costBreakdown*, costInversionWarning)
- `src/app/globals.css` — `.color-mode-select-*`, `.cost-rollup-breakdown*`, `.graph-node-card.compact`
- `tests/` (new) — costRollup, edgeTint, explorationLayout, fixtures
- `package.json` — `"test": "tsx --test tests/**/*.test.ts"`
- `docs/adr/0003-cost-model.md` — amendment section
- `docs/superpowers/specs/2026-05-10-graph-redesign.md` — the design that drove everything above

References: `docs/adr/0001-0005`, `CONTEXT.md`, `docs/agent-memory.md`.

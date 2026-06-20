# Chokepoint Presentation Layer (Plan 2) — Implementation Plan

> **For agentic workers:** execute task-by-task. UI tasks require reading the live components — this plan gives WHAT + acceptance + the exact `chokepointScore.ts` interface + the new copy; the component wiring is yours to discover. **Acceptance is judged by `docs/ACCEPTANCE.md` §3 via the QA agent (Task 4), not by the implementer.** `check:disclosure` (§4) is the machine floor: built RED in Task 1, turned green by Task 2 (lens vocabulary) and Task 3 (first-glance headline).

**Goal:** make the dashboard match the engine. (1) Collapse the canvas to the 3-lens vocabulary — System decomposition / Chokepoint / Cost; remove Maturity. (2) Make every node's detail panel show, at first glance, its chokepoint verdict + the *elevated axis* (Cost / Dependency / Concentration / Barrier) as a concrete sentence, with the four-axis breakdown on drill-in.

**Builds on:** Plan 1 — `src/lib/chokepointScore.ts` already exports `chokepointScores(graph)`, `chokepointBandFor(graph)`, `chokepointRankSignal(graph,node)`. **Read `chokepointScore.ts` to confirm the exact `ChokepointResult` shape before consuming it** (per-axis `{value, known}`, a composite `score`, and an `incomplete` flag; product/root nodes are structurally `incomplete`). ADR-0010, `docs/ACCEPTANCE.md`.

**Branch:** `chokepoint-scoring`, worktree `/Users/wth/dev/civilization-chokepoint`. Tests run via the repo's `tsx --test` (the `--` file filter does not work; invoke the runner on single files). **Known baseline (NOT yours):** 3 pre-existing failures — `detailRail.test.ts`, `gatePage.test.ts`, `uxSmoke.test.ts` (/product p50) — plus ~34 pre-existing `tsc` errors in unrelated test files. Your changes must add zero new ones.

## File map
- NEW `scripts/check-disclosure.ts` + `package.json` `"check:disclosure"`.
- The **live** lens selector (DISCOVER it — rendered via `GraphExplorer.tsx` `analysisMode` / `onAnalysisModeChange` near lines 1742 / 1822; it is **not** the deprecated `ColorModeSelect` / `colorMode*` i18n keys, which `check:graph-ux` forbids) + `src/components/LanguageProvider.tsx` lens labels & legend.
- `src/components/NodeDetailPanel.tsx` (and the rail it renders) — first-glance headline + four-axis breakdown.

## Task 1 — `check:disclosure` (machine floor, §4) — RED first
Create `scripts/check-disclosure.ts` (static analysis, mirror `scripts/check-graph-topology.ts` style). Assert and exit nonzero on violation:
- **(a) Lens vocabulary:** the live lens-selector label source exposes exactly the three lenses `System decomposition`, `Chokepoint`, `Cost`, and does NOT expose a `Maturity` or `Bottleneck risk` lens label.
- **(b) First-glance headline:** `NodeDetailPanel.tsx` renders an element carrying `data-testid="detail-chokepoint-headline"`.

Wire `package.json` `"check:disclosure": "tsx scripts/check-disclosure.ts"`. It starts **RED** (labels still old, headline testid absent) — the TDD anchor for Tasks 2–3. Commit.

## Task 2 — Canvas → 3 lenses
- Find the live lens selector. Rename `Bottleneck risk` → **Chokepoint**, `Cost drivers` → **Cost**; keep **System decomposition**. **Remove the Maturity lens** (its button, legend, and label). Keep the internal `maturity` ColorMode/scoring only if non-lens code still needs it; otherwise drop the lens-option mapping.
- `LanguageProvider` EN + 中文: Chokepoint = `"Chokepoint"` / `"卡点"`; Cost = `"Cost"` / `"成本"`; System decomposition = `"System decomposition"` / `"系统分解"`. Chokepoint legend: EN `"low (blue) → chokepoint (red)"` / 中文 `"低（蓝）→ 卡点（红）"`.
- `check:disclosure` (a) → green; `check:graph-ux`, lint, build, suite stay green (no new failures). Commit.

## Task 3 — Detail panel first-glance chokepoint readout (§3a)
- Consume `chokepointScores(workingGraph).get(nodeId)`. The **elevated axis** = the highest-`value` *known* axis among {cost, criticality, concentration, barrier}.
- Render a first-glance headline `data-testid="detail-chokepoint-headline"`: the chokepoint verdict (band via `chokepointBandFor` → "Chokepoint" at the top band(s), else a lower-key label) + the elevated axis as a CONCRETE sentence (never a raw tag). Copy (EN / 中文):
  - cost → `Cost driver · {X}% of build cost` / `成本大头 · 占 {X}%`
  - criticality → `Load-bearing · {N} subsystems depend on it` / `关键件 · {N} 处依赖`
  - concentration → `Modeled holders · {N}` / `供应方覆盖 · 已建模 {N} 家`
  - barrier → `High barrier · {must-build | hard to replicate}` / `高壁垒 · {必自建 | 难复制}`
  - composite line → `Chokepoint: {elevated label}` / `卡点：{那根轴}`
  - `incomplete` product/root node → `Structural root · not itself a chokepoint` / `结构根 · 本身不是卡点`
- Drill-in: full four-axis breakdown (each axis value + known/unknown), reusing/extending the existing Investor-brief / DecisionBrief area.
- **Sustained:** the headline persists across lens switch and node drill (do not gate it on `colorMode`).
- No raw `maturity: <label>` shown first-glance. `check:disclosure` (b) → green. Commit.

## Task 4 — QA acceptance pass (§3) [controller-run, browser]
Run the QA agent (`docs/QA-agent.md`) against the worktree dev server, judging `docs/ACCEPTANCE.md` §3: first-glance chokepoint readout present + concrete; vocabulary consistency (3 lenses, no Maturity, canvas label == detail vocabulary); zh/en intact; no stock-recommendation / unaudited-return language. Emit verdict `pass | conditional_pass | fail` and map to a decision per §5.

## Acceptance
- `check:disclosure`, `check:graph-ux`, lint, build green; no NEW test failures beyond the 3 known baselines.
- QA verdict against §3 = `pass` (or `conditional_pass` with visible, documented gaps).
- The "engine new / dashboard old" inconsistency is closed: canvas shows Chokepoint / Cost with no Maturity lens; node detail leads with the chokepoint verdict + elevated axis in plain language; canvas and detail share one vocabulary.

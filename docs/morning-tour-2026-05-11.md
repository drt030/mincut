# 2026-05-11 Morning — 5-minute tour

I've been iterating overnight (HEAD `4fcd233`, 31 v3 commits since 25bf0b4). Below is a curated 5-minute walkthrough that hits the biggest changes. Open browser to `localhost:3000`.

## 1 minute — global view

Open: `http://localhost:3000/graph`

You should see (within ~1.8s):
- Flagship `30 万 RMB 包裹分拣机器人` (or English) at top centre
- 12 children in a 2-row × 6-col grid below (previously was a 1×12 wide row, unreadable)
- Each child has a 14px color bar on top — the heat block, currently colored by **Bottleneck risk**
- Right panel: 🎯 优先关注 (Top blockers) callout — three highest-risk children with maturity + risk %

What changed: layout is grid (iter-2), heat block per card (iter-8 + slice-4 polish), Top blockers callout new (iter-11).

## 1 minute — drill into the bug node

The headline cost-rollup bug node: `parcel_manipulation_or_diverter`. It says direct cost 4k but its child industrial_robot_arm_body is 60k.

Open: `http://localhost:3000/graph?stage=focused&focus=parcel_manipulation_or_diverter`

What you should see:
- Focused stage, the warmest card centred and scaled up (~1.04)
- Other 17 nodes minified at 45% opacity and 55% scale — **previous context is still visible**, just shrunk (no "teleport" feel — iter-8)
- Right panel: cost rollup shows **rolled-up 89.7k RMB**, breakdown line "direct only: 4,000 RMB / from children × 1.15: 89,700 RMB", and the **⚠ 直接录入 < 子件汇总** badge

What changed: the rollup walker now does `max(direct, children × 1.15)` and surfaces both branches (slice-1). The breakdown + badge appear because the detail panel is now gated to module/equipment/material too, not just product (iter-15-related).

## 1 minute — switch color modes

In the toolbar, click "按属性染色" / "Color by" dropdown:

- Try **Cost (蓝→红)** — edges to `industrial_robot_arm_body` (60k) and `conveyor_integration` (55k) turn warm
- Try **Maturity (红→绿)** — edges colored by Likert maturity label
- Try **综合成熟度** — continuous score 0-100 ramp
- Try **关系类型** — falls back to legacy CSS strokes (gray + bottlenecked_by red dashed)

A 5-swatch mini-legend strip next to the dropdown shows the current ramp direction (iter-24).

## 1 minute — progressive disclosure

In the right detail panel for any product/module:

- 🎯 优先关注 — top 3 blockers always visible
- 汇总成本 (cost rollup) — visible with breakdown row + ⚠ inversion (when applicable) + ⚠ coverage warning (when > 50% gap)
- 成熟度演化 (4) — **collapsed by default**, click chevron to expand the 4-entry timeline
- 目标上下文 (6) — **collapsed by default**
- Empty metrics — shown as "8 项指标未录入 — 展开查看" expander, not inline
- Long downstream lists — first 5 inline, "+12 more — 展开查看全部" for the rest

## 30 seconds — keyboard test

Tab repeatedly through the toolbar. Every button + select + summary should show a visible focus ring (blue outline). All 96 focusable elements were verified to have either text content or aria-label (Flow 6 report).

## 30 seconds — URL bookmarking

Try `http://localhost:3000/graph?color=maturity&stage=focused&focus=industrial_robot_arm_body`

The URL state persists across reload (iter-3).

## Known caveats (read after the tour)

- Initial fitView still lands at ~1.8s after first paint (timer-based retry; React Flow's programmatic fitView fails before nodes are measured). Visually: brief blank, then graph appears. Acceptable for now.
- Maturity mode only produces 3 distinct edge colors on this graph because data has limited maturity variance. Code is fine; data-coverage thing.
- `/gate` page hasn't been visually checked tonight — should still show 2.89/5, 44 of 64 coverage.

## File map for inspection

- `src/lib/explorationLayout.ts` — pre-order tree + grid wrap layout
- `src/lib/edgeTint.ts` — 5-mode color function
- `src/lib/nodeRisk.ts` — risk = (1-maturity/100) × cost_share
- `src/lib/costRollup.ts` — walker uses max(direct, sum × 1.15)
- `src/components/GraphExplorer.tsx` — stage state, ColorModeSelect, context-band filter, focus state machine
- `src/components/NodeDetailPanel.tsx` — Top blockers, progressive disclosure, scroll-to-top
- `src/components/ProductView.tsx` — coverage warning + Top blockers parity
- `docs/ux-flow-tours.md` — 8 flow playbooks
- `docs/ux-flow-reports/` — 4 actual run reports

## Total commits since last hand-off

31 substantive iters this v3 push. 28 unit tests pass. lint + check:graph-ux green throughout.

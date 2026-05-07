# Morning Hand-off — 2026-05-07

Session: ralph-loop, 2026-05-06 / 07. HEAD `c1eb3c3`. Baseline `26a3acb`.

## TL;DR

Open `npm run dev`, visit `/` and `/graph`. The graph now has a three-glyph visual signal layer (bottleneck / key-tech / frontier), maturity-label + as-of pills on every card, a decomposition-frontier toggle, and a working cost rollup with coverage-gap reporting. Backend caught up to ADR-0001/0003/0005 (review ladder, cost model, decomposition stop) and a focused a11y pass closed measured-surface BLOCKER/MAJORs. **Stub/deferred**: cost ranges on 14 leaves are unreviewed 2025-China estimates; `maturityHistory` exists on 5 nodes only; the time-slider component itself is the next ADR-class item.

## What landed overnight (31 commits, +5591 / -583)

### Visible UX changes
- Bottleneck dashed-amber border + maturity-label pill + maturity-as-of pill on every node card and detail panel — `87e8595`, `9cf4cec`
- Capability cluster + sibling-product layout in graph — `7a43ebf`
- Key-tech `🔑` glyph for `hard_to_develop` tagged nodes — `b9c880b`
- Decomposition-frontier `🔭` glyph on cards + toolbar toggle — `e0d90e3`, `6e8810a`
- Cost-model UI: range rendering, coverage-gap dot, `costAsOf` pill — `7096444`
- Single-parent metric nodes folded into compact metrics strip — `d6ca00e`
- Review-status ladder surfaced in gate UI — `c075799`
- Stub maturity-over-time timeline inside detail panel for 5 nodes — `b28aa0c`
- North-star home page — `a91d999`

### Backend / data integrity / gate scoring / perf
- Cost model backend per ADR-0003: schema, FX constants, rollup walker — `49e7647`
- Decomposition-stop + frontier rules wired into gate — `d7720a9`
- Review-status ladder full ladder semantics in gate — `c075799`
- Capability `targetContext` schema + `maturityAsOf`-required-when-set — `6c61479`
- 14 leaf subsystems backfilled with cost data — `aae44c2`
- P1 perf batch: DAG-aware rollup memo, module-global removal, scoped review cap — `796f165`
- P0 fixes from review pass 1: cost-UI honesty, questionId, denominator drift, `--allow-reviewed` — `0af89c9`
- Stale gate report regenerated; integration premium clarified — `e708c5b`
- 4 `technical_route` nodes retired; route-comparison gate questions removed — `f9326eb`, `214aa4a`
- 4 sibling-product IDs renamed to drop misleading `_route` suffix — `3b392b3`
- Disambiguated gate-overall vs node-maturity; metrics filtered out of Downstream list — `e207407`

### Documentation
- ADRs `docs/adr/0001`–`0005` written this session; see `docs/adr/`
- `CONTEXT.md` glossary (canonical)
- Session landings + final-state log: `143a850`, `d3c9289`, `c1eb3c3`

## What you'll see at `/`
Screenshot: `/tmp/civ-iter28/01-home.png` (also mobile: `16-mobile-home.png`).
- North-star summary, two learning modes (forward / retrospective), v0 features list.
- Skip-to-content link surfaces on first Tab (a11y).

## What you'll see at `/graph`
Screenshots: `/tmp/civ-iter28/02-graph-layered.png`, `03-graph-bottlenecks.png`, `04-graph-full.png`, `05-graph-frontiers-off.png`, `08-graph-product-detail.png`. Card close-ups: `/tmp/civ-iter22/06-card-closeup.png`, `09-full-card-frontier-plus-key.png`. Maturity strip on cards: `/tmp/civ-iter44/graph-cards-maturity.png`.
- Three view modes (Layered / Bottlenecks / Full) and 3 toggles (frontiers, deprecated, metrics-as-nodes).
- Three-glyph signal layer: `⚠` bottleneck (dashed amber), `🔑` key-tech, `🔭` frontier; plus maturity-label pill + as-of pill on every card.
- Detail panel: `role=region aria-live=polite`; cost rollup section with coverage-gap dot.

## What you'll see at `/gate`
Screenshots: `/tmp/civ-iter28/11-gate.png`, `12-gate-cost-expanded.png`. With disputed: `/tmp/civ-iter12/gate-with-disputed.png`.
- Overall gate **2.94/5** (capped by unreviewed cost data per ADR-0001 cost-scoped cap).
- Cost rollup: typical **274.7k RMB** vs **300k RMB** target; **3 / 64** subsystems still gap (see "Honest about gaps" below).
- Review-status ladder visible: `unreviewed` / `reviewed` / `disputed` / `deprecated` each with distinct gate effect.

## What you'll see at `/product/...`
Screenshots: `/tmp/civ-iter28/13-product.png`, `/tmp/civ-iter44/product-cost-rollup.png`, `/tmp/civ-iter34/01-product-with-history.png`.
- Product overview, cost rollup with coverage-gap callout, historical report `<details>` with proper heading depth.
- Maturity-history timeline (static stub) on 5 nodes — see `/tmp/civ-iter34/`.

## Honest about gaps
- **Stub cost data**: 14 leaf subsystems carry cost ranges sourced as 2025-China industry estimates, marked `unreviewed` low-confidence. Replace with real quotes / industry-report citations when promoting.
- **Stub maturityHistory**: 5 nodes only, with `source: ralph_iter34_stub`. The schema field is promoted from ADR-0002 reserved, but the data is illustrative.
- **Time-slider deferred**: data shape + static per-node timeline are live; the interactive slider component is the next ADR-class work (CONTEXT.md "time dimension is core" remains aspirational at the UI level).
- **3 cost-coverage gaps remaining**: cost-optimized hardware stack (aggregator, no children), real-time machine vision (scientific principle, shouldn't carry cost), queuing and flow variability (empirical principle, shouldn't carry cost). These are intentional category exclusions, not missing research.
- **Sibling Product unexpanded**: `parcel_sorting_robot_with_gripper_300k_rmb` exists as a deferred-neighbor placeholder with no children.

## Review-pass results
- 4 review passes ran (iters 15, 20, 31, 35). Latest two found 0 P0/P1.
- Pass-1 surfaced 3 P0 (cost UI honesty, questionId, denominator drift, `--allow-reviewed`) + 4 P1 (DAG memo, module-globals, fallback memo, cost-scoped cap) — all fixed (`0af89c9`, `796f165`).
- A11y audit (iter 42): 2 BLOCKERS + 8 MAJORs + 5 MINORs identified; all fixed by iter 45 (`c9479ae`, `ae8a278`, `51dda38`). **WCAG AA target met for measured surfaces** (audit covered home / graph / detail-panel / gate; not exhaustive).

## Next session candidates
1. **Interactive time-slider** — ADR-class. Data shape exists; design the cross-graph slider behaviour (how a global "as-of" date repaints maturity labels and gate scores).
2. **Cost-data promotion to `reviewed`** — replace 14 stub ranges with industry-report-cited values; this should lift gate cap from 2.94/5 toward 4–5.
3. **Capability-level scoring** — currently capabilities are structural-only; design the "is this capability satisfied?" score per ADR-0004.
4. **Active-graph expansion** — pick one of the deferred sibling products (e.g. gripper variant) to expand and exercise the boundary-distinction story.

---
References: `docs/adr/0001-0005`, `CONTEXT.md`, `docs/agent-memory.md` (most recent entry has full landing log), `docs/roadmap.md`.

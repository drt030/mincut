# Isolated website audit after opportunity-summary pass

Run context:

- Tested URL: `http://localhost:3006/graph` for subagents, then `http://localhost:3007/graph` for controller verification after `next build` invalidated the dev cache.
- Constraint: subagents were told to use browser interaction only. They were told not to read repository files, local data files, command output, or external websites.
- Purpose: stress-test whether the graph answers investor, startup, and manufacturing-research questions from the website surface alone.

## Subagent A: investor / startup readout

Coverage:

- Switched `Cost drivers`, `Bottleneck risk`, `Maturity`, and `System decomposition`.
- Used `Route` and `Detail`.
- Clicked root, vision/OCR, pick-and-place execution, area-scan camera, robot arm body, reducer, optics, lighting, conveyor, PLC/WCS, induction spacing, barcode/OCR software, barcode runtime.
- Used `Set as research root`.
- Opened `FANUC` and `Cognex` organization detail pages.

Findings:

- The site can surface p50 rolled-up system cost: `421,769 RMB` versus the `300,000 RMB` target.
- The site can expose supplier and investable-company candidates for robot body, reducer, conveyor/sortation, vision/barcode, and controls.
- The site can point to startup wedges around PLC/WCS adapters, induction/gapping controls, reducer life testing, and low-cost real-time vision stacks.
- Main weakness: there is no root-level investor answer panel that directly synthesizes biggest bottleneck, why, evidence strength, supplier exposure, and opportunity priority.
- Main data risks: many records are `unreviewed`; target-BOM proof is generally absent; adjacent large-sortation vendor claims can be confused with the 300,000 RMB target product.

Score: 3 / 5.

## Subagent B: broad click-through QA

Coverage:

- Clicked about 40 different visible nodes plus one organization detail entry.
- Covered `System decomposition`, `Cost drivers`, `Bottleneck risk`, and `Maturity`.
- Covered `Detail`, route/risk/weak-point tabs, organization detail, `Set as research root`, and `Original product` reset.

P1 findings:

- A `focus` deep-link scenario reportedly showed a visible 404 during exploration.
- Multiple important nodes surface `direct < children — likely data-entry mistake`, including robot arm body, precision reducer, industrial servo motor, vision compute, and parcel pick-and-place execution.
- Bottleneck semantics can conflict with low risk scores: nodes marked active/frontier/hard-to-develop can show 0-3% risk or 0 downstream bottlenecks.
- Clicking nodes reportedly changed the active lens from `Cost drivers` back to `System decomposition` in at least one flow.

P2 findings:

- Long labels still truncate in route/risk lists and graph labels.
- Leaf nodes can show awkward cost-coverage wording.
- Organization detail mixes `Maturity score not set` / `Risk 0%` with revenue and share exposure, which can confuse company-scale evidence with technology maturity.
- Single-node research-root views need a clearer empty-state explanation.

Score: 3 / 5.

## Controller follow-up in this pass

Implemented and verified a dedicated product-detail section:

- `Startup opportunity candidates`
- Ranked tagged opportunity nodes inside the selected product/subtree.
- Shows constraint categories and direct candidate exposure.
- Browser-verified at `http://localhost:3007/graph` that the root product detail displays:
  - `Low-cost real-time vision compute integration`
  - `NVIDIA`
  - `Intel`
  - `Parcel induction and spacing control`
  - `Wayzim`

Automated verification run:

- `npx tsx --test tests/detailRail.test.ts`
- `npm run verify`
- `npm run verify:ui`

## Remaining backlog

- Add root-level investor answer panel: biggest bottleneck, evidence strength, supplier exposure, cost gap, opportunity rank.
- Fix or explain cost-model inversions on high-impact nodes.
- Stabilize `focus` deep links and root/focus history behavior.
- Clarify low-risk active-bottleneck semantics.
- Add supplier table fields for ticker, market share, share basis, business exposure, target-BOM confidence, evidence status, and as-of date.
- Add throughput model fields and metrics for pph, no-read, false-read, cycle time, jam recovery, life-test duration, and qualification criteria.

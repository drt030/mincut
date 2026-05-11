---
status: accepted
---

# Cost model: range-valued metrics, prefer-direct-price rollup, multi-currency

## Context

The v0 Product target carries a specific cost anchor (300,000 RMB; see CONTEXT.md → "Cost target (parcel-sorting robot v0)"), and the validation gate must score whether local graph data adequately models that target. Prior to this decision, cost was scattered: a fuzzy string on `Product.targetContext.targetCost` ("approximately 300,000 RMB total system cost"), a number on the `total_system_cost` metric (`targetValue: 300000`), and an ambiguous `progressScore: 45`. There was no rollup mechanism, no leaf-cost convention, no currency/year handling, and no path between agent-imported research and gate scoring.

We need a cost model that supports (a) a single authoritative number per cost claim, (b) honest representation of supplier-driven uncertainty, (c) bottom-up rollup that prefers directly-known subsystem prices over computed sums, (d) multi-currency leaf data without forcing premature FX work, and (e) forward-compatibility with the future time-slider (ADR-0002 maturity model).

## Decision

### Where cost lives

Cost is captured **only on `metric`-kind nodes** attached via `measured_by` edges. The Product's `targetContext.targetCost` becomes a *description string only* (no number); the authoritative cost target lives on `total_system_cost.metrics[0].targetValue`. The `progressScore` field on metrics is **dropped** — the gate computes coverage and gap itself.

### Range-valued metrics

`metricValueSchema` extends from `number | string` to a union including `{min, typical, max}` ranges. Cost-bearing metrics carry ranges on `currentValue` (capturing supplier variance) and typically a single `typical` scalar on `targetValue` (the design target). Rollup uses interval arithmetic: `min+min`, `typical+typical`, `max+max`.

### New schema fields on metrics

- **`costAsOf: string`** (year precision; default `"2025"` for the parcel-sorting target). Mirrors `maturityAsOf` from ADR-0002.
- **`currency: enum("RMB","USD","EUR","JPY")`** (default `"RMB"`). Original-currency value preserved on the node.

### Rollup priority (top to bottom; first match wins)

1. **Direct subsystem price**: the node has its own `measured_by` cost metric — use that value, do not recurse.
2. **Commodified leaf** (`maturityLabel ∈ {mature, widely_adopted}`): use the leaf's cost metric. If absent, flag as data gap.
3. **Bottom-up fallback**: walk `requires` children, sum their costs via interval arithmetic, multiply by **15% per-layer integration overhead**. The 15% is a project-level constant, applied only in this fallback path.

There is **no per-route branching** — Products commit to a single fixed architecture (see ADR-0004), so the rollup walks one tree.

### Leaf-cost data sources, by reliability

1. Industry reports / standards / academic benchmarks (reviewed)
2. Public market price databases (reviewed)
3. Vendor catalogs (reviewed but auto-tagged `vendor_claim`, weak per ADR-0001)
4. Agent-imported online research (default `unreviewed`)
5. Hand-set placeholder (`unreviewed`, low confidence)

Agent-imported cost candidates **must** carry `evidenceIds`; `import:candidates` rejects bare cost numbers without provenance.

### Multi-currency

A project-level FX constant table at `scripts/fx-constants.ts` holds 2025 mid-rates (`USD: 7.20, EUR: 7.85, JPY: 0.048`) and is reviewed annually. Rollup converts to RMB at sum time; node values stay in their original currency for traceability. No per-node FX history in v0.

### Coverage gap reporting

Rollup output is `{ rolledUp: range, coverageGap: missingNodeIds[], costAsOf, currency: "RMB" }`. The gate's cost-related question reads `coverageGap` to compute coverage score, and reads `rolledUp.typical` vs `targetValue.typical` to compute gap score. `unreviewed` cost evidence caps cost-question scores per ADR-0001.

## Considered alternatives

- **Scalar-only cost values.** Rejected: produces false precision (one number suggests certainty that doesn't exist); harder to gate-score honestly when supplier variance is real and large.
- **Cost as a node field rather than separate metric**. Rejected: cost gets multiple values (target vs current, sometimes per-subsystem assumptions), needs evidence and review status of its own — first-class metric node fits, field-on-node doesn't.
- **Always bottom-up rollup with fixed overhead, no direct-price shortcut.** Rejected: flat 15% per layer is an engineering heuristic, not a real cost model; whenever a real subsystem market price is available it dominates the bottom-up estimate.
- **RMB-only, FX baked in at data entry.** Rejected: loses provenance and forces re-conversion if the FX assumption is revised. Multi-currency with a constant table preserves the original numbers.
- **FX time series.** Deferred: aligns with the future time-slider; not v0.

## Consequences

- `Node.metrics[].currentValue` and `targetValue` extend to a range union (forward-compatible: existing scalar values remain valid).
- `Node.metrics[]` gains `costAsOf` and `currency` (both optional except where validate:data tightens).
- `Node.metrics[].progressScore` is **removed** from schema.
- `Product.targetContext.targetCost` becomes a description string only (no numbers).
- `validate:data`: rejects numeric cost in `targetContext.targetCost`; warns on cost-bearing metric without `costAsOf` or `currency`; flags any cost candidate without `evidenceIds`.
- New file: `scripts/fx-constants.ts` exports `FX_TO_RMB_2025`.
- Gate runner adds a cost-rollup walker, coverage-gap collection, and cost-question scoring.
- Display layer (per Q11 follow-up): metrics fold into parent node visualizations (compact strip), with click-through to the full metric panel.
- Implementation rolls into the same wave as ADR-0001 (review-status ladder) and ADR-0002 (time-stamped maturity).

## Revisit when

- Annual FX update cadence proves insufficient (e.g., a 15%+ FX move within one year forces ad-hoc re-conversion).
- The 15% per-layer integration overhead diverges from observed integration costs by a meaningful margin in the parcel-sorting domain (then per-domain or per-kind overhead constants).
- Range arithmetic loses fidelity (e.g., when correlated variances matter — supplier shared across subsystems means min/max aren't independent).
- The time-slider lands and cost needs `costHistory` parallel to `maturityHistory`.

## Amendment — 2026-05-10: cost walker uses max(direct, children × 1.15)

Original ADR-0003 specified the walker as a priority cascade: prefer the direct cost reading attached via `measured_by`, fall back to commodified-leaf treatment, and only otherwise sum the `requires` children with a 15% integration overhead. **Direct reading "wins" against children whenever both are present.**

This produced an honest-looking but counter-intuitive output for the parcel-sorting graph: `parcel_manipulation_or_diverter` carried a direct reading of typical 4,000 RMB while its `requires` child `industrial_robot_arm_body` priced at typical 60,000 RMB rolled up to a children-summed estimate of typical 89,700 RMB. The flagship product's UI listed both subsystems side-by-side as siblings of equal billing, so the **parent system read cheaper than its single hardware component** — a textbook data-integrity flag the user surfaced as "成本核算明显有问题 / 子系统价格比总价还贵".

### Decision

The walker now evaluates **both** branches at every layer and returns `max(direct, children-summed × 1.15)`. The commodified-leaf short-circuit (ADR-0005) still applies before children-decomposition kicks in (a `mature` / `widely_adopted` node with a direct reading still returns that reading without descending).

`CostRollupResult` gains three fields so the UI can surface the breakdown:

- `directOnly: CostRange | null` — the target's own direct reading (or null when not authored).
- `fromChildren: CostRange | null` — the target's children-branch value (children-sum × 1.15, or null when no child contributed).
- `directLowerThanChildren: boolean` — true when both are present and `directOnly.typical < fromChildren.typical`. Drives a ⚠ "direct < children" badge in `NodeDetailPanel` so a reviewer is nudged toward fixing the under-priced direct reading.

### Why max() not min() and not always-children

- **Why not "always children"** — many leaves (servo motors, cables, etc.) have a real upstream commodity price recorded as a direct reading and *no* children. The walker still needs a direct-reading path.
- **Why not min()** — under-priced direct readings are common data-entry errors (a typo, or a quote that only covers integration not parts). Picking the smaller estimate would silently hide that error.
- **Why max()** — a system is never cheaper than the sum of its parts. The larger of the two estimates is always the safer floor for downstream gate scoring; the breakdown row + ⚠ badge surface the discrepancy so the data error gets fixed at the source.

### Implementation notes

- `walk()` now tracks a sibling `memoChildrenBranch: Map<string, CostRange | null>` so the top-level `rollupCost()` can surface `fromChildren` for the target by lookup instead of re-summing memos at the top — a naive re-sum would double-count DAG-shared grandchildren (the original walk's internal sum was already DAG-aware via the shared memo).
- Coverage-gap accounting expanded: the OLD walker stopped descending past a direct-cost ancestor, so leaves under that ancestor were never gap-counted. The NEW walker descends both branches and counts gaps everywhere. On the parcel-sorting graph, this moved the headline from "3 of 64 subsystems lack cost data" to "44 of 64". That is more honest but may temporarily move gate scores — accept the move; do not paper over by changing the eligibility filter.

### Revisit when

- Real data shows direct readings consistently undershoot children-summed in the same kind of node (then the breakdown's "direct" column is mostly a stale lower bound, and the ⚠ badge becomes noise rather than signal — at which point we may want to demote `directOnly` to a tooltip).
- Per-layer integration overhead diverges from 15% in a measurable way for the parcel-sorting domain.

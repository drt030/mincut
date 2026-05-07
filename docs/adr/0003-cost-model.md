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

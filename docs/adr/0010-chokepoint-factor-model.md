---
status: accepted
---

# Chokepoint factor model = four axes + geometric-mean composite

## Context

The `bottleneck-risk` lens ranked nodes by `nodeRisk = (1 - maturity/100) × cost_share`. That conflates maturity with cost and misses the chokepoint signal Serenity's audience cares about: a cheap component that everything depends on (InP substrate). "Maturity" is also a vague user-facing axis. See `docs/superpowers/specs/2026-06-14-chokepoint-factor-model-design.md` and the 2026-06-10 know-how-layer design.

## Decision

Four structural axes per node:

- **Cost** — value share, unchanged (`nodeCostSignalRmb`, ADR-0003). Orthogonal overlay, NOT part of the chokepoint composite.
- **Criticality** — capex-weighted downstream fan-in: distinct decomposition-parents, times the summed `demandScale` of dependent ancestor products (default weight 1 when `demandScale` is unset). Within a single product the weight is constant, so within-product ranking is the structural fan-in; the formula is cross-product-ready.
- **Concentration** — `1 / (1 + holderCount)` from `holdersForNode` (0 holders ⇒ 1.0, the strongest flag).
- **Barrier** — mean of the available signals in {`transactability=must_build`, `hard_to_develop` tag, `1 - readiness`, `min(1, capacityLeadTimeMonths/36)`}. Substitute count is deferred (the `substitutes` relation has no data yet). Maturity enters here as readiness — it is no longer a user-facing axis.

Composite (the redefined `bottleneck-risk` score):

- Quantile-normalize each axis to [0,1] over the graph's node distribution (the `bandForCost` empirical-quantile method).
- Combine by **geometric mean over the axes that are known** for the node — multiplicative structure (one low axis drags the score down → 真/伪 chokepoint) without the zero-collapse of a raw product.
- A node missing an axis is scored over its known axes and flagged `incomplete`; an unknown axis is **never** treated as 0.
- Band the composite by its **own** empirical quantiles (Q20/Q40/Q60/Q80).
- Authored `bottleneckOf` still forces band 5 (authored override outranks the computed score), preserving existing behavior.

Initial geometric-mean exponents are equal (1/k). Tunable; revisit when calibrated against real screened nodes.

## Consequences

- New `src/lib/chokepointScore.ts`; `edgeStyleFor.ts` `bottleneck-risk` band switches from `nodeRisk` to the composite. `nodeRisk` / `nodeRiskSignal` stay for any other consumer but are no longer the lens authority.
- New reserved node field `demandScale` (population deferred, `unreviewed`).
- Amends ADR-0002 / ADR-0005: `maturityLabel` remains the internal decomposition-stop input but is no longer surfaced as a user-facing "maturity" axis; it feeds Barrier.

## Revisit when

- Cross-product criticality is built (needs the multi-product view that supersedes ADR-0007).
- `substitutes` edges or `developmentDifficulty` get populated — fold them into Barrier.
- The geometric-mean exponents need calibration against real screening outcomes.

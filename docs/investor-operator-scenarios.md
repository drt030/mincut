# Investor and Operator Scenario Questions

These scenarios define the current website-level evaluation target for the
parcel-sorting robot graph. They are meant to be answered from the rendered
local app, not by reading repo files.

## Learning Focuses (audiences)

"Learner" is the umbrella — every persona is a learner with a
different focus. Feature priority follows the order below
(re-ranked 2026-06-10 per ADR-0008):

1. Retail secondary-market investor (散户) hunting supply-chain
   chokepoints: irreplaceable, high-barrier, supply-concentrated,
   market-ignored upstream segments with listed suppliers.
2. Startup founder evaluating where to build a wedge product.
3. Manufacturing analyst explaining cost, throughput, and adoption risk.
4. Curious operator comparing whether the product boundary is credible.

## Scenario Questions

1. What is the largest bottleneck or risk in the current 300,000 RMB parcel-sorting robot?
2. Which manufacturers or implementation candidates sit under that bottleneck?
3. Can the user see whether those candidates are public companies or private benchmarks?
4. What is the current rolled-up system cost, and how far is it from the 300,000 RMB target?
5. Why might throughput fail to scale: raw materials, component availability, technical maturity, integration/commissioning, or maintenance/operations?
6. If starting a company, which bottleneck, high-cost, or low-maturity subsystem looks like the best opportunity?
7. Where is the answer weak because evidence is unreviewed, vendor-only, proxy-based, or still missing?
8. Which know-how dependencies of the focal product are must-build
   (no market sells them), and who are the few organizations that
   hold them?
9. For a given bottleneck know-how, how many holders exist and how
   many are listed (with tickers visible)?
10. Which mature-looking nodes stay decomposition-eligible because
    their supply is concentrated (≤ 3 holders)?
11. Where is substitution pressure visible — i.e. which sibling
    product candidates are maturing under the same capability?

## Website Success Criteria

- The Product page exposes target cost, rolled-up p50 cost, cost range, and coverage gap.
- The Graph page exposes cost drivers and bottleneck-risk views without requiring repo knowledge.
- Node detail shows direct manufacturer or service candidates for bottleneck nodes, not only for deep child parts.
- Organization entries show public listing or private status when known.
- Details preserve uncertainty: unreviewed claims, proxy evidence, vendor evidence, and missing field evidence are visible.
- Sibling product candidates do not reuse active-product metrics as if they were the same product.

## Isolation Rule

Website-only evaluators should not read `data/`, `src/`, tests, docs, git history,
or local source files. They should use only `http://localhost:3000` and report
which pages, controls, and nodes they used to answer each scenario question.

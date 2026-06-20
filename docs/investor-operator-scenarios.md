# Investor and Operator Scenario Questions

These scenarios define website-level evaluation targets for commercial and
regression journeys. They are meant to be answered from the rendered local
app, not by reading repo files.

Current commercial paths: AI compute as the full-free trust demo, plus SpaceX
reusable launch and humanoid robotics as primary hot-domain journeys. Parcel
robot remains the internal regression/depth-demo graph.

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

1. What is the largest Chokepoint in the selected chain, and which structural axis drives it: Dependency, Concentration, or Barrier?
2. Which manufacturers, suppliers, implementation candidates, or know-how holders sit under that Chokepoint?
3. Can the user see whether those candidates are public companies, private companies, subsidiaries, or unknown exposure candidates?
4. What Cost signal is attached, and is it clearly separate from the Chokepoint reason?
5. Why might scale fail: raw materials, component availability, supply concentration, Barrier Sources, integration/commissioning, maintenance/operations, or evidence gaps?
6. If looking for a company-building or diligence opportunity, which Chokepoint, high-Cost, high-Barrier, or concentrated-supply subsystem deserves deeper inspection?
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

- The Product/domain page exposes the free learning layer and, where relevant, the paid/future-paid company/ticker exposure boundary without surprising the user.
- The Graph page exposes System decomposition, Chokepoint, and Cost lenses without requiring repo knowledge. It must not expose a reader-facing Maturity lens.
- Node detail shows direct manufacturer or service candidates for bottleneck nodes, not only for deep child parts.
- Organization entries show public listing or private status when known.
- Details preserve uncertainty: unreviewed claims, proxy evidence, vendor evidence, and missing field evidence are visible.
- Visible user-facing graph nodes have meaningful color families; grey/unclassified graph nodes fail the scenario.
- Sibling product candidates do not reuse active-product metrics as if they were the same product.

## Isolation Rule

Website-only evaluators should not read `data/`, `src/`, tests, docs, git history,
or local source files. They should use only `http://localhost:3000` and report
which pages, controls, and nodes they used to answer each scenario question.

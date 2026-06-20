# MinCut Roadmap

Status: long-term research roadmap. Current commercial QA priorities are in
`docs/QA-agent.md` and `docs/plans/MASTER-PLAN.md`. Where this roadmap
conflicts with 2026-06-17 acceptance, graph-layer, or commercial-focus
decisions, the newer documents win.

## Long-Term Goal

Build an interactive research system for mapping how real-world products, technologies, and capabilities become mature, manufacturable, scalable, affordable, and widely adopted.

The app should help a human understand:

- What a product or capability depends on.
- Which sibling Product candidates under the Capability could satisfy it (per ADR-0004).
- Which scientific or empirical assumptions support it.
- Which engineering and manufacturing capabilities are required.
- Which metrics determine maturity.
- Which cost, scale, reliability, safety, regulation, and deployment constraints matter.
- Which bottlenecks and placeholder breakthroughs remain.
- Which evidence supports important claims.
- Which candidate nodes, edges, metrics, bottlenecks, and evidence an agent can discover from online sources.
- Which research tasks should be done next.

The graph is the reasoning substrate. Visualization, maturity estimates, validation reports, and research tasks should all derive from structured graph data.

## Product Strategy

Start narrow and deep, but keep internal development and commercial QA
separate. The internal regression domain is:

```text
low_cost_parcel_sorting_robot_300k_rmb
```

Do not build a civilization-scale graph in the first version. Prove that one
product line can be represented, inspected, scored, and expanded through an
agent-assisted online research loop. For the commercial surface, current
first-run QA prioritizes AI compute as the full-free trust demo plus SpaceX
reusable launch and humanoid robotics as hot-domain journeys. Parcel robot
remains the regression graph unless explicitly promoted.

## Phase 0: Repo And Foundation

Status: mostly complete.

- Initialize Next.js + TypeScript + React Flow + Zod.
- Establish `/data`, `/src/lib`, `/src/components`, and `/scripts`.
- Define schemas for Node, Edge, Evidence, GateReport, and ResearchTask.
- Add local data validation.
- Add initial documentation: README, AGENTS, Architecture, Roadmap.

Exit criteria:

- `npm run validate:data` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Phase 1: Parcel Sorting Robot End-To-End Loop

Status: in progress.

- Build complete data around `low_cost_parcel_sorting_robot_300k_rmb`.
- Render the graph in `/graph`.
- Show node detail, product view, sibling-Product comparison under the Capability (per ADR-0004), metrics, bottlenecks, and evidence.
- Run the validation gate dry-run with:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
```

- Convert reviewed gate failures into pending research tasks. Use the non-dry-run gate command only for formal local report/task update:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb
```

- Add a controlled agent-assisted online research/import loop for expanding incomplete product nodes.
- Improve bilingual UI for the first domain.

Current known gap:

- Evidence is intentionally weak or placeholder-heavy.
- Gate currently fails until reviewed field evidence, target metrics, and cost assumptions improve.

Exit criteria:

- The graph clearly explains cost, throughput, perception, manipulation/diverter, conveyor integration, safety, ROI, and maintenance dependencies.
- Each sibling Product candidate under the active Capability has required enablers, bottlenecks, metrics, and evidence coverage (per ADR-0004 sibling-Product layering).
- Gate **overall score** (0–5 scale, the average across competency-question scores) reaches at least 4.0 without hiding missing evidence. This is *graph-modelling completeness*, not the Product's `maturityScore` (0–100, world-state maturity); the Product is expected to remain in prototype/early-deployment range (≈45–60 maturityScore) at v0 exit.

  Do not treat older hard-coded gate scores as current truth. Run the dry-run
  gate command for the current baseline and report the date/commit with the
  score.
- Given a target product and boundary, an agent can search online sources and import a reviewable batch of candidate graph records.
- Agent-imported records are marked `unreviewed` and include evidence/provenance or explicit gaps.

## Phase 2: Data Model Refinement

Status: planned.

- Use the parcel-sorting robot loop to identify schema, relation, maturity, and gate-scoring gaps.
- Refine the schema/import format needed for agent-discovered candidate nodes, edges, evidence, tasks, review status, provenance, and deduplication.
- Refine route maturity and module maturity explanations.
- Improve evidence coverage scoring.
- Decide whether target-specific product variants need additional schema support.
- Keep the model concrete and reusable without introducing a full ontology too early.

Exit criteria:

- New product domains can be added with minimal schema churn.
- Gate output is useful enough to guide real research tasks.

## Phase 3: Second Batch Domains

Status: planned.

Add:

```text
iphone_4
glp1_weight_loss_drugs
next_generation_glp1_derivatives
```

Purpose:

- Validate historical product integration analysis with `iphone_4`.
- Validate biomedical product maturity analysis with GLP-1 drugs and derivatives.
- Test whether current node kinds, sibling-Product layering (per ADR-0004), metrics, and evidence records generalize beyond logistics automation.

Exit criteria:

- Each target has Capability and sibling Product nodes, modules, metrics, bottlenecks, evidence, gate reports, and generated research tasks.

## Phase 4: High-Complexity Industrial Capabilities

Status: planned.

Add:

```text
reusable_space_transport_1000_usd_per_kg
commercial_controlled_nuclear_fusion
ultra_small_nuclear_reactor
```

Purpose:

- Stress-test cost-specific product nodes.
- Model manufacturing scale, reliability, deployment, regulatory friction, and long-horizon bottlenecks.
- Check whether placeholder breakthroughs and maturity caps remain understandable.

Exit criteria:

- Each Capability has its sibling Product candidates modelled (per ADR-0004) and gate reports for the active Product.
- The graph remains high-level capability and industrial maturity analysis, not detailed construction or operational guidance.

## Phase 5: Historical Industrial Case

Status: planned.

Add:

```text
ak47_rifle_historical_industrial_case
```

Purpose:

- Treat the case as a high-level historical industrial study of standardization, manufacturing capability, robustness, cost, logistics, and adoption.
- Test whether the model can represent historical manufacturability without drifting into procedural detail.

Exit criteria:

- The graph captures historical industrial constraints and adoption drivers using high-level nodes, edges, metrics, and evidence.

## Phase 6: Research Workflow And Human Review

Status: v0 requirement.

- Expand the pending task model.
- Add claim review workflows.
- Distinguish reviewed, unreviewed, disputed, deprecated, and placeholder content more clearly.
- Design and implement import surfaces for agent-assisted online research.
- Support product-driven agent expansion: user gives a product and boundary, agent searches online, proposes decomposition, and writes candidate graph records.
- Keep human review before promoting high-confidence claims.

Exit criteria:

- A researcher can pick a task, add candidate evidence/nodes/edges, run the gate, and review changes before treating claims as trusted.
- An agent can create an initial reviewable product dependency chain from online sources without presenting imported claims as reviewed facts.

## Phase 7: Future Automation

Status: later, after controlled v0 import works.

Potential future work:

- Broad autonomous crawling beyond a user-specified product and boundary.
- Better graph layout.
- Persistent database if local JSON becomes insufficient for import/review/provenance.
- Multi-user review workflow.
- Versioned graph snapshots.

These should not be implemented until the controlled agent-assisted import and human review workflow are useful.

## Current Next Tasks

Highest priority:

1. Keep `docs/ACCEPTANCE.md`, `docs/QA-agent.md`, and `docs/GRAPH_UX.md`
   aligned as the current product/QA contract.
2. Browser-QA AI compute as the full-free trust demo.
3. Browser-QA SpaceX reusable launch and humanoid robotics as primary hot-domain journeys.
4. Improve node detail first-glance disclosure: Chokepoint verdict,
   elevated structural reason, Cost as separate magnitude, Barrier Sources,
   company/ticker exposure, and evidence state.
5. Continue evidence/source review for surfaced company/ticker and
   chokepoint claims; agents never promote `reviewStatus: "reviewed"`.
6. Preserve parcel robot as the internal regression path for product
   boundary, graph topology, import, and validation-gate behavior.

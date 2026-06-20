# MinCut

Find the bottlenecks in how things get made.

MinCut is an interactive graph-based research tool for understanding how products, technologies, and capabilities become mature, manufacturable, scalable, affordable, and widely adopted.

The current commercial surface is aimed at public-market retail investors: the free layer teaches the industrial chain and its chokepoints; the paid or future-paid layer can expose company, supplier, ticker, and evidence trails tied to those chokepoints. MinCut is an analytical research tool, not stock advice.

The project goal is not to draw a pretty graph after the fact. The graph is the reasoning substrate: products, sibling products, artifacts, know-how, organizations, metrics, evidence, maturity/readiness inputs, validation reports, and research tasks should all be represented as structured local data.

## Project purpose (north star)

This tool exists for a learner studying manufacturing — how products of industry are built, where the **bottlenecks** sit in the dependency tree, and **how those bottlenecks evolve over time**. Two modes drive every design decision:

1. **Forward-looking**: for an emerging product, surface the key bottlenecks that gate its arrival.
2. **Retrospective**: for a mature product, replay the bottleneck sequence stage by stage.

The time dimension is core, not decorative. UX, content, and modelling decisions serve those two learning modes; a feature that is correct but does not help a learner trace bottlenecks ranks below one that does. See `CONTEXT.md` for the canonical language and `docs/adr/` for design decisions.

### Visual signals

Three glyphs render across the graph and product views and mean the same thing everywhere:

- **⚠ Bottleneck** — currently gating progress; rendered with a dashed amber border.
- **🔑 Key technology** — intrinsically hard to develop; a quantitative-vs-qualitative difference for any product depending on it.
- **🔭 Decomposition frontier** — research goes here next; decomposition stopped but the subtree is known to be incomplete (per ADR-0005).

### What's new in v0 modelling

These ADRs codify the v0 model and are reflected in the schema, gate, and UI:

- **Capability ⇆ Product layering** (ADR-0004). Capability nodes group sibling Product candidates; boundary distinctions live at this layer, not inside a single Product's decomposition.
- **Review-status ladder** (ADR-0001). `unreviewed` / `reviewed` / `disputed` / `deprecated` carry distinct gate semantics; `disputed` is capped *below* `unreviewed` to keep the honest signal.
- **Time-stamped maturity + future time slider** (ADR-0002). Every maturity assessment carries a `maturityAsOf`. `maturityHistory` is reserved for the time-slider that powers retrospective mode.
- **Decomposition stop = commodified leaves** (ADR-0005). Stop decomposing when a node represents a commodified input in the Product's region/era, unless an explicit override reason is recorded. Frontier nodes mark deliberate expansion candidates.
- **Cost model with range-valued metrics + RMB primary** (ADR-0003). Costs are `{min, typical, max}` with a per-layer 15% integration overhead, multi-currency leaves, and a green/amber/red coverage dot in the rollup.
- **Know-how as Barrier Sources** (ADR-0008, amended 2026-06-17). The default graph is an artifact map; `engineering_method` and `manufacturing_process` nodes stay hidden until a secondary Barrier Sources layer or detail surface needs them.
- **Chokepoint factor model** (ADR-0010). Reader-facing analysis uses System decomposition, Chokepoint, and Cost. Maturity/readiness feeds Barrier internally; it is not a public lens.

## Current Focus

Commercial QA currently prioritizes:

- `ai-compute`: full-free trust demo with company/ticker exposure visible enough to judge the method.
- `spacex-reusable-launch`: hot-domain route for graph, evidence, and future paid/future-preview checks.
- `humanoid-robotics`: hot-domain route for graph, evidence, and future paid/future-preview checks.

The internal v0 regression target remains:

```text
low_cost_parcel_sorting_robot_300k_rmb
```

This product node represents a parcel-sorting robot or sorting cell that can be sold or deployed at roughly 300,000 RMB total system cost. It is primarily used to prove and guard one closed loop:

1. Load local graph data.
2. Render the graph.
3. Inspect nodes, dependencies, routes, metrics, bottlenecks, and evidence.
4. Expand incomplete product nodes through agent-assisted online research.
5. Import candidate nodes, edges, evidence, bottlenecks, metrics, and tasks into the graph as reviewable records.
6. Compute a transparent maturity estimate.
7. Run a validation gate using only graph data.
8. Generate follow-up research tasks.

Parcel robot is no longer the main commercial first-run journey unless explicitly promoted. It remains the development graph for boundary, gate, import, and regression checks.

## Current Capabilities

- Next.js App Router application.
- TypeScript and Zod schemas for graph data.
- Local JSON graph storage under `/data`.
- Radial graph explorer following the Stable Balanced Radial Tree direction in ADR-0007 and `docs/GRAPH_UX.md`.
- Three reader-facing graph lenses: System decomposition, Chokepoint, and Cost. There is no reader-facing Maturity lens.
- Secondary Barrier Sources layer for know-how nodes when methods or manufacturing processes explain why an artifact is hard to replicate.
- Node detail panel (collapsible right-edge rail) with metrics, evidence, upstream/downstream, cost rollup, sibling products.
- Product view for the parcel-sorting robot node.
- Capability-grouped sibling Product layout (per ADR-0004): alternative architectures render as sibling Products under one Capability rather than as routes within a single Product.
- Validation gate CLI and report viewer.
- Research task queue.
- Controlled local JSON candidate import for agent-assisted research batches.
- v0 target: agent-assisted online node expansion where research happens outside the app, then cited unreviewed candidate graph records are imported locally.
- English / Simplified Chinese UI toggle.

## Tech Stack

- Next.js
- React
- TypeScript
- `@xyflow/react`
- Zod
- npm
- Local JSON files

v0 includes a controlled candidate import entry point for graph expansion. The agent workflow can search online sources outside the CLI, prepare local JSON candidate records, dry-run them with schema/reference checks, import them as `unreviewed` records by default, and leave reviewable gaps as tasks.

No user accounts, collaboration system, or broad autonomous crawling is included in v0. A persistent database is optional only if it directly supports the graph knowledge base and import workflow; otherwise local JSON remains the source of truth while the model stabilizes.

## Commands

```bash
npm install --registry=https://registry.npmjs.org/
npm run dev
npm run validate:data
npm run check:active-graph-scope
npm run import:candidates -- --file path/to/candidates.json --dry-run
npm run check:graph-ux
npm run verify:ui
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
npm run lint
npm run build
```

Agent harness commands:

```bash
npm run agent:detect
npm run agent:doctor
npm run agent:briefing
npm run agent:context -- --stage plan
npm run agent:verify
npm run agent:verify -- --scope data --run
npm run agent:audit
npm run agent:handoff
npm run agent:start
npm run agent:finish
```

`agent:verify` uses the dry-run gate command by default for data and all scopes, so verification does not write `data/gate_reports/` or update `data/tasks/pending_tasks.json`.

The local app runs at:

```text
http://localhost:3000
```

## Important Paths

- `AGENTS.md`: agent/developer operating instructions.
- `.harness/config.toml`: repo-local harness hints and verification command map.
- `.harness/hooks.toml`: provider-neutral stage-context intent.
- `docs/OPERATOR_SURFACE.md`: agent harness command contract.
- `docs/TESTING.md`: verification rules, automated checks, and required browser checks.
- `docs/agent-memory.md`: tracked handoff memory surface.
- `docs/agent-learn.md`: durable lesson capture surface.
- `docs/ARCHITECTURE.md`: architecture and technical decisions.
- `docs/GRAPH_UX.md`: graph visualization UX contract and interaction rules.
- `docs/NODE_EXPANSION.md`: workflow for expanding incomplete graph nodes.
- `docs/roadmap.md`: long-term roadmap.
- `docs/competitive-landscape.md`: competitor / adjacent-project analysis with advantage/disadvantage comparison (tiered by verification confidence).
- `docs/plans/parcel-sorting-robot-v0.md`: short-term closed-loop plan.
- `data/nodes/parcel_sorting_robot.json`: parcel-sorting graph nodes.
- `data/edges/parcel_sorting_robot_edges.json`: parcel-sorting graph edges.
- `data/evidence/parcel_sorting_robot_evidence.json`: parcel-sorting evidence records.
- `data/gate_questions/default_product_questions.json`: default validation gate questions.
- `data/tasks/pending_tasks.json`: pending research tasks.
- `src/lib/schema.ts`: schema and TypeScript types.
- `src/lib/gateRunner.ts`: validation gate implementation.
- `src/components/GraphExplorer.tsx`: graph UI.

## Data Model

The main graph entities are:

- `Node`: artifacts (`product`, `technical_route`, `module`, `equipment`, key `material`), know-how (`engineering_method`, `manufacturing_process`), organizations, metrics/context records, and deprecated compatibility kinds.
- `Edge`: typed relationship between nodes, such as `requires`, `has_route`, `measured_by`, or `bottlenecked_by`.
- `Evidence`: source or note supporting nodes or edges.
- `GateReport`: structured output from the validation gate.
- `ResearchTask`: follow-up work generated from graph gaps.

Display layers are stricter than schema kinds: the default graph canvas shows artifact nodes; know-how appears as Barrier Sources only in a secondary layer or detail; organizations, metrics, evidence, and context records stay off the default canvas.

All important JSON files should validate with:

```bash
npm run validate:data
npm run check:active-graph-scope
```

`check:active-graph-scope` guards active v0 graph exposure, reference consistency, and product detail full graph coverage.

## Validation Gate

The validation gate answers predefined competency questions using only local graph data. It must not rely on general web knowledge, model memory, or external search.

Online search belongs to the agent-assisted node expansion workflow. After candidate nodes, edges, evidence, and tasks are written into local graph data, the gate can evaluate them as local records.

Use `--dry-run` for verification and QA gate checks. This inspects gate scoring without writing a new report or updating the research task queue:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
```

When a formal gate report and recommended task updates are intentionally needed, run the writing command manually:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb
```

Candidate import is intentionally not a crawler. Use:

```bash
npm run import:candidates -- --file path/to/candidates.json --dry-run
npm run import:candidates -- --file path/to/candidates.json
```

The import file may contain `nodes`, `edges`, `evidence`, and `tasks` arrays. The CLI validates schema, duplicate IDs, references, and defaults imported candidate claims/evidence to `unreviewed`. Formal candidate imports are not allowed to write nodes, edges, or evidence marked `reviewed`; `--allow-reviewed` is only valid with `--dry-run` to inspect candidate files that have already been human reviewed.

By default, candidate import also rejects any candidate edge that would make the active v0 parcel-sorting scope directly reach a different `product` node. This still allows recursive expansion into modules, components, processes, materials, metrics, bottlenecks, evidence, and disconnected deferred product candidates. Use `--allow-active-scope-expansion` only when intentionally expanding the current product boundary after explicit review.

Minimal copyable candidate file for a dry run:

```json
{
  "nodes": [
    {
      "id": "test_candidate_import_parent_module",
      "name": "Test candidate import parent module",
      "kind": "module",
      "domain": ["test_candidate_import_workflow"],
      "description": "Fictitious module used only to test the candidate import shape.",
      "confidence": "low",
      "tags": ["test_candidate"],
      "notes": "Do not treat this as a real product or reviewed claim."
    },
    {
      "id": "test_candidate_import_child_module",
      "name": "Test candidate import child module",
      "kind": "module",
      "domain": ["test_candidate_import_workflow"],
      "description": "Fictitious child module for reference-check testing.",
      "confidence": "low",
      "tags": ["test_candidate", "decomposition_frontier"],
      "notes": "Expansion frontier for import workflow testing only."
    }
  ],
  "edges": [
    {
      "id": "test_candidate_import_parent_requires_child",
      "source": "test_candidate_import_parent_module",
      "target": "test_candidate_import_child_module",
      "relation": "requires",
      "claim": "Fictitious parent module requires the fictitious child module.",
      "confidence": "low",
      "evidenceIds": ["test_candidate_import_internal_note"]
    }
  ],
  "evidence": [
    {
      "id": "test_candidate_import_internal_note",
      "type": "internal_note",
      "title": "Fictitious candidate import smoke-test note",
      "sourceName": "Local test fixture",
      "summary": "Internal note used only to test candidate import wiring.",
      "limitations": "Not a real-world source and not evidence for any product claim.",
      "confidence": "low",
      "supportsEdgeIds": ["test_candidate_import_parent_requires_child"]
    }
  ],
  "tasks": [
    {
      "title": "Replace test candidate import fixture with real researched records",
      "reason": "The sample exists only to demonstrate candidate JSON shape and should not become product evidence.",
      "targetNodeId": "test_candidate_import_child_module",
      "suggestedNodeKind": "module",
      "priority": "low"
    }
  ]
}
```

Start with `--dry-run`. The dry run checks JSON schema validity, duplicate IDs, references between candidate and existing records, evidence links, task target references, active-scope product expansion, and accidental `reviewStatus: "reviewed"` claims without writing to `/data`. Use `--dry-run --allow-reviewed` only to preview already human-reviewed candidate files. Imported nodes, edges, and evidence default to `reviewStatus: "unreviewed"`; task IDs, `status: "pending"`, and `createdAt` are filled in when omitted.

For gate dry-run versus writing behavior, use the authoritative guidance in [Validation Gate](#validation-gate).

## Development Notes

- Keep canonical graph data in English IDs and schema fields.
- Use the UI language layer for Chinese display names and labels.
- Mark placeholder or agent-generated claims as `unreviewed`.
- Add evidence before increasing confidence.
- Keep `gateRunner.ts` local-data-only, but support a separate agent-assisted online research/import loop for expanding the graph.
- For UI, graph, layout, hover, click, expansion, or display changes, follow `docs/TESTING.md`: run automated checks and perform a clean-browser interaction check before handoff.

See `AGENTS.md` before starting future development work.

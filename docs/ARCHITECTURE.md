# Architecture

## Purpose

Capability Graph Explorer is a local-first research application. It helps a human reason about the distance between a product/capability concept and mature, scalable, affordable adoption.

The core architectural decision is that the graph is the product's source of truth. UI, maturity scoring, validation, and task generation all derive from local graph data.

## System Shape

```text
Local JSON Data
  -> Zod Schemas
  -> Graph Loader / Validator
  -> Agent-Assisted Research Import
  -> Traversal + Maturity + Gate Logic
  -> Next.js UI
  -> Gate Reports + Research Tasks
```

There is no general backend service in v0. Next.js server components read local graph records, client components render interactive UI, CLI scripts run validation/gate workflows, and the v0 roadmap includes an agent-assisted online research/import loop for adding candidate graph records.

## Major Subsystems

### Agent Harness

The repo has a lightweight local harness for agent/operator workflow. It does not replace the product graph or npm scripts; it normalizes discovery, stage context, verification, handoff, and learning around existing project surfaces.

- `.harness/config.toml`: minimal hints for target, verification commands, and v0 boundaries.
- `.harness/hooks.toml`: provider-neutral intent for `plan`, `verify`, `handoff`, and `learn` context.
- `scripts/agent-harness.mjs`: Node-native operator surface.
- `docs/OPERATOR_SURFACE.md`: command contract and verification scopes.
- `docs/agent-memory.md`: tracked handoff memory.
- `docs/agent-learn.md`, `docs/feedback-log.md`, and `docs/promotion-backlog.md`: feedback capture and promotion path.

Run `npm run agent:detect`, `npm run agent:context -- --stage plan`, and `npm run agent:audit` to inspect the harness.

### Data

Data lives under `/data`.

- `data/nodes/*.json`: graph nodes.
- `data/edges/*.json`: graph relationships.
- `data/evidence/*.json`: evidence records.
- `data/gate_questions/default_product_questions.json`: competency questions.
- `data/gate_reports/`: generated reports. JSON report files are ignored by Git.
- `data/tasks/pending_tasks.json`: research tasks.

Current v0 domain:

```text
low_cost_parcel_sorting_robot_300k_rmb
```

This target is a concrete product node, not the general demand for low-cost parcel sorting. In v0 it refers to an industrial robot-arm and computer-vision based parcel-sorting robot/cell using a vacuum-suction end-effector. Adjacent solutions such as mechanical-gripper variants, delta robot sorters, humanoid robot sorters, conveyor diverter systems, mobile robot sorting systems, and human-robot assisted workflows should be modeled as separate product candidates unless the product boundary is explicitly changed.

The graph currently includes product, module, metric, bottleneck, placeholder breakthrough, principle, manufacturing, regulation, capability, and evidence nodes. (The schema retains `has_route` and a legacy `technical_route` kind for back-compat, but no `kind: "route"` exists, and per ADR-0004 alternative architectures are modelled as sibling Products under one Capability rather than as routes within a Product.)

v0 should support a graph expansion loop where an agent can use online search to propose and import additional nodes, edges, evidence, metrics, bottlenecks, and research tasks for a target product. Imported agent records should be treated as candidate knowledge, not trusted facts.

### Product Decomposition Model

Product decomposition is part of the graph data model, not only a graph UI behavior.

Every concrete product node should be modeled as a recursive dependency graph:

```text
product
  -> subsystem / module
    -> component / route / capability
      -> manufacturing process / equipment / material / algorithm / method
        -> metric / bottleneck / evidence / principle
```

The graph does not need to expand every branch to the same depth. It should expand where the lower layer changes the maturity, feasibility, cost, manufacturability, scalability, reliability, adoption, or bottleneck explanation for the current product boundary.

For existing or mature products, the decomposition should make the core bill-of-system visible:

- core hardware and software modules;
- critical components and suppliers/process categories where relevant;
- manufacturing and assembly processes;
- deployment, safety, maintenance, and integration constraints;
- metrics and evidence that justify maturity claims.

For immature or target products, the decomposition should make the unresolved path visible:

- the highest-level subsystem or route currently blocking maturity;
- the lower-level component, manufacturing process, metric, algorithm, or principle responsible for the blocker;
- placeholder breakthroughs where the graph knows a gap exists but evidence is not yet sufficient;
- missing evidence and under-specified metrics.

The same node can be both a component of a larger system and an inspectable system in its own right. For example, a robot arm can be a required module of a parcel-sorting robot, while the robot arm itself can require servo drives, reducers, motors, links, controllers, cabling, mounting structure, and assembly processes. A reducer can later become its own inspectable system if precision machining, materials, heat treatment, bearings, lubrication, inspection equipment, or supplier constraints matter to the product question.

Recommended relation usage:

- Use `requires` for functional or compositional dependencies that are needed for the source node to work.
- `has_route` is schema-preserved but **not used in v0 data** per ADR-0004; alternative architectures are modelled as sibling Products under one Capability, not as routes within a Product.
- Use `manufactured_by` for manufacturing and assembly processes.
- Use `implemented_by` for concrete engineering methods or software methods.
- Use `measured_by` for metrics rather than treating metrics as ordinary components.
- Use `bottlenecked_by` for blockers and missing capability nodes.
- Use `part_of` only when the direction needs to state membership from child to parent; most product decomposition views should rely on source -> target dependency edges such as `requires`.

Do not use UI-only text to compensate for a shallow product model. If a lower-level part explains why the product is mature, feasible, expensive, blocked, or hard to manufacture, that part should appear as a node or a documented gap in the graph.

See `docs/NODE_EXPANSION.md` for the operational workflow for adding nodes, marking decomposition frontiers, and creating follow-up research tasks.

### Agent-Assisted Research Import

Agent-assisted research import is a v0 product requirement.

The target workflow is:

```text
user supplies product / target boundary
  -> agent plans a decomposition strategy
  -> agent searches online sources
  -> agent extracts candidate nodes, edges, metrics, bottlenecks, manufacturing/process/material/software dependencies, and evidence
  -> candidate records are dry-run through `npm run import:candidates -- --file <path> --dry-run`
  -> candidate records are written to the graph with review metadata
  -> validation checks schema and references
  -> gate evaluates only the resulting local graph data
  -> human reviews/promotes/disputes/deprecates claims
```

Important boundaries:

- Online search and LLM reasoning belong in the research/import workflow, not inside `gateRunner.ts`.
- `gateRunner.ts` must remain deterministic over local graph data so it can expose gaps and regressions.
- Agent-imported claims must be marked `unreviewed` by default. Formal candidate imports must not write `reviewed` nodes, edges, or evidence; `--allow-reviewed` is only valid with `--dry-run` to inspect records that have already been human reviewed.
- The current import entry point is a controlled local JSON CLI, not a broad crawler or autonomous backend service.
- Candidate evidence should include source title, URL when available, source name, date when available, summary, limitations, confidence, and review status.
- The import workflow should prefer small, reviewable batches over a large opaque graph dump.
- The import workflow should create tasks for branches that are probably important but not yet decomposed or evidenced.

The first implementation can still use local JSON as the write target. A persistent database may be introduced when needed for graph import, review, deduplication, provenance, or versioning, but it should serve the graph knowledge base rather than becoming an unrelated backend.

### Schema

`src/lib/schema.ts` defines Zod schemas and TypeScript types for:

- `Node`
- `Edge`
- `Evidence`
- `GateQuestion`
- `GateReport`
- `ResearchTask`
- `GraphData`

All graph data should parse through these schemas before use.

### Loading And Validation

`src/lib/graphLoader.ts` provides:

- `loadGraphData()`
- `loadGateQuestions()`
- `loadGateReports()`
- `loadTasks()`
- `writeGateReport()`
- `writeTasks()`
- `validateGraphReferences()`

`scripts/validate-data.ts` loads all local graph data and checks:

- Schema validity.
- Duplicate node, edge, and evidence IDs.
- Edge source/target references.
- Evidence references from nodes and edges.
- Evidence support references.
- Task target references.
- Expected gate question count.

### Graph Traversal

`src/lib/graphTraversal.ts` centralizes query helpers:

- Node lookup.
- Incoming and outgoing edge lookup.
- Required modules.
- Module and product routes.
- Bottlenecks.
- Metrics.
- Evidence.
- Upstream and downstream neighbors.

UI and gate logic should use these helpers instead of rewriting graph traversal locally.

### Maturity

`src/lib/maturity.ts` implements the first transparent maturity model.

Current rules:

- Route maturity (legacy `technical_route` kind) combines route score, required enablers, metric progress, and bottleneck caps. Schema-preserved for back-compat; v0 data does not contain route nodes per ADR-0004.
- Module maturity uses the best available route when routes exist; otherwise it falls back to required-enabler / metric / bottleneck rollups.
- Product maturity combines product score, module maturity, any present route maturity, and active bottlenecks.
- Placeholder breakthroughs cap maturity more aggressively.

This is intentionally an explanatory heuristic, not a claim of objective truth. The UI should show the reasoning, not only the score.

### Validation Gate

`src/lib/gateRunner.ts` answers the 20 default gate questions using only graph data.

The gate produces:

- Per-question answer.
- Score from 0 to 5.
- Missing node IDs.
- Missing edge descriptions.
- Missing evidence descriptions.
- Recommended next tasks.
- Overall pass/fail status.

The gate should prefer exposing missing information over guessing.

### Task Generation

`src/lib/taskGenerator.ts` turns gate recommendations into `ResearchTask` records and merges them into `data/tasks/pending_tasks.json`.

Tasks are lightweight in v0. They exist to keep the research loop visible, not to replace a full task management system.

### UI

The app uses Next.js App Router.

Important pages:

- `/`: current project status and entry points.
- `/graph`: interactive graph explorer.
- `/product/[id]`: product/capability detail view.
- `/gate`: generated gate reports.
- `/tasks`: research task queue.

Important components:

- `GraphExplorer.tsx`
- `NodeDetailPanel.tsx`
- `ProductView.tsx` (renders sibling-Product candidates grouped by Capability per ADR-0004)
- `GateReportView.tsx`
- `TaskQueueView.tsx`
- `LanguageProvider.tsx`

### Stable Balanced Radial Tree

Per ADR-0007 (2026-05-20), `/graph` should evolve into a Stable Balanced Radial Tree. It keeps ADR-0006's radial progressive-disclosure direction, but amends the older fixed-sector / recursive elastic-sector model. The full design contract lives in `docs/GRAPH_UX.md`; the governing principles in `docs/design-principles.md`; the current design spec in `docs/superpowers/specs/2026-05-20-stable-balanced-radial-tree-design.md`.

Key shape:

- Structural nodes (product, module, material, engineering_method, manufacturing_process) for the focal product render as a radial product decomposition tree: product at center, recursive dependencies radiating outward by depth. Angular space should be allocated by readability — subtree size, depth, label density, and collision avoidance — before subsystem grouping is drawn.
- The 33 descriptive nodes (`metric`, `bottleneck`, `placeholder_breakthrough`, scientific/empirical principles, regulations, capabilities) never render on canvas. They surface as text in the detail panel of whichever structural node they describe.
- Bottleneck and frontier status are attributes on structural nodes (`bottleneckOf?: string[]`, `frontierFor?: string[]`), not separate `kind`s; the visual presence of a bottleneck emerges from branch emphasis, glyphs, and current mode overlays.
- Subsystem grouping is expressed through base color, labels, faint region tint, or soft boundaries after the tree is readable. It is not the primary layout constraint.
- Shared dependencies remain DAG-aware through low-noise overview marks and stronger cross-links on focus / higher zoom.

What the graph answers, in this model:

- "What is this product made of?" — visible in the default radial overview without any interaction.
- "Which subsystem is most complex / most blocked / most expensive?" — encoded geometrically (branch density, path emphasis) and via the active color mode (edge color + thickness + node outline / soft grouping).
- "What does this node depend on / what depends on it?" — appears in the detail panel rail (right edge, 64px collapsed, 400px expanded) when the node is selected.
- "What blocks this product's maturity?" — encoded by color mode (default `bottleneck-risk`); high-risk nodes glow warm; their `bottleneckOf` attribute surfaces in the detail panel.

Interaction model:

- Click a structural node → highlight the relevant branch, update the detail lens, and keep the broader radial map visible as context.
- Bottleneck and evidence-gap questions are answered by branch highlight on the same map, not by switching to unrelated layouts.
- Esc / empty click / double-click current focus → exit or reduce the current focus state.
- Cmd+K → fuzzy search across node names and descriptive-node text; Enter flies to the result.
- Mouse wheel / pinch / keyboard +/- → pure viewport zoom; LOD bands switch at zoom = 0.5 and 1.5.

Display rules:

- `metric`, `bottleneck`, `placeholder_breakthrough` records are surfaced only via the detail panel.
- `requires`, `manufactured_by`, `implemented_by`, `regulated_by` edges all participate in the radial canvas; `has_route` is schema-preserved but unused in v0 data per ADR-0004; deprecated `bottlenecked_by` edges (replaced by the attribute) are migrated by the slice spec.
- If the graph lacks the next layer, expose the gap (decomposition frontier attribute) rather than inventing hidden structure.

The graph remains the source of truth. UI labels, summaries, and bottleneck explanations derive from nodes, typed edges, attributes, evidence records, maturity fields, and gate output — not from hard-coded narrative.

### Internationalization

v0 uses a lightweight client-side language layer in `LanguageProvider.tsx`.

- Canonical data remains English.
- UI labels can switch between English and Simplified Chinese.
- Graph node display names use `nodeName(id, fallback)` so Chinese aliases can be added without mutating canonical graph data.
- Language preference is stored in `localStorage`.

This is intentionally simpler than introducing a full i18n framework while the product model is still changing.

## Technical Decisions

### Local JSON Before Database

The project uses local JSON to make the graph easy to inspect, diff, validate, and edit. A database can be added when it directly supports graph import, review, deduplication, provenance, or versioned snapshots. Until then, local JSON remains the simplest source of truth.

### Zod As The Contract

Zod provides runtime validation and TypeScript type inference from the same schema definitions. This keeps data quality visible during early iteration.

### React Flow For v0 Graph UI

`@xyflow/react` v12 is the rendering substrate because it provides interactive canvas (pan/zoom), custom node rendering, viewport state subscriptions (`useStore`), and smooth `setViewport` transitions — all of which the radial progressive-disclosure model depends on. Layout is **not** delegated to a graph-layout engine at runtime: per ADR-0006 (2026-05-13), `src/lib/radialLayout.ts` is a pure function that computes polar coordinates once at mount and never recomputes on focus. ELK is removed from the runtime path. Future graph UX work follows `docs/GRAPH_UX.md` and the three design principles in `docs/design-principles.md`.

### No Full Ontology Yet

The project deliberately avoids RDF/OWL or a rigid universal hierarchy in v0. The current model uses typed nodes and typed edges with enough metadata to support reasoning without overfitting too early.

### Gate Separate From Research Import

The validation gate and agent-assisted research import have separate responsibilities.

The import workflow may use online search and an LLM/agent to discover candidate knowledge. The gate must not. The gate should evaluate what has already been imported into local graph data, identify gaps, and generate follow-up tasks.

### Bilingual UI Without Duplicating Data

Chinese support is implemented as a display layer. IDs, schema fields, and source data remain canonical and stable.

## Expansion Strategy

Do not expand every domain at once. Add domains only when the parcel-sorting robot loop is good enough to reveal useful patterns.

Recommended next domain order:

1. `iphone_4`
2. `glp1_weight_loss_drugs`
3. `reusable_space_transport_1000_usd_per_kg`
4. `commercial_controlled_nuclear_fusion`
5. `ultra_small_nuclear_reactor`
6. `ak47_rifle_historical_industrial_case`

Each new domain should include Capability and sibling Product nodes (per ADR-0004), required modules, key metrics, bottlenecks, placeholder breakthroughs, evidence, and gate results.

## Known Limitations

- Graph layout uses ELK in the main explorer, but advanced incremental layout and semantic zoom are still early.
- Gate scoring is rule-based and domain-specific in places.
- Evidence coverage is mostly placeholder for the first domain.
- Chinese translation currently covers core UI and known node aliases, not all free-text descriptions.
- Reports are generated locally and not managed by a backend.
- Task queue is a JSON file, not a workflow engine.

## Validation Commands

Run these before handing off meaningful changes:

```bash
npm run check:graph-ux
npm run validate:data
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
npm run lint
npm run build
```

The gate command above is the verification/QA dry-run path and must not write `data/gate_reports/` or update `data/tasks/pending_tasks.json`. When a formal gate report and recommended task updates are intentionally needed, run the writing command manually without `--dry-run`.

For UI and graph interaction changes, also follow `docs/TESTING.md`. Automated checks are not sufficient for hover, click, expansion, layout, or visual stability; use a clean dev server and perform browser interaction checks before handoff.

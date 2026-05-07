# Node Expansion Workflow

This document defines how to explore and add graph nodes. It is the data-modeling workflow behind recursive graph exploration.

## Current State

v0 does not have an in-app node editor yet. Node expansion currently uses local JSON files as the source of truth, with a controlled candidate import CLI for agent-assisted research batches:

- `data/nodes/*.json`
- `data/edges/*.json`
- `data/evidence/*.json`
- `data/tasks/pending_tasks.json`

Preferred import flow:

```bash
npm run import:candidates -- --file path/to/candidates.json --dry-run
npm run import:candidates -- --file path/to/candidates.json
npm run validate:data
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
```

Manual JSON edits are still possible for focused local changes. After manual edits, run:

```bash
npm run validate:data
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
npm run lint
npm run build
```

Only run the write gate command when the work should create a formal local report and update `data/tasks/pending_tasks.json`:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb
```

The import CLI is intentionally controlled rather than autonomous: research happens outside the CLI, the agent prepares a small candidate JSON batch, `--dry-run` checks schema and references, and the actual import writes reviewable local graph records.

## Target Agent Workflow

The intended v0 workflow is:

```text
user provides product / target boundary
  -> agent asks for clarification if the product boundary is ambiguous
  -> agent creates an expansion plan
  -> agent searches online sources
  -> agent extracts candidate nodes, edges, metrics, bottlenecks, manufacturing/process/material/software dependencies, and evidence
  -> agent prepares a small candidate JSON batch
  -> candidate batch passes `npm run import:candidates -- --file <path> --dry-run`
  -> import CLI writes candidate graph records as local JSON
  -> validation runs
  -> optional gate dry run previews scoring and follow-up tasks
  -> gate evaluates the updated local graph
  -> human reviews/promotes/disputes/deprecates claims
```

Agent imports must be bounded:

- one product boundary at a time;
- small reviewable batches;
- schema-valid candidate JSON;
- cited sources when claims come from online research;
- `unreviewed` default status for generated claims;
- no formal candidate import may write `reviewed` nodes, edges, or evidence; `--allow-reviewed` is only valid with `--dry-run` to inspect records that have already been human reviewed;
- no default import may add an edge from the active v0 parcel-sorting scope, including candidate nodes made reachable by the same batch, to a different `product` node;
- duplicate IDs and missing references resolved before writing;
- explicit tasks for gaps the agent cannot confidently fill.

The agent should not silently expand from a concrete product into a broad demand category. Neighboring products should become separate product candidates unless the user explicitly includes them. Use `--allow-active-scope-expansion` only after explicit review that the current product boundary should include the added product edge.

## Key Principle

A visible leaf is not automatically a terminal node.

If a node has no outgoing dependency edges, it means only one of two things:

- it is truly terminal for the current product question; or
- it is a decomposition frontier whose next layer has not been modeled yet.

For most real product components, the second case is more common. For example, `industrial_servo_motor` is not a terminal node. It can be decomposed into stator, rotor, magnets, windings, encoder, housing, bearings, thermal design, motor-control interface, manufacturing process, and supply constraints.

The same rule applies at whole-product scope. For the current parcel-sorting robot, the first agent-assisted import should not stop at one interesting part. It should cover the major product branches that determine feasibility: vision/label recognition, parcel tracking, robot arm body, end effector, servo drive, reducer, motor, conveyor integration, PLC/WCS integration, safety, maintenance, cost, and field-performance bottlenecks.

The default depth is recursive, not one layer. When the user asks for a complete product chain, expansion should continue until each important branch reaches one of these stopping points:

- a raw material or mineral extraction/refining chain, such as copper ore, iron ore/steelmaking, bauxite/aluminum, quartz/silicon, or rare-earth feedstock;
- a standard industrial process or equipment class whose deeper details no longer affect the current maturity or bottleneck question;
- a known frontier explicitly marked with `decomposition_frontier` and a note explaining the missing lower layers.

Stopping after one child layer is only acceptable when the user asked for a shallow preview, the next layer is irrelevant to the product question, or the import batch intentionally marks the leaf as a remaining frontier.

## Expansion Decision

Expand a node when the next layer changes at least one of:

- maturity or feasibility;
- cost or BOM assumptions;
- manufacturability or production scale;
- reliability, maintenance, safety, or deployment;
- a bottleneck explanation;
- route comparison;
- evidence requirements.

Do not expand every node uniformly. Expand the branch that matters for the current product boundary and research question.

## Frontier Marking

When a node is known to be incomplete but the next layer is not yet modeled, mark it with:

```json
"tags": ["decomposition_frontier"],
"notes": "Expansion frontier: describe what the next layer should cover."
```

Use this for nodes such as motors, reducers, servo drives, sensors, algorithms, materials, manufacturing processes, or subsystem controllers when they are not yet decomposed.

Do not use `decomposition_frontier` for metrics, evidence, or deliberately terminal standards unless there is a concrete next-layer modeling need.

## Node Addition Steps

1. Confirm the parent node and product boundary.
   - Do not add competing products as routes unless the product boundary explicitly includes them.
   - If the boundary is unclear, clarify before editing data.

2. Decide whether this is a child component, implementation route, process, metric, bottleneck, method, material, or evidence record.
   - Use existing `kind` values from `src/lib/schema.ts`.

3. Add the node to `data/nodes/*.json`.
   - Use stable English IDs.
   - Add `maturityScore`, `maturityLabel`, `confidence`, `tags`, and `notes` when useful.
   - Mark agent-generated or placeholder claims as low/medium confidence and/or `unreviewed` through supporting edges/evidence.

4. Add typed edges to `data/edges/*.json`.
   - `requires`: functional or compositional dependency.
   - `has_route`: implementation route inside the current product boundary.
   - `manufactured_by`: manufacturing or assembly process.
   - `implemented_by`: engineering/software method.
   - `measured_by`: metric.
   - `bottlenecked_by`: blocker or missing capability.
   - `validated_by`: evidence relationship when modeled as graph nodes.

5. Add evidence or explicitly leave a gap.
   - High-confidence claims should have evidence.
   - Placeholder or agent-generated claims must not appear as reviewed field evidence.
   - If evidence is missing, add a research task.

6. If the new node is not fully decomposed, mark it as `decomposition_frontier`.

7. Update display names in `LanguageProvider.tsx` for user-facing nodes that should be readable in Chinese.

8. Run validation commands and inspect `/graph`.

9. Verify interactive explorability.
   - The imported node should be reachable by expanding from the target product.
   - The node should be selectable in the graph.
   - Its detail panel should show evidence, frontier status, and children or gaps.
   - Expanding and collapsing the node should not make the graph unreadable or prevent selecting nearby nodes.

## Agent Import Record Rules

When the agent adds records from online search:

- nodes should include stable English IDs, concrete names, kind, domain, description, confidence, tags, and notes when useful;
- edges should include strict relation types, confidence, `reviewStatus: "unreviewed"`, and evidence IDs when available;
- evidence should include title, URL when available, source name, date when available, summary, limitations, confidence, and `reviewStatus: "unreviewed"`;
- frontier nodes should include `decomposition_frontier` and notes explaining likely next layers;
- unsupported but plausible branches should become tasks rather than confident graph claims.

The import should preserve provenance. The current CLI validates candidate schema, duplicate IDs, node/edge/evidence/task references, rejects accidental `reviewStatus: "reviewed"` claims, rejects default active-scope expansion to a different `product` node, and fills default `reviewStatus: "unreviewed"` for nodes, edges, and evidence when omitted. `--allow-reviewed` is only valid with `--dry-run` for inspecting already human-reviewed candidate files; it must not write `/data`. `--allow-active-scope-expansion` bypasses the active product-edge guard and should be used only when the user has explicitly expanded the current product boundary. The CLI also fills task IDs, `status: "pending"`, and `createdAt` when omitted. A future database may make provenance and review workflows easier, but local JSON remains acceptable for the first v0 implementation.

For the parcel-sorting robot v0 check case, use this whole-product expansion batch as the minimum smoke test:

- vision branch: camera, optics, lighting, compute, barcode/OCR software;
- parcel manipulation branch: arm body, end effector, suction/vacuum components, calibration;
- robot arm branch: servo drive, reducer, servo motor, links/joints, controller/I/O, cabling, mounting, assembly;
- conveyor/integration branch: photoelectric sensors, speed tracking, induction/spacing, PLC/WCS integration, chutes/bins, jam recovery;
- material/mineral branch: refined copper, copper mining/refining, electrical steel, alloy steel, iron ore/steelmaking, aluminum/bauxite chain, silicon/quartz chain, semiconductor-grade silicon/electronics, NdPr and heavy rare-earth magnet feedstocks, and elastomer feedstocks where relevant;
- evidence and tasks: every imported claim should either cite evidence or create a follow-up task for weak cost, reliability, field, or manufacturing evidence.

## Post-Import Quality Gate

After an agent-assisted import, check more than schema validity.

Required checks:

- `npm run import:candidates -- --file <path> --dry-run` passes before writing.
- `npm run validate:data` passes.
- `npm run gate -- --target <target> --dry-run` previews how scoring and generated tasks change before writing a new report when inspection is the goal.
- `npm run gate -- --target <target>` runs when the import should create the official local report/task update, and the new records appear in relevant answers.
- The graph UI can reach the new nodes through recursive expansion.
- At least one imported node can be selected and inspected in `NodeDetailPanel`.
- Detail-panel node lists can be used to navigate to imported nodes when graph-canvas selection is crowded or unstable.
- Evidence records are visible on relevant node detail panels.
- Imported claims remain `unreviewed`; human-reviewed candidate files can be previewed with `--dry-run --allow-reviewed` but not formally imported as reviewed records.
- The import created follow-up tasks for weak evidence, unresolved cost assumptions, or remaining decomposition frontiers.

If any of these fail, iterate the import workflow before expanding more nodes.

## Research Tasks

Use `data/tasks/pending_tasks.json` to track known expansion gaps. A task should name:

- the node to expand;
- why the next layer matters;
- expected node kinds to add;
- whether evidence is needed.

Example:

```json
{
  "title": "Decompose industrial servo motor for robot arm maturity",
  "reason": "The motor is currently a decomposition frontier. Add stator, rotor, magnets, windings, encoder, bearings, thermal design, manufacturing processes, cost/supply constraints, and evidence.",
  "targetNodeId": "industrial_servo_motor",
  "suggestedNodeKind": "module",
  "priority": "medium"
}
```

## UI Expectation

The graph explorer should not imply that a frontier node is complete. The detail panel should surface frontier status, and expansion controls should reveal existing children when they exist. If no children exist yet, the node should still show as a known modeling frontier rather than a finished endpoint.

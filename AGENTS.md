# AGENTS.md

## Project Context

Capability Graph Explorer is a local-first, graph-first research tool for mapping how real-world products, technologies, and capabilities become mature, manufacturable, scalable, affordable, and widely adopted.

The graph is the reasoning substrate. Nodes, edges, metrics, evidence, maturity calculations, validation gate reports, and research tasks should stay grounded in local graph data.

Current v0 focus:

```text
low_cost_parcel_sorting_robot_300k_rmb
```

The first goal is to make one product domain work end to end before expanding. Do not fill many planned domains with shallow data.

## Core Modeling Principles

1. Product and demand are different concepts.
   - A product node should represent a concrete product or product architecture, not a broad market need.
   - `low_cost_parcel_sorting_robot_300k_rmb` means the concrete 300,000 RMB parcel-sorting product currently intended here: an industrial robot-arm and computer-vision based sorting robot/cell using a vacuum-suction end-effector.
   - Delta robots, humanoid robots, conveyor diverters, mobile sorting robots, or human-robot assisted systems are not alternate routes of this same product by default. They should be modeled as separate products or product candidates unless the user explicitly clarifies otherwise.
   - A demand such as "low-cost parcel sorting" may motivate multiple products, but it should not be silently merged with one product node.

2. Clarify before adding a new product.
   - Before creating or expanding a new product node/domain, ask the user to clarify the product boundary, intended architecture, target user/context, cost/performance target, and which neighboring products should remain separate.
   - Do not infer a broad demand from a product name and then populate competing products as routes.

3. Decompose products recursively, not just visually.
   - Product decomposition is a graph modeling responsibility, not only a UI interaction pattern.
   - When modeling a product, identify the high-level modules/subsystems first, then add at least one lower layer for the most important or most maturity-sensitive subsystem when the domain focus requires it.
   - Treat each subsystem or component as both part of a larger product and a potentially independent inspectable system with its own required components, manufacturing processes, metrics, evidence, and bottlenecks.
   - For hardware, decomposition should be able to move from product -> subsystem -> component -> manufacturing process/equipment/material -> lower supply or scientific constraints when useful.
   - For software or capability nodes, decomposition should be able to move from product function -> algorithm/model/control method -> data/compute/performance constraint -> scientific or empirical principle when useful.
   - Do not stop at only first-level modules if the product's maturity, feasibility, cost, or bottleneck depends on lower-level components such as reducers, servo drives, motors, sensors, materials, precision processes, or algorithms.
   - Do not create low-level nodes everywhere by default. Add the next layer where it explains maturity, cost, manufacturability, scalability, adoption, or a bottleneck for the current product boundary.

4. Keep graph data explicit.
   - Important claims should appear as node metadata, edge claims, metric values, evidence records, or notes.
   - Avoid hiding important reasoning inside UI-only text.

5. Keep relation semantics strict.
   - Use the existing edge relation set in `src/lib/schema.ts`.
   - Do not add vague `related_to` style edges.
   - Add a new relation only when existing relations cannot represent a recurring, important semantic.

6. Evidence matters.
   - New high-confidence claims should have evidence.
   - Agent-generated or placeholder material must be marked `unreviewed`.
   - Vendor claims, internal notes, and placeholders are allowed, but must not be presented as reviewed field evidence.

7. Agent-assisted node expansion is part of v0.
   - v0 should support a workflow where the user gives a concrete product, then an agent uses online search to propose and add relevant nodes, edges, evidence, metrics, bottlenecks, and decomposition frontiers.
   - Agent-generated graph changes must be grounded in cited online sources or explicit internal notes, and must enter as `unreviewed` unless a human reviews the claim.
   - Agent expansion should prioritize building a complete product dependency chain: product -> subsystem -> component -> manufacturing/software/material/process constraints -> metrics/evidence/bottlenecks.
   - The agent should create research tasks for branches it identifies but cannot confidently decompose or evidence.
   - Do not present agent-added claims as established facts until evidence and review status support that.

8. Validation gate uses only local graph data.
   - `gateRunner.ts` must not use web knowledge, search, model memory, or external APIs.
   - Gate answers should expose gaps rather than invent answers.
   - Online search belongs in the agent-assisted expansion/import workflow, not inside gate scoring.

9. Preserve the v0 boundary.
   - Add controlled agent-assisted online research and candidate graph import for v0.
   - Do not add auth, collaboration, broad autonomous crawling, or unrelated backend services unless explicitly requested.
   - A persistent database is allowed only if it directly supports the graph knowledge base/import workflow; otherwise keep local JSON until the graph model stabilizes.

10. UI should support research work.
   - Keep the first screen useful, dense, and readable.
   - The app should remain usable in both English and Simplified Chinese.
   - Use `LanguageProvider` for switchable UI labels and `nodeName(id, fallback)` for graph node display names.

11. Avoid broad rewrites.
   - Follow existing file organization and helper APIs.
   - Keep changes focused on the requested task.
   - Do not refactor unrelated data or UI unless it blocks the task.

## Operational References

- `README.md`: onboarding, current capabilities, commands, and demo flow.
- `docs/OPERATOR_SURFACE.md`: local agent harness command contract.
- `docs/TESTING.md`: verification rules, automated checks, and required browser interaction checks.
- `docs/ARCHITECTURE.md`: architecture, technical decisions, repository map, validation commands, and subsystem notes.
- `docs/NODE_EXPANSION.md`: workflow for recursively expanding incomplete graph nodes and marking decomposition frontiers.
- `docs/roadmap.md`: long-term roadmap and domain expansion sequence.
- `docs/plans/parcel-sorting-robot-v0.md`: current product-domain plan and validation focus.
- `docs/agent-memory.md`: tracked handoff memory for unfinished work.
- `docs/agent-learn.md`: durable learn log for repeated feedback and prevention items.
- `docs/ux-flow-tours.md`: three end-to-end UX flow playbooks. The agent runs **only when necessary**: user requested, OR ~8–10 substantive UI commits have landed since the last report under `docs/ux-flow-reports/`, OR the agent has a specific reason to suspect a flow regressed. **Not per-commit.** Tours are expensive (~10–15 min and serious token budget); the cheap verification (`npm run verify`) is the per-commit gate. See "when to run" inside the doc for the full rule.

## Handoff Checklist

- Run `npm run agent:context -- --stage verify` before final verification for broad changes.
- Run `npm run validate:data` if graph data changed.
- Run `npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run` if gate logic or parcel data changed.
- Run `npm run check:graph-ux` if graph UI, layout, hover, click, expansion, or visual behavior changed.
- Run `npm run verify` (lint + check:graph-ux + node --test) for any code change. Replaces ad-hoc check sequencing for slice work.
- Walk a UX flow tour (`docs/ux-flow-tours.md`) **only when necessary** (user-requested, long stretch since last run, or you suspect a regression in a specific flow). Skip per-commit; the cheap `npm run verify` is the per-commit gate.
- Run `npm run verify:ui` for meaningful UI or app-router changes.
- Run `npm run lint` if TypeScript or React code changed.
- Run `npm run build` for UI or app-router changes.
- Run `npm run agent:audit` if harness files changed.
- For UI/interaction/display changes, test the changed surface in a clean browser session or fresh dev server port. If browser verification is not reliable, explicitly report what was not verified and why.
- Keep dev server running on the tested URL if the user is testing in browser.
- Summarize changed files, automated validation results, browser interactions tested, and remaining risks.

## Agent skills

### Issue tracker

Issues and PRDs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as `Status:` line values. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root, created lazily by `/grill-with-docs`. See `docs/agents/domain.md`.

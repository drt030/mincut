# AGENTS.md

## Project Context

MinCut is a local-first, graph-first research tool for mapping how real-world products, technologies, and capabilities become mature, manufacturable, scalable, affordable, and widely adopted. The current commercial audience is public-market retail investors who want to learn an industrial chain for free, then inspect company/supplier/ticker exposure as a paid or future-paid diligence layer.

The graph is the reasoning substrate. Nodes, edges, metrics, evidence, maturity calculations, validation gate reports, and research tasks should stay grounded in local graph data.

Current focus:

- Commercial QA and user-facing work prioritizes `ai-compute` as the full-free trust demo, plus `spacex-reusable-launch` and `humanoid-robotics` as primary hot-domain journeys.
- `low_cost_parcel_sorting_robot_300k_rmb` remains the internal v0 development/regression target for gate, graph, data-model, and product-boundary checks.
- Do not promote a new commercial domain unless its product boundary, graph topology, evidence state, and route access state are explicit. Avoid broad shallow expansion.

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
   - Default graph views are artifact maps: product, technical route, module, equipment, and key material nodes. Organization, metric, evidence, and context records stay in detail/evidence/gate surfaces.
   - Know-how nodes (`engineering_method`, `manufacturing_process`) are **Barrier Sources**: hidden by default, summarized on host artifacts, and shown only in an explicit secondary layer or detail surface when they explain Barrier, holder scarcity, evidence gaps, or chokepoint logic.
   - Reader-facing graph lenses are **System decomposition**, **Chokepoint**, and **Cost**. Maturity/readiness is an internal input to Barrier, not a public lens.
   - No user-facing graph node may be grey or unclassified. If a node cannot receive a meaningful color family, hide it from the primary map or move it to a secondary surface.

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

- Product-facing issue intake is acceptance-first, fix-second:
  - Before changing product code for a user-reported UI, graph, commercial, data-display, or QA failure, map the reported symptom to `docs/ACCEPTANCE.md` and `docs/QA-agent.md`.
  - This checklist explicitly authorizes Codex to spawn a sub-agent for the independent QA replay required below. Treat this as the user's explicit sub-agent authorization for that bounded replay task; do not wait for a separate chat message before using a sub-agent when the replay is required.
  - For any QA miss or acceptance miss, run an independent QA replay against the affected URL/surface using the current QA docs before the product fix. Do not give the replay agent the user's exact symptom list; use it to test whether the acceptance process can discover the failure class on its own.
  - If the independent replay misses any user-reported failure class, improve `docs/QA-agent.md`, `docs/ACCEPTANCE.md`, `docs/agents/acceptance-judge-prompt.md`, or the relevant machine/test gate first, then rerun an independent QA replay. Repeat until the replay reports the failure class or a real blocker is documented.
  - If the failure mode is already covered, cite the exact section/bullet in the work notes and add or run a focused failing check against that rule before the product fix when a reasonable automated seam exists.
  - If the failure mode is missing or only covered by broad language, update `docs/QA-agent.md`, `docs/ACCEPTANCE.md`, or the relevant machine/test gate first. Do not proceed to the product fix until the acceptance delta is explicit in the diff.
  - Final handoff must state either the exact existing acceptance rule that covered the issue or the QA/acceptance/machine-gate change that now covers it, plus whether the independent replay found the issue after the acceptance update.
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

## Evidence audit protocol

When asked to audit evidence / check source credibility for a domain, follow the FIXED method — do not improvise:

- **Entry point:** `/audit-evidence <domain-slug>` (`.claude/commands/audit-evidence.md`) runs the whole pipeline. The runtime method lives in `docs/agents/evidence-audit-brief.md`.
- **Two axes (ADR-0001, amended 2026-06-14):** `reviewStatus` is **owner-only** (human judgment, only path to 5/5). `machineCheck` is **agent-granted** (source re-fetched, quote+number confirmed) and lifts an unreviewed claim's gate cap 3/5 → 4/5. They are orthogonal.
- **Hard invariants:** an agent **NEVER** writes `reviewStatus: "reviewed"` (owner-only, applied via `applyOwnerFlips`; test-guarded in `tests/auditNeverWritesReviewed.test.ts`); escalate **≤ 10** records; demote dead/wrong sources to `rejectedEvidenceIds` / `machineCheck=failed`, never delete; one fact per claim with verbatim quote (ADR-0009); verification subagents run **Opus 4.8**.
- **Deterministic core:** `npm run audit:evidence -- --domain <slug> [--refresh] [--write] [--verdicts <file>]` (`src/lib/evidenceAudit.ts`). Triage + HTTP source-status + machineCheck stamping are pure/tested code; only the quote/basis judgment uses the LLM.
- **Remediation ladder (ADR-0009, when a cited source does not support a number):** ① re-source (authoritative source + verbatim quote at the same basis; fix mislabelled basis) → ② downgrade to estimate (relabel best-estimate + record method + anchor sources + `confidence: low`) → ③ downgrade to qualitative (drop the number, keep the claim) → ④ delete (move to `rejectedEvidenceIds`, never silently keep). A re-sourcing pass = one Opus subagent per claim returning FOUND or NOT-FOUND + recommended rung.

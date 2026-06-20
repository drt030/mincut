# Agent Learn Log

Capture durable lessons that should prevent repeated mistakes in this repo.

## Entry Template

- date:
- source:
- feedback:
- root cause:
- scope: `one-off` | `candidate default` | `confirmed default`
- target surface: `policy` | `checklist` | `hook` | `command` | `template` | `core`
- prevention checklist item:
- where recorded:
- validation needed:

## Lessons

- date: 2026-04-27
- source: user feedback after React Flow + ELK graph UX changes
- feedback: Automated checks and build success did not catch real hover flicker and poor graph usability.
- root cause: Verification over-relied on static/code checks and a polluted Next dev server; hover still drove graph-wide React Flow state even though it no longer triggered ELK layout.
- scope: `confirmed default`
- target surface: `checklist` | `command` | `policy`
- prevention checklist item: For UI, graph, layout, hover, click, expansion, or display changes, run relevant automated checks and then perform a clean-browser interaction check. If the browser check is unreliable, state that limitation explicitly instead of treating static checks as UX validation.
- where recorded: `docs/TESTING.md`, `docs/GRAPH_UX.md`, `AGENTS.md`, `npm run check:graph-ux`, `npm run verify:ui`
- validation needed: Keep expanding automated interaction checks when recurring UI regressions are found; do not remove manual browser verification until a real browser automation suite covers hover/click/expand/filter flows.

- date: 2026-04-28
- source: user feedback after graph double-click expansion fix
- feedback: Double-clicking a node expanded it and also zoomed the canvas.
- root cause: React Flow's default double-click viewport zoom stayed enabled while the graph assigned double-click to node expansion.
- scope: `confirmed default`
- target surface: `checklist` | `command` | `policy`
- prevention checklist item: When double-click is used for a graph node command, disable React Flow `zoomOnDoubleClick` and browser-verify that the viewport transform scale is unchanged after double-click.
- where recorded: `docs/TESTING.md`, `npm run check:graph-ux`
- validation needed: Add a real browser automation suite for viewport-transform assertions if this interaction area keeps changing.

- date: 2026-04-28
- source: user feedback after double-click zoom fix
- feedback: Double-click no longer zoomed the canvas, but real double-click still did not expand/collapse nodes.
- root cause: The fix validated viewport scale stability but did not validate the actual command result. The implementation depended on `click` event `detail >= 2`, which is less reliable than an explicit node `onDoubleClick` handler across real interaction paths.
- scope: `confirmed default`
- target surface: `checklist` | `command` | `policy`
- prevention checklist item: For graph double-click changes, browser verification must assert both command effect, such as node count or expanded state, and viewport stability. A scale-only check is incomplete.
- where recorded: `docs/TESTING.md`, `npm run check:graph-ux`
- validation needed: Keep an explicit regression check that custom graph nodes own double-click behavior through `onDoubleClick`, not only `click` detail.

- date: 2026-04-29
- source: QA review after validation-gate and task-queue improvements
- feedback: Historical gate reports and retained gate-generated tasks can mislead users when they look like current results after gate logic changes.
- root cause: The UI initially rendered all gate reports as equal current evidence, and task merging kept the first pending task metadata even after later gate runs produced the same follow-up titles with updated report provenance.
- scope: `confirmed default`
- target surface: `checklist` | `core` | `policy`
- prevention checklist item: Gate UIs must make the latest report visually primary and mark older reports as stale/historical. Pending gate-generated tasks should refresh source report metadata on rerun while preserving manual status changes such as `done` or `in_progress`.
- where recorded: `src/components/GateReportView.tsx`, `src/lib/taskGenerator.ts`, `docs/agent-learn.md`
- validation needed: After gate logic changes, run the gate command, inspect `/gate` and `/tasks`, and confirm current report/task provenance cannot be confused with stale historical output.

- date: 2026-06-12
- source: user feedback during humanoid robotics and controlled fusion domain expansion
- feedback: Data collection agents can be cheap, but data-quality judgment must use a stronger agent; the same agent should not both generate and validate launch-critical graph decisions.
- root cause: Earlier goal design mixed generation, selection, and validation too tightly, which let gray nodes, messy edges, and incomplete route coverage survive until the user inspected the UI.
- scope: `confirmed default`
- target surface: `policy` | `checklist`
- prevention checklist item: For new paid-domain graph expansion, split roles explicitly: inexpensive collectors gather candidate sources/components/routes, while a stronger reviewer decides evidence quality, merge/split boundaries, and whether nodes/edges are launch-ready. Replace reviewer agents between major review rounds instead of repeatedly asking the same reviewer to re-approve.
- where recorded: `docs/plans/MASTER-PLAN.md`, `docs/agent-learn.md`
- validation needed: Before declaring a new paid domain ready, report which role performed collection, which role performed quality judgment, and what route/product boundaries were merged or kept separate.

- date: 2026-06-18
- source: user feedback after AI compute graph/detail QA miss
- feedback: When a product-facing issue is reported, the agent should first explain why QA/acceptance missed it and strengthen the acceptance net before fixing the concrete UI/data issue. A fresh independent QA agent should rerun the acceptance flow; if it cannot discover the user's reported failure class, the QA standard must improve and replay again until it can.
- root cause: Existing docs contained broad graph/detail QA language, but the operational sequence allowed agents to start implementation first and treat QA coverage as a final handoff item. It also lacked a replay loop that proves an independent QA agent can actively discover the class of defect without being handed the exact symptom list. Broad rules let specific failures slip through: detached arrow endpoints, unexplained numeric badges, non-top nodes in Key Chokepoints, and weak evidence or missing holder coverage presented as bottleneck reasons.
- scope: `confirmed default`
- target surface: `policy` | `checklist` | `template`
- prevention checklist item: Product-facing issue handling is acceptance-first, fix-second, and replay-verified. Map the reported symptom to `docs/ACCEPTANCE.md` / `docs/QA-agent.md`; run an independent QA replay against the affected surface without the exact symptom list; if coverage is missing, broad, or the replay misses the class, update QA/acceptance/machine-gate rules and rerun a fresh replay before touching product implementation. Final handoff must name the exact rule or new coverage and whether the replay found the issue.
- where recorded: `AGENTS.md`, `docs/QA-agent.md`, `docs/ACCEPTANCE.md`, `docs/TESTING.md`, `docs/master-agent.md`, `docs/agents/acceptance-judge-prompt.md`, `docs/agent-learn.md`
- validation needed: On the next product-facing fix, verify that the first diff or work note is the acceptance citation/update plus independent replay result, then add the concrete product regression test/fix second.
- replay calibration: The first independent AI compute replay on 2026-06-18 found unexplained numeric badges and a weak-evidence/detail issue, but missed detached/decorative edge geometry and multiple detail-rail semantics. The QA runbook now requires named edge-pair sampling, AI compute regression nodes, concrete chokepoint mechanisms, holder-coverage wording, and non-top-node treatment checks so a future replay has executable targets.

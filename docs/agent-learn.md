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

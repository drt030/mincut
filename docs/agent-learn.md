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

- date: 2026-06-20
- source: user feedback during graph-first homepage redesign preview
- feedback: Save every approved design preview for later comparison; otherwise the implementation can drift while iterating. Do not remove the saved preview until the user confirms the work is complete.
- root cause: Visual brainstorming artifacts can live only in ignored local directories such as `.superpowers/`, which makes them easy to lose or ignore during implementation and QA.
- scope: `confirmed default`
- target surface: `policy` | `checklist`
- prevention checklist item: Before implementing any user-approved UI design preview, save the preview source and a rendered screenshot under a tracked docs path such as `docs/plans/assets/`; use the saved sample as the browser-verification reference; remove it only after explicit user sign-off.
- where recorded: `docs/design-principles.md`, `docs/agent-learn.md`
- validation needed: In UI implementation handoffs, name the saved preview asset paths and state whether the rendered implementation still matches or intentionally diverges from them.

- date: 2026-06-20
- source: user feedback during AI compute system-overview rail design
- feedback: A system overview that uses a reasonable framework such as TOC can still be low quality if the copy is generic, repeats itself, exposes internal data gaps, or fails to serve the public-market investor/research user. The overview must explain the concrete product system, its production path, current improvement direction, industry-chain impact, risks, and evidence-supported conclusions.
- root cause: The agent initially treated the presence of domain nouns and a plausible framework as enough. That let tautologies such as "improve the bottleneck" and generic capacity-shortage outcomes score too highly, while missing the user's need for system-specific, commercially useful readouts.
- scope: `confirmed default`
- target surface: `policy` | `checklist` | `template`
- prevention checklist item: Every system overview must pass the `System read` row contract before implementation: `System target`, `Production path`, `Constraint mechanism`, `Improvement path`, `Industry-chain impact`, `Main risks`, and `Evidence support`. QA must score each row 0/1/2 and reject overview content below 12/14, any required row scored 0, generic framework prose, reader-facing internal data gaps, visible raw `MinCut` jargon, or commercial impact that fails to identify affected chain positions.
- where recorded: `docs/ACCEPTANCE.md` §3c, `docs/QA-agent.md` Gate 3, `docs/agent-learn.md`
- validation needed: Before updating a real route overview, run a fresh QA pass against the rendered default rail and include the row-by-row `System read` score in the handoff. Do not ship the overview until the QA agent passes the contract.
- calibration: Independent agents on 2026-06-20 were able to derive a concrete AI compute system read from the new contract, but exposed ambiguity around microcopy (`TOC lens`), evidence priority, coupled chokepoint ranking, commercial-impact overclaims, and whether a useful row with a forbidden tail can pass. The acceptance/runbook now require all visible overview microcopy to pass Gate 3, forbid deprecated/failed evidence as overview support, allow coupled constraints when graph-supported, require `Improvement path` to name an improvement mode, judge grouped commercial outcomes per chain position/outcome, prohibit `Evidence support` from containing navigation or placement copy, and treat hard-fail tails as blockers even when the row has reusable content.
- follow-up calibration: The route-default system overview should not include a 2x2 core readout by default. Graph lenses already provide visual chokepoint orientation, and the `System read` table carries the explanatory structure. A compact tile board is allowed only when it adds a new decision layer that is not a shorter repeat of `System target`, `Constraint mechanism`, `Improvement path`, or `Industry-chain impact`.
- follow-up calibration: `System read` is the internal QA contract name, not a visible UI layer. In the route-default overview, the system thesis should be followed directly by the seven row contract entries without an intermediate `系统读法` / `System read` heading or `系统层` / `System layer` meta label.

- date: 2026-06-20
- source: user feedback after full verification was rerun for a narrow system-overview change
- feedback: Full `npm run verify` is too expensive to run reflexively. For clear single-point functionality changes, use test levels and run targeted checks first. Full verification is for long-running work, large/broad modifications, repeated failures, pre-merge/release readiness, or explicit user request.
- root cause: The handoff checklist treated `npm run verify` as the default for any code change, causing unrelated graph/data/redaction/layout tests to run even when focused tests and browser checks were enough for the actual change.
- scope: `confirmed default`
- target surface: `policy` | `checklist` | `command`
- prevention checklist item: Use the verification levels in `docs/TESTING.md`: Level 1 focused tests, Level 2 related-surface checks, Level 3 build/UI readiness, Level 4 full `npm run verify`. Do not run Level 4 by default for narrow changes; state the chosen level and why when reporting validation.
- where recorded: `AGENTS.md`, `docs/TESTING.md`, `docs/agent-learn.md`
- validation needed: On the next narrow UI/content/code change, verify with focused tests and browser checks only unless the change scope escalates to Level 4.

- date: 2026-06-21
- source: user feedback on selected AI compute node detail core readout layout
- feedback: The selected-node core readout in the right rail should not force four tiny columns. The desired layout is the readable 2x2 tile treatment; matching a saved sample too literally on width is the wrong priority.
- root cause: `docs/ACCEPTANCE.md` and `docs/QA-agent.md` still encoded the older rule that four tiles should render in one row when they technically fit. The implementation followed that stale rule via `repeat(4, minmax(0, 1fr))`, so QA would miss or even reject the desired 2x2 rail layout.
- scope: `confirmed default`
- target surface: `policy` | `checklist` | `machine-gate` | `test` | `ui`
- prevention checklist item: Selected-node detail core readouts must use a stable 2x2 rail layout by default. QA should fail cramped four-column rows in the narrow rail, and machine/static tests should guard both the generic detail grid and the sample-style commercial supplier shell.
- where recorded: `docs/ACCEPTANCE.md` §3a, `docs/QA-agent.md` Gate 5, `scripts/check-disclosure.ts`, `tests/detailRail.test.ts`, `tests/topNGlyph.test.ts`, `docs/agent-learn.md`
- validation needed: For future node-detail IA changes, browser-check a selected node in the real rail and verify the four core tiles render as two columns by two rows without text overflow before final handoff.

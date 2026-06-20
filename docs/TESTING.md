# Testing and Verification

This repo uses layered verification. Automated checks catch structural regressions, but they do not replace real interaction testing for UI work.

## Default Rule

After changing any feature, run the narrowest relevant automated checks first. If the change affects UI, layout, graph interaction, animation, filtering, hover, click, expansion, routing, or visual state, also perform a real browser check before handing off.

If a browser check cannot be completed reliably, report exactly what was not verified and why. Do not present build, lint, or static checks as proof that an interaction feels good.

**Acceptance is defined by `docs/ACCEPTANCE.md`.** §6 routes each change type to its gates; any change a user can see also runs the QA agent against §3 (machine-green is never sufficient for a UI / product change).

For user-reported product defects and QA misses, update or cite the acceptance rule before changing the product implementation. First run an independent QA replay against the affected surface without giving the replay agent the exact symptom list. If the replay misses a reported failure class, add or sharpen the QA/acceptance/machine-gate rule first, then rerun a fresh replay until it independently reports the class or a concrete blocker is documented. Only then write the concrete fix and verify against that rule. Do not leave acceptance coverage as a final cleanup step.

For paid-launch or commercial-readiness QA, `docs/ACCEPTANCE.md` is the
acceptance contract and `docs/QA-agent.md` is the browser/testing runbook.
That QA is organized around commercial promise, paid insight trust, graph
map readability, node-detail investor summary, and release guardrails.
Automated commands are supporting evidence; they are not a substitute for
the commercial QA gates.

## Automated Checks

Use these commands by change type:

```bash
npm run check:graph-ux
npm run check:disclosure   # ACCEPTANCE.md §4 machine floor: first-glance elevated-axis headline + lens-vocabulary match
npm run lint
npm run build
```

For graph data changes:

```bash
npm run validate:data
npm run check:active-graph-scope
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
```

`check:active-graph-scope` covers active v0 graph exposure, reference consistency, the `/explore` active graph research home, `/d/[slug]` domain-registry switching, and the product detail full graph guard. Root `/` is the commercial landing page and must not load graph data.

Verification and QA gate checks should use `--dry-run` so they do not write a new report or update `data/tasks/pending_tasks.json`.

When a formal gate report and recommended task updates are intentionally needed, run the writing command manually:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb
```

For broad handoff verification:

```bash
npm run agent:context -- --stage verify
```

`npm run check:graph-ux` is a regression guard for known graph interaction failures. It checks that:

- React Flow is not remounted or auto-fit on normal graph updates.
- hover-only state does not drive graph-wide React Flow state.
- selection-only state does not trigger ELK layout.
- React Flow double-click viewport zoom is disabled because double-click is reserved for node expansion.
- Custom graph nodes handle double-click through an explicit `onDoubleClick` command, while single-click remains selection-only.
- graph nodes do not use ambient float animation.
- hover does not move the pointer hitbox.
- ELK worker is served as a static asset.

This script is necessary but not sufficient. It cannot judge whether the graph is pleasant or clear to use.

## Required Browser Checks For UI Work

For changes touching `src/components`, `src/app/globals.css`, app routes, graph rendering, filters, layout, or language display, open a clean dev server and test the changed surface manually.

Run build before starting the browser-check dev server, or restart the dev server after running `npm run build`. `next build` writes `.next` and can corrupt an already-running `next dev` process, producing false browser failures. If a dev server is already running for manual testing, do not run `npm run build` or `npm run verify:ui` in a worker handoff; leave final build and `verify:ui` to the main agent after they intentionally stop or replace the dev server.

When the user is actively using their browser, run browser checks in the background instead of reusing their window. Prefer a clean dev server on an unused port plus a temporary headless browser profile, for example Chrome with `--headless=new` and a throwaway `--user-data-dir`. Report when the in-app browser is unavailable and which fallback browser surface was used.

Minimum graph browser checklist:

- Open `/graph` from a clean dev server port.
- Confirm the page renders without Next overlay, runtime error, or console error from the changed code.
- Hover several nodes and confirm there is no flicker, jump, repeated label flashing, or hitbox instability.
- Click several nodes and confirm the detail panel updates without moving graph coordinates.
- Inspect visible dependency edges around the reported area; if no reported area is available, sample the active route root, top Chokepoints, one high-fanout node, and at least eight visible incident `primary` / `requires` edges. Name the sampled edge pairs in the handoff. Arrowheads and endpoints should attach to rendered node boundaries/ports, primary tree edges should read as dependency links rather than decorative curls, and dense siblings should not all emerge from one indistinguishable point.
- Inspect any numeric graph badges. Their meaning must be available through a tooltip, legend, accessible label, or adjacent layer copy, and they must not be mistaken for rank, evidence count, or Chokepoint score.
- Confirm the default canvas is an artifact map: organization, metric, evidence, and raw context records do not render as ordinary graph nodes; know-how nodes stay hidden unless a Barrier Sources / know-how layer is explicitly active.
- If the Barrier Sources / know-how layer is touched, confirm know-how nodes render as purposeful Barrier-source nodes, artifact context keeps meaningful subsystem color, and no user-facing node is grey/unclassified.
- Open top/authored Chokepoint nodes and at least one ordinary dependency node. Confirm the **first-glance chokepoint readout**: the elevated structural axis (Dependency / Concentration / Barrier) reads as a concrete mechanism, not a raw tag like `maturity: prototype` and not generic copy that merely says route scale depends on the constraint; Cost, when present, is a separate magnitude readout rather than the chokepoint reason (ACCEPTANCE.md §3a).
- Confirm weak evidence and missing supplier/holder coverage are framed as evidence or holder-coverage gaps, not as the specific bottleneck reason or as a real-world supplier absence. Non-top nodes should not appear in a Key Chokepoints / 具体卡点 surface unless explicitly labeled as candidate/low-confidence.
- Switch lenses (System decomposition / Chokepoint / Cost) and confirm node positions stay stable (ADR-0007) while the encoding follows; confirm lens labels match the detail-panel vocabulary (§3b, `check:disclosure`).
- Double-click an expandable node and confirm the visible node count changes in the expected direction. Also compare the React Flow viewport transform before and after double-click to ensure the canvas did not zoom.
- Switch language and confirm labels still fit.
- Test one narrow/mobile-ish viewport and one desktop-ish viewport when layout or text changed.

If the existing dev server has been through runtime errors or HMR failures, start a fresh server on a new port before testing:

```bash
npm run dev -- --port 3003
```

Old dev servers can retain bad Webpack/RSC state after runtime crashes. Do not rely on a polluted server for UX validation.

## Reporting

Final handoff should include:

- changed files,
- automated commands run,
- browser interactions actually tested,
- any unverified interaction or remaining risk.

Do not say "tested" for UI work unless a real browser interaction was performed or the limitation is explicitly called out.

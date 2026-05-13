# Promotion Backlog

Candidate harness improvements that may become stable policy, checklists, hooks, commands, templates, or core logic.

## Routing Rules

- `policy`: update `AGENTS.md` or a stable contract doc.
- `checklist`: update `.harness/hooks.toml`, `docs/OPERATOR_SURFACE.md`, or a planning checklist.
- `hook`: update provider-neutral hook intent in `.harness/hooks.toml` before adding provider-specific wiring.
- `command`: update `scripts/agent-harness.mjs` and `docs/OPERATOR_SURFACE.md`.
- `template`: update repo-local templates when they exist.
- `core`: update detection, context, verification, or audit behavior.

## Entry Template

- date:
- source feedback:
- proposed promotion:
- target surface:
- reason:
- validation needed:
- status:

## Entries

- date: 2026-05-13; source: ADR-0006 / spec 2026-05-13 slice A1 GREEN; proposed promotion: rewire downstream consumers of `kind: "bottleneck"` / `kind: "placeholder_breakthrough"` to read `bottleneckOf` / `frontierFor` attributes; target surface: `src/components/GraphExplorer.tsx` (lines ~890, 962, 1023, 1052, 2140), `src/components/NodeDetailPanel.tsx` (~885), `src/components/ProductView.tsx` (~304), `src/lib/costRollup.ts` (~173, 277), `src/lib/maturity.ts` (~53, 94), `src/lib/graphTraversal.ts` (~48, `bottlenecksForNode`), `src/lib/explorationLayout.ts` (~80), `src/lib/gateRunner.ts` (~241); reason: A1 removed all `kind: "bottleneck"` and `kind: "placeholder_breakthrough"` nodes from data; the kind-checks above now match nothing and the related UI affordances (blocker pills, bottleneck-mode tinting heuristics, maturity-cap-for-blockers) effectively no-op. Slices A3 / B1 / B2 / B3 / B4 will rewrite GraphExplorer + NodeDetailPanel and so will pick up the canonical attribute reads; cost rollup, gate runner, and maturity walker are out of scope for the radial-redesign slices and still currently green on verify (`npm run validate:data`, `npm run check:active-graph-scope`, `npm test`, `npm run lint`, `npm run check:graph-ux`); validation needed: when rewiring, ensure each call-site reads `node.bottleneckOf` / `node.frontierFor` (string id arrays) instead of filtering by `node.kind`; status: pending B/C-phase rewrite.

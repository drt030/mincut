# Operator Surface

This repo exposes a small agent harness through `scripts/agent-harness.mjs` and npm aliases. The harness wraps existing project commands instead of replacing them.

## Commands

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

## Contract

- `detect`: report discovered policy, docs, data, task, memory, learn, hook, and verification surfaces.
- `doctor`: report missing or weak harness capabilities with concrete next actions.
- `briefing`: show what an agent should read and do before changing the repo.
- `context --stage <plan|verify|handoff|learn>`: assemble the stage-specific context pack from `.harness/hooks.toml`.
- `verify`: print repo-native verification commands by default; run them only with `--run`.
- `audit`: emit a deterministic harness scorecard and top actions.
- `handoff`: print the handoff template and target memory surface.
- `start`: show the default start sequence for an implementation session.
- `finish`: show the default closeout sequence for an implementation session.

## Verification Scopes

- `data`: `npm run validate:data`, `npm run check:active-graph-scope`, and the parcel-sorting gate dry-run command.
- `code`: `npm run lint` and `npm run build`.
- `all`: data and code commands.

`check:active-graph-scope` covers active v0 graph exposure, reference consistency, and the product detail full graph guard.

Verification defaults to dry-run gate execution:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
```

This does not write `data/gate_reports/` or update `data/tasks/pending_tasks.json`.

When a formal gate report and recommended task updates are intentionally needed, run the writing command manually:

```bash
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb
```

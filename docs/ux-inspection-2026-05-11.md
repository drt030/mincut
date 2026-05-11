# UX Inspection Report — 2026-05-11 (HTTP-driven)

HEAD `598e54a`. Chrome DevTools MCP was unavailable for the whole session, so this is a curl-driven SSR markup check rather than a real visual tour. The user should run the 7-step manual tour from `docs/morning-handoff-2026-05-11.md` and override these scores with eye-of-the-beholder reality.

## Route checks

### 1. `/` (home)

| Signal | Expected | Actual |
| --- | --- | --- |
| HTTP status | 200 | ✓ 200 |
| Hero "Capability Graph Explorer" | present | ✓ |
| "forward-looking" + "retrospective" modes copy | present | ✓ both |
| Currently-exploring callout | "parcel-sorting robot" | ✓ |

**Inspection score (HTML only): 5/5 clarity, n/a responsiveness, 4/5 fit-for-purpose.** Hero is the same as iter-28's design; nothing slice 1–4 changed about home.

### 2. `/graph` (default landing — overview stage, bottleneck colorMode)

| Signal | Expected | Actual |
| --- | --- | --- |
| 22 node cards | 22 | ✓ 22 |
| `.compact` class on cards (stage="overview" default) | present | ✓ found in markup |
| ColorModeSelect dropdown markup | exactly 1 | ✓ 1 |
| Default selected option | `value="bottleneck" selected` | ✓ exact match |
| Edge style.stroke from edgeTintFor | applied to non-relation edges | inferred (inline SVG style — can't grep without rendering) |
| Compact-mode heat block `::before` 14px | CSS rule present | ✓ in `globals.css` |
| Detail panel cost-rollup-breakdown row (flagship default) | present | ✓ 1 |

**Inspection score (HTML only): 4/5 clarity, n/a responsiveness, 4/5 fit-for-purpose.** All slice-2 and slice-4 markup is in the SSR'd HTML; client-side rendering of the edge stroke + heat block colors needs eyeball verification.

### 3. `/product/low_cost_parcel_sorting_robot_300k_rmb`

| Signal | Expected | Actual |
| --- | --- | --- |
| `.cost-rollup-card` section | 1 | ✓ 1 |
| `.cost-rollup-breakdown` row (slice-4 polish parity) | 1 | ✓ 1 |
| Rolled-up typical 283,532 RMB (new walker) | present | ✓ |
| Target 300,000 RMB | present | ✓ |
| "44 of 64 subsystems lack cost data" | present | ✓ |

**Inspection score: 5/5 clarity, n/a responsiveness, 5/5 fit-for-purpose.** Slice 1's deliverable is plainly visible on the SSR'd response.

### 4. `/gate`

| Signal | Expected | Actual |
| --- | --- | --- |
| HTTP status | 200 | ✓ 200 |
| Latest gate score | "2.89/5" | ✓ |
| Historical scores in side panel | "2.94/5 · failed" alongside | ✓ |
| Page body size | > 100KB | ✓ 743KB |

**Inspection score: 5/5 clarity, n/a responsiveness, 4/5 fit-for-purpose.** Gate score moved as expected after the walker change; historical reports preserved for comparison.

## What HTML inspection can't tell you

- The actual color of edges in bottleneck mode at runtime
- Whether the compact mode 14px heat block reads as legible heat at fit-to-screen zoom
- Whether the 350ms zoom-in animation from overview → focused feels smooth or laggy
- Whether ESC actually returns to overview (keyboard listener fires only client-side)
- Whether the ⚠ inversion badge on `parcel_manipulation_or_diverter`'s detail panel is correctly positioned next to the breakdown row

These are the items you should score yourself tomorrow morning during the 7-step manual tour.

## Self-test commands

```bash
# Unit + smoke tests (20/20)
npm test

# Static checks
npm run lint
npm run check:graph-ux

# Dev server (already running on PID from this session)
lsof -i :3000

# Regenerate gate report (already done at HEAD 7b8e9ab)
# npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb
```

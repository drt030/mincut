# UX Flow Tours — manual playbook for the agent

Three end-to-end user flows the agent walks through using `chrome-devtools` MCP after **significant changes**. Output a scored markdown report under `docs/ux-flow-reports/<HEAD>-<flow>.md` (committed) so we have a history.

## When to run

Tours are **expensive** (one full run is ~10–15 minutes and burns serious token budget on screenshots + DOM inspection + agent self-scoring). They are **not** a per-commit ritual.

**Run only when one of these is true**:

1. **The user asks for one.** Direct request always wins.
2. **It's been a long stretch without a run** AND multiple user-visible commits have landed in between. Default threshold: at least 8–10 substantive UI commits since the last tour report under `docs/ux-flow-reports/`. Use git log: `git log --oneline <last-tour-HEAD>..HEAD -- src/ public/ | grep -vE "^(test|docs|chore|refactor)"`.
3. **You're suspicious a recent change broke a flow path.** E.g., you touched the stage state machine, the position pipeline, or the rendering gate for the detail panel — go verify the affected flow before claiming "done".

**Do NOT run** if:

- The commit is refactor / test-only / docs-only.
- You already ran a tour within the last few commits and nothing material has changed in the relevant flow.
- The agent is mid-iteration and there's no reason to think anything visible regressed.

Verification commands (`npm run lint`, `npm run check:graph-ux`, `npm test`, `npm run verify`) are cheap — run them aggressively. UX flow tours are expensive — run them sparingly.

## Score axes (0–5 per step)

- **Clarity** — can a new user understand what they're seeing without help?
- **Responsiveness** — does the interaction feel instant / smoothly animated?
- **Fit-for-purpose** — does this step move the user toward their goal (find bottleneck / read maturity / compare modes)?

Average all three, then average across steps. **Average ≥ 3.5 = pass, < 3.5 = next iter priority.**

The agent runs the steps via MCP and *self-scores honestly*. Score 3 if you'd see a friction in real use; don't give 5 for "works".

## Honest-scoring checklist (avoid agent self-bias)

After each step that involves visible UI, **before scoring** ask each of these questions out loud:

1. **Information necessity**: every card / pill / chip / row currently on screen — would a first-time user understand why it's there? If "no" for ≥ 2 elements, fit-for-purpose ≤ 3.
2. **Visual crowding**: any two visible elements that look like they overlap or touch at the current zoom? clarity ≤ 3.
3. **Semantic role**: can the user tell each card's *role* in the graph (focus / dependency / sibling / metric / context) without reading any text? If three different roles render with identical visual treatment, clarity ≤ 3.
4. **Surprise on screenshot**: if you sent the screenshot to the user without explanation, would they immediately ask "what's X?" That X is the problem; don't paper over it with a 5.

The agent missed exactly these in the first Flow 1 run — the focused-stage context band had 9 mystery cards and was scored 5/5/4. Don't repeat this. **When in doubt, score lower and flag the friction; the user can override upward but can't override downward.**

## Flow 1 — New user finds a bottleneck

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 1.1 | `navigate_page /` | Hero "Capability Graph Explorer", current product callout | / |
| 1.2 | Click "Open the active graph" link or navigate `/graph` | stage="overview", 13 nodes (focus + 12 children), heat blocks visible | / |
| 1.3 | DOM check: find the warmest `--heat-color` on the children row | one child should be visibly red (high risk) — identify by id | / |
| 1.4 | Click that child card | stage="focused", `viewport.scale > 0.7`, target node centered, neighbors visible, `↩ Global view` button appears | / |
| 1.5 | Inspect right detail panel | Shows cost rollup + breakdown + maturity + bottleneck info for the selected node | / |
| 1.6 | If selected node has `directLowerThanChildren=true`, find the ⚠ badge | Badge present with text "direct < children" | / |
| 1.7 | Press `Escape` | stage="overview", viewport returns to fit-view | / |

## Flow 2 — Compare cost mode and maturity mode

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 2.1 | `navigate_page /graph` | Bottleneck mode by default — heat colors per `nodeRisk` | / |
| 2.2 | Change `ColorModeSelect` to `cost` | Edges to expensive children turn warm (industrial_robot_arm_body 60k = red) | / |
| 2.3 | Read 3 distinct edge stroke colors | At least 3 distinct hex values across visible edges | / |
| 2.4 | Change to `maturity` | Edges colored by maturityLabel (Likert red→green) | / |
| 2.5 | Change to `relation` | Falls back to CSS class default (gray + relation-specific colors) | / |
| 2.6 | Change back to `bottleneck` | Same colors as 2.1 (sanity check, deterministic) | / |

## Flow 3 — Drill into the cost-inversion node

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 3.1 | `navigate_page /graph`, find `parcel_manipulation_or_diverter` card | Visible in children row | / |
| 3.2 | Click that card | Focused on it; detail panel updates | / |
| 3.3 | In detail panel, locate cost rollup | Shows ≥ 69k typical (the children-summed rollup) | / |
| 3.4 | Find the ⚠ "direct < children" badge | Present | / |
| 3.5 | Find the direct/children breakdown row | Shows "direct only: 4,000 RMB" + "from children × 1.15: 89,700 RMB" | / |
| 3.6 | Double-click the card | If implemented as expand: children appear / re-layout fires | / |
| 3.7 | Press Escape | Returns to overview | / |

## Flow 4 — Color-mode consistency

Verifies the 5-mode dropdown changes edge colors as expected, and that switching modes produces no visual artifacts.

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 4.1 | Open `/graph` | Default bottleneck-risk mode, edges heat-colored | / |
| 4.2 | DOM check: count distinct edge stroke values across all edges | ≥ 4 distinct hex strokes in bottleneck mode | / |
| 4.3 | Switch ColorMode to `cost` | Re-render within 200ms; ≥ 3 distinct strokes; expensive children warmer | / |
| 4.4 | Switch to `maturity` | Likert-mapped; low-maturity targets warm, mature targets green | / |
| 4.5 | Switch to `overall` | Continuous red→green ramp; no jarring transitions | / |
| 4.6 | Switch to `relation` | Falls back to CSS class strokes (gray + relation accents) | / |
| 4.7 | Switch back to `bottleneck` | Same colors as 4.1 (deterministic; no state drift) | / |

## Flow 5 — Multi-layer expand drill-down

Verifies that explorationLayout reflows cleanly when a deeper subsystem is expanded, and that the grid wrap kicks in only when needed.

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 5.1 | `/graph` overview | 13 nodes, grid wrap (2 rows of 6 + 1 row of 1 below flagship) | / |
| 5.2 | Double-click `parcel_manipulation_or_diverter` to expand | Its 3 requires children (industrial_robot_arm_body, end_effector, motion_planning) appear at y = depth+1 below it; canvas reflows | / |
| 5.3 | Verify no sibling jumps UP — every other module's y is ≥ previous y | DOM-evaluate; assertion holds | / |
| 5.4 | Collapse via double-click again | The 3 children disappear; layout returns to step 5.1's positions | / |
| 5.5 | Expand `industrial_robot_arm_body` (3 layers deep) | Layout still legible; cards don't overlap | / |

## Flow 6 — Keyboard navigation

Verifies a11y of all interactive surfaces.

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 6.1 | Tab from URL bar repeatedly through toolbar | Each toolbar button receives a visible focus ring | / |
| 6.2 | Tab into canvas, then arrow keys | (React Flow may not support arrow-nav out of the box; document actual behaviour) | / |
| 6.3 | Tab to a card, press Enter | Card selects (sets selectedId + focused stage) | / |
| 6.4 | Press ESC | Returns to overview stage with focus on root | / |
| 6.5 | Tab through Top Blockers list, Enter on second entry | Drills into that node | / |
| 6.6 | Tab into a collapsed `<details>`, press Enter/Space | Section expands | / |

## Flow 7 — Language switch (i18n completeness)

Verifies no missing i18n keys after switching to English.

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 7.1 | Click the "English" button (or `?lang=en` if added) | All zh strings flip to en | / |
| 7.2 | Walk through `/`, `/graph`, `/product/...`, `/gate` | No `missing.key.X` literals visible; no zh-only fallbacks | / |
| 7.3 | Switch back to 中文 | All en strings flip back | / |

## Flow 8 — Gate report sync

Verifies the gate score + coverage gap on `/gate` matches the latest report after a cost-rollup-affecting change.

| # | Action | Expected | Score |
| --- | --- | --- | --- |
| 8.1 | `/gate` | Latest report's overall score (post-walker amendment: 2.89/5) | / |
| 8.2 | Look for "44 of 64 subsystems lack cost data" | Visible somewhere on the page | / |
| 8.3 | Click a node-id link in the gate report | Navigates to `/graph?focus=<id>&stage=focused` and lands focused on that node | / |

## Report format

After running, write `docs/ux-flow-reports/<datetime>-<HEAD-short>-flowN.md` with:

```markdown
# UX Flow N — <name>

HEAD: <short-hash>
Run at: <ISO datetime>

## Step-by-step

### 1.1 ...
- screenshot: `.tmp/civ-ralph/...`
- observed: <one-line>
- score: clarity 4 / responsiveness 5 / fit-for-purpose 4
- notes: <any friction or surprise>

(repeat for each step)

## Summary

- Average score: X.XX / 5
- Pass/fail: pass | fail
- Top friction: <one-line — what's the worst step?>
- Action item: <if avg < 3.5, what's the iter-N+1 priority?>
```

The agent commits the report file. Reports accumulate so we can chart score over time.

# UX Flow Tours — manual playbook for the agent

Three end-to-end user flows the agent walks through using `chrome-devtools` MCP after **significant changes**. Output a scored markdown report under `docs/ux-flow-reports/<HEAD>-<flow>.md` (committed) so we have a history.

## When to run

Run flows after a commit that materially affects user-visible behavior:

| Change type | Run? |
| --- | --- |
| Layout algorithm change | yes |
| State machine (stage / colorMode / expansion) | yes |
| Visible CSS / animation | yes |
| New UI affordance (button, dropdown) | yes |
| Bug fix to user-facing behavior | yes |
| ADR amendment that surfaces in UI | yes |
| Pure refactor / type / variable rename | no |
| Test-only / docs-only commit | no |
| Backend / data validation tweak with no UI surface | no |

To keep token cost reasonable: at most one full run per ~3 significant commits. If three significant commits are tightly coupled (one feature shipped in three pieces), run once after the third.

## Score axes (0–5 per step)

- **Clarity** — can a new user understand what they're seeing without help?
- **Responsiveness** — does the interaction feel instant / smoothly animated?
- **Fit-for-purpose** — does this step move the user toward their goal (find bottleneck / read maturity / compare modes)?

Average all three, then average across steps. **Average ≥ 3.5 = pass, < 3.5 = next iter priority.**

The agent runs the steps via MCP and *self-scores honestly*. Score 3 if you'd see a friction in real use; don't give 5 for "works".

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

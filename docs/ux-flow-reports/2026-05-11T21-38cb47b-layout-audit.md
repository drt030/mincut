# UX Flow — Layout And Task-Path Audit

HEAD: `38cb47b`
Run at: 2026-05-11T21:16:41-04:00
Run mode: Browser walkthrough, screenshots, DOM snapshot

## Scope

The user reported that the current layout feels messy and the UX feels bad. I ran the graph-critical path plus adjacent product and gate pages, scoring for whether a first-time learner can immediately find a bottleneck, inspect it, and understand the result.

Screenshots are under `.tmp/ux-flow-2026-05-11-38cb47b/`.

## Step-by-step

### 1. Home page
- screenshot: not saved; home was viewed in-browser before file capture was started.
- observed: The home page is readable and explains the project, but it does not start the learner in the actual research workflow. The primary action is visible.
- score: clarity 4 / responsiveness 5 / fit-for-purpose 3
- notes: This is the least broken surface. It is explanatory rather than task-first.

### 2. `/graph` first viewport
- screenshot: `.tmp/ux-flow-2026-05-11-38cb47b/flow-overview.png`
- observed: The first viewport shows the title, mode buttons, many toolbar buttons, filters, and only the empty top of the graph canvas. No node is visible in the first viewport.
- score: clarity 2 / responsiveness 4 / fit-for-purpose 1
- notes: This fails the "new user finds a bottleneck" path immediately. The page says graph browser, but the actual graph is below the fold.

### 3. `/graph` full-page overview
- screenshot: `.tmp/ux-flow-2026-05-11-38cb47b/flow-graph-fullpage.png`
- observed: The nodes exist, but they are small and pushed far down inside a tall canvas. The cards are visually similar; risk/color signals are subtle compared with the amount of empty grid.
- score: clarity 2 / responsiveness 4 / fit-for-purpose 2
- notes: The graph technically renders 13 nodes, but the layout makes the user hunt for the content.

### 4. Focus a bottleneck node
- screenshot: `.tmp/ux-flow-2026-05-11-38cb47b/flow-focused-via-topblocker-fullpage.png`
- observed: Clicking through the Top Blockers list reliably focused `parcel_manipulation_or_diverter`. In focused stage, the canvas shows 4 nodes, but the detail panel is still below the canvas in the narrow layout.
- score: clarity 2 / responsiveness 4 / fit-for-purpose 2
- notes: The task-critical detail panel is not visible when focus changes. The user sees more canvas first, not the cost rollup or bottleneck explanation.

### 5. Detail panel after focus
- screenshot: `.tmp/ux-flow-2026-05-11-38cb47b/flow-focused-detail-visible.png`
- observed: Scrolling did not naturally land on the detail content; it mostly exposed more canvas. The DOM contains the correct rollup, coverage gap, and direct-vs-children warning, but visually it is not where the user expects it.
- score: clarity 1 / responsiveness 3 / fit-for-purpose 1
- notes: This is the largest UX failure. The data is present, but the layout hides the answer.

### 6. Color mode switch
- screenshot: `.tmp/ux-flow-2026-05-11-38cb47b/graph-cost-mode-fullpage.png`
- observed: Switching to cost mode works. The legend appears, but it is packed into the toolbar row and the graph remains partially clipped/horizontally awkward. Edge colors are difficult to interpret because cards and viewport framing dominate attention.
- score: clarity 2 / responsiveness 4 / fit-for-purpose 2
- notes: The feature works mechanically, but the visual explanation is not strong enough for learning.

### 7. Product page
- screenshot: `.tmp/ux-flow-2026-05-11-38cb47b/product-first-viewport.png`
- observed: The product page shows useful content, but the long English description and right-side target card are clipped in the first viewport. It reads like a raw structured dump rather than a guided product brief.
- score: clarity 2 / responsiveness 4 / fit-for-purpose 3
- notes: Content density is high, but hierarchy and wrapping are weak.

### 8. Gate page
- screenshot: `.tmp/ux-flow-2026-05-11-38cb47b/gate-first-viewport.png`
- observed: The top score and status are clear. Below that, the report turns into a large table of verbose question/answer text.
- score: clarity 3 / responsiveness 4 / fit-for-purpose 3
- notes: This page is more usable than graph/product, but still needs progressive summary before the long evidence table.

## Summary

- Average score: 2.67 / 5
- Pass/fail: fail
- Top friction: `/graph` does not show a usable graph or detail answer in the first task viewport; the learner must scroll and hunt before seeing the thing they came for.
- Action item: Rework `/graph` around a task-first split: compact sticky toolbar, visible canvas plus detail panel above the fold, and a stronger "top blockers" entry path that immediately lands on the node and its explanation.

## UX Diagnosis

The current problem is not missing data. It is that the UI gives equal visual priority to controls, explanations, filters, canvas chrome, graph cards, and detail panels.

Highest-priority fixes:

1. Make `/graph` first viewport useful. Reduce the toolbar to one compact row or a collapsible controls strip, and keep at least the selected node plus top blocker details visible above the fold.
2. In focused stage, move the detail panel before or beside the canvas on narrow screens. The answer should appear immediately after selecting a blocker.
3. Collapse advanced filters by default. Domain/kind/relation/maturity filters are useful, but they should not sit before the graph for the primary bottleneck-finding task.
4. Replace the large empty canvas feel with a more constrained viewport or denser fit. Empty grid should not dominate the page.
5. On product and gate pages, add stronger summary blocks and enforce text wrapping/width constraints so cards do not clip.

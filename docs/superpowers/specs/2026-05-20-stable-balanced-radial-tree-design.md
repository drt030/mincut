# Stable Balanced Radial Tree Design

**Date**: 2026-05-20
**Status**: approved design direction; implementation not started
**Supersedes / amends**: `docs/adr/0006-radial-progressive-disclosure-graph.md` and `docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md` where they require equal fixed sectors, sector expansion as the main focus mechanism, or Level-2 elastic geometry.

## Goal

The graph surface should help a learner build and keep a stable mental model of a concrete product:

```text
product -> subsystem -> component -> process/material/algorithm -> metric/evidence/task
```

The main visualization is a stable radial product decomposition tree. It should first answer:

1. What is this product made of?
2. Which subsystem branches matter most right now?
3. Where should the user inspect next?

It should not behave like a dashboard of unrelated charts or a graph viewer that optimizes for showing many nodes without preserving trackability.

## Core Principle

**Object identity is stable; analytical interpretation is switchable.**

Stable channels:

- Node identity and display name.
- Approximate radial position.
- Parent/child branch membership.
- Base subsystem color.
- Branch order around the product.

Switchable channels:

- Edge color and edge width.
- Node outline.
- Glyphs.
- Saturation / opacity.
- Soft background grouping.
- Time-dependent values when the future time axis lands.

The user should feel that they are changing the lens on the same map, not jumping between unrelated visualizations.

## Chosen Shape

Use a **Stable Balanced Radial Tree**:

- The focal product sits at the center.
- Recursive structural dependencies radiate outward by depth.
- Angular space is allocated primarily by readability: subtree size, depth, label density, and collision avoidance.
- Subsystem grouping is a soft visual layer over the tree, not a rigid equal-width sector constraint.
- First-layer subsystem order stays stable across runs and small data updates.
- Shared dependencies are acknowledged without letting cross-links dominate the first viewport.

This replaces the older assumption that each first-layer subsystem owns an equal sector at rest. Equal sectors are visually tidy but become ugly when one subsystem is dense and another is sparse.

## Three-Stage Experience

### Stage 1: Overview

The overview teaches object identity and system structure.

It should show:

- The full structural product tree at low fidelity.
- Product center, first-layer subsystems, recursive depth, and approximate branch density.
- Base subsystem colors.
- A small number of priority glyphs only when they are useful.

It should not show:

- Long evidence summaries.
- Metric tables.
- All edge labels.
- Task lists.
- Every review-status detail.
- Large banners or duplicate list UIs beside the graph.

Density is managed with semantic zoom:

- Low zoom: nodes as small dots; no labels except maybe product.
- Mid zoom: subsystem labels, selected important names, outlines, and priority glyphs.
- High zoom / focus: local labels, badges, and edge labels for the focused branch.

### Stage 2: Branch Highlight

Highlight is a state of the same radial map, not a separate graph.

When the user asks "what blocks this?" or "where is evidence missing?", the selected branch becomes the figure and the rest of the tree becomes ground:

- Focus branch remains saturated.
- Non-focus branches desaturate or fade but stay visible for orientation.
- Edges along the important path become thicker and more visually prominent.
- Bottleneck nodes use warm outlines and stronger path emphasis.
- Evidence gaps use dashed / broken marks rather than the same warm bottleneck language.
- Frontier nodes use a distinct glyph.

This merges the old "bottleneck" and "research gap" views. They are two signals on the same research path.

### Stage 3: Node Detail Lens

Selecting a node opens a detail lens while keeping the map visible.

Desktop default:

- Use a right-side rail / panel.
- Keep the selected node and its branch visible on the map.
- Collapse to a narrow rail when not in deep inspection.

Quick preview:

- Use a small inline popover for hover or first click.
- Show only name, role, and one critical status.

Small-screen adaptation:

- Use a bottom focus sheet.

Detail content order:

1. Why this node matters in the selected branch.
2. Role in the product tree.
3. Metrics and maturity.
4. Evidence and review status.
5. Evidence gaps, frontier state, and research tasks.
6. Longer notes and source limitations.

The detail lens is an explanation layer, not an isolated database page.

## Signal Vocabulary

Avoid making every important signal red.

| Signal | Visual language | Meaning |
|---|---|---|
| Bottleneck | Warm outline, thick emphasized path, high saturation | This node is currently blocking progress |
| Evidence gap | Dashed / broken edge or hollow gap glyph | Important claim lacks sufficient support |
| Frontier | Hollow diamond / frontier glyph | Decomposition should continue here |
| Top priority | Small ranked glyph | Current mode ranks this node among the most important |
| Review status | Subtle badge or rail detail, not default canvas noise | Trust state of the claim |

Only a small number of high-priority glyphs should appear in overview. Full review details belong in the node lens.

## Layout Rules

The radial tree layout should optimize for first-glance readability:

- Allocate angular space by subtree size and local label density.
- Keep branch order deterministic and stable.
- Keep approximate branch positions stable across small graph edits.
- Preserve recursive depth through radius.
- Avoid hard equal-sector allocation when it creates crowding.
- Keep shared dependencies low-noise at overview: use small glyphs or faint cross-links; show full cross-links on focus or higher zoom.

The implementation may still use pure deterministic layout functions. The point is not to introduce runtime physics or arbitrary re-layout, but to stop treating equal sector width as the primary invariant.

## Deferred Work

The following are valid but not first implementation priorities:

- Animated path extraction from the radial map into a linear causality path.
- Time-axis replay of maturity, cost, evidence, and bottleneck states.
- Sibling-product comparison inside the same radial map.
- Advanced filters.

Path extraction should eventually follow this principle:

**Global radial map for intuition; local extracted path for causality.**

But overview and branch highlight should be made excellent before path extraction is attempted.

## Acceptance Criteria

The next graph UX iteration should be judged by these outcomes:

- A new user can identify the main product subsystems from the first viewport.
- The densest / most important branch is visible without reading a side list.
- Selecting a branch preserves map orientation.
- Bottlenecks and evidence gaps are visually distinct.
- Opening node detail does not make the user lose where the node lives.
- The layout looks balanced even when one subsystem has many more descendants than another.
- The design remains DAG-aware without turning the overview into cross-link clutter.

## Explicit Non-Goals

- Do not implement path extraction before overview and branch highlight are strong.
- Do not make separate layouts for cost, maturity, bottleneck, and evidence modes.
- Do not use fixed equal subsystem sectors as the main layout rule.
- Do not solve density with default filters that hide large parts of the tree.
- Do not let right-side lists become the primary way to discover bottlenecks.

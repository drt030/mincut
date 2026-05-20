# Graph UX Contract

This document defines the interaction and visualization rules for graph-facing product work. It applies to `GraphExplorer.tsx` and future graph views unless a task explicitly documents a different UX goal.

> **2026-05-20 update**: The graph UX direction is now the Stable Balanced Radial Tree captured in `docs/adr/0007-stable-balanced-radial-tree.md` and `docs/superpowers/specs/2026-05-20-stable-balanced-radial-tree-design.md`. This amends the earlier equal-sector radial model from ADR-0006. Keep ADR-0006's radial progressive-disclosure goals, but do not treat fixed equal sectors or recursive sector expansion as the primary design invariant.

## Product Goal

Capability Graph Explorer is a research workspace, not a decorative network map. The graph should help a user answer concrete research questions:

- What is this product made of?
- Which subsystem, component, process, or material blocks maturity?
- Where is evidence missing?
- What should be expanded or researched next?

Visual polish is valuable only when it improves orientation, comparison, or trust. Where this document conflicts with `docs/design-principles.md`, the principles win.

## Core Model

The default `/graph` view is a **Stable Balanced Radial Tree**:

- The focal product sits at the center.
- Structural product decomposition radiates outward by depth.
- Nodes preserve approximate position, branch membership, name, and base subsystem color across interactions.
- Analysis modes change overlays, not the underlying identity map.
- Subsystem grouping is a soft visual layer over a readable radial tree, not a hard equal-sector constraint.

The graph should feel like one map viewed through different lenses.

Stable channels:

| Channel | Encodes |
|---|---|
| Approximate node position | Object identity and learned location |
| Radius | Recursive decomposition depth |
| Branch membership | Product/subsystem/component lineage |
| Base node color | Subsystem identity |
| Node name | Object identity |

Switchable channels:

| Channel | Encodes |
|---|---|
| Edge color / width | Current analysis mode value |
| Node outline | Per-node mode band or status |
| Glyphs | Bottleneck, evidence gap, frontier, top priority |
| Saturation / opacity | Focus branch versus context |
| Soft background grouping | Subsystem or aggregate mode hint |

## Layout Rules

Use deterministic radial layout logic. Do not use runtime physics or hand-tuned one-off lanes.

The layout should optimize for first-glance readability:

- Allocate angular space by subtree size, depth, label density, and collision avoidance.
- Keep branch order stable across runs and small graph edits.
- Preserve recursive depth through radius.
- Keep the focal product central.
- Avoid fixed equal subsystem sectors when they create empty sparse regions or cramped dense branches.
- Express subsystem grouping through base color, labels, faint region tint, or boundaries after the tree is readable.

Shared dependencies must remain DAG-aware:

- Overview can keep shared-dependency links low-noise through faint cross-links, glyphs, or delayed display.
- Focused/high-zoom states may reveal full cross-links.
- Do not duplicate shared nodes as if the data were a pure tree without making the duplication visually explicit.

## Stage 1: Overview

Overview teaches identity and structure.

It should show:

- The full structural product tree at low fidelity.
- Product center, first-layer subsystems, recursive depth, and branch density.
- Base subsystem colors.
- A small number of priority glyphs when useful.

It should not show:

- Long evidence summaries.
- Metric tables.
- All edge labels.
- Task lists.
- Every review-status detail.
- Large banners or duplicate list UIs beside the graph.

Density is managed by semantic zoom:

- **Low zoom**: structural nodes as small dots; no labels except possibly product.
- **Mid zoom**: subsystem labels, important node names, outlines, and priority glyphs.
- **High zoom / focus**: local labels, badges, and edge labels for the focused branch.

## Stage 2: Branch Highlight

Branch highlight answers bottleneck and evidence-gap questions on the same map.

When a branch is selected:

- The selected branch and its relevant descendants remain saturated.
- Non-focus branches desaturate or fade but stay visible for orientation.
- Edges on the important path become thicker or warmer according to the active mode.
- Bottleneck nodes use warm outlines and strong path emphasis.
- Evidence gaps use dashed / broken marks or hollow gap glyphs.
- Frontier nodes use a distinct frontier glyph.

Do not switch to an unrelated layout for bottleneck, cost, maturity, or evidence-gap modes. These are overlays on the same radial product map.

## Stage 3: Node Detail Lens

Selecting a node opens a detail lens while preserving map context.

Desktop default:

- Use a right-side rail / panel.
- Keep the selected node and branch highlighted on the map.
- Allow a collapsed rail for light inspection and expanded rail for research.

Quick preview:

- Use inline popovers only for lightweight confirmation: name, role, and one critical status.

Small screens:

- Use a bottom focus sheet rather than forcing a narrow right rail.

Detail content order:

1. Why this node matters in the selected branch.
2. Role in the product tree.
3. Metrics and maturity.
4. Evidence and review status.
5. Evidence gaps, frontier state, and research tasks.
6. Longer notes and source limitations.

The detail lens is an explanation layer anchored to the map, not an unrelated details page.

## Signal Vocabulary

Do not make every important signal red.

| Signal | Visual language | Meaning |
|---|---|---|
| Bottleneck | Warm outline, thick emphasized path, high saturation | This node is currently blocking progress |
| Evidence gap | Dashed / broken edge or hollow gap glyph | Important claim lacks sufficient support |
| Frontier | Hollow diamond / frontier glyph | Decomposition should continue here |
| Top priority | Small ranked glyph | Current mode ranks this node among the most important |
| Review status | Subtle badge or rail detail | Trust state of the claim |

Only a small number of high-priority glyphs should appear in overview. Full review details belong in the node lens.

## Color Modes

Color modes are lenses over the stable product map.

Supported modes may include:

- **Bottleneck risk**: combines maturity gap and cost/importance share.
- **Cost**: emphasizes cost-bearing nodes and paths.
- **Maturity**: emphasizes low versus high maturity.
- **Evidence gap**: emphasizes unsupported or weakly supported claims.
- **Overall**: composite signal when useful.
- **Relation**: legacy/debug mode for edge relation semantics.

Across modes, keep binning aligned when the same scalar is redundantly encoded. For example, if edge color and edge width both encode cost, they must use the same thresholds.

## Interaction Rules

Primary interactions:

- **Zoom**: changes semantic detail level. It should not change the user's conceptual location.
- **Click / select a structural node**: highlights the relevant branch and updates the detail lens.
- **Click outside / Esc**: exits the current focus state or collapses detail, preserving orientation.
- **Cmd+K**: jumps to a node or descriptive record, then anchors the result on the same map.
- **Mode switch**: changes overlays without moving nodes into a different layout.

Deferred interactions:

- Animated path extraction from radial branch to linear causality path.
- Time-axis replay of maturity, cost, evidence, and bottleneck state.
- Sibling-product comparison inside the radial surface.

Path extraction, when implemented, must animate from the radial branch into the linear path so the user can track where the path came from.

## Implementation Guardrails

- Do not remount React Flow on focus changes.
- Do not call ELK, dagre, or runtime physics for ordinary graph focus.
- Do not use fixed equal sectors as the core layout invariant.
- Do not use advanced filters as the default density solution.
- Do not introduce a list UI alongside the canvas without first designing the visual replacement.
- Do not encode the same scalar in two visual channels with different thresholds.
- Keep local graph data as the source of truth for graph UI and validation.

## Deferred Surfaces

The following are explicitly deferred from the next overview/highlight iteration:

- Animated path extraction.
- Time-axis replay.
- Sibling-product compare in the radial map.
- Advanced filter / narrowing UI.
- Mobile-specific layout beyond the bottom detail-sheet adaptation.

When a deferred surface lands, update this document and the ADR registry.

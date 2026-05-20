---
status: accepted
---

# Stable balanced radial tree

## Context

ADR-0006 moved the graph away from a rectangular stage-machine layout and toward a radial progressive-disclosure surface. That solved the major problems of chrome overload, loss of spatial continuity, and fake-tree rendering.

The follow-on design discussion on 2026-05-20 tightened the goal further. The user clarified that the graph should work as a visually continuous tree-like map:

```text
overview -> highlighted branch -> node detail lens
```

The stages should not be separate visual worlds. Stage 2 should be Stage 1 with one branch highlighted. Stage 3 should be a selected node enlarged into detail while the map remains visible.

The discussion also identified a weakness in the earlier equal-sector model: forcing first-layer subsystems into fixed equal angular sectors can make sparse branches waste space and dense branches cramped. A readable radial tree should be balanced first; subsystem grouping should be expressed as a soft visual layer second.

## Decision

Adopt **Stable Balanced Radial Tree** as the graph-facing design direction.

The focal product remains central, and recursive product decomposition remains the graph's primary spatial structure. The layout should optimize for a readable, balanced radial tree before drawing subsystem regions.

Stable object-identity channels:

- Node name.
- Approximate position.
- Branch membership.
- Base subsystem color.
- Branch order.

Switchable analysis channels:

- Edge color and width.
- Node outline.
- Glyphs.
- Saturation / opacity.
- Soft background grouping.

The main interaction sequence is:

1. **Overview**: show the structural tree with low information density.
2. **Branch highlight**: emphasize the selected bottleneck / evidence-gap branch on the same map.
3. **Node detail lens**: open evidence, metrics, maturity, review status, and tasks for a selected node while preserving map context.

Animated path extraction and time-axis replay remain desirable future capabilities, but they are deferred until overview and branch highlight are strong.

## Consequences

Positive:

- The first viewport can focus on product structure instead of analysis overload.
- Users keep track because the same node stays in the same approximate location across modes.
- Bottlenecks and evidence gaps become different visual signals on the same branch rather than separate views.
- The layout can handle uneven subtrees better than fixed equal sectors.

Negative:

- This amends parts of ADR-0006 and the 2026-05-13 slice spec.
- The existing equal-sector tests and implementation assumptions will need a new layout contract before implementation changes.
- The design is less mathematically tidy than equal sectors because angular space is allocated by readability.

## Supersedes / Amends

This ADR amends ADR-0006 where it requires:

- Equal first-layer subsystem sectors at rest.
- Elastic sector expansion as the main focus mechanism.
- Level-2 elastic sub-sector expansion as a required near-term behavior.

The following ADR-0006 ideas remain:

- Radial graph as the main surface.
- Progressive disclosure.
- Stable spatial memory.
- Semantic zoom.
- Color modes as overlays rather than separate layouts.
- Detail rail / lens.
- DAG-aware shared dependency handling.

The concrete design spec is `docs/superpowers/specs/2026-05-20-stable-balanced-radial-tree-design.md`.

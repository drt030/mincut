# Graph-First Homepage Design

## Decision

Root `/` becomes the product entry surface, not a traditional commercial landing page. It should default to the `ai-compute` full-free map and feel like a usable graph workspace immediately.

## Approved Preview Sample

The approved preview is saved for implementation comparison:

- Source: `docs/plans/assets/homepage-graph-first-preview.html`
- Rendered reference: `docs/plans/assets/homepage-graph-first-preview.png`
- Referenced graph image: `docs/plans/assets/homepage-graph-first-ai-compute-map-preview.png`

These samples must stay in the repo until the user confirms the implementation is complete and no longer needs comparison.

Implementation comparison captures:

- Default graph-first home: `docs/plans/assets/homepage-graph-first-implementation.png`
- Domain switch popover: `docs/plans/assets/homepage-graph-first-domain-switch-implementation.png`
- Domain-route map switcher continuity: `docs/plans/assets/homepage-graph-first-domain-route-fixed.png`
- Maps click-menu interaction source: `docs/plans/assets/homepage-map-dock-click-menu-preview.html`
- Maps click-menu interaction reference: `docs/plans/assets/homepage-map-dock-click-menu-preview.png`
- Maps click-menu implementation capture: `docs/plans/assets/homepage-map-dock-click-menu-implementation.png`

## Layout

- Keep the app header.
- Replace the root marketing hero with a graph-first workspace.
- Default domain is `ai-compute`; the graph uses the same data, entitlement filtering, exposure locking, holder teasers, and `GraphExplorer` behavior as `/d/ai-compute`.
- Add a narrow left map dock on desktop:
  - 64px wide by default.
  - Top control says `Maps` for now; implementation may use a `lucide-react` icon later if the dependency exists.
  - Domain shortcuts use quiet text abbreviations: `AI`, `PR`, `SX`, `HR`, `CF`, `OD`.
  - No colored status dots in the collapsed dock.
  - Compact shortcuts are direct-switch controls. Hovering a shortcut may show only a small label tooltip.
  - Full free/preview/locked exposure copy appears only after clicking `Maps` to open the full portfolio menu and on current route surfaces.
- Hide the dock on mobile; use the existing header domain selector.
- Preserve the existing graph/detail rail layout and controls inside `GraphExplorer`.

## Content

- The first visible object is the real AI compute graph workspace.
- Copy is concise and operational:
  - AI compute is the full-free flagship demo.
  - Parcel is a free depth demo.
  - SpaceX, Humanoid, and Fusion are previews/future paid domains with exposure locked until gates pass.
- The persistent site footer continues to carry the investment-advice disclaimer.
- Waitlist/email capture is not part of the first-screen core. If retained later, it should be secondary and not compete with the graph.

## Acceptance

- A first-time user can start inspecting AI compute from `/` without passing through a marketing page.
- A returning user can switch to another domain from the dock or existing header selector.
- The collapsed dock does not add colored-dot noise.
- The rendered `/` implementation remains visibly close to `docs/plans/assets/homepage-graph-first-preview.png` unless the final handoff names an intentional divergence.
- Root `/` keeps the same commercial safety rules as domain routes: no investment advice, no locked supplier/ticker leaks, no live checkout unless gates are ready.

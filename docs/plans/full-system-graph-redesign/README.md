# Full System Graph Redesign PlanDock

## Visual Reference

Use these images as the product-design reference for the first implementation pass:

- `assets/full-system-route-reference.png` — primary reference for the first pass.
- `assets/overview-map-reference.png` — later reference; do not implement Overview first.

## Current Decision

Implement the Full System map before the Overview map.

The Full System map is the source experience: it shows the whole product structure while using a highlighted route to guide learning. The Overview map should later be derived by filtering and simplifying the Full System model, not designed as a separate interaction pattern first.

## First Pass Scope

- Default `/graph` to a Full System route-led map.
- Use a real `requires` path selection for the Cost drivers route.
- Keep non-route nodes visible as context, but visually quieter than the highlighted route.
- Add a compact product context strip inside the Graph surface.
- Replace the two bottom-left floating controls with one restrained graph control surface.
- Make the right rail explain the active route before showing raw node detail.

## Out Of Scope For First Pass

- Overview map implementation.
- Validation page merge.
- Gate or task model changes.
- Agent import or review workflow changes.
- New product domains.

## Route Correctness

The visual route must come from graph data. Do not draw a plausible-looking path that does not follow `requires` edges from `low_cost_parcel_sorting_robot_300k_rmb`.

For the first pass, Cost drivers means:

1. Rank structural nodes by RMB cost signal.
2. Select the highest-impact cost nodes with valid root-to-node `requires` paths.
3. Highlight the union of those paths.
4. Explain the selected route in the rail with top contributors and cost data gaps.

## Design Guardrail

The implementation should stay close to `assets/full-system-route-reference.png` in layout and hierarchy:

- compact dark app/header feel;
- compact product context strip;
- large off-white graph canvas;
- one left control surface;
- strong highlighted route;
- quiet background nodes;
- route-first right rail.

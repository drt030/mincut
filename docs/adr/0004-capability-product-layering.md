---
status: accepted
---

# Capability-Product layering: alternatives live as sibling Products, Routes retired

## Context

The graph's existing schema offered three places where "alternative architectures" could live: under a `capability` node (sibling Products), under a `product` node (Routes via `has_route`), and inside a Product (variant subgraphs). This ambiguity produced three concrete problems in the parcel-sorting v0 graph:

- 4 `kind: "product"` neighbor nodes had IDs ending in `_route` (`delta_robot_sorting_route`, `conveyor_diverter_sorting_route`, etc.) — they are sibling Products, not Routes, but the naming suggests otherwise.
- The Product `low_cost_parcel_sorting_robot_300k_rmb` carried 4 routes (gripper, suction, generic, integrated cell), where two were a generic abstraction and a "sweep" rather than concrete architectures.
- Plan, README, and gate logic each had subtly different mental models of what a Route is.

The grilling session in `/grill-with-docs` resolved the boundary question via a "shared technology stack / shared key technologies" principle: alternative architectures whose **key technologies** (hard-to-develop tech nodes; see ADR-0005) differ are *different Products*; alternatives that share key tech and differ only in low-leverage choices would in principle be Routes.

In practice for v0 — and likely beyond — the cases that surface as "different architectures" all turn out to be different Products by the key-tech test. Within a single Product, the implementation is fixed. Routes within a Product are not the load-bearing concept they appeared to be.

## Decision

**Architectural alternatives live exclusively as sibling Product nodes under one Capability node. The `has_route` relation is retired from v0 modelling but preserved in the schema for possible future use.**

Concretely:

- **Capability node** (`kind: "capability"`) groups sibling **Product nodes** that satisfy the same demand. This is where boundary distinctions are recorded.
- **Each Product node** commits to one fixed architecture. No `has_route` edges within a Product.
- **End-effector variants** (gripper vs. suction) become separate sibling Products under the Capability. The v0 target Product `low_cost_parcel_sorting_robot_300k_rmb` is reinterpreted as **the suction-based variant** — the most representative architecture for parcel-sorting cells in 2025-China industry. The gripper variant becomes a deferred sibling Product (`parcel_sorting_robot_with_gripper_300k_rmb`) registered under the Capability but not expanded in v0.
- **Decomposition under a Product** does not encounter boundary distinctions — by construction you stay inside one Product when walking `requires` / `part_of`.
- **The `has_route` schema relation is preserved** for possible future need (e.g., genuine intra-Product configurable variants if a real case ever emerges) but is not added in v0 data.

## Considered alternatives

- **(B) Keep one Route per Product as the canonical implementation choice within an otherwise multi-route Product node.** Rejected: leaves the schema in a "use sometimes" state, which produces drift over time. If Routes aren't load-bearing, removing them is cleaner than guarding their use.
- **(C) Keep gripper and suction as Routes within `parcel_manipulation_or_diverter`** (the Q9-era state). Rejected after Q11: contradicts the boundary principle that alternative architectures are sibling Products. Maintaining intra-Product Routes alongside cross-Product alternatives doubles the modelling vocabulary for the same concept.
- **Rename the existing Product** (drop `low_cost_parcel_sorting_robot_300k_rmb`, introduce two new IDs `parcel_sorting_robot_with_suction_300k_rmb` and `parcel_sorting_robot_with_gripper_300k_rmb`). Rejected: the existing ID is referenced by 60+ data nodes, gate runner hardcoded targets, and historical gate-report filenames. The ID does not embed an end-effector commitment; reinterpreting it via `description` and `targetContext` is sufficient.
- **Remove `has_route` from the schema entirely.** Rejected: schema removal is destructive and the relation may carry signal for some future case; leaving it in the schema unused is harmless.

## Consequences

- All 4 `kind: "technical_route"` nodes are deleted (`industrial_robot_arm_sorting_route`, `industrial_robot_arm_gripper_route`, `industrial_robot_arm_suction_route`, `integrated_robot_arm_sorting_cell_route`). Their substantive outgoing edges migrate to the manipulation module or to the Product (per `agent-memory.md` backlog item 5).
- All 4 `has_route` edges are deleted.
- `gateRunner.ts:requiredParcelRoutes` array is removed; route-comparison gate questions are repurposed or removed.
- `LanguageProvider.tsx` translations for the four route IDs are removed.
- `low_cost_parcel_sorting_robot_300k_rmb` description / `targetContext` updated to commit explicitly to vacuum suction.
- New sibling Product `parcel_sorting_robot_with_gripper_300k_rmb` created as a deferred-expansion neighbor under `affordable_small_warehouse_automation`.
- The legacy `_route` suffix on the four neighbor Product IDs (`delta_robot_sorting_route`, etc.) is documented as misleading but not blocking; renaming is non-blocking follow-up.
- `check:active-graph-scope` continues to track only the v0 target's subgraph; gripper sibling stays out of active scope.

## Revisit when

- A real intra-Product configurable-variant case emerges where the variants share key technology, share the same maturity story, and differ only in a runtime/configuration choice (currently no candidates).
- A multi-Product Capability acquires enough Products that the Capability node itself needs first-class scoring (deferred per CONTEXT.md → "Capability node").

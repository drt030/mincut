# Parcel Sorting Robot v0 Closed Loop Plan

## Goal

Use `low_cost_parcel_sorting_robot_300k_rmb` as the first complete product graph. The user should be able to inspect dependencies, sibling Products under the parent Capability (per ADR-0004), metrics, bottlenecks, evidence, maturity, gate output, and follow-up tasks.

## Product Target

An approximately 300,000 RMB parcel-sorting robot or robotic sorting cell suitable for logistics parcel sorting.

For v0, this is a concrete product architecture, not the broad demand for low-cost parcel sorting. The intended product is an industrial robot-arm and computer-vision based sorter using a vacuum-suction end-effector.

Neighboring products such as delta robot sorters, humanoid robot sorters, conveyor diverter systems, mobile robot sorting systems, or human-robot assisted systems should remain separate product candidates unless the user explicitly decides to model them inside this product boundary.

## Required Closed Loop

- Open the graph explorer.
- Select the product node.
- Inspect cost, throughput, perception, manipulation, conveyor integration, safety, ROI, and maintenance dependencies.
- Compare sibling Products under the Capability (per ADR-0004) — the v0 Product is fixed to a single architecture, so comparison is across neighbor Products, not across routes within this Product.
- Use agent-assisted online research to expand incomplete frontier nodes into candidate nodes, edges, evidence, bottlenecks, metrics, and tasks.
- Run the validation gate.
- See missing data, weak evidence, missing metrics, and recommended next research tasks.

## Recursive Product Decomposition Check Case

Use the 300,000 RMB industrial robot-arm parcel-sorting product as the primary product-decomposition and interaction check case.

The graph data should not stop at a first-level module list. It should model the product as a recursive dependency graph, and the UI should let the user open that graph one layer at a time:

```text
300,000 RMB parcel-sorting robot
  -> robot body / manipulation subsystem
  -> vision module
  -> vacuum-suction end effector
  -> conveyor integration
  -> sorting decision software
  -> computer vision algorithms
  -> motion planning / control
  -> safety system
  -> mechanical frame and installation structure
```

The first screen should keep this at the high-level subsystem layer. The lower-level nodes should still exist in graph data where they explain maturity, cost, manufacturability, integration, or bottlenecks, but they should not all be visible at once.

### Robot Body Expansion

When the user expands the robot body or manipulation subsystem, the graph should support another layer such as:

```text
robot body / manipulation subsystem
  -> servo drive / controller
  -> reducer / gearbox
  -> motor
  -> arm links and joints
  -> controller and I/O
  -> cabling and power
  -> base / mounting structure
  -> manufacturing and assembly processes
```

Each of these can also be treated as an inspectable product/system with its own dependencies. For example, a reducer may later expand into precision machining, materials, heat treatment, bearings, lubrication, inspection equipment, and supplier/process constraints. The graph does not need to model all of that immediately, but the data model and interaction model must allow it without changing the core product concept.

At the lowest levels, the same recursive pattern can eventually reach materials, mineral extraction, process equipment, standards, and scientific or empirical principles. These should be added only when useful for the current product-domain question.

### Agent-Assisted Expansion Check

The v0 workflow should support both frontier-node expansion and whole-product expansion. The single-node interaction is useful for depth:

```text
user selects industrial_servo_motor
  -> agent identifies it as a decomposition frontier
  -> agent searches online sources for industrial servo motor structure, manufacturing, cost, reliability, and supply constraints
  -> agent proposes child nodes such as stator, rotor, permanent magnets, windings, encoder, bearings, housing, thermal design, motor-control interface, winding/assembly/testing processes, and supply constraints
  -> agent adds candidate nodes/edges/evidence as unreviewed records
  -> gate and UI expose what is now supported, missing, weak, or still frontier
```

But the current parcel-sorting robot check should also run across the whole product, not just the servo motor:

```text
user selects low_cost_parcel_sorting_robot_300k_rmb
  -> agent preserves the robot-arm + computer-vision product boundary
  -> agent searches online sources for each major branch
  -> agent imports reviewable nodes for vision, tracking, end effector, robot arm body, servo drive, reducer, motor, conveyor integration, PLC/WCS, safety, maintenance, and cost bottlenecks
  -> agent recursively continues important branches down to materials, mineral extraction/refining chains, or explicitly marked decomposition frontiers
  -> imported claims cite evidence or become follow-up tasks
  -> gate shows which branches are supported, which are weak, and which still block maturity
```

This check is more important than manually adding a few hard-coded robot nodes. The system should make it practical to grow a complete dependency chain from online research while preserving provenance and review status.

### Hardware And Software Co-Dependency

The check case must show that the product becomes feasible through both hardware and software capabilities:

- Hardware examples: robot arm, vacuum suction cups, vacuum generator/ejector, cameras, lighting, conveyor interface, frame, safety equipment, controllers, motors, reducers, servo drives.
- Software examples: barcode/OCR/label recognition, parcel detection and tracking, sorting decision logic, computer vision models, motion planning, exception handling, calibration, maintenance workflow.
- Integration examples: timing between conveyor flow, perception, grasp/push/place motion, destination decision, jam recovery, and safety interlocks.

The UI should make these co-dependencies visible without implying that one linear chain fully explains the product.

### Bottleneck Drill-Down

The bottleneck view should work recursively.

For a historical or counterfactual time setting, the highest-level blocker may be different from the present-day blocker. For example:

```text
300,000 RMB parcel-sorting robot
  -> bottleneck: robust real-time computer vision for parcel logistics
    -> bottleneck: reliable image classification / detection under real warehouse variation
      -> enabling breakthrough: neural-network-based visual classifiers
```

This example is a modeling target, not a claim that current graph data already proves the exact historical dates. If such historical timing is added, it should be represented explicitly through node metadata, metrics, evidence, or notes rather than UI-only prose.

For a currently existing product, the view should emphasize:

- core components and subsystems;
- manufacturing and assembly processes;
- cost, throughput, reliability, safety, and maintenance metrics;
- evidence showing whether the product is commercially available, mature, or widely adopted.

For an immature product or target architecture, the view should emphasize:

- the highest-level unresolved bottleneck;
- the subsystem or route responsible for it;
- missing metrics and weak evidence;
- the deeper scientific, engineering, manufacturing, cost, or deployment constraint after expansion.

### Boundary Checks

This check case should also protect the product boundary.

The current product is an industrial robot-arm and computer-vision based sorting cell using a vacuum-suction end-effector. The following should not be silently treated as internal routes of the same product:

- delta robot sorter;
- humanoid robot sorter;
- conveyor diverter-only system;
- mobile robot sorting system;
- human-robot assisted sorting workflow.

They may be compared as neighboring product candidates or alternative architectures, but adding them as part of this product requires explicit boundary clarification first.

## Architecture

This Product is committed to **one fixed architecture**: industrial robot arm + CV-based parcel perception + **vacuum suction** end-effector. There are no `has_route` alternatives within this Product. Architectural variants are modelled as **sibling Product nodes under the `affordable_small_warehouse_automation` Capability**, not as routes:

- `low_cost_parcel_sorting_robot_300k_rmb` — **this Product**, suction-based, the v0 target.
- `parcel_sorting_robot_with_gripper_300k_rmb` — sibling Product, gripper-based variant. Created as a placeholder under the Capability but **not expanded in v0**; deferred neighbor candidate for future comparison.
- `delta_robot_sorting`, `conveyor_diverter_sorting`, `mobile_robot_sorting`, `hybrid_human_robot_assisted_sorting` — sibling Products with different core architectures (different Key technologies). The legacy `_route` suffix was dropped in commit 3b392b3; they are Products, not routes, and live under the same Capability.

Conveyor integration, sensing, and control choices are modelled as `engineering_method`, `module`, or `metric` nodes inside this Product, not as routes. Hybrid end effectors (gripper + suction tool changer on one arm) would be a separate sibling Product if ever modelled.

## Validation

```bash
npm run validate:data
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
npm run lint
npm run build
```

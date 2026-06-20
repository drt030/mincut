# SpaceX reusable-launch — decomposition-deepening gap analysis

**Date:** 2026-06-16 · **Mode:** analysis only (no data/source edits) · **Root:** `spacex_reusable_launch_stack`
**Companion:** `gap-spacex.json` (prioritized task array)

> Numbers below are from a faithful re-implementation of the live render path
> (`scopeGraphToReachableNodes` → `stripExposureLayer` (space locked) → `filterCanvasGraph`,
> depth cap 4). They differ from the brief's "36/74 vs 69/205" because the brief counted only
> `spacex_reusable_launch.json` (74) and a different flagship snapshot; the live tree pulls from the
> combined graph. The acceptance floor (rendered ≥ 60, total ≥ 160) is unchanged and is what this
> plan targets.

## 1. Current tree shape (the real measurement)

| Metric | SpaceX (live, gated) | Flagship `ai_compute` (live) |
|---|---|---|
| **Rendered focal-tree nodes** (depth ≤ 4) | **53** | **86** |
| Total scoped nodes (ungated) | **90** | 209 |
| Orgs in exposure file / reachable in scope | 47 / **27** | — |
| First-layer (depth-1) children | **4** | **7** |
| Depth-2 node count | 14 | **55** |
| Max structural depth reached | **6** (deeper than flagship!) | 4 |
| Tree organizing axis | **by vehicle program** (Falcon9 route / Starship route) | **by subsystem** (7 parallel modules) |

**Shape diagnosis — the deficit is NOT shallowness, it is a narrow top + buried/orphaned nodes:**

1. **Narrow top.** SpaceX splits at layer-1 into two big `technical_route` branches (Falcon9, Starship) plus two small modules = **4 first-layer children**. The flagship fans into **7 parallel subsystem modules**, each exploding to ~8 children at depth-2 (55 nodes at d2). SpaceX's depth-2 has only 14. The flagship's width comes from enumerating, **under each d1 module, every key EQUIPMENT + every PROCESS step + every input MATERIAL as sibling d2 children**, then expanding the chokepoint ones one more layer. SpaceX instead chains `engineering_method` know-how nodes *downward* into a thin spine (d3→d4→d5→d6).

2. **~19 orphaned, already-evidenced component nodes are invisible.** TVC actuators, propellant valves, igniters, precision bearings, metal-AM machines/powder, rad-hard FPGA, COTS-upscreened silicon, IMU/GNSS, star tracker, space connectors, FTS ordnance, PICA ablator, ceramic tiles, TPS adhesive, carbon fiber — all authored with `ok_exact` evidence — attach **only via `part_of` (NOT a canvas-tree edge) + supplier edges (stripped on the gated route)**, so none render. **`part_of` does not lift the tree**; only `requires` / `has_route` / `implemented_by`→know-how do (`src/lib/canvasGraph.ts`).

3. **Engine internals are depth-blocked.** Falcon9 booster → engine cluster, and Starship vehicle → booster → engine, already sit at d3–d5. Anything added below the engine cluster lands at d5+ and is clipped by the **depth-4 cap**. The flagship never hits this because its subsystems start at d1.

## 2. Target shape

Reach **rendered ≥ 60, total ≥ 160** by (a) wiring the orphaned evidenced nodes with `requires`, and (b) adding genuine sibling components/materials/processes at the **shallow frontiers** (depth budget = 4 − depth ≥ 1). Mirror the flagship: each first-layer-ish module should carry a fan of equipment + process + material children, not a single know-how chain.

**Where new nodes can land and still render (depth budget):**
- **budget 3** — `spacex_launch_ground_stack` (d1).
- **budget 2** — `falcon9_fault_tolerant_avionics_gnc`, `falcon9_fairing_recovery_reuse`, `falcon9_second_stage_payload_delivery`, `autonomous_flight_safety_system`, `starship_superheavy_vehicle_stack`, `methane_oxygen_ground_propellant_system` (all d2).
- **budget 1** — `falcon9_aluminum_lithium_tank_structure`, `falcon9_grid_fin_reentry_control`, `falcon9_landing_legs`, `falcon9_merlin_engine_cluster`, `merlin_vacuum_upper_stage_engine`, `starship_ship_reusable_upper_stage`, `superheavy_reusable_booster`, `starship_stainless_steel_primary_structure` (all d3).
- **budget 0 (DEPTH-BLOCKED, rail-only)** — everything at d4+: COPV, heat-shield tile system, Super Heavy grid fins/catch, Starship flap control, the whole Ti sponge→mill→forging feedstock chain, engine-internal valves/igniters/AM.

## 3. Prioritized frontiers (build order = genuine depth gain × low overfit)

Ordered as in `gap-spacex.json`. Σ optimistic render delta **+25**; **realistic combined ≈ +23 (53 → 76)** in a full simulation of T01–T14 (T15 dropped), clearing the ≥60 floor with margin. The ≥160 total floor is cleared once each task's 2–4 merchant exposure orgs are wired (exposure pass) — wiring the orphan components alone already lifts total **90 → 124**.

| # | Task | Subsystem | Δrendered | Overfit | Type |
|---|---|---|---|---|---|
| T01 | Wire 5 orphan avionics nodes via `requires` | Avionics/GNC | +5 | low | wire existing |
| T02 | New flight computer + power/battery + RF transponder | Avionics/GNC | +3 | low | new |
| T03 | Wire FTS ordnance node | Range safety | +1 | low | wire existing |
| T04 | Fairing composite panel + recovery RCS/parafoil | Aerostructures | +2 | med | new |
| T05 | Upper-stage RCS cold-gas thruster tier | Second stage | +1 | med | new |
| T06 | Re-home TVC actuators + bearings to engine cluster (d4) | Engines | +2 | low | re-home existing |
| T07 | Grid-fin hydraulic actuation | Recovery | +1 | med | new |
| T08 | Landing-leg crushable honeycomb core | Recovery | +1 | med | new |
| T09 | COPV metallic liner (re-home to tank, d4) | Structures | +1 | med | new |
| T10 | Starship stainless coil/plate (30X) | Structures | +1 | low | new |
| T11 | Re-home PICA + ceramic tile materials to ship stage (d4) | TPS | +2 | low | re-home existing |
| T12 | Ground: flame-deluge + cryo tank farm | Ground systems | +2 | low | new |
| T13 | MVac niobium nozzle extension | Upper-stage engine | +1 | med | new |
| T14 | Starship flap electric actuator | Control surfaces | +1 | med | new |
| T15 | Super Heavy catch hardpoint structure | Recovery | +1 | **high** | new (drop if uncited) |
| T16 | Ti sponge feedstock corner — **rail only** | Materials | 0 | low | note (depth-blocked) |

### The 3 deepest genuine frontiers (most real decomposition, lowest risk)

1. **Avionics & rad-tolerant electronics (T01 + T02, +8 rendered).** The single richest seam: a d2 module with budget 2, **zero** `requires`-children today but five fully-evidenced orphans plus three more real merchant tiers (flight computer, power/battery, RF telemetry). Surfaces a genuine sub-tree (rad-hard FPGA, COTS-upscreen silicon, IMU/GNSS, star tracker, connectors, flight computer, batteries, transponder) with named, ticker-bearing suppliers (BAE, Microchip, Frontgrade, AMD/Xilinx, SkyWater, Honeywell, Northrop, Sodern, Jena-Optronik, Glenair, TE, Amphenol, EaglePicher, Saft, L3Harris). Nearly all already cited.
2. **Thermal protection — Starship tiles (T11, +2 rendered, high decision value).** TPS is *the* Starship reuse bottleneck. The tile system sits at d4, burying its materials at d5; re-homing the PICA ablator + ceramic/silica tile to the d3 ship stage surfaces the tile material tier at d4. The deeper rayon/Lyocell→FiberForm precursor corner (FMI, Lenzing, SNIACE — a genuine ≤3-holder chokepoint) stays depth-blocked and belongs on the suppliers rail.
3. **Structures — tanks, COPV, stainless (T09 + T10, +2 rendered).** Two documented, citable frontiers: the COPV metallic liner (AMOS-6 failure-mode chokepoint; Infinite Composites / Steelhead / HyPerComp already in-file) and Starship's stainless coil/plate (the parent node's own description admits "alloy/process details remain outside this first pass" — an explicit unfinished frontier; Outokumpu already in-file, 30X alloy is public).

## 4. Honest limits — where the real industry frontier is genuinely shallow or depth-blocked

- **Engine internals (turbopump, injector, valves, igniters, AM) cannot deepen the *rendered* tree.** They are real and chokepoint-grade but sit 5+ layers down behind the engine-cluster nodes, below the depth-4 cap. T06 re-homes the two highest-value merchant tiers (TVC actuators, bearings) to the d3 cluster to render at d4; the rest (valves, igniters, AM machines/powder) stay invisible by design and must be surfaced via the **suppliers rail** (Gate F2), not by fabricating intermediate nodes. Do not pad the engine spine to hit a count.
- **Titanium feedstock chain (sponge → mill → forging) is depth-blocked (T16, 0 render delta).** A genuine ≤4-holder corner (VSMPO-AVISMA, Toho, Osaka, TIMET) but already 5 layers deep. Its value is exposure, surfaced on the mill-product node's rail. Re-homing sponge upward purely to render it would misrepresent the supply chain (sponge feeds the mill, not the grid fin) — explicitly **don't**.
- **Landing legs, grid fins, fairing, Falcon structures are `mature`/`widely_adopted`.** They pass ADR-0005 only via a stated override (reuse-consumable story or ≤3-holder concentration), so each yields **one** honest node, not a deep sub-tree. T07/T08 are single-node adds with a stated reuse/consumable rationale; resist over-decomposing a commodified leg/fin.
- **Starship novel structures (flap actuators T14, catch hardpoints T15) are largely captive.** SpaceX builds them in-house (Tesla-derived motors; bespoke catch chines), so merchant exposure is thin and independent citation is weak. T14 ships as a structural node labelled captive; **T15 is high overfit risk — include only if a credible non-vendor source describes the catch hardpoints, else drop.** Better to land at 70–74 honestly than to fabricate to 86.
- **Ground systems (T12) have mixed exposure.** Cryo tank farm has a real merchant tier (Chart, Linde — reuse `org_linde`, Air Products); the flame-deluge/water system is mostly bespoke civil/steel work — note the thin merchant exposure honestly rather than inventing suppliers.

## 5. Two structural facts the build team must respect

1. **Use `requires` (parent → child), never `part_of`, to lift the rendered tree.** Existing `part_of` edges are stored child→parent and are ignored by the renderer. Keep them for semantics if useful, but add a `requires` edge for every node that must render. Every `requires` edge that carries a claim needs a citation (Gate B4).
2. **Material nodes render only when "key."** A `material` renders only if it carries `hard_to_develop` / `bottleneck` / `bottleneckOf` / `frontierFor` (`isExplicitlyKey`). Every proposed material (composite panel, honeycomb core, COPV liner, stainless coil, niobium nozzle, re-homed PICA/ceramic tiles) must be tagged key — and that tag must be *earned* by a real chokepoint/frontier rationale, not applied to force a render. Equipment/module/process nodes render regardless.

---
**Bottom line:** 15 genuine render-lifting tasks (+1 rail-only note). Realistic achievable rendered tree ≈ **70–76** (clears ≥60); total ≈ **165–185** once exposure orgs are wired (clears ≥160). The lift is real decomposition — wiring evidenced orphans + enumerating genuine merchant component tiers at shallow frontiers — not padding. Every node must still survive the Opus evidence verifier (Gate B) and the sealed holdout (Gate D); drop any that can't be cited.

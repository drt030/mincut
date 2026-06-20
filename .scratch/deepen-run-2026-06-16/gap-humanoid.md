# Humanoid decomposition-deepening — gap analysis

**Date:** 2026-06-16 · **Domain:** `humanoid_robotics` · **Mode:** ANALYSIS ONLY (no data files edited).
**Companion:** `gap-humanoid.json` (12 prioritized tasks, 32 proposed nodes, schema-locked).

## The render mechanic (calibrated against the running code, not assumed)

The "rendered focal tree" count the standard floors at **≥60** is the **default product-layer** view:

- Built from **decomposition tree edges only**: `requires`, `has_route`, and `implemented_by`→know-how
  (`src/lib/canvasGraph.ts::isCanvasTreeEdge`). Org edges (`manufactured_by`, etc.) never lift it; on
  the gated route orgs are stripped first anyway (`exposureGate.ts`).
- **Depth budget = 4** (`DEFAULT_CANVAS_MAX_DEPTH`). Nodes more than 4 `requires`-hops from the focal
  product do **not** render. This is the binding constraint on where new nodes can go.
- The default graph layer is `product`, which **hides every know-how node**
  (`knowHowLayer.ts::layerHidesNode`). So `engineering_method` / `manufacturing_process` nodes are
  genuine flagship depth and carry exposure **but add 0 to the rendered count**.
- `material` nodes render **only if key-tagged** (`bottleneck` / `hard_to_develop` / `bottleneckOf` /
  `frontierFor`) — `isCanvasNode`. The two existing humanoid materials are tagged `bottleneck`.

Verified by reproducing the algorithm: flagship = 86 canvas reach − 17 know-how = **69 rendered**;
humanoid = 78 − 20 know-how = **58 rendered**. Both match the standard's headline numbers exactly, so
the mechanic above is the right model to plan against.

**Implication for this task:** to raise the rendered count you must add **artifact** nodes
(`module` / `equipment` / `product` / `technical_route`, or **key-tagged `material`**) **within depth
4**. Know-how is added for genuine depth + exposure, never for the count.

## Current humanoid tree shape

- Total non-org nodes 82; rendered product-layer **58**; materials **2** (vs flagship 33).
- **11 first-layer subsystems.** Depth/health by subsystem:

| First-layer subsystem | product-layer subtree | deepest product depth | status |
|---|---|---|---|
| Actuation | 15 | **d4** | the ONLY flagship-depth subsystem (the model to copy) |
| Dexterous hand & tactile | 6 | d2 | **all 5 children are leaves — dead-ends at d2** |
| Battery / power | 6 | d2 | all leaves at d2 |
| Thermal | 6 | d2 | all leaves at d2 |
| Perception & sensing | 8 | d2 | 7 equipment leaves at d2 |
| Onboard compute & control | 5 | d2 | leaves at d2 |
| Structure / materials / harness | 6 | d2 | leaves at d2; only 1 generic material |
| Manufacturing / test / service | 3 | d2 | mostly know-how (doesn't render) |
| Locomotion control SW | 1 | d1 | **pure know-how — renders as 1 node** |
| Manipulation AI/data | 1 | d1 | **pure know-how — renders as 1 node** |

Actuation already reaches depth 4 (reducer→strain-wave-reducer→…, linear-joint→roller-screw→grinding).
**Every other physical subsystem stops one or two layers shallower than its flagship analogue** — the
exact F3 "dead-ends a layer shallower" miss. The headroom is at **depth 3–4 under the existing depth-2
leaves**, which is wide open and inside the render budget.

## Target shape

Flagship pattern (extracted from `logic_die_fabrication`, `advanced_packaging`,
`substrate_and_interposer`, `thermal_cooling`): **subsystem (d1) → component modules/equipment (d2) →
sub-components + materials (d3) → materials / precision equipment (d4)**, with each critical component
exploding into a 3–5 node sub-tree and its feedstock material hanging off the consuming component.
Apply that same shape to the humanoid's dead-ended d2 leaves.

## Prioritized frontiers (order = genuine depth gain × low overfit risk)

| # | Task | Frontier | Δ rendered (cons.) | risk |
|---|---|---|---|---|
| 1 | **H1** | Harmonic/strain-wave reducer internals: flexspline + circular spline + wave generator + cross-roller bearing + bearing steel | **+5** | low |
| 2 | **H2** | Planetary roller-screw internals: threaded shaft + rollers + nut (+ existing grinding eq.) | **+3** | low |
| 3 | **H3** | Dexterous-hand actuation cell: hollow-cup motor + micro lead-screw + fingertip tactile element | **+3** | low |
| 4 | **H10** | Perception transducers: CMOS image sensor+emitter, MEMS IMU die | +2 | low |
| 5 | **H6** | 6-axis force/torque internals: elastic element + strain transducer | +2 | low |
| 6 | **H9** | Inverter power switch (Si/GaN FET) | +1 | low |
| 7 | **H4** | Li-ion cell materials (cathode/anode/separator) + BMS AFE IC | +1 (+3 mats) | low |
| 8 | **H7** | Joint-encoder internals: magnetic ASIC + optical code-disk | +2 | med |
| 9 | **H11** | Compute SoC + LPDDR (with flagship-boundary note) | +2 | med |
| 10 | **H5** | Motor materials: electrical steel + copper wire + NdFeB feedstock | 0 (+3 mats) | low |
| 11 | **H8** | Structure materials: Mg alloy + PEEK/CF + Al alloy | 0 (+3 mats) | low |
| 12 | **H12** | Thermal: heat pipe/vapor chamber + TIM | +1 | med |

## Estimated rendered-node delta to clear ≥60

- **Conservative (artifacts only, materials counted 0): +22 → 58 + 22 = 80 rendered.** Clears ≥60 by 20.
- **With key-tagged materials (the existing humanoid material convention): +31 → 89 rendered**, and
  total non-org nodes 82 → 114 (total-with-orgs ≈ 161, clearing the ≥160 floor). **Both numbers were
  verified by feeding the proposed nodes/edges through a faithful reproduction of
  `filterCanvasGraph` + the product-layer know-how filter** — all 31 new artifact nodes resolve within
  depth 4; only `bearing_steel` initially fell to depth 5 and was re-parented to the reducer (now d4).
- Even the **top 6 low-risk tasks alone (H1,H2,H3,H10,H6,H9) = +16 → 74 rendered**, clearing the floor
  before the med-risk tasks are touched. There is comfortable margin to drop any node that fails the
  Opus verifier or the holdout and still pass.

This is genuine depth, not padding: every proposed node is a **named physical part or feedstock** with
a cited industry basis (harmonic-drive 3-member canon; roller-screw shaft/roller/nut from patents +
EMAG; Optimus Gen-3 hollow-cup+screw+tendon hand; Li-ion cathode/anode/separator canon; 6-axis
elastic-element+strain-gauge canon; encoder Hall-ASIC/optical-disk canon; NdFeB/electrical-steel/
bearing-steel/PEEK/Mg feedstocks). No node is a relabel or a split of one real thing into two.

## Honest notes on genuinely shallow subsystems

- **Locomotion control software** and **Manipulation AI/data stack** are **genuinely shallow in the
  product layer and should stay that way.** They are almost entirely `engineering_method` know-how
  (control stacks, gait/balance policy, VLA model, sim-to-real). Know-how does not render in the
  product layer, and per the standard's scope, full software stacks (foundation models, locomotion
  policy) are **out of scope** beyond the named compute SoC. **Do not** try to lift the rendered count
  here — manufacturing artifacts to render would be padding. Their depth is correctly expressed as
  know-how (visible in the know-how layer) + the compute SoC (H11). Leave as-is; document the boundary.
- **Manufacturing / test / service** is also know-how-heavy by nature (assembly, burn-in, EOL test,
  field service are processes). The genuine renderable artifact there is test/calibration **equipment**
  (already has an EOL calibration rig). Minor upside only; not prioritized.
- **Thermal (H12)** is the weakest of the *physical* subsystems for genuine depth: heat pipe / vapor
  chamber is real but not universal on humanoids (frame as the high-duty-cycle option), and TIM is a
  material. Marked med-risk and lowest priority — ship only if evidence is clean.

## Exposure (later pass — note only)

Most proposed components map to **orgs already in the 47-org roster** (Harmonic Drive Systems, Nabtesco,
Leaderdrive, Rollvis, GSA, PTG Holroyd, Drake, maxon, PICEA, CATL/EVE/LG/Samsung/Panasonic/Molicel,
TI/Infineon/EPC/STMicro/NXP, Bota/ATI/SRI/TE, Bosch Sensortec/TDK, Orbbec/RealSense, NVIDIA/Qualcomm/
Rockchip/D-Robotics, Victrex/Evonik, JL MAG/Proterial, Shin-Etsu). **Reuse those ids — do not duplicate.**
Genuinely NEW org candidates to verify (ticker from IR/exchange this round, ADR-0005 corners/upstream):
THK (6481.T), IKO/Nippon Thompson (6480.T), Schaeffler (SHA.DE), EMAG (private), MP Materials (MP),
electrical-steel mills (Nippon Steel 5401.T / POSCO / Baowu), separator (Asahi Kasei 3407.T / SEMCORP
300568.SZ), cathode (Sumitomo Metal Mining 5713.T), Sony 6758.T (CMOS), Renishaw RSW.L / AMS-OSRAM /
MPS (encoder), SK hynix/Micron (LPDDR — keep behind a flagship-domain boundary note), Auras 3324.TW /
AVC 3017.TW / Boyd (two-phase cooling), Henkel/Dow (TIM). Exposure is the later pass per the brief.

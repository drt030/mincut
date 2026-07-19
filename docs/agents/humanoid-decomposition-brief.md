# Humanoid Robot (Whole-Robot) — Decomposition Brief

**Version: v2 · 2026-06-15 · Owner of this file: the orchestrator.**
**Supersedes v1 (actuator-only).** Owner decision 2026-06-15: this domain is the **whole robot**
(actuators + hands + battery/power + thermal + perception + compute + structure + control/AI
software + manufacturing/service), NOT the actuator chain alone. The registered domain
(`src/lib/domains.ts`: slug `humanoid-robotics`, root `humanoid_robot_key_component_stack`,
domainTag `humanoid_robotics`, entitlement `humanoid`, `audit-preview`) is already whole-robot
framed, and `data/nodes/humanoid_robotics.json` already holds the whole-robot skeleton (94 nodes /
13 orgs / 34 modules). This brief describes that structure and the method to bring it to
**flagship parity** ([acceptance standard](domain-expansion-acceptance-standard.md)).

Benchmark decision 2026-07-03: use **Figure 03** as the single primary reference platform for
whole-robot decomposition QA. Unitree H1/R1 remain useful for price, mobility, and developer-platform
calibration, and Tesla Optimus remains useful for vertical-integration/software-framing sanity checks,
but Figure 03 is the benchmark that best exercises the full graph: actuators, hands, sensory stack,
battery/power, charging, data offload, structure, electronics, manufacturing traceability, fleet
operation, and service. BMW's 2026-06-25 Spartanburg release is the independent customer/workcell
anchor for Figure 03 logistics sequencing and the predecessor Figure 02 production-environment
lineage; TIME's 2025-10-09 reporting is the readiness caveat that keeps home/autonomy claims bounded.
Treat Figure official claims and these machine-checked additions as `unreviewed` until owner review.
The benchmark is **not decision-grade** until non-vendor evidence separately verifies production ramp,
uptime/reliability, autonomy rate, safety/certification basis, fleet-learning/data-offload behavior,
and supplier/BOM exposure. Do not infer suppliers or listed-company exposure from Figure 03 architecture.

## 0. Hard rules (violating any voids the round)

1. **Never read `.eval/**`** or any `docs/agents/handoff-*` file.
2. **Forbidden research targets** (playbook §0.2): the @aleabitoreddit / "Serenity" / 白毛股神
   account, any thread about its picks, any "what is X buying / holding" portfolio content. Map
   the chain from industry facts only; never put these terms in a query.
3. **Log every web query verbatim** to the path given in your dispatch.
4. Evidence: independent industry sources only (whitelist §4); `reviewStatus` always `unreviewed`;
   `ok_exact` is the verifier's grant, never self-assigned.

## 1. Target structure (reconcile with the EXISTING data — extend, don't duplicate)

- Product (root, existing id): `humanoid_robot_key_component_stack`. Tag every node
  `domain: ["humanoid_robotics"]`. **Grep `data/nodes/humanoid_robotics.json` first** — 94 nodes /
  13 orgs / 34 modules already exist; extend below them, create new only for genuine gaps.
- **Level-1 modules (already present):** `humanoid_actuation_system`, `humanoid_dexterous_hand_tactile_system`,
  `humanoid_battery_power_charging_system`, `humanoid_thermal_management_system`,
  `humanoid_perception_sensing_stack`, `humanoid_onboard_compute_control_electronics`,
  `humanoid_structure_materials_harness`, `humanoid_locomotion_control_software`,
  `humanoid_manipulation_ai_data_stack`, `humanoid_manufacturing_test_safety_service`.
- **Captive-vs-merchant honesty is central** (the SpaceX lesson): integrators (Tesla Optimus,
  Figure, Unitree, Agility, 1X) build some parts in-house (actuators, control SW, manipulation
  models). Where a part is genuinely captive, say so in a node note — do NOT invent a merchant
  supplier. Software stacks (locomotion policy, foundation/manipulation models) are mostly
  captive/closed; map only the named merchant compute SoC + sensors they buy, and mark the rest
  `decomposition_frontier`/captive.
- **Reuse cross-domain orgs** — grep live ids first: CATL, NVIDIA, TDK, Schaeffler, SKF, NSK,
  Inovance, Estun, FANUC and others likely already exist (from ai_compute / parcel). One company =
  one node.

## 2. Method

Playbook recipe verbatim; domain notes:

1. **Day-0 dev set first** (`.eval/dev/humanoid_robotics_public_chokepoints.json`): documented
   2021–2026 episodes for THIS chain with publicly-named constrained suppliers — e.g. **rare-earth
   NdFeB magnet** export control (China 2023–2025, the headline humanoid chokepoint); **harmonic
   reducer** capacity/lead-time (Harmonic Drive near-monopoly); **planetary roller screw**
   scarcity + thread-grinding-machine bottleneck (widely reported for humanoid scale-up);
   **Li-ion cell** allocation; **six-axis force/torque sensor** specialists; precision **bearing**
   supply. Costs zero eval budget; predicts the weak axis before any holdout touch.
2. Decompose toward commodified leaves (ADR-0005); honest `decomposition_frontier` tags.
3. **Three exposure passes are first-class** (the data has 13 orgs — flagship parity needs more):
   **upstream** merchant tiers (who feeds the reducer/screw/motor makers — bearing steel, NdFeB
   magnets, grinding machines, separators/cathode for cells); **in-tier breadth** (every
   publicly-named supplier — Harmonic Drive 6324.T, Leaderdrive, Shenzhen Han's; Rollvis,
   Ewellix/SKF, THK, NSK roller/ball screws; frameless motors Allied Motion/Kollmorgen-Regal,
   Nidec, Moog; magnets JL Mag, Shin-Etsu, TDK, Proterial, MP Materials; cells CATL, LG Energy,
   Samsung SDI, Panasonic; F/T sensors ATI Industrial Automation, Bota; SoC NVIDIA Jetson Thor,
   Qualcomm; bearings NSK/NTN/Schaeffler/RBC); **single/near-single-source corners** (NdFeB +
   heavy-rare-earth, thread-grinding equipment, harmonic-reducer flexspline).
4. Quantify every `bottleneckOf` (capacity / expansion lead time / share concentration) on the
   flag node, citation attached to that node/edge.

## 3. Exposure layer

`org_fanuc` template shape (see `data/nodes/parcel_sorting_robot.json`); ≤5 orgs per component,
most-concentrated first; **tickers verified THIS round** from IR/exchange (expect Tokyo/Shenzhen/
Shanghai/Korea/US listings — Harmonic Drive 6324.T, JL Mag 300748.SZ, Shin-Etsu 4063.T, TDK
6762.T, CATL 300750.SZ, LG Energy 373220.KS, Samsung SDI 006400.KS, THK 6481.T, NSK 6471.T,
Nidec 6594.T, NVIDIA NVDA, MP Materials MP; many integrators private — say so); share metric with
named source + basis (or honest qualitative tag); ≥1 independent URL per org.

## 4. Sources

Whitelist: company filings/IR/earnings; reducer/screw/motor/sensor/cell maker capacity
disclosures; USGS / government (rare earths, export-control notices); IFR / interact-analysis /
TrendForce / Yole-class research; Nikkei / Reuters / Bloomberg / DigiTimes supply-chain reporting;
teardown reports. Grey (pointer only): Wikipedia, vendor marketing (tag `vendor_claim`). Banned
for numbers: SEO market-report farms, investing substacks, aggregator reblogs.

## 5. Repo conventions

Schema `src/lib/schema.ts`; strict batch `{"nodes":[],"edges":[],"evidence":[],"tasks":[]}`;
dry-run via `npm run import:candidates -- --file <batch> --domain humanoid_robotics --dry-run`;
ids name components never suppliers/verdicts; evidence ids `ev_humanoid_<slug>`; edge ids
`e_humanoid_<slug>`; supplier→component edge `manufactured_by` (makes it today) vs
`reported_capable_supplier` (unverified capability) per ADR-0009; maturity triple dated `2026-06`;
zh sidecar per batch (LanguageProvider node dictionary). Domain already registered GATED at
`audit-preview` — do not rename.

## §4.5 Evidence verification discipline (binding, per ADR-0009)

CANDIDATE evidence; an orchestrator Opus verifier re-checks it (emit **clean structured JSON** so
it applies cleanly). **No quote, no number** (verbatim `excerpt` + basis + scope + asOf, else
qualitative). **One claim, one fact.** `sourceStatus` self-report `fetch_ok` / `paywalled_snippet`
only; deep links, not homepages. Single-source / "only" / ">X%" claims need one primary or two
independent quality sources. **Honest misses beat filled blanks** — fabricated precision voids the
batch (observed rejection 24–85% on unverified batches).

## 6. Self-check rubric

Acceptance-standard Gates A–E + playbook hygiene apply verbatim: suppliers + share + source, lead
times, single-source risk, quantified bottlenecks, working whitelist URLs, captive-vs-merchant
honesty, uniform depth, dry-run green, clean query log.

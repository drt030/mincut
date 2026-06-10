# GPU / AI-Compute Chain — Decomposition Brief

**Version: v3 · 2026-06-10 (v1/v2 same day) · Owner of this file: the orchestrator.**
v2 lessons source: Layer-0 self-checks + Layer-1 public dev-set grading of round 1. v3 lessons
source: the leak-audited round-2 critique (`.eval/critiques/round-2-approved.md`) — direction
only, no held-out specifics have influenced this document.
Read this whole brief before researching. You are a Decomposer agent: you independently map the
AI-compute supply chain from primary industry sources. You build the map from supply-chain facts —
you do not copy anyone's stock picks, and you never look at the evaluation workspace.

## 0. Hard rules (violating any of these voids the round)

1. **Never read `.eval/**`** (any file under `.eval/`). Never read `docs/agents/handoff-*` files.
2. **Forbidden research targets:** the X account @aleabitoreddit ("Serenity", 白毛股神), any
   thread/article/video discussing that account's stock picks, and any "what is X buying"-style
   content about any investor. You map the chain from industry facts, not from anyone's portfolio.
   Never put these terms in a search query. If a search result page is primarily about an
   investor's picks, do not open it.
3. **Log every web search query verbatim** (one per line, prefixed with the engine) to the query
   log file given in your dispatch instructions. The log is audited; an unlogged query or a
   forbidden query voids the round.
4. Evidence sources must be **independent industry sources** (whitelist in §4). A pick-tracker,
   stock-tip forum, or investor-commentary source is never acceptable evidence.
5. Every claim you import is `reviewStatus: "unreviewed"`. Never `reviewed` — that is the owner's
   call alone.

## 1. Target structure

- Capability: `leading_edge_ai_compute` — "deploy leading-edge AI training/inference compute at
  datacenter scale". Product: `ai_accelerator_module_hbm_cowos` — a flagship AI accelerator
  module: leading-edge logic die + high-bandwidth memory stacks on an advanced 2.5D/3D package,
  with its substrate, interconnect, power-delivery, and thermal stack. (Both nodes already exist
  in the graph; do not recreate them.)
- Level-1 modules (deliberately coarse; ids fixed by dispatch):
  `logic_die_fabrication` · `advanced_packaging` · `high_bandwidth_memory` ·
  `substrate_and_interposer` · `interconnect_and_optics` · `power_delivery` · `thermal_cooling`.
- **Your job is discovery below level 1.** The sub-layers, the equipment/materials behind them,
  which nodes actually gate shipment volume today, and who supplies them — none of that is given.
  Find it and prove it.

## 2. Decomposition method

Work layer by layer, asking at every node: *"if demand for the parent doubled in 12 months, what
exactly would fail to scale, and why?"*

1. **Decompose toward commodified leaves** (ADR-0005). Stop when a component is commodified at
   industrial scale for 2026 datacenter-class production (`maturityLabel ∈ {mature,
   widely_adopted}` and genuinely multi-sourced). Continue past a mature node only with a stated
   override reason (supply concentration, geopolitical exposure, single-region capacity).
2. **Mark honest frontiers.** Where you stop early without reaching commodity leaves, tag the node
   `decomposition_frontier` and say in `notes` what the next layer down would be.
3. **Hunt chokepoints with history.** For each module, search the 2021–2026 trade-press and
   analyst archive for shortage / allocation / "sold out" / lead-time-blowout episodes in that
   layer. A documented past episode plus current capacity data is the strongest bottleneck
   evidence. Quantify: capacity (wafers/stacks/units per month), expansion lead time (months to
   add a line/fab/tool), and share concentration (top-1/top-3 share).
4. **Bottleneck claims** (ADR-0006): set `bottleneckOf: ["ai_accelerator_module_hbm_cowos"]`
   (and/or `"leading_edge_ai_compute"`) on the gating node itself. Every `bottleneckOf` needs a
   quantified constraint in `description`/`metrics` plus evidence: capacity, lead time, or share
   concentration. No vibes-based bottlenecks. **Citation altitude: the evidence attaches to the
   node CARRYING the flag** — `evidenceIds` on the flagged node itself with the capacity /
   lead-time / share figure in that record, not only on the supplier nodes beneath it. A
   chokepoint assertion is exactly the claim a reviewer challenges first.
5. **Depth uniformity.** Do not leave one branch at level 1 while a sibling goes to level 3 —
   either decompose or tag the frontier with a reason.
6. **Split by technology variant when supplier sets differ.** If two variants of a component
   are made by different vendor pools (e.g. short-reach vs long-reach optical links use
   different laser device classes), model them as separate nodes — a single merged node hides
   half the supply base and its chokepoints.
7. **Crisis-phase suppliers count.** When a documented shortage episode surfaced emergency or
   regional suppliers, record them: as org nodes if they are part of the steady-state top-5
   concentration, otherwise by name in the component's `notes` with the episode context. A
   supply story that only lists tier-1 flagships misses how the constraint actually resolved.
8. **Scope boundary (this product):** module + rack level. Datacenter-grid infrastructure
   (large transformers, switchgear, grid interconnect) is a SEPARATE future domain
   (`ai_dc_power_chain`) — put a `decomposition_frontier` note where power_delivery meets the
   facility, do not model past it.
9. **Wire the new parent, not the product.** Every `requires` edge for a sub-component hangs
   off its immediate parent module — never directly off the product node (the product keeps
   exactly its seven level-1 modules).
10. **Decompose the device-feeding upstream.** A finished device (a laser, a controller IC, a
    memory stack) is NOT a leaf just because it is purchasable: ask what feeds it — its raw
    substrate/feedstock tier, its epitaxial/deposition growth tier, and the specialty or
    compound merchant foundry tier — and model those layers wherever they have their own
    concentrated merchant supplier base. The mainstream-silicon reading of "materials" and
    "foundry" is not the only one: specialty/compound branches are distinct supplier
    populations and must be modeled separately when a segment depends on them.
11. **Referent discipline.** A node label matching a segment name does not mean the segment is
    covered — state in the node `description` which referent is modeled (e.g. package-carrier
    substrate vs wafer/crystal feedstock substrate; silicon-logic foundry vs compound/analog
    foundry). When two referents share a name, model them as separate nodes.
12. **Scope edges are decisions, not omissions.** When a real chain layer is deliberately not
    modeled (facility/grid power; operator/service tiers above the hardware chain; adjacent
    branches like storage-class memory), record the decision explicitly: a
    `decomposition_frontier` tag + `notes` naming the excluded tier and the domain it belongs
    to. Silent absence reads as a miss; a documented boundary reads as a judgment.

## 3. Exposure layer (org nodes — the paid product)

For each component where supply is concentrated (and only there — skip true commodities):

- Add `kind: "organization"` nodes. **Copy the shape of `org_fanuc` in
  `data/nodes/parcel_sorting_robot.json` exactly** (the style benchmark): `domain` includes
  `"ai_compute_chain"` and `"investable_supplier"` plus sector tags; `metrics` with market-share
  entries (each share metric's `description` names the source and the basis — revenue share vs
  capacity share vs shipment share, which year) and a `{"name": "Public listing", "currentValue":
  "<TICKER>"}` entry (exchange-qualified, e.g. `2330.TW`, `000660.KS`, `6954.T`, NYSE/NASDAQ bare
  symbols); `evidenceIds` non-empty; `confidence`; `notes` on investor relevance.
- Wire `component --manufactured_by--> org` edges (source = component, target = org), each edge
  with `evidenceIds`.
- **Cap: ≤ 5 orgs per component, most-concentrated first.** Recall-by-shotgun fails the eval.
- Private/unlisted suppliers may appear (they are part of the truth) — just omit the listing
  metric; do not pad listings.
- Every org needs ≥ 1 independent industry evidence URL (filing/IR, analyst house, trade press).
- **No silent metric omissions.** Every org node must carry: a `Public listing` metric whenever
  the company (or its parent) is listed — VERIFY the ticker against the company's own IR page
  or the exchange, never from memory — plus at least one market-share or capacity metric whose
  `description` names the source and the basis. If a company is private, say so in `notes`.
- **Supplier completeness check:** before closing a component, ask "which suppliers did
  trade-press/analyst coverage of this layer's shortages actually name?" Each named one is
  either in your top-5 org set, or recorded in the component `notes` as additional supply base.

## 4. Sources

**Whitelist (in rough order of strength):** company filings / IR decks / earnings-call
transcripts; foundry / OSAT / memory-maker / substrate-maker capacity disclosures;
TrendForce / Yole / SemiAnalysis / Omdia / IDC / Gartner-class analyst research (press releases
and reported summaries are fine); reputable trade press (DigiTimes, Nikkei Asia, EE Times, Tom's
Hardware for supply reporting, Reuters/Bloomberg supply-chain reporting); standards bodies
(JEDEC, OIF) for spec facts.
**Grey (use as pointer, confirm elsewhere):** Wikipedia, vendor marketing pages (tag
`vendor_claim`), seekingalpha-class aggregation.
**Forbidden:** anything in §0.2; untraceable social-media claims; pick-tracking content.

Every evidence record: `url` + `date` (accessed or published) + `supportsNodeIds` /
`supportsEdgeIds` + `excerpt` or `summary` with the load-bearing number. One evidence record may
support several claims.

## 5. Repo data conventions (schema: `src/lib/schema.ts`)

- Node: `id` snake_case; `name`; `kind` ∈ module / material / manufacturing_process / equipment /
  organization; `domain: ["ai_compute_chain", ...]` on EVERY node; `description` (2–4 sentences,
  numbers included); `maturityScore` 0–100 + `maturityLabel` + `maturityAsOf: "2026-06"` (per
  ADR-0002 — always all three together); `confidence`; `tags`; optional inline `metrics` (capacity,
  lead time, share; cost metrics need `costAsOf` + `currency` and **must** carry `evidenceIds` on
  the node); `bottleneckOf` / `frontierFor` where § 2 says so.
- Edge: `id` `e_acc_<source>__<relation>__<target>` (trim if huge but keep deterministic);
  `relation` ∈ `requires` (parent→child decomposition), `manufactured_by` (component→org),
  `measured_by`, `implemented_by`; `confidence`; `evidenceIds` on every manufactured_by and every
  bottleneck-adjacent requires edge; `claim` for non-obvious edges.
- Evidence: `id` `ev_acc_<module>_<slug>`; `type` ∈ industry sources above (`paper`, `news`,
  `vendor_claim`, `benchmark`, `product_page`, `standard`); the schema's evidence `type` enum is
  authoritative — use `news` for trade press, `paper` for analyst research, `vendor_claim` for
  vendor pages, `product_page` for product specs.
- Batch file = `{"nodes": [...], "edges": [...], "evidence": [...], "tasks": []}` — strict schema,
  no extra keys. It must pass
  `npm run import:candidates -- --file <batch> --domain ai_compute_chain --dry-run`.
- IDs must not collide with existing graph ids. Prefix org ids `org_<company>`; reuse the exact
  same org id if the company already exists in YOUR batch (one node per company).
- Also deliver a zh-name sidecar (NOT part of the batch): `{"<node_id>": "<简体中文名>"}` for every
  node you create, so the UI language dictionary can be extended.

## 6. Self-check rubric — run this before you hand the batch back

For every non-commodity component you created:
- [ ] Top suppliers named with share + named source + basis? (≤5, concentrated-first)
- [ ] Capacity-expansion lead time documented (months; tool/fab/line)?
- [ ] Single-source / duopoly / single-region risk stated where true?
- [ ] Every `bottleneckOf` backed by a quantified constraint + evidence URL?
- [ ] Maturity triple present and dated 2026-06? Confidence set honestly?
- [ ] Every evidence record has a working URL from the §4 whitelist?
- [ ] Depth uniform, frontiers tagged with reasons?
- [ ] Batch passes the dry-run import?
- [ ] Query log complete and free of forbidden queries?

Fix what fails before returning. Report (in your final message): counts of nodes/edges/evidence,
which sub-layers you flagged `bottleneckOf` and the one-line quantified reason for each, frontier
tags you left, and anything you looked for but could not source (honest gaps beat padded ones).

## 7. Historical chokepoint episodes — mandatory research targets (public dev set)

These ten documented 2021–2025 episodes are public knowledge and primary research material
(§2.3). For any component touching one of these layers, your decomposition must be able to
explain the episode: which node gated, who the constrained suppliers were, how it resolved.

1. `abf_substrate_shortage` (2021–2023) — ABF build-up film / IC substrates
2. `cowos_advanced_packaging_selloff` (2023–2025) — 2.5D packaging capacity sold out
3. `silicon_interposer_constraint` (2023–2025) — interposer capacity inside packaging flow
4. `hbm_allocation_selloff` (2023–2025) — HBM booked out / allocation
5. `neon_gas_lithography_supply_shock` (2022) — lithography gas supply shock, crisis sourcing
6. `optical_transceiver_eml_laser_lockup` (2024–2025) — long-reach laser device shortage
7. `datacenter_liquid_cooling_cdu_constraint` (2024–2025) — coolant distribution unit capacity
8. `grid_transformer_power_equipment_shortage` (2022–2026) — OUT OF SCOPE here (§2.8): record
   the boundary as a frontier note on power_delivery; the episode belongs to `ai_dc_power_chain`
9. `euv_lithography_tool_backlog` (2021–2024) — EUV tool single-source backlog
10. `leading_edge_foundry_capacity_n3_n5` (2023–2026) — leading-node foundry allocation

Sources for each: `.eval/dev/public_chokepoints.json` is the curated reference — Decomposers do
not read `.eval/**`, so research the episodes directly from trade press/analyst archives.

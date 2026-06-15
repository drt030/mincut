# Reusable Orbital Launch Chain — Decomposition Brief

**Version: v1 · 2026-06-15 · Owner of this file: the orchestrator.**
Method inherits [the domain playbook](domain-decomposition-playbook.md) and is graded against
[the domain-expansion acceptance standard](domain-expansion-acceptance-standard.md) (flagship
parity). Read both first. This brief is independent of the GPU / humanoid briefs by design — only
method carries over, no content.

## 0. Hard rules (violating any voids the round)

1. **Never read `.eval/**`** or any `docs/agents/handoff-*` file.
2. **Frame the chain as an INDUSTRY, not a company.** The domain is *reusable orbital launch*, not
   "SpaceX". SpaceX is one (captive-heavy) integrator among several — map the merchant supply chain
   that any reusable-launch program draws on. **Forbidden research targets** (playbook §0.2): the
   @aleabitoreddit / "Serenity" / 白毛股神 account and any portfolio / "what is X buying" pick
   content. Map from industry facts only; never put these terms in a query.
3. **Log every web query verbatim** to the path given in your dispatch.
4. Evidence: independent industry sources only (whitelist §4). `reviewStatus` always `unreviewed`;
   `ok_exact` is the verifier's grant, never self-assigned.

## 1. Target structure

- Capability: `spacex_reusable_orbital_launch_capability` (existing id — do not rename) — delivering
  payload to orbit with a recovered & reflown vehicle.
- Product (root): `spacex_reusable_launch_stack` (existing id). The product is **anchored** on the
  real reusable programs (Falcon 9 operational reuse + Starship/Super Heavy rapid-reuse), but the
  decomposition + exposure are **industry-framed**: map the merchant supply chain any reusable-launch
  program buys; label SpaceX-captive parts honestly as captive.
- **Out of scope, documented in DATA** (capability `scope` note + `decomposition_frontier` boundary
  note): orbital / space-based data centers (sibling parked domain `orbital_data_center`),
  satellites/payloads, ground stations & range infrastructure (keep only regulatory licensing as a
  `standard_or_regulation` node), and crew systems.
- **Reuse, don't duplicate** (ADR-0004/0005): the graph already has rad-tolerant electronics,
  connectors, and specialty-material subtrees touched by other domains — grep live ids first and
  link with `requires` edges; create new nodes only for genuinely new components.
- Tag every node `domain: ["spacex_reusable_launch"]` (existing domainTag; preserve cross-tags like
  `investable_supplier`). Sub-components hang off their parent module, never off the product.

### Level-1 skeleton (target coverage; reconcile with the 55 existing launch-side nodes in `space_spacex.json` — grep live module ids, extend, don't duplicate; agents discover below it, never above)

1. `propulsion_engine_system` — combustion chambers, turbopumps, injectors, valves, igniters, TVC.
   Hard tech: regen-cooled chambers, staged-combustion (ox-rich / full-flow), additive-manufactured
   hot-section parts.
2. `airframe_structures_tankage` — propellant tanks, barrel/dome forming, friction-stir welding,
   common bulkheads, interstages, fairings, COPV pressurant vessels.
3. `thermal_protection_system` — reentry heatshield (ablative PICA-class / ceramic tile), base heat
   shield, reusability between flights.
4. `avionics_gnc_flight_computer` — flight computer, rad-tolerant / COTS-upscreened electronics,
   IMU, GNSS, star tracker, sensors, flight termination.
5. `recovery_reuse_hardware` — grid fins (Ti forgings), landing legs / catch hardware, propulsive
   landing GNC, refurbishment & requalification process.
6. `propellants_fluids` — LOX, RP-1 / LCH4 (methane), helium pressurant, ground/flight fluid systems.
7. `production_test_qualification` — engine test stands, structural/proof test, mass-production lines.
8. `launch_regulatory_license` — FAA/AST launch & reentry licensing, debris/deorbit compliance.

## 2. Method

Playbook §recipe verbatim; domain-specific notes:

1. **Day-0 dev set first** (`.eval/dev/reusable_launch_public_chokepoints.json`): documented
   2020–2026 episodes for THIS chain with publicly-named constrained suppliers — e.g. aerospace
   **titanium** export risk (VSMPO-AVISMA post-2022); aerospace-grade **carbon fiber** allocation /
   export control (Toray-class); **helium** shortage (2022) hitting pressurant supply; **rad-hard /
   space-grade chip** lead times; large **casting/forging** capacity (Howmet / PCC); superalloy /
   additive-powder (GRCop-class) constraints. Built by the Day-0 agent from trade press / analyst
   archives. Costs zero eval budget and predicts the weak axis before any holdout touch.
2. Decompose toward commodified leaves (ADR-0005); honest `decomposition_frontier` tags; every node
   carries `maturityLabel` (the current file has 16 `unknown` — resolve them).
3. **The three exposure passes are first-class duties** (this is where the launch chain is thinnest —
   only 2 launch-side orgs exist today): **upstream** merchant tiers (who feeds the engine/tank
   makers — superalloys, titanium, Al-Li, carbon fiber, copper powder, forgings?); **in-tier
   breadth** (every publicly-named supplier — Moog/Parker valves & actuators, BAE/Microchip/
   Frontgrade rad-hard, Honeywell/Northrop IMUs, Sodern/Ball star trackers, Constellium/Kaiser
   Al-Li, Howmet/ATI/Carpenter/Haynes superalloys, Toray/Hexcel/Teijin carbon fiber, Glenair/TE/
   Amphenol connectors); **single/near-single-source corners** (export-controlled titanium, high-
   modulus aerospace carbon fiber, specific forging presses, space-grade FPGA).
4. **Captive-vs-merchant is the central honesty call here.** Vertically-integrated primes (SpaceX
   Raptor/Merlin, Blue Origin BE-4) build much in-house — say so. Exposure recall is earned on the
   *merchant* tiers any program must buy (materials, rad-hard electronics, actuators, forgings),
   not by pretending captive parts have public suppliers.
5. Quantify every `bottleneckOf` (capacity / expansion lead time / share concentration) on the
   flag-carrying node, citation attached to that node/edge (evidence altitude).

## 3. Exposure layer

`org_fanuc` template shape exactly (see `data/nodes/parcel_sorting_robot.json`); ≤5 orgs per
component, most-concentrated first; **tickers verified THIS round** from IR/exchange (expect
NYSE/NASDAQ/Euronext/Tokyo listings — Howmet HWM, ATI, Carpenter CRS, Moog MOG.A, Parker PH,
Constellium CSTM, Toray 3402.T, Hexcel HXL, BAE BA.L, Microchip MCHP, L3Harris LHX; many primes are
private/captive — say so, don't invent a ticker); share metric with named source + basis; ≥1
independent URL per org; reuse existing orgs (grep first — `org_spacex`, `org_rocket_lab` exist).

## 4. Sources

Whitelist: company filings/IR/earnings transcripts; FAA/AST licensing & mishap docs; NASA technical
reports & procurement; materials-maker capacity disclosures; Aviation Week / SpaceNews / Reuters /
Bloomberg supply-chain reporting; standards bodies. Grey (pointer only, confirm elsewhere):
Wikipedia, vendor marketing (tag `vendor_claim`). Forbidden: §0.2 content, untraceable social
claims, SEO market-report farms / investing substacks for numbers.

## 5. Repo conventions

Schema `src/lib/schema.ts`; strict batch `{"nodes":[],"edges":[],"evidence":[],"tasks":[]}`;
dry-run via `npm run import:candidates -- --file <batch> --domain spacex_reusable_launch --dry-run`;
ids name components, never suppliers/verdicts; evidence ids `ev_space_<slug>`; edge ids
`e_space_<slug>`; maturity triple dated `2026-06`; zh sidecar per batch (LanguageProvider node
dictionary). The domain is already registered GATED at `audit-preview` — do not rename it.

## 6. Self-check rubric

Acceptance-standard Gates A–E + playbook hygiene apply verbatim: suppliers + share + source, lead
times, single-source risk, quantified bottlenecks, working whitelist URLs, captive-vs-merchant
honesty, uniform depth, dry-run green, clean query log.

## §4.5 Evidence verification discipline (binding, per ADR-0009)

Your output is CANDIDATE evidence; an orchestrator Opus verifier re-checks it. **No quote, no
number** (verbatim `excerpt` + basis + scope + asOf, else qualitative). **One claim, one fact.**
`sourceStatus`: self-report `fetch_ok` / `paywalled_snippet` only; deep links, not homepages.
Single-source / "only" / ">X%" claims need one primary or two independent quality sources.
**Honest misses beat filled blanks** — "no claim-specific source found" is a valid answer;
fabricated precision voids the batch (observed rejection 24–85% on unverified batches).

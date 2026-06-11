# Humanoid Actuator Chain — Decomposition Brief

**Version: v1 · 2026-06-11 · Owner of this file: the orchestrator.**
Method inherits [the domain playbook](domain-decomposition-playbook.md) (read it first). This
brief is independent of the GPU-chain brief by design — no content carries over, only method.

## 0. Hard rules (violating any voids the round)

1. **Never read `.eval/**`** or any `docs/agents/handoff-*` file.
2. **Forbidden research targets:** the X account @aleabitoreddit ("Serenity", 白毛股神), any
   thread/article discussing that account's picks, and any "what is X buying" content about any
   investor. Map the chain from industry facts, never from portfolios. Never put these terms in
   a query; if a result page is primarily investor-pick content, do not open it.
3. **Log every web query verbatim** to the path given in your dispatch.
4. Evidence: independent industry sources only (whitelist §4). reviewStatus always `unreviewed`.

## 1. Target structure

- Capability: `humanoid_robot_actuator_joint` — actuated joints for commercial humanoid robots.
- Products (three sibling architectures per ADR-0004):
  `rotary_actuator_harmonic` (harmonic-reducer rotary joint) ·
  `linear_actuator_roller_screw` (planetary-roller-screw linear joint) ·
  `dexterous_hand_actuator` (hand/finger actuation incl. tendon drives).
- **Reuse, don't duplicate** (ADR-0004/0005): the graph already contains
  `precision_reducer_gearbox` and servo/encoder subtrees from the parcel domain — link into
  them with `requires` edges; create new nodes only for what those subtrees genuinely lack.
- Flagship-launch deltas to discover and decompose (launch plan Task 15): planetary roller
  screws and their **thread-grinding capacity**, frameless torque motors, six-axis
  force/torque sensors, joint encoders, tendon/cable drives, and the materials feeding them
  (bearing steel classes, rare-earth magnets).
- Tag every new node `domain: ["humanoid_actuator"]`. Sub-components hang off their parent
  module, never off a product node.

## 2. Method

Playbook §recipe applies verbatim; the domain-specific notes:

1. **Day-0 dev set first**: documented 2021–2026 public episodes for THIS chain (e.g. harmonic
   reducer capacity/lead-time cycles, roller-screw grinding-machine scarcity reporting,
   rare-earth magnet export-control events, encoder allocation) — built by the day-0 agent
   from trade press/analyst archives into `.eval/dev/humanoid_public_chokepoints.json`.
2. Decompose toward commodified leaves (ADR-0005); honest `decomposition_frontier` tags.
3. The three exposure passes are first-class round-1 duties here (playbook lesson): upstream
   merchant tiers (who feeds the reducer/screw/motor makers — steel, magnets, grinding
   machines?), in-tier breadth (every publicly-named constrained supplier), single-source
   corners (grinding equipment, sensor specialists).
4. Quantify every `bottleneckOf` (capacity, expansion lead time, share concentration) on the
   flag-carrying node, citation attached to that node/edge (evidence altitude).
5. Scope boundary: full-robot integration, locomotion software, batteries → out of scope
   (note the boundary in data); this domain is the ACTUATOR chain.

## 3. Exposure layer

org_fanuc template shape exactly (see `data/nodes/parcel_sorting_robot.json`); ≤5 orgs per
component most-concentrated first; verified tickers (IR/exchange, never memory — expect
Tokyo/Taiwan/Shanghai/Shenzhen listings); share metric with named source+basis; ≥1 independent
URL per org; reuse existing orgs (grep first — FANUC, Inovance, Estun etc. already exist).

## 4. Sources

Whitelist: company filings/IR/earnings transcripts; reducer/screw/motor/sensor maker capacity
disclosures; TrendForce/Yole/Omdia/IFR/interact-analysis-class research; Nikkei/DigiTimes/
Reuters/Bloomberg supply-chain reporting; standards bodies. Grey (pointer only, confirm
elsewhere): Wikipedia, vendor marketing (tag `vendor_claim`). Forbidden: §0.2 content,
untraceable social claims, pick-tracking content.

## 5. Repo conventions

Identical to the GPU brief §5 (schema `src/lib/schema.ts`; strict batch
`{"nodes":[],"edges":[],"evidence":[],"tasks":[]}`; dry-run via
`npm run import:candidates -- --file <batch> --domain humanoid_actuator --dry-run`;
ids name components never suppliers/verdicts; evidence ids `ev_hum_<module>_<slug>`;
edge ids `e_hum_*`; maturity triple dated `2026-06`; zh sidecar per batch).

## 6. Self-check rubric

Playbook hygiene list + GPU brief §6 checklist apply verbatim (suppliers+share+source,
lead times, single-source risk, quantified bottlenecks, working whitelist URLs, uniform
depth, dry-run green, clean query log).

## §4.5 Evidence verification discipline (binding, per ADR-0009 — added 2026-06-11)

Your output is CANDIDATE evidence; an orchestrator verification layer re-checks it. Rules:

1. **No quote, no number.** Any quantified claim (share, capacity, lead time, price, ratio)
   must carry a verbatim `excerpt` from the page plus basis (revenue/unit/capacity/bit — they
   are different numbers), scope, and asOf date in `summary`. If you cannot quote it, write
   the claim as qualitative — that is a fully acceptable deliverable.
2. **One claim, one fact.** Never bundle share + price + capex + lead time into one statement
   or one metric.
3. **sourceStatus**: self-report `fetch_ok` (you actually fetched a SPECIFIC page) or
   `paywalled_snippet` (visible snippet quoted). `ok_exact` is reserved for the verifier —
   never self-assign it. Deep links only; a homepage/section page is not a citation.
4. **Banned for numbers**: SEO market-report farms, personal or investing substacks/newsletters,
   aggregator reblogs. Vendor IR/product pages are fine for who-makes-what facts (type
   `vendor_claim`/`product_page`), weak for market structure. Single-source/"only qualified"/
   "100%" claims need one primary source or two independent quality sources — otherwise state
   "reported, unverified".
5. **Honest misses beat filled blanks.** "No claim-specific source found" is a valid, expected
   answer; fabricated precision voids the batch. Expect your self-reports to be spot-checked —
   observed rejection rates on unverified batches ran 24–85%.

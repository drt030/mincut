# Domain Expansion — Agent Acceptance Standard (Flagship Parity)

**Version: v2 · 2026-06-15 · Owner of this file: the orchestrator.**
**v2 change:** folds the [QA-agent.md](../QA-agent.md) browser user-flow back in as **Gate F**
(mandatory) — data gates A–E alone no longer grant ACCEPTED. See §0 + §7.5 + §8.
**Inherits (read first):** [QA-agent.md](../QA-agent.md) (the product user-flow contract — Gate F),
[domain-decomposition-playbook.md](domain-decomposition-playbook.md),
[evidence-audit-brief.md](evidence-audit-brief.md), ADR-0001 (review ladder), ADR-0004
(sibling-product boundary), ADR-0005 (decomposition stop + concentration override), ADR-0008
(know-how layers), ADR-0009 (claim discipline + edge semantics + remediation ladder), and the
[MASTER-PLAN](../plans/MASTER-PLAN.md) decision log.

## 0. Purpose

This is the **pass/fail contract** for any agent or agent fleet that expands a paid emerging
domain to **flagship parity** (the quality the `ai_compute_chain` flagship reached: 205 nodes /
312 edges / 388 evidence, evidence_integrity → 1.00, exposure_recall 0.65). It is the standard
the autonomous expansion run is graded against. It is domain-agnostic; per-domain specifics live
in each domain's decomposition brief and in §7 below.

This document grades **decomposition + exposure + evidence quality** (Gates A–E). **Data
correctness is necessary but NOT sufficient** for ACCEPTED: the rendered product must also pass the
[QA-agent.md](../QA-agent.md) browser user-flow as **Gate F (§7.5)**. A domain that is data-correct
but renders a thin/unreadable graph, hides the exposure the data claims, or shows
gray/unclassified nodes is **NOT ACCEPTED** — it is "data-accepted, user-flow pending".
(Correction 2026-06-15: an earlier version scoped UI-QA out as a "separate concern"; that gap let a
data-only loop pass two domains whose product surfaced only ~12 of 53 supplier orgs and carried
unresolved gray nodes. UI acceptance is folded back in here.)

A round/batch is **ACCEPTED if and only if** every gate A–F passes for the domain under test
(§8). Partial passes do not ship to an owner review queue.

## 1. Scope locked this round (2026-06-15)

| Domain | Frame | In scope | Out of scope (must be documented in DATA) |
|---|---|---|---|
| `reusable_launch` | **Industry product chain**, NOT "SpaceX the company" (playbook §0.2: map from industry facts, never from a portfolio/company) | Reusable orbital launch-vehicle chain: engines & turbomachinery, structures (tanks, large castings/forgings, aerostructures), TPS, avionics & rad-tolerant electronics, propellant/materials (aerospace Al-Li, carbon composite, specialty alloys), GNC sensors, recovery (grid fins, legs) | Orbital / space-based **data center** (pre-revenue; parked as preview/waitlist, no eval). Payloads, ground systems, in-space servicing. |
| `humanoid_robotics` | **Whole robot** (owner override 2026-06-15; supersedes the actuator-only brief v1) | Actuator chain (harmonic/roller-screw/dexterous) + power/battery + compute/perception (SoC, sensors) + force/tactile sensing + integration | Full humanoid *software stacks* (foundation models, locomotion policy) beyond the named compute SoC; consumer-toy robots. |

- **Every** scope exclusion is written into the DATA as a capability-level `scope` note **and** a
  `decomposition_frontier` boundary note pointing at the sibling domain (playbook Day-0 rule:
  undocumented boundaries grade as misses, documented ones grade as decisions).
- Both domains are **already registered** (`src/lib/domains.ts`, `exposureGate.ts` `GATED_DOMAINS`,
  entitlement `space`) at `portfolioState: "audit-preview"`. This round does **not** re-register or
  rename them — 7 test files pin `spacex_reusable_launch` / `spacex_reusable_launch_stack`, so a
  rename is gratuitous breakage. The industry framing is a **content** directive (map the merchant
  chain any reusable-launch program buys, not SpaceX-captive parts only; honest captive-vs-merchant
  labelling), not an id change. Server-side exposure stripping stays live (Decision 4).
  `orbital_data_center` stays at `audit-preview`, unexpanded and out of eval this round.

## 2. The bar — flagship parity

Flagship parity = the deterministic, evidence, exposure, eval, review, **and user-flow** gates
(§3 Gate A – §7.5 Gate F) all pass for the domain. "Looks complete" is not parity — the eval, the
verifier, **and a real user testing the running product** decide.
The reference run (`ai_compute_chain`) is the calibration anchor, not a node-count target — a domain
with fewer genuine segments is fine if its segments are fully covered.

**Repo-native "done":** ACCEPTED (all gates pass) = the domain is eligible to flip its
`portfolioState` from `audit-preview` → `paid-candidate` (`DOMAIN_PORTFOLIO_STATES` in
`src/lib/domains.ts`). That flip — like the `reviewed` evidence flips (§7) — is **owner-only**.

## 3. Gate A — Deterministic hard gates (must be 100%; run first, fail fast before any eval spend)

These are cheap, mechanical, and block everything downstream. Run them every round.

| # | Check | Command | Pass line |
|---|---|---|---|
| A1 | Schema + stop-condition: every node has `maturityLabel`; every `hard_to_develop` node has `notes`/`description` (ADR-0005) | `npm run validate:data` | 0 violations |
| A2 | **Evidence integrity floor** (the headline gap — currently 100% fail on both domains) | `npm run audit:evidence -- --domain <slug>` | **0 records in the `failed` bucket** (0 missing `excerpt`) |
| A3 | Active-graph scope not silently rescoped by the new domain | `npm run check:active-graph-scope` | green |
| A4 | Graph topology + UX invariants hold | `npm run check:graph-ux` | green |
| A5 | Commercial-readiness invariants (gating, leaks) hold | `npm run check:commercial-readiness` | green |
| A6 | Lint + build + tests | `npm run verify` (lint + graph-ux + test) then `npm run build` | green |
| A7 | zh sidecar coverage complete for every new node/metric/evidence | languageCoverage check (part of verify) | 0 missing zh |
| A8 | Per-domain **data-quality unit test** (e.g. `tests/spacexDataQuality.test.ts`) pins decision-grade fields on the headline bottleneck(s): `transactability`, `capacityLeadTimeMonths`, cost-disclosure metric, `constraint_*` tags, ≥1 direct independent non-vendor evidence | `npm test` | green |

## 4. Gate B — Evidence & claim discipline (ADR-0009, per-record)

A6/A2 are structural; this is semantic and is enforced by the **Opus verifier**, never self-attested
(agent self-reports run 24–85% wrong — playbook verification layer).

- **B1 No quote, no number.** Every quantified claim (share, capacity, lead time, price, ratio)
  carries a verbatim `excerpt` + `basis` (revenue/unit/capacity/bit are different numbers) +
  `scope` + `asOf`. Otherwise it ships qualitative or as a labelled estimate (method + anchors,
  `confidence: low`). **0 orphan numbers** (fact-whitelist sweep, not keyword filter).
- **B2 One claim, one fact.** Never bundle share + price + capex + lead time. Metric-level facts
  cite their own record.
- **B3 `ok_exact` is verifier-granted only.** Agents self-report `fetch_ok` / `paywalled_snippet`;
  the verifier promotes to `ok_exact` after WebFetch + quote check + basis check.
- **B4 Edge semantics are claims.** 0 bare `manufactured_by` edges without a citation;
  capability/qualification/second-source/strategic-supply use their correct ADR-0009 relation
  (`reported_capable_supplier` for unverified capability, never `manufactured_by`).
- **B5 Source-class rules (ADR-0009).** SEO market-report farms / personal investing substacks /
  aggregator reblogs are never citable for numbers. Vendor IR/product pages: fine for
  who-makes-what, weak for market structure. Single-source / ">X%" / "only qualified" claims need
  one primary source or two independent quality sources.
- **B6 Demote, don't delete.** Failed citations move to `rejectedEvidenceIds` (+ reason in
  `limitations`); the audit trail survives; they never count as support.

## 5. Gate C — Exposure (the hard axis; three passes done and provable)

Knowing a segment exists ≠ knowing who occupies it. This is where ~all real recall is earned.

- **C1 Three passes executed** per supply-concentrated component (playbook): **upstream** merchant
  tier (who feeds the visible maker — steel/magnets/alloys/grinding machines/blanks); **breadth**
  (every publicly-named constrained supplier in an already-modeled tier, not just #1); **corners**
  (single / near-single-source positions; reject pseudo-corners honestly).
- **C2** ≤5 orgs per component, most-concentrated first; overflow → `notes`.
- **C3** Every org: a **ticker verified THIS round** from IR/exchange (never from memory — observed
  7–29% error per cheap-fleet batch) + ≥1 independent quality URL + a share metric with named
  source & basis (or an honest qualitative tag).
- **C4** One company = one node, ever (alias-folded; cross-domain orgs reused — grep live ids
  first: FANUC, Inovance, CATL, etc. already exist).
- **C5 Concentration override (ADR-0005 amendment):** a `mature`/`widely_adopted` node with ≤3
  distinct holders (or 0) is treated as frontier — decomposition-eligible, auto-task. Don't stop
  at a commodified-looking leaf that is actually a chokepoint.

## 6. Gate D — Sealed-room eval (flagship parity; four axes)

**Prerequisite:** a Day-0 **public-episode dev set** exists at
`.eval/dev/<domain>_public_chokepoints.json` (documented 2020–2026 shortage/allocation/lead-time
episodes with publicly-named constrained suppliers) **and** a sealed holdout. Free layers
(Layer-0 rubric + dev-set grading) must **plateau** before any holdout touch.

| Axis | Pass line | `ai_compute_chain` reference |
|---|---|---|
| segment_recall | **≥ 0.85** | 0.80–0.90 after round 1 |
| chokepoint_flag_rate | **≥ 0.95** | 0.95–1.00 |
| exposure_recall | **≥ 0.65** | 0.65 after 3 enrichment rounds |
| evidence_integrity | **≥ 0.95** | → 1.00 after altitude + edge passes |

- **D1 Holdout economics:** ≤ **3** holdout touches per domain, logged in `.eval/budget.md`
  (owner + auditors only beyond the budget lines), **fixed grading template** across touches
  (template drift breaks comparability), fresh sealed-room agents each round.
- **D2 Eval export** via `scripts/export-decomposition.mjs`; holdout sealed; ≤3 graded touches.
- **D3 Forward picks** (post-freeze) are the terminal public claim, used exactly once per domain.

## 7. Gate E — Owner review (honesty ladder; ADR-0001 / Decision 10)

- **E1** Per domain, the **top-15** highest-stakes claims (top bottlenecks / flip candidates) are
  made **flip-eligible**: all supporting evidence is `ok_exact` + verbatim quote + single fact +
  scope/basis + `asOf` + correct edge type. These six are the pipeline's job and must be true and
  provable before the queue is handed up.
- **E2** The **seventh** criterion — owner-checked URL — and the flip to `reviewStatus: reviewed`
  are the **owner's alone**. No agent, fleet, or verifier ever writes `reviewed` or claims a human
  reviewed anything (evidence-audit-brief Hard Rule 1–2).
- **E3** The review queue is delivered as a doc like
  [review-queue-ai-compute.md](review-queue-ai-compute.md): per-claim, per-fact, with the evidence
  and the exact flip decision the owner is being asked to make.

## 7.5 Gate F — User-flow product acceptance (QA-agent.md; MANDATORY, browser-tested)

Gates A–E grade the **files**; Gate F grades the **running product**, exactly per
[QA-agent.md](../QA-agent.md) (the adversarial product reviewer). A verdict agent may **not** pass
a domain on A–E alone — per QA-agent.md strictness: *"do not mark pass if browser testing was
skipped for UI changes"* and *"if a core user journey was not actually tested."*

- **F1 Real browser.** Open the live route `/d/<slug>` in a real browser (preview/automation) and
  run the QA-agent.md minimum user tasks (first screen; graph inspection per ADR-0007; graph
  usability; maturity/routes; evidence/review status; gate; tasks; EN/zh; responsive;
  trust/recovery). Report what was actually clicked, not what the docs promise.
- **F2 The exposure the data claims is actually VISIBLE.** The supplier orgs counted by Gate C/D
  must be reachable in the product — as graph nodes and/or the suppliers-&-tickers rail on the
  relevant component — **not merely present in the JSON.** Spot-check 5 Gate-D answer-key suppliers;
  confirm a user can find each. **`reported_capable_supplier`-only orgs that render nowhere are a
  blocker:** the radial tree is built from decomposition relations (`requires`/`part_of`/
  `has_route`/`implemented_by`) and holder counts use `manufactured_by`/`implemented_by`, so an org
  reachable by neither is invisible — the exposure work must surface, or the relations/rail must.
- **F3 Graph reads as a map.** The radial decomposition renders, is non-trivial, and communicates
  which subsystem is most complex/important without a side list; no blank canvas, no orphan
  cluster. Report the rendered-tree node count vs the flagship.
- **F4 No gray/unclassified nodes.** Every rendered node has a resolved maturity **and** subsystem
  classification — no `unknown` maturity, no uncoloured/uncategorised nodes. Day-0 classification
  debt (e.g. the 16 `unknown`-maturity SpaceX nodes flagged at kickoff) is resolved, not carried.
- **F5 EN + zh both usable**; no truncation/overlap of core controls (e.g. the lens toggle), no
  console errors, graceful recovery from missing data.
- Findings categorised per QA-agent.md (blocker / major / minor / ux / data_model / performance /
  accessibility / opportunity). **Any blocker or major rendered-product finding fails Gate F.**

## 8. The acceptance decision rule

A domain reaches **flagship parity (ACCEPTED for owner review)** when, in a single coherent state:

```
A1..A8 all green
  AND B1..B6 hold (verifier-confirmed, not self-attested)
  AND C1..C5 done and provable
  AND D: segment_recall ≥0.85 AND chokepoint_flag_rate ≥0.95
         AND exposure_recall ≥0.65 AND evidence_integrity ≥0.95
  AND E1 satisfied (top-15 flip-eligible queue delivered)
  AND F1..F5 pass (QA-agent.md browser user-flow; 0 blocker/major rendered-product findings)
```

**Data-accepted ≠ ACCEPTED.** A domain that clears A–E but has not passed Gate F is
"data-accepted, user-flow pending" and does NOT earn `audit-preview`→`paid-candidate` eligibility.
E2 (owner flips) happens after the full A–F conjunction. Anything short is `in_progress`, reported
honestly with the failing gate named — never rounded up to "done".

**Status correction (2026-06-15):** the prior `reusable_launch` and `humanoid_robotics`
"ACCEPTED" verdicts were **data-only (A–E)** — Gate F was never run. Both are downgraded to
**data-accepted, user-flow PENDING** until QA-agent.md passes. (Already surfaced by inspection: the
rendered SpaceX tree shows ~59 structural nodes with only ~12 of 53 supplier orgs reachable, plus
gray `unknown`-maturity nodes — exactly the class of defect Gate F exists to catch.)

## 9. Process integrity & cost discipline (binding)

- **Sealed-room discipline:** the brief is the only learning substrate between rounds; version it,
  date it. Fresh agents per round. No sealed-room role (including auditors) enumerates its scan
  tokens in output ("report results only; never enumerate what you scanned for").
- **Forbidden research targets (§0.2):** the @aleabitoreddit / "Serenity" / 白毛股神 account, any
  thread discussing its picks, and any "what is X buying" portfolio-tracking content. Map chains
  from industry facts. Never put these terms in a query; never open a primarily-pick page.
- **Query logging:** every web query logged verbatim to the dispatch-specified path.
- **Model policy (2026-06-14):** cheap models (Sonnet/Haiku) for all fan-out research and simple
  scans only; **Opus 4.8 for every sealed-room judgment** (curator / holdout grader / leak auditor)
  **and every number/quote verification** before import. `ok_exact` is an Opus decision.
- **Fleet mechanics:** background fleets with per-agent retry; all intermediate artifacts in files
  (`.scratch/<domain>-round-N/`) so an API outage costs minutes, not the work.
- **Never invent graph facts** to clear a gate. An honest miss ("no claim-specific source found")
  beats a filled blank; fabricated precision voids the batch.

## 10. Per-round deliverable manifest

Each domain, when ACCEPTED, has produced:

- updated `data/nodes/<domain>.json` + `data/edges/<domain>_edges.json` +
  `data/evidence/<domain>_evidence.json` (+ zh sidecar);
- `.eval/dev/<domain>_public_chokepoints.json` (Day-0 dev set) + sealed holdout + eval scorecard
  (four axes) + `.eval/budget.md` touch entries;
- an audit report with **0 `failed`** (`npm run audit:evidence -- --domain <slug>`);
- a top-15 owner review queue doc;
- the domain's decomposition brief, versioned/dated (`reusable_launch`: **new**; `humanoid_robotics`:
  **rewritten** from actuator-only to whole-robot);
- domain `portfolioState` eligible to flip `audit-preview` → `paid-candidate` (owner-only),
  server-side exposure stripping verified, and a `*DataQuality.test.ts` pinning its headline
  bottleneck(s).

This standard + the two briefs are committed **before** round 1.

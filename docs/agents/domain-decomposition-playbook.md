# Domain Decomposition Playbook

**Distilled from the ai_compute_chain run (2026-06-10, 4 rounds, 3 holdout touches).**
Apply to every new domain (humanoid_actuator, ai_dc_power_chain, …). The numbers below are
what the metrics actually did, so future runs know what to expect and where the work is.

## What the eval taught us (score mechanics)

| Axis | Behavior observed | Implication |
|---|---|---|
| segment_recall | 0.80–0.90 after ONE breadth round | Structure is cheap. Do not over-invest in round 1. |
| chokepoint_flag_rate | 0.95–1.00 from round 1 | Historical-episode hunting works immediately. |
| exposure_recall | 0.20 → 0.50 → 0.65 over three enrichment rounds | **The hard axis. ~All real work lives here.** |
| evidence_integrity | 0.65 → 1.00 only after altitude + edge-level passes | Placement matters as much as existence. |

**The core exposure lesson:** knowing a segment exists ≠ knowing who occupies it. The misses
concentrated in exactly three shapes, which became the three standard passes (below):
upstream merchant tiers feeding visible components; secondary players inside already-modeled
tiers; single/near-single-source corners (where the chokepoint story actually lives —
the HBM-bonder-equipment-maker pattern, the mask-blank-monopoly pattern, the T-glass pattern).

## The recipe

**Day 0 (orchestrator, ~half a day)**
1. Fix the product boundary; write every scope exclusion into the DATA (capability-level
   scope notes + `decomposition_frontier` boundary notes pointing at the sibling domain).
   Undocumented boundaries grade as misses; documented ones grade as decisions (+0.10
   adjusted exposure in this run).
2. Author the coarse level-1 skeleton (5–8 modules) yourself — agents discover below it,
   never above it. Wire sub-components to their parent module, never to the product.
3. **Build the public episode dev set first** (documented shortage/allocation/lead-time
   episodes, ~2020–2026, with the publicly-named constrained suppliers). It is the cheapest
   high-signal artifact: it encodes where bottlenecks materialize AND who was constrained,
   and it costs zero eval budget to grade against every round.

**Round 1 — breadth (one cheap agent per module)**
Prescriptive brief + per-module dispatch; rubric demands: top suppliers + share + named
source/basis; capacity and expansion lead time; single-source/duopoly risk; episode hunt in
that layer. Expect exposure to be WEAK (~0.2–0.5). That is fine; do not iterate breadth.

**Round 2+ — the three exposure passes (where recall is actually earned)**
- **Upstream pass:** for every supply-concentrated component ask "who FEEDS this, and is the
  feeder merchant or captive?" Go one tier below; merchant specialists are the population
  investors actually hold (substrate wafers / epitaxy / blanks / specialty equipment class).
- **Breadth pass:** inside modeled tiers, wire every supplier that episode coverage publicly
  named as constrained — not just the #1. Respect the ≤5 cap; overflow goes to `notes`.
- **Corners pass:** explicitly hunt single/near-single-source positions ("only maker of",
  "largest supplier of", ">70% share"). Reject pseudo-corners honestly (a duopoly with a
  healthy second source is not a corner).

**Every round — mechanical hygiene (orchestrator-owned, deterministic)**
- Normalize agent output before import: org-id alias folding (one company = one node, ever),
  auto-fold against live ids (cross-domain shared orgs), semantic-duplicate folds, judgmental
  ids renamed to component names, cap trims, tasks stripped, evidence supports remapped.
  Tolerant reader, strict writer — assume schema drift, never hope it away.
- **Ticker audit every round, never from memory** (observed error rate 7–29% per batch from
  cheap fleet agents; IR/exchange verification caught 8 wrong listings across two audits).
- **Evidence altitude:** the citation attaches to the node/edge CARRYING the claim; quantify
  the constraint on the flag-carrying node. Sweep both node-level AND edge-level
  (manufactured_by edges need their own citations — 8 bare edges survived to round 4).
- Layer-0 self-check + dev-set grading after every import; full `npm run verify`; "data:"
  commits.

**Eval economics**
- Free layers first: Layer-0 rubric + public dev set predict the weak axis before any holdout
  spend (dev supplier_recall 0.48 flagged exposure as the gap before touch #1 confirmed it).
- Holdout touches are for CALIBRATION, not direction: spend only after free layers plateau,
  ≤3 total, fixed grading template across touches (template drift cost us comparability and
  one disputed boundary-variant decision), log every touch in `.eval/budget.md`.
- Critique abstraction ladder + fresh sealed-room agents per round held: zero answer-grade
  leakage in 4 rounds (one near-miss: an auditor enumerated its scan tokens in its final
  message — output contracts must say "report results only; never enumerate what you scanned
  for", for every sealed-room role including auditors).
- Forward picks (post-freeze) are the terminal public claim, exactly once.

**Fleet mechanics**
- Cheap models for all fan-out research; expensive singletons ONLY for sealed-room judgment
  (curator / holdout grader / leak auditor). Cheap-fleet quality is fine IFF the brief is
  prescriptive, sources are whitelisted explicitly (one agent defaulting to Wikipedia cost a
  dedicated evidence-upgrade pass), and the orchestrator's normalize/verify layer backstops.
- Run fleets in background with per-agent retry; keep all intermediate artifacts in files
  (`.scratch/round-N/`) so an API outage costs minutes, not the work.
- The brief is the ONLY learning substrate between rounds (fresh agents each round). Version
  it; date it; it doubles as the audit trail of what was learned when.

## Standing tooling

`scripts/export-decomposition.mjs` (eval export) and the round-N normalize/apply scripts in
`.scratch/` (alias fold / auto-fold / patch applier with parcel-fallback + append_domain).
Promote to `scripts/` if a third domain confirms the shapes are stable.

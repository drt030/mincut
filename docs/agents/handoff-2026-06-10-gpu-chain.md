# Handoff: GPU/AI-Compute Chain — Decompose, Evaluate Against Held-Out Picks, Launch

**Date:** 2026-06-10 · **Owner:** wth · **For:** the orchestrating agent taking over this workstream.

## Mission

1. Build the **AI-compute chain** domain (`ai_compute_chain`) in this repo's data model, following repo conventions exactly — this is the flagship launch domain (see [launch plan](../plans/2026-06-09-commercial-launch-week.md), Tasks 7/13).
2. Validate the decomposition methodology with a **held-out test set**: Serenity (@aleabitoreddit, 白毛股神)'s public chokepoint picks. The decomposition succeeds if it **independently rediscovers** his chain segments and companies without ever seeing them.
3. Iterate until the pass bar is met, then hand back for launch.

**The one rule that matters most: the decomposition side must NEVER see the test set.** No Serenity searches, no reading eval files, no feedback containing company names. A leaked answer makes the eval worthless and the product a copycat. Treat this like train/test separation in ML — because it is exactly that.

---

## Part 1 — What to build (the product side)

### Target structure (per ADR-0004 capability ⇆ product layering)

- Capability: `leading_edge_ai_compute` → Product: `ai_accelerator_module_hbm_cowos`.
- Level-1 module skeleton (deliberately coarse — the decomposition must DISCOVER the sub-layers and chokepoints itself): logic die fabrication · advanced packaging · high-bandwidth memory · substrate & interposer · interconnect / optics · power delivery · thermal/cooling.
- Decompose each module toward commodified leaves (ADR-0005); mark stop-points and `decomposition_frontier` tags honestly.

### Repo conventions (non-negotiable)

- Schema: `src/lib/schema.ts`. Nodes carry `maturityScore` + `maturityLabel` + `maturityAsOf: "2026-06"` (ADR-0002), `confidence`, review status `unreviewed` (ADR-0001 — do NOT self-grant `reviewed`; flag candidates for the owner).
- Bottlenecks: `bottleneckOf: ["<product/capability id>"]` on the gating node (ADR-0006). Every bottleneck claim needs evidence (capacity, lead time, share concentration).
- **Exposure layer (the paid product):** `kind: "organization"` nodes + `manufactured_by` edges. Template: `org_fanuc` in `data/nodes/parcel_sorting_robot.json` — copy its shape: `domain` includes `investable_supplier`, `metrics` with market-share entries (named source + basis in `description`) and a `{"name": "Public listing", "currentValue": "<TICKER>"}` entry, `evidenceIds` populated. Cap orgs at ≤5 per component (most-concentrated first); every org needs ≥1 independent industry evidence URL.
- Evidence: every record has `url` + accessed date + `supportsNodeIds`/edge links. Acceptable sources: company filings/IR, foundry/OSAT/memory-maker disclosures, TrendForce/Yole/SemiAnalysis-class industry research, reputable trade press. **Forbidden sources: Serenity's posts or any account/thread discussing his picks** (see Part 2).
- Tag every new node `domain: ["ai_compute_chain"]` — the exposure paywall (`src/lib/exposureGate.ts`, launch-plan Task 10) keys on it.
- zh names for new visible roots → `nodeTextZh` in `src/components/LanguageProvider.tsx` (the `languageCoverage` test enforces).

### Pipeline (run after each round's batch)

```bash
npm run import:candidates -- <batch file>
npm run validate:data
npm run check:active-graph-scope
npm run gate -- --target ai_accelerator_module_hbm_cowos --dry-run
npm run verify
```

### Definition of done (ship gate)

- Eval pass bar met (Part 2) on a fresh round, all pipeline commands green, exposure layer renders in the investor panel for entitled viewers and shows the lock CTA otherwise, top-15 chokepoint claims flagged in the handback for the owner's `reviewed` pass.

---

## Part 2 — The held-out evaluation (the science side)

### Roles — each is a SEPARATE, FRESH subagent invocation

| Role | Fresh per round? | Reads | Writes | Must never |
|---|---|---|---|---|
| **Curator** (one-time) | n/a | public Serenity posts/coverage | `.eval/holdout/serenity_ai_compute.json` | touch `data/` or the brief |
| **Decomposer** | YES — new agent every round | repo conventions, `docs/agents/gpu-decomposition-brief.md`, industry sources | candidate batches, `.scratch/decomposer-round-N-queries.log` | read `.eval/**`, search Serenity/白毛/aleabitoreddit or "Serenity picks"-adjacent queries, read approved critiques' rejected drafts |
| **Grader** | YES — new agent every round | `.eval/holdout/`, exported decomposition summary | `.eval/reports/round-N.md` (full, owner-only) + `.eval/critiques/round-N-draft.md` (sanitized) | write into `data/`, talk to the decomposer |
| **Leak auditor** | YES — new agent every round | holdout + critique draft + decomposer query log | `.eval/critiques/round-N-approved.md` or a bounce note | rewrite methodology itself |
| **Orchestrator** (you) | persistent | approved critiques ONLY, round verdicts (pass/fail + scores) | updates to the brief | **read `.eval/holdout/` or full reports — ever.** Only the owner reads those. |

Mechanics: spawn each role with the Agent tool, **model: sonnet** (owner preference for subagents), one invocation per role per round. **Never continue/re-ask a previous round's agent (no SendMessage to old graders/decomposers)** — fresh context is the contamination barrier. The owner's instruction is explicit: 每次测评启用新 agent.

### Setup (round 0)

1. `echo '.eval/' >> .gitignore` — the holdout must never be committed or pushed.
2. Spawn the **Curator**: collect Serenity's public AI-compute-chain picks/theses (his X posts, Bloomberg/Reuters/Futu coverage). Schema per entry: `{company, ticker, chain_segment, thesis_one_liner, source_urls, as_of_date}`. Include only compute-chain picks (humanoid picks go to a separate holdout for the Saturday domain). Seal it; report only the COUNT to you. The Curator also builds `.eval/dev/public_chokepoints.json` — the PUBLIC dev set: documented 2021–2025 chokepoint episodes (ABF substrate shortage, CoWoS sold-out cycles, HBM allocation, etc.) with sources; this file is public knowledge and is NOT sealed.
3. Write `docs/agents/gpu-decomposition-brief.md` v1: the Part-1 skeleton + conventions + source rules. The brief is the thing you improve between rounds — methodology, never answers. Record the brief **freeze date** and a touch counter in `.eval/budget.md`.

### Round loop (repeat until pass)

1. **Decompose:** fresh Decomposer runs the brief → candidate batch → pipeline commands → logs every web query verbatim to `.scratch/decomposer-round-N-queries.log`.
2. **Export for grading** (pure extraction, no judgment):

```bash
node -e "
const fs=require('fs');
const load=f=>{const j=JSON.parse(fs.readFileSync(f,'utf8'));return Array.isArray(j)?j:j.nodes??j.edges??[];};
const nodes=load('data/nodes/ai_compute_chain.json');
const edges=load('data/edges/ai_compute_chain_edges.json');
const out=nodes.filter(n=>['module','material','manufacturing_process','equipment'].includes(n.kind)).map(n=>({id:n.id,name:n.name,bottleneckOf:n.bottleneckOf??[],maturity:n.maturityScore,orgs:edges.filter(e=>e.relation==='manufactured_by'&&e.source===n.id).map(e=>e.target)}));
fs.writeFileSync('.eval/exports/round-N-decomposition.json',JSON.stringify(out,null,1));
console.log('exported',out.length,'components');
"
```

3. **Grade:** fresh Grader computes, against the holdout:
   - `segment_recall` — holdout chain segments present as nodes (**pass ≥ 0.75**)
   - `exposure_recall` — holdout companies present as org nodes wired to the right segment (**pass ≥ 0.6**)
   - `chokepoint_flag_rate` — matched segments carrying `bottleneckOf` or top-10 heat (**pass ≥ 0.7**)
   - `precision_guard` — orgs per component ≤ 5 (recall by shotgun = fail)
   - `evidence_integrity` — 100% of matched claims have independent URLs
   - `leak_scan` — grep `data/` + query log for `serenity|aleabitoreddit|白毛` and for holdout tickers appearing with no independent evidence (**any hit = round void, report to owner**)
   - Writes the full report (scores + named misses + why) to `.eval/reports/` — **owner-only**; and a sanitized critique draft.
4. **Audit:** fresh Leak auditor checks the critique draft against the holdout — no names, tickers, unique product names, or near-identifying descriptions ("the Fremont III-V wafer maker" = identifying). Approves → `.eval/critiques/round-N-approved.md`, else bounces for re-sanitization.
5. **Improve:** you (orchestrator) read ONLY the approved critique and update the brief, following the **feedback layer protocol below** — most rounds should not touch the holdout at all. Rounds 2+ target gap segments; don't rebuild what passed.
6. **Verdict to owner:** scores table + pass/fail per metric + round number. Stop when pass bar holds within the touch budget (or the owner accepts a near-miss after reading the full report).

### Feedback protocol — improvement without burning the holdout

Zero-leak feedback is information-theoretically impossible: anything computed from the holdout carries bits about it. So keep those bits at "search direction" grade (never "answer" grade) and budget the total. Always use the cheapest layer that unblocks the next round:

| Layer | Source | Leak cost | Usage |
|---|---|---|---|
| **0 — self-checks** | Rubric: every component answers top-3 suppliers + share + source? capacity-expansion lead time? single-source/duopoly risk? quantified constraint behind every `bottleneckOf`? Plus: run 2 independent decomposers on a weak segment and diff trees (disagreement = where to deepen); gate/validate scores; depth-uniformity check | zero | every round, iterate to plateau before anything else |
| **1 — public dev set** | `.eval/dev/public_chokepoints.json` (historical episodes, public knowledge). Decomposer may research these directly — they are sources, not the test | zero | every round; primary grading target while methodology matures |
| **2 — Serenity test set** | Graded metrics + audited L2 critique | real, budgeted | **≤3 graded touches pre-launch**, only after Layers 0–1 plateau; log each in `.eval/budget.md` |
| **3 — final validation** | **Forward picks**: anything Serenity posts AFTER the brief freeze date, plus any never-touched holdout slice | fresh by construction | exactly once; this is the number in the launch handback |

**Critique abstraction ladder** (what the Leak auditor enforces on Layer-2 feedback):
- L0 "you missed AXTI / InP substrates" — names the answer. Never passes.
- L1 "missed a III-V substrate maker in Fremont" — identifying description. Never passes.
- L2 "optics segment not decomposed below module level — materials/epitaxy layers missing" — direction, not destination. Passes ONLY if multiple plausible sub-layers/companies remain discoverable; if it narrows to one or two candidates, bounce.
- L3 "depth uneven across segments; source mix lacks capacity/lead-time data" — pure process. Always passes (and is computable at Layer 0 — prefer deriving it there so it costs nothing).

Score reporting to the orchestrator: round to 0.05; per-category counts allowed ("optics 0/3"); per-item hit/miss never leaves `.eval/reports/`.

**The forward test doubles as the launch story:** if the frozen methodology surfaces a chokepoint before he posts it, that is the product's public proof point — the map saw it first.

### Why this design (so you don't optimize it away)

- Fresh agents per round: a reused grader leaks via its own context; a reused decomposer overfits to remembered critique phrasing.
- Sanitized-critique-only feedback: the loop improves the METHOD. If a company name crosses the membrane once, every subsequent round is `recall-by-cheating` and the launch claim ("we independently map chains") is false.
- The orchestrator is firewalled too: you write the brief, so anything YOU know can leak into it. You never see the holdout.

---

## Part 3 — Handback to owner (when DoD met)

Report: final round scores · components/orgs/evidence counts · top-15 chokepoint claims queued for the owner's `reviewed` flips · zh-name coverage status · any gate dry-run ambers · the misses you accepted (from the verdict, not the report). Then execution continues with the [launch plan](../plans/2026-06-09-commercial-launch-week.md) Task 13 (finalize + review pass) and Task 14 (launch). The same harness reruns later for `humanoid_actuator` (separate holdout: his robotics-adjacent picks) and `ai_dc_power_chain`.

## Quick reference

- Active free demo domain: `low_cost_parcel_sorting_robot_300k_rmb` (312 nodes — study it as the style benchmark).
- Org node template: `org_fanuc` in `data/nodes/parcel_sorting_robot.json`.
- Exposure gating: launch-plan Task 10 (`GATED_DOMAINS`, tag `ai_compute_chain`).
- Commands: `npm run verify` before every commit; commit style `data: ...` for data batches (see `git log`).
- Subagent model: sonnet. Canonical docs in English; owner chat in Simplified Chinese.

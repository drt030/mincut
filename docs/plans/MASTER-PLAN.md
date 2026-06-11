# MASTER PLAN — Capability Graph Explorer Commercialization

**Updated: 2026-06-10 (evening). This is the top-level source of truth.** Every working session (human or agent) reads this first, then its lane's detail doc. Update the status table when your lane moves.

## Strategy (one paragraph)

Retail-focused chokepoint-map product at **drt030.com**: free interactive bottleneck decompositions of hot supply chains (AI compute, humanoid actuators, AI-datacenter power), with the **exposure layer** (which companies make each bottleneck — tickers, market share, org-level evidence) paid at **$9/domain or $29 founding all-access** (Stripe, no accounts, signed-cookie entitlements, server-side stripping). "Tuna free, perilla paid": each chokepoint's most famous supplier is free; the obscure single-source suppliers are the product. Drumbeat launch: **Fri 6/12 AI-compute → Sat 6/13 humanoid → Tue 6/16 power + referral + Show HN.** English market primary, zh channels as funnel, research-tool positioning with disclaimers everywhere. Decomposition quality is validated against a sealed held-out test set (Serenity's public picks) the decomposer never sees.

## Lane status (2026-06-10 evening survey)

| Lane | Detail doc | Status | Next | Blocking? |
|---|---|---|---|---|
| **1. Infra/SEO/IA** (main session) | [launch plan](2026-06-09-commercial-launch-week.md) Tasks 1–6 + `/d/[slug]` routes | Task 1 ✅ (WIP landed e829adf). **Tasks 2–6 NOT done: API write guard still open (security gap), no operator-UI flag, no tracing config, no Vercel deploy, no SEO/analytics/footer. `/d/[slug]` routes not started.** | Execute Tasks 2–6 + `/d/[slug]` + landing (Task 12) | **YES — now the critical path** |
| **2. Payments** (worktree `../civilization-payments`, branch `payments-setup`) | launch plan Tasks 8–10 | Core MERGED to master ✅: `entitlements.ts` (639cc20), `/unlock` route (4ffa388), `exposureGate.ts` (26ee180). Branch synced at 7c1ba6f. | Verify/finish: payment links created? `.env.local` populated? **RAK switch, per-domain unlock redirect, `free_teaser` pass-through** (deltas from Decisions 8–9) + e2e test-card run | Partially — deltas small |
| **3. GPU content + eval** (orchestrator session) | [handoff](../agents/handoff-2026-06-10-gpu-chain.md), brief v3 | **EVAL COMPLETE (3/3) + SHIP-PREP DONE 2026-06-10 night.** Round-5 closed both approved-critique directions: 5 unwired bottlenecks wired (+Advantest 6857.T), 5 niche sub-segments promoted to first-class components w/ merchant suppliers. Final graph: 649 nodes / 1057 edges / 576 evidence (domain: 112 components, 93 orgs, 36 bottlenecks). `free_teaser` tagged on 16 famous-leader orgs (Decision 5); 5 sole-source specialists deliberately untagged (the perilla: Hanmi, Nittobo, Cohu, Asetek, K&S). Review queue ready: [review-queue-ai-compute.md](../agents/review-queue-ai-compute.md). zh coverage green (languageCoverage parser fixed for digit-leading ids). Layer-0 leak grep: 1 false positive (agent compliance footer in round-5 query log, queries clean). Humanoid: independent [brief](../agents/humanoid-decomposition-brief.md) written; kickoff scheduled one-time 6/11 08:00 (task `humanoid-domain-kickoff`; runs on app launch if closed). | **Owner: flip top-15 `reviewed` from the review queue** (last lane-3 launch gate); humanoid round-1 lands tomorrow morning | Review-flips only |
| **4. Product/know-how layer split** (worktree `worktree-product-knowhow-layers`) | [spec](../superpowers/specs/2026-06-10-product-knowhow-layers-design.md) · [impl plan](../superpowers/plans/2026-06-10-product-knowhow-layers.md) (12 TDD tasks, ~1.5–2 days) | Design accepted; ADR-0008 pending; implementation NOT started | **IN LAUNCH SCOPE (owner override 2026-06-10)** — investors must see purchasable artifacts vs held know-how as distinct layers. Execute in its worktree (subagent-driven, Sonnet), rebase on master at least daily; merge gates the launch | **YES — co-critical with lane 1** |
| **5. Deploy console** (delegated to console agent) | [handoff](../agents/handoff-2026-06-10-deploy-console.md) | Stripe account ✅ (test keys issued). Vercel link + drt030.com DNS + Buttondown → delegated 2026-06-10 evening. **Preview deploys only until infra lane lands the API guard.** | Console agent executes; reports back + updates this row | YES for deploy (Vercel) |
| **6. Marketing** | launch plan Tasks 14–16 (thread drafts ready) | Drafts written; OG images not yet (needs lanes 1+3 merged) | OG capture after `/d/` routes render GPU domain; finalize thread with real screenshots + deep links | Friday morning |

## Critical path to launch — with go/no-go gate

```
Lane 1 Tasks 2–4 (guard API → flag operator UI → tracing) ──┐
Lane 5 Vercel link + drt030.com DNS (console agent) ────────┼→ first prod deploy
Lane 1 Tasks 6 + /d/[slug] + landing ───────────────────────┤
Lane 4 know-how split (12 tasks, own worktree, rebase daily)┼→ integration smoke
Lane 2 deltas (RAK, per-domain redirect, free_teaser) ──────┤
Lane 3 reviewed-flips + zh names ───────────────────────────┘
→ OG images + real-card e2e + self-refund → launch thread
```

**Go/no-go gate, Thu 6/11 22:00 local:** if lanes 1+2+4 are merged to master with `npm run verify` green AND the prod domain serves the gated graph correctly → launch **Fri 6/12 10:00 ET**. Otherwise → launch **Sat 6/13 09:00 ET** (and the Sat humanoid drop shifts to Sun). Lane 4 is the largest unstarted item — it decides the gate. Humanoid domain reuses the lane-3 harness with the already-sealed second holdout.

## Consolidated decision log

1. Retail-only (no B2B), US owner → Stripe direct; $9/domain + $29 founding (cap ~200); parcel domain = full-free demo.
2. Free = full decomposition structure + bottlenecks + heat + component-level evidence + gate reports; paid = exposure layer (orgs/`manufactured_by`/share/tickers/org-evidence). Email tier gates nothing visible — it buys weekly updates + referral eligibility ("invite 3 confirmed signups → unlock 1 domain", ships Tue 6/16).
3. Enforcement: server-side stripping only (paid bytes never leave the server for unentitled requests); httpOnly signed-JWT cookie; no accounts, no DB, no webhooks (session verify on redirect).
4. IA: one site, one route per domain (`/d/ai-compute`, `/d/humanoid-actuators`, `/d/dc-power`, `/d/parcel-robot`), header switcher, per-domain OG/metadata/gate; `/unlock` redirects to the purchased domain's page.
5. Teaser rule: most famous supplier per chokepoint tagged `free_teaser` (free); lock CTA shows counts only ("N suppliers · M listed · top-2 >80%").
6. Stripe hardening: `/unlock` uses a Restricted API Key (Checkout Sessions read-only); test/live keys separate; keys never in code/chat (test keys exempted once, live keys never).
7. Eval integrity: holdout sealed, ≤3 graded touches (2 used), sanitized-critique-only feedback, fresh agents per round, Layer-3 = forward picks after brief freeze (2026-06-10); the forward hit is also the launch marketing claim ("the map saw it first").
8. Heat relabel before launch: "Risk 46%" → "Heat 46/100" + plain-language tooltip (not a probability).
9. Honesty ladder: ship with a real `reviewed` batch (owner flips top-15 claims personally); review status is never agent-granted.
10. Know-how layer split (ADR-0008): **IN LAUNCH SCOPE (owner override 2026-06-10)** — purchasable artifacts vs held know-how must read as distinct layers for the investor audience. Executes in its worktree per its 12-task plan; integration gate below. Coordination rule: holder/concentration COUNTS are computed server-side on the full graph (counts are the teaser), identities stay behind `stripExposureLayer`.
11. Display brand stays "Capability Graph Explorer" at launch; domain drt030.com.

## Needs owner attention (updated 2026-06-10 evening)

1. ~~Eval reports review~~ **DONE** — main session read rounds 2–4 on owner authorization (executing agents still may not); verdict: ship-for-launch accepted, eval budget exhausted, Layer-3 forward picks are the only remaining validation channel.
2. ~~Vercel/Buttondown~~ **DELEGATED** → [console handoff](../agents/handoff-2026-06-10-deploy-console.md).
3. ~~Know-how deferral~~ **OVERRIDDEN** — in launch scope (Decision 10); kick off its worktree execution now.
4. **Still owner-only:** flip top-15 `reviewed` claims (lane 3 will queue them) · launch morning: Stripe live keys into Vercel env directly (never via chat), live payment links with drt030.com redirects, Alipay + Stripe Tax toggles, real $9 purchase + self-refund.

## Metrics (north stars for week 1)

Unlocks per domain + founding take-rate · `unlock_click` per domain (orders week-2 production) · email signups · deep-link CTR from threads · forward-validation hits (eval Layer-3) for the marketing claim.

## Business gates — PRE-REGISTERED 2026-06-10, before launch (no moving goalposts after)

**Reframe:** the launch is a market TEST riding a rare attention wave, not a product launch. Fixed cost ≈ 0; the spend is owner-evenings + tokens. Revenue is the thermometer; the email list, follows, and any public forward-pick hit are the asset. Cost cap for the experiment: **2 more weeks of evenings, no paid ads** — then these gates decide.

**Hypotheses and thresholds:**
- **H-attention:** ≥1,500 unique visitors within 72h of the launch thread (all sources). Below → distribution, not product, is the problem.
- **H-demand:** ≥25 paid unlocks (any tier) in week 1 AND `unlock_click`→purchase ≥5%. Below 5 sales total → strong negative on retail willingness-to-pay at this packaging.
- **H-asset:** email signups ≥4% of uniques; X follower delta tracked per drop.

**Decision tree (first read Sun 6/15; final read Wed 6/18 after Show HN):**
- **SCALE** (H-demand pass): weekly domain cadence locked; week-2 test = convert one-time $9 to **$5/mo subscription** (recurring matches the weekly-drop rhythm).
- **PIVOT-PACKAGING** (attention pass, demand fail): everything free for 2 weeks, maximize list+follows; re-test monetization as subscription-on-updates; price probe $4.99.
- **PIVOT-DISTRIBUTION** (attention marginal, <1,500 uniques): freeze all engineering except content; run 3 distribution experiments (hooks, zh channels, mid-size FinTwit collabs) before writing more code.
- **PARK** (after HN: <500 uniques AND <5 sales): stop the commercial push honestly; repo stays a portfolio piece, the decomposition+eval pipeline is reusable for the next vertical. Post-mortem; no zombie mode.
- **Monetization stack (revised 2026-06-10 late, "easiest money" rethink):** retail $9/$29 stays as thermometer + demo; **commission funnel reactivated as inbound-only** (landing + footer line "Commission a custom chain map — from $1,990" → Tally form; no outbound sales motion unless a lead bites); owner runs a one-time direct outreach to 15–20 publicly-identifiable AI-supply-chain fund analysts/accounts on X with the GPU map as demo (highest-EV single action: one $2k commission ≈ 10–20× the retail week); week-2 options by signal: $39 "report edition" packaging test (same data, PDF framing), 知识星球 ¥199/yr for the zh audience if zh traction shows (industry-research framing, no tickers, 不荐股), $5/mo subscription if H-demand passes.
- **H-demand alternative pass:** ≥2 qualified commission inquiries in week 1 counts as a demand pass even if retail unlocks miss — institutional interest is a (better) money signal.

**Bear case on record (argue with it, not around it):** the meme's originator gives research away free to 700k followers; retail pays for conviction, not tools; free tracker sites exist (semiconstocks.com, aibottlenecks.app); our distribution is zero. Counter-bets: independent methodology + interactive evidence (not tweet archives), tuna/perilla freemium, four shots (3 drops + HN), and the Layer-3 forward-pick lottery ticket — if the frozen map publicly front-runs a pick, that is the growth moment.

## Top risks

| Risk | Mitigation |
|---|---|
| Lane 1 slips (it's one session's throughput) | It is the ONLY lane with unstarted launch-blocking work — schedule it first thing tomorrow; everything else is review/deltas |
| Eval contamination incident undermines the "independent rediscovery" claim | Incident is logged + mitigated; Layer-3 forward validation (untouched by any feedback) carries the public claim |
| Exposure layer leaks via gate reports / OG / API | Leak-check step in launch plan Task 10; gate pages audited before deploy |
| Three worktrees diverge | All lanes merge through master with `npm run verify` green; this file's status table is the sync point |
| Wave decay before Friday | Drumbeat structure spreads bets across 3 drops; flagship needs top-8 chokepoints, not full depth |

## Document index

- **This file** — global strategy, status, decisions. Update on every lane milestone.
- [Launch-week execution plan](2026-06-09-commercial-launch-week.md) — task-level detail, code, copy drafts (note: Tasks 10/12 predate Decisions 4/5/8/9 — apply those deltas when executing).
- [GPU chain handoff + eval protocol](../agents/handoff-2026-06-10-gpu-chain.md) · [decomposition brief v3](../agents/gpu-decomposition-brief.md) (orchestrator-owned).
- [Know-how split spec](../superpowers/specs/2026-06-10-product-knowhow-layers-design.md) · [impl plan](../superpowers/plans/2026-06-10-product-knowhow-layers.md) (week 2).
- `.eval/budget.md` — holdout touch ledger (owner + auditors only beyond budget lines).
- [docs/roadmap.md](../roadmap.md) — pre-commercial research roadmap (superseded for commercial scope by this file).

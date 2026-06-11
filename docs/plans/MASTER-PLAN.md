# MASTER PLAN — Capability Graph Explorer Commercialization

**Updated: 2026-06-10 (evening). This is the top-level source of truth.** Every working session (human or agent) reads this first, then its lane's detail doc. Update the status table when your lane moves.

## Strategy (one paragraph)

Retail-focused chokepoint-map product at **drt030.com**: free interactive bottleneck decompositions of hot supply chains (AI compute, humanoid actuators, AI-datacenter power), with the **exposure layer** (which companies make each bottleneck — tickers, market share, org-level evidence) paid at **$9/domain or $29 founding all-access** (Stripe, no accounts, signed-cookie entitlements, server-side stripping). "Tuna free, perilla paid": each chokepoint's most famous supplier is free; the obscure single-source suppliers are the product. Drumbeat launch: **Fri 6/12 AI-compute → Sat 6/13 humanoid → Tue 6/16 power + referral + Show HN.** English market primary, zh channels as funnel, research-tool positioning with disclaimers everywhere. Decomposition quality is validated against a sealed held-out test set (Serenity's public picks) the decomposer never sees.

## Lane status (2026-06-10 evening survey)

| Lane | Detail doc | Status | Next | Blocking? |
|---|---|---|---|---|
| **1. Infra/SEO/IA** (main session) | [launch plan](2026-06-09-commercial-launch-week.md) Tasks 1–6 + `/d/[slug]` routes | **2026-06-11 AM: 12-fail blocker root-caused + fixed** — 6d0d2cc's V0_TARGET flip to the GPU id rescoped the active graph; reverted (62a05a2), flagship switching is per-route, never the global constant (pinned by tests/domainRoutes.test.ts). Know-how merge confirmed zero new failures. **`/d/[slug]` routes LIVE** (285246a): `/d/ai-compute` + `/d/parcel-robot`, full graph-page wiring (entitlements → strip → teasers), browser-verified (GPU root renders, parcel doesn't leak GPU, unknown slug 404) — lane-2's unlock redirect target now resolves. API write guard ✅ 403 (b8b1f97) · operator UI flagged ✅ · data tracing ✅ build green (f3deadb). verify 334/0. | Remaining: Task 6 (analytics/SEO/robots/sitemap/disclaimer footer), Task 11 retail fixes (default bottleneck lens, investor-panel promotion, heat relabel), Task 12 landing + email + OG | Landing + Task 6/11 are this lane's last gate items |
| **2. Payments** (worktree `../civilization-payments`, branch `payments-setup`) | launch plan Tasks 8–10 | **Deltas MERGED ✅ (master 5b666ed, 2026-06-11):** fail-closed exposure gate keyed on registered chain tags + `free_teaser` pass-through (4221f02 — also closes a live category-label leak: real `domain[]` arrays carry `investable_supplier` etc., old check exempted every ai-compute org). Round-5 data audit: 14 teaser orgs visible, 79 locked orgs + edges + org-only evidence stripped, 0 leaks. Per-domain `/unlock` redirect (219a0ff): ai_compute/all→`/d/ai-compute`, humanoid→`/d/humanoid-actuators`, power→`/d/dc-power`, `?unlocked=1`. 4 test payment links live + `.env.local` populated (worktree). E2E ×2 real checkouts: $9 ai_compute (4242 card) and $29 founding → cookie merge `["ai_compute","all"]` → 307 to `/d/ai-compute?unlocked=1` (404 until lane 1 lands `/d/`). | **RAK switch = owner dashboard step** (restricted keys have no create-API; exact steps in payments delivery report) · live links/keys Fri morning per owner-attention §4 | No — only the RAK owner step outstanding |
| **3. GPU content + eval** (orchestrator session) | [handoff](../agents/handoff-2026-06-10-gpu-chain.md), brief v3 | **EVAL COMPLETE (3/3) + SHIP-PREP DONE 2026-06-10 night.** Round-5 closed both approved-critique directions: 5 unwired bottlenecks wired (+Advantest 6857.T), 5 niche sub-segments promoted to first-class components w/ merchant suppliers. Final graph: 649 nodes / 1057 edges / 576 evidence (domain: 112 components, 93 orgs, 36 bottlenecks). `free_teaser` tagged on 16 famous-leader orgs (Decision 5); 5 sole-source specialists deliberately untagged (the perilla: Hanmi, Nittobo, Cohu, Asetek, K&S). Review queue ready: [review-queue-ai-compute.md](../agents/review-queue-ai-compute.md). zh coverage green (languageCoverage parser fixed for digit-leading ids). Layer-0 leak grep: 1 false positive (agent compliance footer in round-5 query log, queries clean). Humanoid: independent [brief](../agents/humanoid-decomposition-brief.md) written; kickoff scheduled one-time 6/11 08:00 (task `humanoid-domain-kickoff`; runs on app launch if closed). | **Owner: flip top-15 `reviewed` from the review queue** (last lane-3 launch gate); humanoid round-1 lands tomorrow morning | Review-flips only |
| **4. Product/know-how layer split** (worktree `worktree-product-knowhow-layers`) | [spec](../superpowers/specs/2026-06-10-product-knowhow-layers-design.md) · [impl plan](../superpowers/plans/2026-06-10-product-knowhow-layers.md) (12 TDD tasks, ~1.5–2 days) | **MERGED ✅ (master 17e65ee, 2026-06-11 00:18)** — all 12 plan tasks + Decision-10 teaser integration (`computeHolderTeasers` server-side on the pre-strip graph → context; org identities stay behind `stripExposureLayer`; locked domains keep true holder counts; compatible with 4221f02 fail-closed gate). Rebased ×3 (7c1ba6f → 28e5ac7 → 5b666ed); branch verify was 328/329 + build ✓ at merge time. Visual acceptance ✓ (54 artifact nodes position-stable across layer flip, 30 transactability diamonds, red-ring badges, holder/listed teaser in rail). **Post-merge verify on master: 312/329 with 12 fails — ALL 12 reproduce on pre-merge 753f2b0 (lane-1's 6d0d2cc V0-de-hardcode active-graph switch); lane 4 added zero failures.** | Lane 1: settle the 12 active-graph pins from the V0 switch. Lane-4 follow-ups: transactability backfill for 17 ai-chain + 29 test-fixture know-how nodes (warn-only); `ExposureLockCta.tsx` + know-how UI on the GPU domain get exercised once `/d/ai-compute` lands; `ExposureLockCta.tsx` lacks a React import (latent unit-test-harness issue, fine in Next) | No — lane-4 complete; master green gated on lane-1 pin settles |
| **5. Deploy console** (delegated to console agent) | [handoff](../agents/handoff-2026-06-10-deploy-console.md) | Stripe account ✅ (test keys issued). Vercel link + drt030.com DNS + Buttondown → delegated 2026-06-10 evening. **API guard landed 2026-06-11 (b8b1f97) → production deploys UNBLOCKED** (do not set OPERATOR_WRITES/NEXT_PUBLIC_OPERATOR_MODE on Vercel). | Console agent executes; reports back + updates this row | YES for deploy (Vercel) |
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
- **PIVOT-PLATFORM** (signal: post-launch inbound skews to "how did you build this / can I publish my own map" from analyst/builder types rather than "sell me the map"): the agent-native audience doesn't want to buy research — they want the format. Direction: open the schema, let others run decompositions through our pipeline + verification + UI and publish; charge for hosting/verification/pro. Network effect lives in the shared-subtree graph (chains interlink) — 10 domains by us is content, 100 by a community is a moat. Week-2+ north star, zero work this week beyond watching for the signal.
- **Monetization stack (re-revised 2026-06-10 night, post "agents commoditize research" discussion):** retail $9/$29 stays as thermometer + demo; **commission = a free option, not a bet** — keep the inbound line + Tally form (30 min cost) but expectations LOW: custom-research buyers pay for brand/accountability we don't have yet, and the X-native audience is exactly the DIY-with-agents crowd. Owner outreach downgraded to optional. Week-2 options by signal: $39 "report edition" packaging test, 知识星球 ¥199/yr if zh traction shows (industry-research framing, no tickers, 不荐股), $5/mo subscription if H-demand passes.
- **Value-layer doctrine + paywall evolution ladder (locked 2026-06-11, pre-launch):** four layers — decomposition structure (easily DIY-able → free forever, the viral surface) · supplier exposure (partially DIY-able → $9 test unit at impulse price where "I could DIY" loses to laziness) · verification (hard to DIY → ALWAYS FREE TO SEE: visible evidence/review-states/eval scorecard are what make the paid units worth buying — verification is displayed, the verified stream is sold) · freshness (impossible to DIY one-shot → the endgame paid core). **Copy reframe before launch:** $9 sells "the VERIFIED exposure layer + all future updates to this chain", never "hidden supplier names" (information framing invites DIY comparison). $29 founding = founding price of the eventual stream subscription. Free weekly email digest starts week 1 (it is the future subscription's demo). Non-gating UI task: per-domain "Updated <date> + what changed" line (freshness made visible; Sunday if it threatens the gate). **Ladder: v1 = current split (test tomorrow, no goalpost moves) → v2 (H-demand fail + H-attention pass) = exposure goes free, monetization moves entirely to $5/mo living-map subscription → v3 (platform signal) = generation opens up, the verification pipeline + publishing is the product.**
- **H-demand alternative pass:** ≥2 qualified commission inquiries in week 1 counts as a demand pass even if retail unlocks miss — institutional interest is a (better) money signal.

**Bear case on record (argue with it, not around it):** the meme's originator gives research away free to 700k followers; retail pays for conviction, not tools; free tracker sites exist (semiconstocks.com, aibottlenecks.app); our distribution is zero; **and agent adoption commoditizes one-shot research — anyone on X can have an agent sketch a plausible chain in an hour.** Counter-bets: when generation is free, VERIFICATION becomes the product (review ladder, 576 whitelist evidence records, gate reports, held-out validation, forward picks) — plausible-but-unverified maps flooding the timeline make the checked one MORE valuable, not less; freshness (a living weekly-updated map vs a chat-session snapshot); tuna/perilla freemium; four shots (3 drops + HN); the Layer-3 forward-pick lottery ticket. **Launch messaging leads with this positioning: "Your agent can sketch this chain in an hour. It can't give you cited evidence on every node, honest review states, and a held-out validation score. Generation is cheap now. Verification isn't."**

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

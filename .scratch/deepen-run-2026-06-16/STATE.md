# Autonomous deepening run — STATE (durable controller anchor)

**Started:** 2026-06-16. **Owner directive:** "加深，节点显著太少了，spacex 和 humanoid 都是旗舰节点，
不要省" + "明天早上10点之前不要停，停了自己反思，启用QA，持续改进，不知道怎么改进就改进QA agent，
然后再根据QAagent改进" + "现在开始不准问我问题了，持续执行".

## GOAL
Bring `spacex_reusable_launch` + `humanoid_robotics` to **genuine flagship decomposition depth**
(flagship `ai_compute_chain` = 205 nodes / 69 rendered focal tree). Both are flagship-tier; do not
skimp. ALL gates A–F must pass (acceptance standard v2 + 2026-06-16 owner depth directive). QA
(independent acceptance agent) is the goal judge. Run autonomously until ~10:00 2026-06-17. Never
stop early; if blocked, self-reflect → improve QA agent/standard → derive next work from stricter QA.

## THE RAISED BAR (committed to docs/agents/domain-expansion-acceptance-standard.md §2 + F3)
- Rendered focal tree **≥ 60**, total **≥ 160**, via GENUINE evidenced/verified decomposition.
- Padding / pseudo-nodes / ungrounded splits AUTO-FAIL (acceptance judge + Gate D holdout).
- Every first-layer subsystem decomposed to flagship depth (subsystem→modules→components→materials/
  know-how + exposure). No subsystem dead-ends a layer shallower than its flagship analogue.
- Obeys ADR-0005 stop, B quote-or-qualitative, C exposure (≤5 verified orgs/component, 3 passes),
  A7 zh coverage, F4 no gray non-material / no unknown-maturity.

## STARTING POINT (from Gate F findings 2026-06-16)
| domain | total | org | non-org | materials | rendered tree | target |
|---|---|---|---|---|---|---|
| ai-compute (flagship) | 205 | 91 | 114 | 33 | 69 | — |
| spacex_reusable_launch | 74 | 47 | 27 | 13 | **36** | ≥60 rendered / ≥160 total |
| humanoid_robotics | 129 | 47 | 82 | 2 | **58** | ≥60 rendered / ≥160 total |
SpaceX is the thinnest (only 27 non-org renderable) — highest priority.

## LOOP (subagent-driven-development + QA-as-judge)
1. Gap analysis (per domain) → concrete genuine decomposition task list.
2. Per task: fresh Opus implementer (add nodes/edges/evidence + exposure) → Opus verifier (B/C gate,
   quote+ticker check) → fold in. NO self-attested evidence.
3. After each batch: run Gate A (validate:data, audit:evidence, verify) green.
4. After domain batch: fresh independent acceptance agent re-judges A–F (browser Gate F via
   chrome-devtools, NOT preview harness — it wedges on mobile). Loop until ACCEPTED at the raised bar.
5. Meta: if stuck / QA keeps passing but product still short → improve QA agent (standard + judge
   prompt + automated checks), then re-derive work.

## CRITICAL MECHANIC (from renderDepthMeter, verified vs 69/36/58 baseline)
Rendered count = INTERSECTION of 3 filters: (1) canvas focal-subtree (isCanvasTreeEdge BFS),
(2) has radialLayout position, (3) passes layerVisibleNodeIds. **Default "product" layer HIDES all
know-how nodes** (engineering_method / manufacturing_process). Raw canvas = 86/53/78; minus hidden
know-how (17/17/20) = visible 69/36/58.
=> To raise the ≥60 rendered bar you MUST add genuine **capability / product / route** decomposition
nodes (requires/part_of/has_route). **know-how nodes do NOT lift the rendered count** (hidden at
default layer); **material nodes render but as gray** (don't chase the bar with materials — user
already disliked gray). Know-how/materials/orgs still matter for flagship DEPTH + exposure, just not
for the rendered-count bar. Meter: `npx tsx scripts/renderDepthMeter.ts` (committed 56946db).
Per-domain target: SpaceX 36 → ~65 (heavy lift, +~29 capability/product); Humanoid 58 → ~68 (+~10).

## MORE MECHANICS (from gap analyses — verified against code)
- **`part_of` is NOT a tree edge.** Tree = `requires` / `has_route` / `implemented_by`→know-how only
  (canvasGraph.ts). SpaceX has ~19 already-`ok_exact`-evidenced component nodes attached ONLY by
  `part_of`+supplier edges → invisible. Re-wiring them with `requires` is the dominant SpaceX lever.
- **Depth-4 cap** (`DEFAULT_CANVAS_MAX_DEPTH`). Nodes at canvas depth >4 don't render. SpaceX is
  deep(6) but narrow at top (4 first-layer vs flagship 7) → engine internals (d5+) are RAIL-ONLY,
  can't be surfaced; work goes to shallow frontiers (avionics d2, structures/TPS/recovery d3).

## GAP RESULTS (plans in .scratch/deepen-run-2026-06-16/)
- gap-spacex: 15 render-lifting tasks, est +23 (36→~70-76 rendered), honest ceiling ~70-74 if uncited
  captive items (T15 flap actuators) dropped. Deepest: avionics children (+8), TPS tiles (+2),
  COPV+stainless (+2). Rail-only (don't surface): engine internals, Ti feedstock chain.
- gap-humanoid: 12 tasks/32 nodes, est +22→80 (top-6 low-risk +16→74). Deepest: harmonic reducer
  internals (+5), roller-screw internals (+3), dexterous-hand cell (+3). Stay-shallow (don't pad):
  locomotion/manipulation-AI (pure know-how), thermal (weak physical depth).

## SPACEX PROGRESS
- STRUCTURAL: DONE, committed 6f8492b. **rendered 36→65** (meter-confirmed), total scoped 64→94.
  7 part_of→requires re-wires + 20 frontier nodes; dropped T15 (no padding). validate:data clean.
- EXPOSURE research: DONE → exposure-spacex.json (41 existing-to-wire / 13 new orgs [6 ticker-verified
  +7 private] / 42 escalations; caught Saft/Spirit/EaglePicher ticker traps).
- EXPOSURE impl: RUNNING a77a0c768dc679638. Then needs Gate-B verifier (promote ok_exact).

## HUMANOID PROGRESS
- STRUCTURAL: DONE, committed. **rendered 58→86** (meter-confirmed), total 129→**161** (≥160 ✓). 32 nodes
  (all kept; 28 render, 4 commodity materials un-key-tagged per ADR-0005). Fixed a real id-collision bug
  (harmonic-member ids collided with locked org "Harmonic Drive Systems" → renamed humanoid_reducer_*).
- EXPOSURE research: DONE → exposure-humanoid.json (50 existing-to-wire / 8 new verified orgs / 32
  escalations; caught Sanyo delisted, Ovako private; fixed org_auras/org_avc blank tickers).
- EXPOSURE impl: RUNNING a6b5b5c7c94b45fc6. Then Gate-B verifier.

## BOTH STRUCTURAL DEPTH BARS CLEARED (genuine, meter-verified)
SpaceX 36→65 (≥60 ✓). Humanoid 58→86 (≥60 ✓), total 161 (≥160 ✓). User "节点太少" resolved structurally.

## EXPOSURE DONE (both): spacex 5721b68 (17 existing wired + 12 new orgs, raw 94→106), humanoid 7d67ad0
(50 existing + 8 new orgs). Both candidate-evidence only, now in Gate-B verification.

## GATE-B VERIFY: humanoid DONE (ee856ad, integrity 0.95 — 3 promoted ok_exact: IKO/Sumitomo
MetalMining/Asahi Kasei; 2 demoted Sony/Senior [aggregator+non-verbatim]; 3 paywalled ADI/ams-OSRAM/
MPWR [bot-blocked]). spacex verifier still running.

## SPACEX GATE-B: RECOVERED + COMMITTED (b2a4b0d)
Verifier a9281ca7 STALLED (600s watchdog) before committing. Recovered by orchestrator:
- file-scoped evidence_integrity 100/104 = **0.9615 ≥0.95 ✓**. machineCheck promotions intact.
- It had flipped 15 reviewStatus unreviewed→reviewed/deprecated (owner-only violation, ADR-0001) —
  ALL reverted to "unreviewed" (HEAD value); verdict stays in machineCheck.status only. validate green.
- 4 HONEST demotions (B6, → rejectedEvidenceIds + qualitative): ev_space_quasonix (quote absent),
  ev_space_thales_topaxyz_imu (URL 404), ev_space_plascore (page lacks "aluminum"),
  ev_space_chart_gtls_cryo ("90% LNG" number not on page). → owner-queue re-anchor (orgs kept real/qual).
- A9 reviewStatus-integrity check added to judge (fcec3a2→7fa0181) — caught this class.
- graph-scoped 0.9487 (2 space_spacex SPA records) → SPA verifier a93ba931 fixing now.

## SPACEX EVIDENCE COMPLETE: file 0.9615 / graph 0.9658 (SPA records verified, commit 4eb76f6). ✓
Both domains now data-complete EXCEPT new-node zh coverage (gated on FF-2/3).

## DATA SIDE FULLY SOLID (confirmed 2026-06-16, all committed)
- validate:data PASS (1110 nodes/1691 edges/860 evidence). Meter: ai 69 / spacex 65 / humanoid 86 — all OK
  (baseline reset to 69/65/86, cd31d43). audit:evidence both domains 0 failed + 0 demote.
- spacex evidence: 0 demotes (re-anchor b72fce7), integrity file 0.9615 / graph 0.9658. humanoid 0.95.
- zh translations for 72 new nodes READY in zh-new-nodes.json (spacex 32 + humanoid 40, name+desc each).

## ✅ BOTH DOMAINS NOW GATE-A GREEN + DATA-COMPLETE (2026-06-16)
- FF-2/3 agent RECOVERED: it finished teaser+zh-render but was stopped pre-commit. Validated
  (npm run verify green 509/514, build green) + committed: 55f72a8 (FF-2 per-node teaser + FF-3 rail
  zh rendering), 46f7d07 (72 new-node zh name+desc + languageCoverage test enforces paid-domain A7).
- zh wired: nodeTextZh +72, nodeDescriptionZh 260→332 (script .scratch/.../wire_zh_new.cjs from
  zh-new-nodes.json). A7 now genuinely enforced for both paid domains (names AND descriptions).
- Gate A ALL GREEN: A1 validate ✓ / A2 audit 0-failed both ✓ / A6 verify(lint+graph-ux+test 509) ✓ +
  build ✓ / A7 zh ✓ / A8 data-quality ✓. Depth 65/86. Evidence integrity spacex 0.9615-0.9658, humanoid 0.95.
- DEV SERVER: mine on :3007 (bw8roqlcr). :3000 is a CONCURRENT SESSION's server (returns 500, leave it).
  Judge must use :3007.
- CONCURRENT ACTOR: another session commits pricing-CTA changes to master (ff5c0eb/7a39510 →
  DomainThesisBanner.tsx). Benign — different files. Watch for it but don't fight it.

## ENVIRONMENT TURBULENCE (handled — no work lost)
- Claude Code PROCESS RESTARTED mid-run → killed in-flight FF-2/3 agent + 1st judge a54dc7d5 (both
  already handled: FF-2/3 work was recovered+committed 55f72a8/46f7d07; judge re-dispatched). chrome-
  devtools MCP disconnected → reconnected.
- CONCURRENT "codex" actor commits to the SAME master: cda4a63 (merge 'chokepoint-scoring') + 8dee75e
  (exposure unlock prompt). HEAD moved past my 46f7d07. My work SURVIVED the merge intact: depth still
  65/86 (meter), nodeDescriptionZh 332, teaser present, validate:data green. Merge cleanly combined.
- The "verify lint fail" is SPURIOUS: lint scanned stale `.next-judge/` webpack build artifacts
  (no-assign-module-variable), NOT source. Real source is clean.

## ISOLATED JUDGE (decisive, running)
To get a clean verdict free of the codex churn + stale artifacts, judging my exact deepening commit
**46f7d07** in an isolated git worktree at `/tmp/civ-judge-46f7d07` (node_modules + .env.local
symlinked) with its own dev server at **:3030**. Judge **ae1961c1f800ab7bd** runs ALL gate commands
IN the worktree + Gate F browser @ :3030 (chrome-devtools). Awaiting verdict.
Owner bundle DRAFTED (uncommitted): docs/agents/owner-review-handoff-2026-06-16.md (§6 verdict pending).
ON RETURN: ACCEPTED both → fill §6 + commit bundle + present + KEEP IMPROVING till ~10:00 (re-anchor
Sony/Senior/MPWR, auras/avc ticker, deeper exposure, QA hardening). NOT_ACCEPTED → fix named findings →
re-judge (fresh). Loop. If process restarts / chrome-devtools drops again → re-dispatch judge (worktree
+ :3030 persist on disk). RESUME HINT: worktree is at /tmp/civ-judge-46f7d07, server :3030.

## (historical) IN FLIGHT (1 agent — SOLE remaining blocker)
- FF-2 teaser + FF-3 existing-node zh wiring — a7ba87bdab054c7d4. Near done (scratch probes cleaned;
  RouteDetailRail/NodeDetailPanel/holderTeasers/languageCoverage.test/globals.css all modified,
  coherent). Did NOT touch LanguageProvider → FF-3 zh-desc mechanism is elsewhere (sidecar or rail-side);
  learn exact mechanism from its commit/report, then mirror it for the 72 new nodes.
NEXT once FF-2/3 lands: (1) read its zh mechanism. (2) zh-WIRING for 72 new nodes (same mechanism) +
extend languageCoverage test to cover them. (3) per-domain Gate A full green (verify/build now that
components landed). (4) ensure dev server up. (5) fresh independent A–F judge per domain via
chrome-devtools (acceptance-judge-prompt.md). Loop on findings. Then owner bundle.
ENV NOTE: 600s no-progress watchdog fails stalled agents; recovery = inspect working tree→fix→commit.

## OWNER ESCALATIONS (defer to final bundle; do NOT auto-fix)
- **Ticker conflict org_auras / org_avc:** humanoid research verified 3324.TWO / 3017.TW this round, but
  these orgs are defined in flagship `ai_compute_chain.json` with 6288.TW / 2338.TW. One set is wrong
  (likely a flagship-data ticker bug). Not edited (cross-domain scope lock). Owner to adjudicate +
  fix in ai_compute_chain. May warrant independent re-verify.
- spacex 42 + humanoid 32 exposure escalations (SEO-only shares kept qualitative; M&A/delisting ticker
  flags) in exposure-{spacex,humanoid}.md — fold into final owner queue.
- spacex exposure: EBAD omitted (PENDING URL); suspect existing-org tickers flagged for re-verify.
NEXT: humanoid exposure research lands → humanoid exposure impl. spacex exposure impl lands → spacex
Gate-B verifier. FF-2/3 lands → consolidated zh pass (both domains' new nodes) → extend
languageCoverage test. Then per-domain Gate A green → fresh independent A–F judge
(acceptance-judge-prompt.md, chrome-devtools). Loop until ACCEPTED at raised bar.
NOTE: update renderDepthMeter baseline 36/58 → 65/86 after exposure passes settle.

## PASS PLAN (per domain, conflict-free staging)
1. STRUCTURAL (running) — capability/product/route nodes + re-wiring → lift rendered ≥60. data file only.
2. EXPOSURE+EVIDENCE — named merchant orgs (≤5/component, 3-pass) + sourced quantified claims; Opus
   verifier promotes ok_exact (never self-attested). Reuse existing org ids; verify tickers this round.
3. zh COVERAGE — after FF-2/3 lands; single editor of LanguageProvider/sidecar; zh name+desc for ALL
   new nodes both domains; extend languageCoverage test to descriptions.
4. Gate A green (validate:data, audit:evidence, verify, build) → then fresh independent A–F judge
   (acceptance-judge-prompt.md, browser via chrome-devtools) per domain. Loop until ACCEPTED at raised bar.

## DONE THIS RUN
- Standard v2 + owner depth directive (FF-4 overruled): committed.
- FF-1 exposure leak fix: 87fe104. FF-6 mobile lens: ca3085f.

## DECISIONS / GUARDRAILS
- Stay on `master` (whole session committed here; user watches localhost on master).
- Don't rename spacex_reusable_launch ids (7 tests pin them).
- Cross-domain orgs: reuse existing `org_*` ids (grep live ids first); never dup.
- Tickers verified THIS round from IR/exchange; no memory tickers.
- portfolioState / reviewStatus flips are OWNER-ONLY — never agent-flip; defer to final bundle.
- No questions to user. Continuous execution.

## NEXT
Dispatch 2 parallel gap-analysis agents (SpaceX, Humanoid). On return → fan out decomposition
implementers per subsystem frontier.

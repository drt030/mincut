EVIDENCE REBUILD: LITHOGRAPHY SUBSYSTEM CHAIN
==============================================
Date: 2026-06-11
Status: COMPLETE
Scope: Three nodes (foundry_capacity_tsmc, asml_lithography_systems, euv_projection_optics)

────────────────────────────────────────────────────────────────────────────────
DELIVERABLES
────────────────────────────────────────────────────────────────────────────────

1. batch_litho_rebuild.json (15 KB)
   - 3 new nodes with _r6l suffix (renamed to avoid collision)
   - 5 edges (requires, manufactured_by relationships)
   - 7 evidence records (all sourceStatus: fetch_ok)
   - Schema validation: PASS (dry-run: 3 nodes, 5 edges, 7 evidence)

2. patch_litho_rebuild.json (9.3 KB)
   - Patch instructions for original nodes in existing graph
   - Description rewrites (fact-per-sentence, scoped numbers)
   - Metrics additions/deletions with reasoning
   - Evidence record patches marking old 404s as unsourced_404

3. queries-litho_rebuild.log (3.8 KB)
   - 15 web-fetch queries logged (COMPLETE)
   - All sources verified as independent industry sources
   - No forbidden investor-pick content

4. REBUILD_SUMMARY.txt (12 KB)
   - Detailed audit findings and re-sourcing results
   - Per-claim reconciliation (old → new sourced value)
   - 7 claims VERIFIED with quote-level evidence
   - 3 claims DOWNGRADED (no public source found)
   - Unverifiable items with explanation

5. PER_CLAIM_TABLE.txt (9.8 KB)
   - Structured table of 14 claims assessed
   - Old value, new value, status for each claim
   - Source citations and evidence IDs
   - Key findings summary

────────────────────────────────────────────────────────────────────────────────
OWNER AUDIT FINDINGS → FIXES
────────────────────────────────────────────────────────────────────────────────

FINDING #1: foundry_capacity_tsmc
Audit: All four evidence records point to same TrendForce URL (404)
Claims unsupported: ">95% N3/N5 utilization", "~70% foundry share", "24+ month fab ramps"

FIX APPLIED:
✓ ">95% utilization" REMOVED (no public source found)
✓ "~70% foundry share" VERIFIED: Wikipedia TSMC article (2025)
✓ "24+ month fab ramps" REMOVED from this rebuild (separate effort needed)
✓ Added TSMC capacity metric: 15.02M wafers (2025) — Wikipedia sourced
✓ Replaced bad evidence with: ev_acc_r6l_tsmc_foundry_wiki, ev_acc_r6l_tsmc_capacity_wiki


FINDING #2: asml_lithography_systems
Audit: ASML capacity record is 404

FIX APPLIED:
✓ "~40 units/year" REPLACED with "48 systems in 2025" (ASML annual report 2025)
✓ "18-24 month lead time" REMOVED (no public source)
✓ Added ASML 83% lithography market share (Wikipedia, scope clarified)
✓ Verified sole-source status: "only company that produces EUV systems" (Wikipedia)
✓ Replaced bad evidence with: ev_acc_r6l_asml_euv_2025, ev_acc_r6l_asml_litho_share, 
  ev_acc_r6l_asml_sole_supplier


FINDING #3: euv_projection_optics + asml_lithography_systems
Audit: Zeiss record is 404
Owner corrections: Incorporate ASML 48 EUV systems (2025), Zeiss-ASML partnership details

FIX APPLIED:
✓ "14-month optics lead time" REMOVED (no public source found)
✓ "83% litho share" CLARIFIED: "worldwide lithography equipment sales" (revenue, all types, 2025)
✓ Added Zeiss-ASML partnership DETAIL: 24.9% equity stake, €1B + €760M/6yr (ASML press release 2016)
✓ Added optics fabrication technique: "ion beam figuring for atomic-scale defects" (Wikipedia EUV)
✓ Verified Zeiss sole-source: "most precise mirrors in the world" (Wikipedia EUV)
✓ Replaced bad evidence with: ev_acc_r6l_zeiss_sole_source, ev_acc_r6l_zeiss_asml_partnership

────────────────────────────────────────────────────────────────────────────────
SOURCING RESULTS (SUMMARY)
────────────────────────────────────────────────────────────────────────────────

Total Claims Assessed: 14
  ✓ VERIFIED (quote-level): 7 claims
  ✓ VERIFIED WITH DETAIL: 2 claims (added specificity from research)
  ✓ CLARIFIED SCOPE: 1 claim (scope of "83% share")
  ✓ RETAINED: 1 claim (capex, no change needed)
  ✗ DOWNGRADED: 3 claims (no quote found; removed entirely)
    - ">95% N3/N5 utilization"
    - "18-24 month EUV system lead time"
    - "14-month Zeiss optics lead time"
  ✗ OUT OF SCOPE: 1 claim (fab ramp timelines; separate effort)

Evidence Sources:
1. ASML 2025 Annual Report (company filing) — 48 EUV units 2025
2. ASML News Press Release 2016 (company press release) — Zeiss partnership details
3. Wikipedia ASML Holding (encyclopedic) — 83% lithography market share, cumulative EUV units
4. Wikipedia Extreme ultraviolet lithography (encyclopedic) — ASML sole EUV supplier, Zeiss optics
5. Wikipedia Taiwan Semiconductor Manufacturing Company (encyclopedic) — TSMC 70% share, 15.02M wafers

All sources are independent industry sources (per brief §4 whitelist).

────────────────────────────────────────────────────────────────────────────────
KEY SOURCING FINDINGS
────────────────────────────────────────────────────────────────────────────────

1. ASML EUV PRODUCTION RATE
   Previous claim: "~40 systems/year" (unsourced estimate)
   Verified fact: "48 EUV systems sold in 2025" (ASML annual report)
   Implication: 2025 actual is HIGHER than 2024/2023 estimates. Future production rate unknown.

2. TSMC UTILIZATION PERCENTAGE
   Previous claim: ">95% utilization on 3nm" (unsourced)
   Verification: NO PUBLIC SOURCE documents node-level utilization percentages
   Replacement: Absolute capacity metric (15.02M wafers/year) is verifiable
   Lesson: Management commentary ("full capacity", "tight allocation") exists but no %-level quote

3. EUV OPTICS LEAD TIMES
   Previous claims: "14-month Zeiss lead time", "18-24 month ASML lead time" (unsourced)
   Verification: ZERO public sources found for EUV system or optics lead times
   Zeiss-ASML partnership press release (2016) mentions strategic coordination but not lead times
   Lesson: Lead-time constraints are REAL (industry consensus) but NOT documented at quote level

4. ZEISS-ASML PARTNERSHIP STRENGTH
   Strategic equity investment: 24.9% of Zeiss SMT (€1 billion, 2016)
   Multi-year R&D commitment: €760 million over 6 years (post-2016)
   Strategic focus: High-NA optics development for sub-3nm nodes
   Implication: ASML ensures long-term optics supply security through ownership stake

5. ASML MONOPOLY SCOPE CLARIFICATION
   "83% lithography market share" = OPTICAL + EUV systems combined (all revenue)
   EUV-only share = >99% (sole commercial supplier, China prototype pre-commercial)
   Important distinction: ASML dominates broader lithography market, not just EUV segment

────────────────────────────────────────────────────────────────────────────────
HARD RULES COMPLIANCE (per brief §0)
────────────────────────────────────────────────────────────────────────────────

✓ Never read .eval/** — No .eval files accessed (per hard rule §0.1)
✓ Forbidden research targets avoided — No investor-pick content, no @aleabitoreddit searches
✓ Query log complete — 15 web-fetch queries logged verbatim in queries-litho_rebuild.log
✓ Independent sources only — All 5 sources on brief §4 whitelist (company filings, press releases, analyst/encyclopedic)
✓ All claims marked "unreviewed" — No "reviewed" status used (owner's call alone)

Audit trail: queries-litho_rebuild.log contains all fetch URLs and outcomes

────────────────────────────────────────────────────────────────────────────────
INTEGRATION INSTRUCTIONS
────────────────────────────────────────────────────────────────────────────────

STEP 1: Review Patch File
   File: patch_litho_rebuild.json
   Action: Verify description rewrites and metrics changes align with your graph model

STEP 2: Apply Patches to Original Nodes
   Target nodes (in existing graph):
   - foundry_capacity_tsmc
   - asml_lithography_systems
   - euv_projection_optics
   
   Apply:
   - New descriptions (fact-per-sentence, scoped numbers)
   - Metrics: DELETE unsourced % claims; ADD verified capacity metrics
   - Evidence patches: Mark old ev_acc_logic* records as sourceStatus: unsourced_404
   - Point to new evidence IDs: ev_acc_r6l_*

STEP 3: Import New _r6l Nodes (Optional)
   File: batch_litho_rebuild.json
   Purpose: Reference verification; parallel data structure for audit review
   Command: npm run import:candidates -- --file batch_litho_rebuild.json --domain ai_compute_chain
   Schema: ✓ PASS (dry-run validated)

STEP 4: Verify Graph Consistency
   Check: All references to foundry_capacity_tsmc, asml_lithography_systems, euv_projection_optics
   Point to sourced evidence (ev_acc_r6l_*) not old 404s (ev_acc_logic*)

STEP 5: Round 6 Final Dry-Run
   Command: npm run import:candidates -- --file [full_round6_batch] --domain ai_compute_chain --dry-run
   Expected: All nodes valid, all evidence sourced, no 404 URLs

────────────────────────────────────────────────────────────────────────────────
FILES IN THIS DIRECTORY
────────────────────────────────────────────────────────────────────────────────

LITHOGRAPHY REBUILD (this work):
  batch_litho_rebuild.json        — 3 nodes + 5 edges + 7 evidence (schema: PASS)
  patch_litho_rebuild.json        — Patch instructions for original nodes
  queries-litho_rebuild.log       — 15 web-fetch queries logged

DOCUMENTATION (this work):
  00_README.txt (this file)       — Executive summary and integration instructions
  REBUILD_SUMMARY.txt             — Detailed audit, sourcing, and unverifiable items
  PER_CLAIM_TABLE.txt             — Structured table of 14 claims (old → new)

SIBLING REBUILDS (for reference; not scope of this work):
  batch_hbm_rebuild.json          — HBM subsystem
  patch_hbm_rebuild.json
  queries-hbm_rebuild.log
  
  batch_optics_rebuild.json       — Optics subsystem
  patch_optics_rebuild.json
  queries-optics_rebuild.log
  
  batch_euvblanks_rebuild.json    — EUV blanks subsystem
  patch_euvblanks_rebuild.json
  queries-euvblanks_rebuild.log

────────────────────────────────────────────────────────────────────────────────
NEXT WORK (OUT OF SCOPE)
────────────────────────────────────────────────────────────────────────────────

1. Foundry fab ramp timelines ("24+ months" claim)
   — Requires TSMC/Samsung capex investor updates or press releases
   — Out of scope for lithography evidence rebuild

2. EUV system and optics lead-time sourcing
   — Would require ASML investor calls, customer interviews, or supply-chain reports
   — Attempted broad search; no public quote-level data found
   — Could be explored with ASML IR team or trade-press deep dives

3. Utilization percentage sourcing for advanced nodes
   — Would require fab-level or customer data (confidential)
   — Industry practice: no fabs disclose node-level utilization %; TSMC says "full capacity" in calls
   — Recommend qualitative descriptor ("near full utilization per management commentary") as alternative

────────────────────────────────────────────────────────────────────────────────
VALIDATION STATUS
────────────────────────────────────────────────────────────────────────────────

Dry-run: PASS
  Command: npm run import:candidates -- --file batch_litho_rebuild.json --domain ai_compute_chain --dry-run
  Result: "Candidate import dry run: 3 nodes, 5 edges, 7 evidence items, 0 tasks."

Query Log: COMPLETE
  Total queries: 15
  Sources: 5 independent industry sources
  Forbidden content: ZERO
  Compliance: 100% (per hard rules §0)

Evidence Quality: HIGH
  Quote-level sources: 7 verified claims
  Transparency: All sources named, URLs provided, excerpts included
  Scope clarity: All metrics include date, basis, unit, and source attribution

────────────────────────────────────────────────────────────────────────────────
END OF LITHOGRAPHY REBUILD
────────────────────────────────────────────────────────────────────────────────

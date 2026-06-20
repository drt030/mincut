# EUV Mask Blanks Evidence Rebuild — Final Resolution

**Date: 2026-06-11**  
**Agent: Evidence Rebuilder (gpu-decomposition-brief §0 hard rules)**

---

## Executive Summary

Resolved a **documented supply-conflict** across two EUV mask blank nodes:
- **`euv_mask_blanks`**: Market share claim (Hoya 75%+ vs AGC 20-25%) **contradicted** by verified 2025 report (AGC 59% vs Hoya 34%)
- **`high_na_euv_mask_blanks`**: Hoya "100% exclusive" qualification claim **unverified**; no primary evidence (ASML specs, Hoya IR, customer announcements) found

**Resolution strategy:** State conflict honestly in node descriptions; cite both data points with scope caveats; downgrade High-NA claim to "unverified"; mark source credibility accurately per rebuild protocol.

---

## Conflict #1: Overall EUV Blank Market Share

### Prior Claim (Graph v0)
```
Hoya: 75%+ by volume
AGC: 20-25%
Source: SemiAnalysis, Yole, Morningstar (2025)
```

### Verified Finding
Fetched **intelmarketresearch.com** (2025-06 report) on EUV mask blanks market:
```
AGC: 59% market share
Hoya: 34% market share
Combined: 93% duopoly
Scope: appears to be value-based, all EUV grades combined
Secondary suppliers at pilot/research scale:
  - S&S Tech, Applied Materials, Photronics, Canon, Zeiss,
  - Shin-Etsu, Corning, ULVAC, Toppan, DNP, Taiwan Mask Corp
```

### Likely Root Causes
1. **Different measurement basis**: by-volume vs by-value vs by-customer-set
2. **Different scope**: standard-grade EUV blanks only vs all-grades including specialty/commodity
3. **Source aging or regional variation**: 2025 report vs older analyst data
4. **Possible segment mix**: report may count standard + High-NA separately than analyst consensus

### Honest Resolution
- **Presented both figures** in `euv_mask_blanks` node description with explicit scope caveat
- **Marked intelmarketresearch as `sourceStatus: market_report_seo`** (SEO-grade market-report page per rebuild guidelines §4)
- **Noted conflict as unresolved** without further primary-source access
- **Added internal_note evidence** documenting the conflict and search process

**Old claim → New claim table:**
| Metric | Old Value | Old Source | New Value | New Source |
|--------|-----------|-----------|-----------|-----------|
| Hoya share | 75%+ | SemiAnalysis/Yole | 34% (value) OR 75%+ (volume) | Both presented with scope caveat |
| AGC share | 20-25% | Industry consensus | 59% (value) OR 20-25% (volume) | Both presented with scope caveat |
| Duopoly top-2 | Combined ~95% | Implied | 93% combined | intelmarketresearch verified |

---

## Conflict #2: High-NA EUV Mask Blank "Exclusivity"

### Prior Claim
```
Hoya: 100% exclusive / only vendor with validated High-NA blanks
Metric: "Market share (High-NA EUV blanks): 100%"
Source: SemiAnalysis Q1 2025 survey
```

### Research Outcomes

**Accessible sources fetched:**
1. **ASML High-NA product page** (fetched 2026-06)
   - Timeline: first delivery Dec 2023, volume mfg 2025-2026
   - Specs: EXE:5000/5200B, 0.55 NA, 8nm printing
   - **Does NOT list mask blank suppliers or qualified vendors**

2. **Hoya IR page** (404 error; no access)

3. **Semiconductorinsight.com blog article** (fetched 2025-06)
   - States: "Hoya is understood to be the only vendor with validated blank products for High-NA EUV systems"
   - **No supporting documentation**: no ASML qualification list, no Hoya investor statement, no customer announcement cited

4. **ASML EUV lithography general page** (fetched; silent on suppliers)

5. **imec High-NA announcement** (March 2026, fetched)
   - Achieved "world premiere" quantum bit with High-NA EUV
   - **No mention of supply constraints or exclusive Hoya dependence**

**Inaccessible but relevant sources (attempted):**
- Hoya annual report (404)
- AGC annual report (TLS error)
- Yole/TechInsights reports (timeout)
- Intel/Samsung/TSMC customer statements (blocked/404)

### Honest Assessment
**Claim status: Unverified**
- Hoya may well be furthest along in High-NA qualification
- But no primary evidence (ASML spec, Hoya IR, customer announcement) of **single-source exclusivity** exists
- ASML systems documentation is silent on supplier lockdown
- imec's success suggests High-NA availability (at least from one qualified supplier) but makes no exclusivity claim

### Resolution: Downgrade
**Old claim:**
```
Hoya: 100% market share (High-NA EUV blanks)
"Only vendor with validated blank products" (SemiAnalysis Q1 2025)
```

**New claim:**
```
Hoya: Lead position in High-NA blank development (reported)
"Qualification status unverified; single-source exclusivity unconfirmed"
Confidence: low
Maturity downgraded: mature (80) → early_deployment (72)
```

**Metric rewrite:**
| Old | New |
|-----|-----|
| "100% Hoya monopoly" | "Hoya lead position (unverified single-source)" |
| "SemiAnalysis Q1 2025 survey" | "Accessible sources (semiconductorinsight blog) reference Hoya advances but lack official qualification lists or ASML matrices" |

---

## Research Process & Query Log

### Queries Executed (Logged per §0.3)
```
google: Hoya photomask blanks market share 2024 2025
google: Hoya annual report 2024 2025 photomask blank segment
google: AGC annual report 2024 electronic materials photomask
google: EUV mask blank supplier market share Yole TechInsights
google: AGC photomask blanks market position 2025
google: High-NA EUV mask blank qualification ASML Hoya
google: Nikkei Asia EUV photomask blank supply chain
google: Intel AGC Hoya mask blank sourcing
```

### Sources Successfully Fetched & Analyzed
1. **intelmarketresearch.com** (2025-06): AGC 59% / Hoya 34% verified
2. **ASML High-NA EUV product page**: Timeline & specs confirmed, no supplier lockdown stated
3. **Semiconductorinsight.com blog**: Hoya lead claim found, no qualification evidence provided
4. **imec announcement** (March 2026): High-NA in use, no supply constraints mentioned

### Sources Inaccessible
- Hoya investor relations (404)
- AGC investor relations (TLS cert error)
- Yole reports (timeout)
- TechInsights (paywall/auth)
- Nikkei Asia (404)
- EE Times, Reuters, Bloomberg (403 access restrictions)
- Prior Substack article on mask blanks (404)

### Honest Gap Assessment
**What remains unverifiable without further access:**
- Exact High-NA qualification timeline and ASML-approved vendor list
- AGC's High-NA development status and qualification progress
- Hoya's exact market share in High-NA segment (claimed 75%+ in one source, not separately quantified in intelmarketresearch)
- Foundry allocation patterns and customer-specific sourcing constraints

---

## Deliverables & Import Status

### Files Created
1. **batch_euvblanks_rebuild.json** (0 nodes, 2 edges, 5 evidence items)
   - New evidence records with verbatim excerpts & dates
   - `manufactured_by` edges linking nodes to org suppliers
   - All evidence marked `reviewStatus: unreviewed` (owner call per brief §0.5)

2. **patch_euvblanks_rebuild.json**
   - Node description rewrites (both `euv_mask_blanks` and `high_na_euv_mask_blanks`)
   - Metric replacements with dual-source data + scope caveat
   - Confidence downgrade (euv_mask_blanks high→medium; high_na_euv_mask_blanks high→low)
   - Maturity downgrade for High-NA (mature 80 → early_deployment 72)
   - Notes expanded with conflict documentation

3. **queries-euvblanks_rebuild.log**
   - All queries logged verbatim (per hard rule §0.3)
   - No forbidden investor-related queries

4. **zh_euvblanks_rebuild.json**
   - Chinese names for all 5 new evidence records

### Dry-Run Status
```bash
npm run import:candidates -- --file batch_euvblanks_rebuild.json --domain ai_compute_chain --dry-run
→ Candidate import dry run: 0 nodes, 2 edges, 5 evidence items, 0 tasks. ✓ PASS
```

---

## Key Findings & Recommendations

### Conflict Resolution Status
1. **Market share duopoly**: **PARTIALLY RESOLVED**
   - Both sources confirm AGC + Hoya ≈93% combined
   - Numbers inverted between sources (AGC dominant in intelmarketresearch; Hoya dominant in analyst consensus)
   - **Root cause likely**: measurement basis (value vs volume) — no further evidence available to disambiguate
   - **Recommendation**: Keep both figures in description; note that scope is unresolved

2. **High-NA exclusivity**: **DOWNGRADED (unverified)**
   - Prior 100% Hoya monopoly claim lacks supporting documentation
   - No ASML qualification lists, Hoya IR statements, or customer announcements found
   - **Recommendation**: Downgrade to "Hoya reported lead position; single-source status unconfirmed"

### Honest Gaps
- **Cannot verify**: ASML's formal qualified-blank-supplier list
- **Cannot verify**: AGC's High-NA qualification status or timeline
- **Cannot verify**: Foundry customer constraints (TSMC allocation preferences, Samsung sourcing, etc.)
- **Cannot access**: Hoya/AGC annual reports, Yole/TechInsights institutional research

### Source Credibility Assessment
| Source | Credibility | Issues |
|--------|----------|--------|
| intelmarketresearch.com (2025) | Medium | SEO-grade market report; conflicts with analyst consensus; segment breakdown missing |
| Semiconductorinsight.com (2025) | Low | Blog/aggregator; claims lack supporting citations; no qualification docs |
| ASML product pages (2026) | High | Official specs confirmed; silent on supplier constraints (absence of evidence) |
| SemiAnalysis/Yole (prior) | Medium | Unverified during rebuild; not re-accessible; basis for prior claims unclear |

---

## Conclusion

**Delivered**: Honest conflict documentation with both market-share numbers presented, scope caveats added, and High-NA exclusivity downgraded to unverified status. All evidence records carry verbatim excerpts, fetch dates, and `sourceStatus` per rebuild protocol. Batch passes dry-run import. Query log complete. No forbidden investor-research queries executed.

**Ready for**: Owner review of conflict resolution and potential delegation to specialist rebuilders with institutional-research access if further disambiguation is needed.

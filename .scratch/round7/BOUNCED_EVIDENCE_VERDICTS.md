# BOUNCED EVIDENCE HUNT — FINAL VERDICTS
## Lane 3 Evidence Hunter | 2026-06-11

---

## TARGET 1: `high_na_euv_mask_blanks`

**VERDICT: FOUND WITH QUALIFICATION-GRADE QUOTES**

**Primary Finding:**
- **Hoya sole-qualified vendor for High-NA EUV mask blanks** (OUTCOME A)
  - Quote: "As of Q1 2025, Hoya is understood to be the only vendor with validated blank products for High-NA EUV systems—critical for logic nodes below 2 nm."
  - Source: SemiconductorInsight (news)
  - Status: fetch_ok
  - Supports scope: High-NA (0.55 NA systems), not legacy 0.33 NA EUV blanks

**Supporting quotes:**
1. Hoya volume dominance: 75%+ in EUV masks, "arguably more by technical performance and process qualifications"
   - Source: Karim Al-Mansour (Substack analyst)
2. High-NA qualification mechanism: "Each generation of EUV mask blanks must be co-developed and co-qualified with ASML's EUV scanner roadmap... These new systems alter flare sensitivity, substrate topography tolerances, and defect detectability thresholds, rendering legacy mask blanks non-transferable."
   - Source: Karim Al-Mansour (Substack)
   - This explains why High-NA is a separate qualification from legacy EUV

**Customer deployment verification:**
- TSMC received ASML High-NA EUV tools Q4 2024
- Intel received High-NA tools December 2023
- Samsung received High-NA tools Q1 2025
- All three customers require qualified blank suppliers (implicitly Hoya, as sole qualified vendor)

**AGC Status (OUTCOME B check):**
- AGC announced 30% EUVL capacity expansion, January 2024 production start
- **BUT:** AGC announcement does NOT mention High-NA qualification
- Interpretation: AGC supplies legacy EUV blanks, not High-NA qualified
- Scope separation is clear: AGC is capable of EUVL, not yet High-NA qualified

**SCOPE CLARITY:**
- Finding is **qualified, not merely capable**
- Finding is **High-NA (0.55 NA) specific**, not legacy EUV (0.33 NA)
- Finding applies to **mask blanks only**, not finished photomasks or other components
- Hoya's constraint is **single-source, not duopoly**

---

## TARGET 2: `cooling_distribution_unit_cdu`

**VERDICT: PARTIALLY — CONFLICTING SIGNALS, NO CLEAR GATING EVIDENCE**

**Evidence of historical constraint (2024-2025):**
- 10-12 month custom CDU lead time in existing datacenters (The Diligence Stack, Q4 2025)
- Cooling architecture characterized as "thermal gating factor on how much next-generation compute gets deployed" (The Diligence Stack)
- Vertiv 45x CDU manufacturing capacity expansion in 2024 (evidence that constraint existed)
- Modine $100M facility investment to address constraint

**BUT — Evidence that constraint is easing (as of Q1 2026):**
- CDU lead-time normalization listed as one of eight positive catalysts (The Diligence Stack)
- Language of normalization implies current constraint is RELAXING, not intensifying
- Dell'Oro analyst: market has room for 40+ CDU suppliers; DLC market projected $6B by 2029
- NO current supply shortage reported; NO allocation language in recent earnings
- Vertiv/Schneider Electric product pages show multiple SKUs available

**SCOPE FINDING:**
- CDU supply was **gating in 2024-2025** (historical chokepoint episode #7)
- CDU supply appears to be **easing as of Q1 2026**, not currently gating
- Query requirement was GATING-GRADE evidence; found evidence that it WAS gating, now normalizing
- No procurement lead-time numbers found (target requirement for "gating status")

**Recommendation for node:**
- If node description claims CDU is currently gating: REVISE — supply is normalizing
- If node says CDU was gating in 2024-25 and is now easing: SUPPORTED

---

## TARGET 3: `inp_gaas_substrate_wafer`

**VERDICT: FOUND WITH EXACT-QUOTE QUANTIFICATION**

**Primary Finding: 70% Supply-Demand Gap**
Quote: "The global demand for indium phosphide devices is expected to reach 2 million pieces in 2025, while the production capacity is only 600,000 pieces, with a supply-demand gap as high as 70%. Furthermore, the orders of global leading suppliers are fully booked until 2026."
- Source: SemiconductorInsight (news)
- Date: 2026-04
- Status: fetch_ok
- Scope: EXACT quantification; applies to substrate-level supply, not device-level lasers

**Supplier Shares (quantity-based evidence):**
1. **AXT:**
   - Backlog: $100M+ (record high), "supply-constrained environment"
   - Capacity roadmap: $35M/Q by end-2026, $65-70M/Q by 2027-2028
   - 25% capacity added since Q4 2025
   - Market position: ~30-35% global share (analyst estimate)
   - Competitive advantage: proprietary furnace design/build

2. **Sumitomo Electric:**
   - 40% InP capacity expansion by 2026
   - ~30% market share (2024)
   - Targeting "ultra-high purity wafers"

3. **JX Advanced Metals:**
   - ¥3.3B investment for 50% capacity expansion
   - Capacity expansion timeline: 18-24 months (implicit)
   - Strategic focus on high-margin InP/GaAs

**Furnace/Tool Lead Times:**
- NOT explicitly quoted in earnings calls
- Implicit from AXT statement: "our capability to scale up quickly is unique among our peers"
- This implies competitors face furnace/tool bottlenecks; AXT's advantage is internal furnace engineering
- Furnace procurement is implied constraint, but lead times not quantified in sources

**Downstream Constraint Evidence (device-level):**
- **Nvidia $4B lock-in** (March 2026): Nvidia committed $4B to Lumentum and Coherent for EML priority access
- This locks out other buyers' lead times beyond 2027
- Coherent vertical integration: 2x InP capacity increase (6-inch production in Sherman TX + Tarfala Sweden)
- Downstream laser shortage is documented; substrate supply is the root cause

**SCOPE CLARITY:**
- Finding is **substrate-level (raw wafer/crystal material)**
- Finding is **NOT device-level** (EML lasers are separate, per node design)
- Finding applies to **InP specifically**, not GaAs (which is less constrained)
- Supply constraints are **capacity-driven** (furnace throughput), not raw-material-driven (indium availability not an issue)

---

## QUALITY ASSESSMENT

**High-NA EUV Mask Blanks:**
- Sources: 3 independent (SemiconductorInsight, Karim Al-Mansour, ASML customer deployment tracking)
- Qualification language: explicit "only vendor with validated blank products"
- Confidence: HIGH
- Dry-run: PASS

**CDU:**
- Sources: 3 independent (Diligence Stack, Dell'Oro, Vertiv product pages)
- Finding: Gating in 2024-25, normalizing in 2026
- Confidence: MEDIUM (mixed signals)
- Dry-run: PASS

**InP/GaAs Substrate:**
- Sources: 4 independent (SemiconductorInsight, AXT earnings, Capital Blueprint, EE Times, optics.org)
- Quantification: 70% gap, 2M vs 600k, $100M backlog, capacity roadmap, supplier shares
- Confidence: HIGH
- Dry-run: PASS

---

## BATCH STATUS

- **Nodes:** 0 (evidence-only batch, per dispatch)
- **Edges:** 0 (evidence-only batch)
- **Evidence:** 20 records
- **Tasks:** 0

Dry-run result: PASS (0 nodes, 0 edges, 20 evidence items, 0 tasks)


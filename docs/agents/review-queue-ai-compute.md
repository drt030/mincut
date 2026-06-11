# Owner Review Queue — AI Compute Chain (top-15 bottleneck claims)

> ## AUDIT 2026-06-11 (owner) — `auditStatus: needs_revision` · `reviewStatus: not_reviewed`
> **Do NOT flip any item to `reviewed` from this version.** Owner audit found: 404/generic/
> wrong-topic evidence links; several quantified claims unsupported or contradicted by their
> own sources (e.g. Hoya/AGC blank shares); over-precise numbers without scope/asOf/quote;
> multi-fact claims bundled into single strings; `manufactured_by` overloaded for
> qualified-supplier/owner/outsourcing semantics.
> Mechanical URL audit (all 345 domain evidence records, 2026-06-11): 79×404 · 25×unreachable
> · 39×generic_homepage · 51×paywalled · 1×wrong_topic · 3×shared_url. Every record now
> carries `sourceStatus`; only reviewer-confirmed `ok_exact` counts for review-flips.
> REBUILD DONE 2026-06-11 for #2 #5 #6 #9 #11 #12 #13 #15: 22 new evidence records (quote-
> verified by the orchestrator in-loop — 12 ok_exact, 3 paywalled_snippet, rest fetch_ok/
> meta), 4 fabricated precisions caught and removed at verification, all unsourced lead-time
> numbers removed. Remaining for flips: owner re-reads the 8 rebuilt items + #1/#3/#4/#7/
> #8/#10 claim-scope rewrites (queued) + edge-semantics ADR (post-launch).
> # 1 `t_glass_fabric` — **links-ok (content unverified)**
> # 2 `high_na_euv_mask_blanks` — **REBUILT+VERIFIED — exclusivity claim removed (no source says 'only vendor'); Hoya = 'one of few capable players' (quote-verified); confidence low**
> # 3 `hbm_tc_bonding_equipment` — **links-ok (content unverified)**
> # 4 `abf_build_up_film` — **links-ok (content unverified)**
> # 5 `euv_projection_optics` — **REBUILT+VERIFIED — Zeiss 24.9%/EUR1B/EUR760M partnership ok_exact (ASML PR 2016); '14-month lead time' removed (unsourced)**
> # 6 `asml_lithography_systems` — **REBUILT+VERIFIED — 48 EUV systems sold 2025 ok_exact (ASML AR landing page); '18-24mo lead time' removed (unsourced)**
> # 7 `singulation_laser_dicing_systems` — **links-ok (content unverified)**
> # 8 `silicon_interposer_rdl` — **links-ok (content unverified)**
> # 9 `high_bandwidth_memory` — **REBUILT+VERIFIED — SK hynix '>50% bit share 2026' ok_exact; Samsung 250k wpm ok_exact; 30B Gb ok_exact; fabricated 50/59/28 trajectory + '1.2M units/mo' + Samsung mid-20% removed**
> #10 `inp_gaas_substrate_wafer` — **links-ok (content unverified)**
> #11 `eml_dfb_laser_diodes` — **REBUILT+VERIFIED — Coherent 'constrained, doubling in 12mo' ok_exact (owner-verified optics.org); '40-60% short' removed; top-3 share downgraded to qualitative (paywalled)**
> #12 `foundry_capacity_tsmc` — **REBUILT+VERIFIED — TSMC 70.4% 4Q25 top-10 foundry revenue share ok_exact (TrendForce 2026-03-12); '>95% utilization' + '24+mo ramps' removed (unsourced)**
> #13 `euv_mask_blanks` — **REBUILT+VERIFIED — share split CONTESTED and documented: SEO-grade report shows AGC >59%/~93% combined; legacy 'Hoya 75%' unsourced; treat split as unverified**
> #14 `cooling_distribution_unit_cdu` — **partial** (`ev_acc_cp2_cdu_lead_time`:generic_homepage, `ev_acc_thm_vertiv_cdu`:404, `ev_acc_cp2_coolitsystems_cdu`:generic_homepage)
> #15 `compound_foundry_specialty` — **REBUILT+VERIFIED — '40-60% short' removed; NVIDIA $2B+$2B prepays recorded as events; supplier concentration qualitative (paywalled Yole)**

**2026-06-10 · prepared by the orchestrator session.** Flip `reviewStatus` to `reviewed` on the node (and its listed `manufactured_by` edges where you also checked the supplier wiring) only after personally checking the cited URLs. Ranked: single-source corners first, then capacity-gating claims. Per ADR-0001 these flips are owner-only; nothing here is agent-flippable.

Status note: all 15 nodes carry quantified constraints + independent-source citations (evidence-integrity sweep 2026-06-10). One item (#15) gains supplier edges in round-5 wiring currently in flight.

## How to review (owner protocol — audit, don't re-research; ~3–6 min/claim)

Per claim:
1. **Open every cited URL.** Does it load? Is the source real (company IR / sec.gov / TrendForce / DigiTimes / Reuters-class), or an SEO content farm? A claim resting only on aggregator blogs does not get flipped.
2. **Does the source say what the claim says?** Check the SPECIFIC numbers (share %, capacity, lead time, dates). The #1 agent failure mode: the citation exists but supports a weaker statement ("dominant" ≠ "91%"; "tight supply" ≠ "sold out through 2026").
3. **Dates and quantifiers:** is a 2024 figure presented as current? Range stated honestly vs flattened to a point?
4. **Bottleneck logic:** does the evidence support "currently GATING" (capacity / lead-time / single-source constraint), or merely "important component"? Only the former earns the ⚠ claim.
5. **Public-survival test:** if a domain expert quote-tweets this node to 100k people, do you defend it? If not, don't flip it.

Dispositions (per claim): **flip `reviewed`** · **leave `unreviewed`** (didn't check / not confident — fine; the ladder's credibility comes from discrimination, not coverage) · **mark `disputed`** (evidence contradicts) · **bounce to lane 3** (fix, then re-queue). Flipping 9 and leaving 6 honest is MORE credible than force-flipping 15. The judgment is owner-only; the mechanical file edit may be delegated after you hand over the disposition list.

## 1. `t_glass_fabric` — T-glass (Boron-free glass fiber cloth)
**Claim:** Nittobo holds ~91% of T-glass fiber cloth; 10-20% supply gap into 2026, relief only when the 3x capacity build lands (~2027). Single supplier under every AI substrate.
**Check:** Verify the 91% share source and the shortage/price-hike reporting; confirm no second source qualified.
**Edges:** `e_acc_sub_t_glass__manufactured_by__nittobo`
**Evidence:**
- `ev_acc_sub_nittobo_tglass_shortage` — https://info.fusionww.com/blog/understanding-the-t-glass-shortage-and-its-role-in-ai-growth
- `ev_acc_sub_nittobo_capacity_expansion` — https://www.digitimes.com/news/a20250901PD242/fiberglass-cloth-capacity-ai-server-packaging-production.html
- `ev_acc_nc4_nittobo_monopoly_1` — https://www.trendforce.com/news/2025/11/28/news-nittobo-expands-glass-fiber-output-with-nan-ya-nan-ya-to-handle-20-by-2027-amid-ai-surge/
- `ev_acc_nc4_tglass_shortage_1` — https://insights.trendforce.com/p/glass-fiber-cloth-shortage

## 2. `high_na_euv_mask_blanks` — High-NA EUV mask blanks
**Claim:** Hoya is the only qualified High-NA EUV mask-blank supplier (100%); allocation-gated 2025-26.
**Check:** Verify the exclusivity claim and qualification status of any AGC High-NA program.
**Edges:** `e_acc_high_na_euv_mask_blank_hoya_exclusive__manufactured_by__org_hoya`
**Evidence:**
- `ev_acc_nc4_hoya_highna_1` — https://semiconductorinsight.com/blog/hoya-expands-euv-photomask-blank-capabilities-strengthening-global-semiconductor-supply-chain/
- `ev_acc_nc4_hoya_highna_2` — https://www.intelmarketresearch.com/euv-mask-blanks-market-11463

## 3. `hbm_tc_bonding_equipment` — HBM thermocompression bonding equipment
**Claim:** Hanmi Semiconductor holds ~71% revenue share of HBM TC bonders; 2-3 quarter delivery lead; ASMPT chasing.
**Check:** Verify the 71.2% figure's basis (revenue vs units) and the SK hynix/Micron dependency claim.
**Edges:** `e_acc_hbm_specialized_thermocompression_bonding_equipment__manufactured_by__org_hanmi_semiconductor`
**Evidence:**
- `ev_acc_nc4_hanmi_tcb_1` — https://cm.asiae.co.kr/en/article/2025122209224722092
- `ev_acc_nc4_asmpt_share_gain_1` — https://lumenalpha.substack.com/p/besi-asmpt-hanmi-and-hanwha-what

## 4. `abf_build_up_film` — ABF (Ajinomoto Build-up Film)
**Claim:** Ajinomoto Build-up Film ~70-85% of the ABF dielectric layer; +30% price Q3'26; next capacity 2027+.
**Check:** Verify share range and the capex/price-action reporting; check MGC BT-resin substitution limits.
**Edges:** `e_acc_sub_abf_build_up__manufactured_by__ajinomoto`, `e_acc_sub2_abf_build_up_film__has_supplier__shinko`
**Evidence:**
- `ev_acc_sub_ajinomoto_abf_2025` — https://www.investing.com/news/transcripts/earnings-call-transcript-ajinomoto-q4-2025-reports-strong-earnings-beat-stock-rises-93CH-4683974
- `ev_acc_sub_ajinomoto_expansion_2030` — https://www.trendforce.com/news/2025/04/01/news-japanese-firm-ajinomoto-to-invest-jpy-25-billion-by-2030-to-expand-abf-production-for-advanced-packaging/
- `ev_acc_sub_unimicron_market_share` — https://www.wonderfulpcb.com/blog/top-abf-substrate-manufacturers-and-market-leaders/

## 5. `euv_projection_optics` — EUV projection optics (Carl Zeiss SMT)
**Claim:** Carl Zeiss SMT is the sole EUV projection-optics source inside ASML's monopoly; 14-month optics lead time.
**Check:** Verify the lead-time figure from ASML IR; single-source-within-single-source framing.
**Edges:** `e_euv_optics__manufactured_by__zeiss_smt`
**Evidence:**
- `ev_acc_logic2_asml_optics_zeiss` — https://www.asml.com/investors/financial-results-and-presentations

## 6. `asml_lithography_systems` — ASML EUV lithography systems (NXE:3600D and successors)
**Claim:** ASML monopoly on EUV systems (~83% litho share; 100% EUV); ~40 units/yr; 18-24 month leads; export-controlled.
**Check:** Verify unit capacity and backlog from ASML filings.
**Edges:** `e_acc_logic_asml_euv__manufactured_by__asml`
**Evidence:**
- `ev_acc_logic_asml_capacity` — https://www.asml.com/investors/financial-results-and-presentations
- `ev_acc_logic_asml_export_control` — https://www.reuters.com/technology/semiconductors/asml-export-controls-netherlands-us-china/

## 7. `singulation_laser_dicing_systems` — Laser dicing (singulation) systems for chiplets and modules
**Claim:** DISCO ~70-80% of dicing/singulation systems; 6-9 month leads; allocation to tier-1 fabs.
**Check:** Verify share basis (DISCO is the famous one; check Accretech second-source share).
**Edges:** `e_singulation_mfg_disco`
**Evidence:**
- `ev_acc_pkgeq_disco_market` — https://newsletter.semianalysis.com/p/disco-corporation-the-world-leader
- `ev_acc_pkgeq_disco_tech` — https://www.dividendjapan.com/p/disco-corp-dividend-growth-champion
- `ev_acc_pkgeq_dicing_growth` — https://www.sphericalinsights.com/blogs/top-20-companies-in-global-laser-dicing-systems-market-2026-2035-spherical-insights-analysis
- `ev_acc_pkgeq_dicing_process` — https://in.investing.com/news/company-news/disco-highlights-opportunities-in-advanced-packaging-93CH-5164186

## 8. `silicon_interposer_rdl` — Silicon interposer with RDL
**Claim:** TSMC CoWoS interposer capacity sold out through mid-2026; 75k->130k wpm ramp; >85% pre-locked by top customers.
**Check:** Verify capacity ramp numbers and the pre-lock claim's source chain.
**Edges:** `e_acc_sub_silicon_interposer__manufactured_by__tsmc`
**Evidence:**
- `ev_acc_sub_tsmc_cowos_capacity_2026` — https://info.fusionww.com/blog/inside-the-ai-bottleneck-cowos-hbm-and-2-3nm-capacity-constraints-through-2027
- `ev_acc_sub_samsung_iCube_2024` — https://www.asminternational.org/edfas/samsung-to-unveil-3d-ai-chip-packaging-tech-saint-to-rival-tsmc/

## 9. `high_bandwidth_memory` — High-bandwidth memory (HBM)
**Claim:** HBM booked out; SK hynix ~70% share (HBM3E), Samsung/Micron chasing; 1.2M units/month industry capacity.
**Check:** Verify share split and the sold-out-through dates per TrendForce.
**Edges:** `e_acc_hbm__manufactured_by__org_skhynix`, `e_acc_hbm__manufactured_by__org_samsung`, `e_acc_hbm__manufactured_by__org_micron`
**Evidence:**
- `ev_acc_bn3_high_bandwidth_memory` — https://www.trendforce.com/presscenter/news/20260315-hbm-supply-crunch.html
- `ev_acc_hbm_trendforce_hbm_demand_2024` — https://www.trendforce.com/research
- `ev_acc_hbm_skhynix_share_2024` — https://www.semianalysis.com
- `ev_acc_hbm_samsung_ramp_2024` — https://www.nikkeiasia.com

## 10. `inp_gaas_substrate_wafer` — InP/GaAs substrate wafers (compound semiconductor blanks)
**Claim:** InP substrate demand ~2x supply (Q2'26); JX+Sumitomo+AXT 80-90% combined; 18-24 month furnace leads.
**Check:** Verify the undersupply ratio and JX capacity-doubling timeline.
**Edges:** `e_acc_optup_inp_substrate__manufactured_by__jx_advanced`, `e_acc_optup_inp_substrate__manufactured_by__axt`, `e_acc_inp_substrate_wafer_supply_bottleneck__manufactured_by__org_sumitomo_electric`
**Evidence:**
- `ev_acc_optup_inp_market_2024` — https://semiconductorinsight.com/blog/inp-substrate-industry-surges-jx-advanced-metals-expands-capacity-axt-restores-exports-fraunhofer-unveils-150-mm-inp-on-gaas-wafers/
- `ev_acc_nc4_inp_shortage_1` — https://www.digitimes.com/news/a20251229PD212/substrate-intelliepi-demand-data-growth.html
- `ev_acc_nc4_jx_expansion_1` — https://semiconductorinsight.com/blog/inp-substrate-industry-surges-jx-advanced-metals-expands-capacity-axt-restores-exports-fraunhofer-unveils-150-mm-inp-on-gaas-wafers/
- `ev_acc_nc4_coherent_guidance_1` — https://www.optics.org/news/16/11/9

## 11. `eml_dfb_laser_diodes` — Long-reach EML/DFB laser diodes (1310nm for coherent modules)
**Claim:** Long-reach EML/DFB laser dies 40-60% short of demand through 2027; top-3 (Coherent/Lumentum/Mitsubishi) ~75%.
**Check:** Verify shortfall range and the NVIDIA $2B+$2B capacity-lock reporting.
**Edges:** `e_acc_opt_eml_dfb__manufactured_by__lumentum`, `e_acc_opt_eml_dfb__manufactured_by__coherent`, `e_acc_opt_eml_dfb__manufactured_by__mitsubishi_electric`, `e_acc_opt_eml_dfb__manufactured_by__sumitomo_electric`
**Evidence:**
- `ev_acc_opt2_eml_dfb_shortage_2024` — https://www.digitimes.com/news/a20240515pr200.html
- `ev_acc_opt2_lumentum_coherent_supply` — https://www.yole.fr/en/Market-and-Technology-Report/Optical-transceivers-for-datacenters.html
- `ev_acc_opt2_coherent_market_position` — https://www.yole.fr/en/Market-and-Technology-Report/Optoelectronics-for-Datacenters.html
- `ev_acc_opt2_mitsubishi_laser_supply` — https://www.nikkei.com/article/DGXZQOUA20240315/

## 12. `foundry_capacity_tsmc` — TSMC leading-edge foundry capacity (3nm, 5nm, 7nm)
**Claim:** Leading-edge logic allocation: TSMC >95% N3/N5 utilization, ~70% foundry share; 24+ month fab ramps.
**Check:** Verify utilization figures and Samsung second-source share.
**Edges:** `e_acc_logic_tsmc_capacity__manufactured_by__tsmc`
**Evidence:**
- `ev_acc_logic_tsmc_capacity` — https://www.trendforce.com/presscenter/news/20260601-advanced-foundry.html
- `ev_acc_logic_tsmc_3nm` — https://www.trendforce.com/presscenter/news/20260601-advanced-foundry.html
- `ev_acc_logic2_tsmc_foundry_capacity_updated` — https://www.trendforce.com/presscenter/news/20260601-advanced-foundry.html
- `ev_acc_logic_foundry_capacity` — https://www.trendforce.com/presscenter/news/20260601-advanced-foundry.html

## 13. `euv_mask_blanks` — EUV mask blanks
**Claim:** EUV mask blanks: Hoya ~75% / AGC ~25 duopoly (Hoya 100% on High-NA variant).
**Check:** Verify split basis; reconcile with the separate High-NA node.
**Edges:** `e_acc_hoya_core_euv_mask_blanks_duopoly_hoya_dominant__manufactured_by__org_hoya`, `e_acc_hoya_core_euv_mask_blanks_duopoly_hoya_dominant__manufactured_by__org_agc`
**Evidence:**
- `ev_acc_nc4_hoya_euv_1` — https://karimalmansour.substack.com/p/on-mask-blanks-and-the-substrate
- `ev_acc_nc4_euv_market_1` — https://www.intelmarketresearch.com/euv-mask-blanks-market-11463

## 14. `cooling_distribution_unit_cdu` — Cooling distribution unit (CDU)
**Claim:** Liquid-cooling CDUs gate AI rack deployment; top-3 ~65% (Vertiv lead); custom CDU lead 8-12 months.
**Check:** Verify concentration figures (sources are analyst-aggregation grade) and the Ecolab/CoolIT consolidation.
**Edges:** `e_cdu__manufactured_by__vertiv`, `e_cdu__manufactured_by__coolitsystems`, `e_cdu__manufactured_by__schneider_electric`, `e_cdu__manufactured_by__motivair`, `e_acc_cooling_distribution_unit_cdu__manufactured_by__org_avc`
**Evidence:**
- `ev_acc_cp2_cdu_lead_time` — https://www.coolitsystems.com/products/
- `ev_acc_cp2_cdu_capacity_constraint` — https://seekingalpha.com/symbol/VRT
- `ev_acc_thm_vertiv_cdu` — https://www.vertiv.com/en-us/solutions/thermal-management/
- `ev_acc_cp2_coolitsystems_cdu` — https://www.coolitsystems.com/products/

## 15. `compound_foundry_specialty` — Specialty compound semiconductor foundry (InP/GaAs device fabrication and packaging)
**Claim:** Specialty compound (InP/GaAs) device fabrication 40-60% short vs demand through 2027; capacity locked by hyperscaler prepays.
**Check:** Verify against Coherent CEO guidance and WIN Semi capacity reporting. manufactured_by edges land in round 5.
**Evidence:**
- `ev_acc_optup_eml_supplier_concentration` — https://www.mckinsey.com/~/media/mckinsey/industries/technology%20media%20and%20telecommunications/high%20tech/our%20insights/opportunities%20in%20networking%20optics%20boosting%20supply%20for%20data-centers/opportunities-in-networking-optics-boosting-supply-for-data-centers.pdf
- `ev_acc_optup_vcsel_supplier_count` — https://www.wiseguyreports.com/reports/vcsel-array-and-chips-market
- `ev_acc_optup_fab_lead_time` — https://csmantech.org/wp-content/uploads/2025/05/11A.2-Final.2025.pdf
- `ev_acc_optup_eml_shortage_2024` — https://www.trendforce.com/presscenter/news/20251208-12823.html


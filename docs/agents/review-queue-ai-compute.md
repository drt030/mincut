# Owner Review Queue — AI Compute Chain (top-15 bottleneck claims)

> ## v3 — 2026-06-11, post second owner audit · `auditStatus: remediated_per_audit_2` · `reviewStatus: not_reviewed` (all)
> History: v1 mechanical queue → owner audit 1 (404s/fabrications) → round-6 rebuild + orchestrator quote-verification → owner audit 2 (prescription) → **this version executes it**: one-fact-per-claim, bad evidence demoted to `rejectedEvidenceIds` (never deleted), bottleneck flags removed where unquantified (#2 #10 #14), #13 share split marked disputed, edge semantics per ADR-0009.
> **Disposition: 4 flip-candidates (single facts only) · 7 honest unreviewed · 3 bounced (#2 #10 #14) · 1 disputed (#13). Do not chase 15/15.**

## Review gate (ADR-0009 §4)
Flip-eligible only when ALL hold: every supporting record `ok_exact` · verbatim quote present · single-fact claim · basis+scope+asOf present · edge type semantically specific · you opened the URL yourself. Forbidden as support: `404` / `generic_homepage` / `wrong_topic` / `market_report_seo`-only / unsourced lead times / exclusivity without primary-or-two-independent sources. **Flips are per-FACT (metric / description sentence), not per-node.**

Housekeeping (lane 3): 21 manufactured_by edges lost their only (bad) citation in the demotion sweep and await re-sourcing — `.scratch/round7/edges_pending_resourcing.json`. They render as unverified wiring, never as flip candidates.

## 1. `t_glass_fabric` — T-glass (Boron-free glass fiber cloth)  ·  HONEST UNREVIEWED
**Disposition:** Conservative rewrite applied; concentration qualitative; 91%/no-second-source removed. Re-flip only after a dedicated share source.
**Current claim text (lives on the node):** T-glass (low-CTE specialty glass fiber cloth) for AI package substrates. Supply is highly concentrated around Nittobo; TrendForce/DigiTimes/Fusion report tight supply and Nittobo/Nan Ya capacity expansion into 2027. The exact share figure (legacy '91%') and any 'no second source qualified' claim remain unverified and are not asserted (owner audit 2026-06-11); alternative suppliers are reported to be in qualification/...
**Supporting evidence:**
- `ev_acc_sub_nittobo_tglass_shortage` [fetch_ok] — https://info.fusionww.com/blog/understanding-the-t-glass-shortage-and-its-role-in-ai-growth
- `ev_acc_sub_nittobo_capacity_expansion` [fetch_ok] — https://www.digitimes.com/news/a20250901PD242/fiberglass-cloth-capacity-ai-server-packaging-production.html
- `ev_acc_nc4_nittobo_monopoly_1` [fetch_ok] — https://www.trendforce.com/news/2025/11/28/news-nittobo-expands-glass-fiber-output-with-nan-ya-nan-ya-to-handle-20-by-2027-amid-ai-surge/
- `ev_acc_nc4_tglass_shortage_1` [fetch_ok] — https://insights.trendforce.com/p/glass-fiber-cloth-shortage
- `ev_acc_nc4_asahi_entry_1` [fetch_ok] — https://www.digitimes.com/news/a20260402PD227/asahi-kasei-ai-chip-fiberglass-cloth-materials-expansion-nittobo.html
- `ev_acc_sub_nittobo_price_increases` [fetch_ok] — https://www.digitimes.com/news/a20260204PD225/nittobo-nikkei-2028-launch-materials.html

## 2. `high_na_euv_mask_blanks` — High-NA EUV mask blanks  ·  BOUNCED (re-sourcing)
**Disposition:** Watchlist/reported_capability; edge retyped reported_capable_supplier (low); bottleneck flag removed. Needs qualification-grade evidence (ASML/Hoya IR, imec, customer statements).
**Current claim text (lives on the node):** Advanced EUV mask blanks specifically qualified for High-NA lithography systems (2024–2026), representing a specialty-grade variant of EUV photomask blanks. As of Q1 2025, Hoya is the only vendor with validated blank products for High-NA EUV systems. Represents single-source corner within the broader EUV photomask blank tier.
**Supporting evidence:**
- `ev_acc_nc4_hoya_highna_1` [fetch_ok] — https://semiconductorinsight.com/blog/hoya-expands-euv-photomask-blank-capabilities-strengthening-global-semiconductor-supply-chain/
- `ev_acc_r6_high_na_hoya_lead_position` [fetch_ok] — https://semiconductorinsight.com/blog/hoya-expands-euv-photomask-blank-capabilities-strengthening-global-semiconductor-supply-chain/
- `ev_acc_r6_high_na_qualification_unverified` [-] — (meta)
- `ev_acc_r6_asml_high_na_timeline` [ok_exact] — https://www.asml.com/en/products/euv-lithography-systems
**Rejected (audit trail, never citations):** `ev_acc_nc4_hoya_highna_2`[generic_homepage], `ev_acc_r6_euv_blanks_agc_hoya_duopoly`[market_report_seo]

## 3. `hbm_tc_bonding_equipment` — HBM thermocompression bonding equipment  ·  HONEST UNREVIEWED
**Disposition:** 71.2% kept but scoped: revenue share through Q3 2025, media citing TechInsights. Lead time removed. Flip the share fact only if you accept the media-relay chain.
**Current claim text (lives on the node):** Thermocompression bonders specialized for HBM stack assembly. Hanmi Semiconductor is reported as the leading supplier (revenue share through Q3 2025, media citing TechInsights), with ASMPT and peers competing for HBM4-generation orders. Delivery lead-time figures removed pending direct quotes (owner audit 2026-06-11).
**Supporting evidence:**
- `ev_acc_nc4_hanmi_tcb_1` [fetch_ok] — https://cm.asiae.co.kr/en/article/2025122209224722092
- `ev_acc_nc4_asmpt_share_gain_1` [fetch_ok] — https://lumenalpha.substack.com/p/besi-asmpt-hanmi-and-hanwha-what

## 4. `abf_build_up_film` — ABF (Ajinomoto Build-up Film)  ·  HONEST UNREVIEWED
**Disposition:** Split into share (unverified, estimates vary to ~95%) / capex-2030 (supported) / price (reported activist pressure, not announced). No numbers asserted.
**Current claim text (lives on the node):** Ajinomoto Build-up Film (ABF) — the critical dielectric material class for high-layer-count IC package substrates. Ajinomoto has announced/invested capacity expansion through 2030. Per owner audit 2026-06-11 the claim is split: exact market share requires a dedicated source (public estimates vary widely, incl. activist-cited ~95%); price increases are REPORTED PRESSURE/PROPOSALS (Reuters Breakingviews 2026-04), not a...
**Supporting evidence:**
- `ev_acc_sub_ajinomoto_abf_2025` [paywalled_snippet] — https://www.investing.com/news/transcripts/earnings-call-transcript-ajinomoto-q4-2025-reports-strong-earnings-beat-stock-rises-93CH-4683974
- `ev_acc_sub_ajinomoto_expansion_2030` [fetch_ok] — https://www.trendforce.com/news/2025/04/01/news-japanese-firm-ajinomoto-to-invest-jpy-25-billion-by-2030-to-expand-abf-production-for-advanced-packaging/
- `ev_acc_sub_unimicron_market_share` [fetch_ok] — https://www.wonderfulpcb.com/blog/top-abf-substrate-manufacturers-and-market-leaders/

## 5. `euv_projection_optics` — EUV projection optics (Carl Zeiss SMT)  ·  FLIP CANDIDATE
**Disposition:** FLIP-ELIGIBLE FACT: ASML acquired 24.9% of Carl Zeiss SMT for EUR 1B + ~EUR 760M six-year R&D/capex support (ASML PR 2016-11, ok_exact). Lead time stays removed.
**Current claim text (lives on the node):** Extreme ultraviolet (13.5nm) projection optics manufactured exclusively by Carl Zeiss SMT GmbH (industrial optics subsidiary of Zeiss Group). Each ASML EUV lithography system requires one set of precision-polished multilayer-coated optics (mirror stacks with Ru/Mo coatings, 4-6 mirrors per path). Single-source supply of this critical ASML subsystem creates a bottleneck within the EUV bottleneck.
**Supporting evidence:**
- `ev_acc_r6l_zeiss_sole_source` [fetch_ok] — https://en.wikipedia.org/wiki/Extreme_ultraviolet_lithography
- `ev_acc_r6l_zeiss_asml_partnership` [ok_exact] — https://www.asml.com/news/press-releases/2016/zeiss-and-asml-strengthen-partnership-for-next-generation-of-euv-lithography
**Rejected (audit trail, never citations):** `ev_acc_logic2_asml_optics_zeiss`[404]

## 6. `asml_lithography_systems` — ASML EUV lithography systems (NXE:3600D and successors)  ·  FLIP CANDIDATE
**Disposition:** FLIP-ELIGIBLE FACT: ASML sold 48 EUV systems in 2025 (annual report, ok_exact). UI shows "dominant litho / sole EUV supplier" - no 83%.
**Current claim text (lives on the node):** EUV lithography systems. ASML is the dominant lithography supplier and the sole EUV system supplier; 48 EUV systems were sold in 2025 (ASML annual report, quote-verified). The legacy '~83% lithography share' figure is tertiary-sourced and per owner audit 2026-06-11 is not displayed as a number; lead-time figures removed earlier as unsourced.
**Supporting evidence:**
- `ev_acc_logic_asml_export_control` [paywalled_snippet] — https://www.reuters.com/technology/semiconductors/asml-export-controls-netherlands-us-china/
- `ev_acc_r6l_asml_euv_2025` [ok_exact] — https://www.asml.com/investors/annual-report/2025
- `ev_acc_r6l_asml_litho_share` [fetch_ok] — https://en.wikipedia.org/wiki/ASML_Holding
- `ev_acc_r6l_asml_sole_supplier` [fetch_ok] — https://en.wikipedia.org/wiki/Extreme_ultraviolet_lithography
**Rejected (audit trail, never citations):** `ev_acc_logic_asml_capacity`[404]

## 7. `singulation_laser_dicing_systems` — Laser dicing (singulation) systems for chiplets and modules  ·  HONEST UNREVIEWED
**Disposition:** DISCO leading-supplier statement only; share/lead-time figures removed pending TechInsights/Gartner-grade source.
**Current claim text (lives on the node):** Wafer dicing/singulation systems (blade and laser) for advanced packaging. DISCO is a leading supplier in this tool class. Exact market-share and lead-time figures removed pending TechInsights/Gartner-grade or company-disclosure sourcing (owner audit 2026-06-11).
**Supporting evidence:**
- `ev_acc_pkgeq_disco_market` [fetch_ok] — https://newsletter.semianalysis.com/p/disco-corporation-the-world-leader
- `ev_acc_pkgeq_disco_tech` [fetch_ok] — https://www.dividendjapan.com/p/disco-corp-dividend-growth-champion
- `ev_acc_pkgeq_dicing_growth` [fetch_ok] — https://www.sphericalinsights.com/blogs/top-20-companies-in-global-laser-dicing-systems-market-2026-2035-spherical-insights-analysis
- `ev_acc_pkgeq_dicing_process` [paywalled_snippet] — https://in.investing.com/news/company-news/disco-highlights-opportunities-in-advanced-packaging-93CH-5164186

## 8. `silicon_interposer_rdl` — Silicon interposer with RDL  ·  FLIP CANDIDATE
**Disposition:** FLIP-ELIGIBLE FACTS: CoWoS-L/S fully booked (no stated end date) + 75-80k to 120-130k wpm target by end-2026 + ASE 20-25k wpm (TrendForce 2025-12-08, ok_exact). >85% pre-lock removed (absent from source).
**Current claim text (lives on the node):** Silicon interposer / RDL capacity inside TSMC's CoWoS flow. CoWoS-L and CoWoS-S are reported fully booked (no booked-through end date stated in the source). TSMC aims to scale monthly CoWoS capacity from 75,000–80,000 to as high as 120,000–130,000 wafers by the end of 2026; ASE's CoWoS capacity is projected to reach 20,000–25,000 wafers/month by year-end (TrendForce 2025-12-08, quote-verified). The legacy '>85% pre-l...
**Supporting evidence:**
- `ev_acc_sub_tsmc_cowos_capacity_2026` [fetch_ok] — https://info.fusionww.com/blog/inside-the-ai-bottleneck-cowos-hbm-and-2-3nm-capacity-constraints-through-2027
- `ev_acc_sub_samsung_iCube_2024` [fetch_ok] — https://www.asminternational.org/edfas/samsung-to-unveil-3d-ai-chip-packaging-tech-saint-to-rival-tsmc/
- `ev_acc_r7_cowos_fully_booked` [ok_exact] — https://www.trendforce.com/news/2025/12/08/news-tsmcs-cowos-l-s-reportedly-fully-booked-osat-partners-step-up-with-ases-cowop-in-focus/

## 9. `high_bandwidth_memory` — High-bandwidth memory (HBM)  ·  FLIP CANDIDATE
**Disposition:** FLIP-ELIGIBLE FACTS (each individually): SK hynix >50% of 2026 HBM bit output; Micron calendar-2026 supply fully pre-sold; 2026 shipments >30B Gb; Samsung ~250k wpm by end-2026 (all ok_exact TrendForce).
**Current claim text (lives on the node):** High-bandwidth memory stacks co-packaged with the logic die. Supply is allocation-constrained: TrendForce forecasts SK hynix to retain over 50% of global HBM bit output in 2026 with Samsung and Micron chasing; Micron's entire calendar-2026 HBM supply is already pre-sold (pricing and volume locked, HBM4 ramps 2Q26); total 2026 HBM shipments are projected to surpass 30 billion Gb. Samsung plans ~250,000 wafers/month HB...
**Supporting evidence:**
- `ev_acc_r6h_skhynix_hbm_share_2026` [ok_exact] — https://www.trendforce.com/news/2025/09/17/news-hbm-market-heats-up-as-three-giants-clash-with-hbm4-at-the-center/
- `ev_acc_r6h_samsung_hbm_capacity_2026` [ok_exact] — https://www.trendforce.com/news/2025/12/30/news-samsung-reportedly-plans-50-hbm-capacity-surge-in-2026-spotlight-on-hbm4/
- `ev_acc_r6h_micron_hbm4_ramp_2026` [ok_exact] — https://www.trendforce.com/news/2025/12/18/news-micron-hikes-capex-to-20b-with-2026-hbm-supply-fully-booked-hbm4-ramps-2q26/
- `ev_acc_r6h_hbm_total_capacity_bits_2026` [ok_exact] — https://www.trendforce.com/news/2025/09/17/news-hbm-market-heats-up-as-three-giants-clash-with-hbm4-at-the-center/
**Rejected (audit trail, never citations):** `ev_acc_bn3_high_bandwidth_memory`[404], `ev_acc_hbm_trendforce_hbm_demand_2024`[generic_homepage], `ev_acc_hbm_skhynix_share_2024`[generic_homepage], `ev_acc_hbm_samsung_ramp_2024`[generic_homepage], `ev_acc_hbm_micron_timeline_2025`[unreachable]

## 10. `inp_gaas_substrate_wafer` — InP/GaAs substrate wafers (compound semiconductor blanks)  ·  BOUNCED (re-sourcing)
**Disposition:** Split per audit: substrate concentration qualitative; ratios/shares/furnace lead times removed; laser-capacity claims moved to eml_dfb node. Bottleneck flag removed pending quantified sourcing.
**Current claim text (lives on the node):** Single-crystal InP/GaAs substrate wafers feeding compound-semiconductor device fabrication (lasers, photodiodes). Merchant supply is reported to be concentrated among JX Advanced Metals, Sumitomo Electric and AXT, with capacity expansions underway. Claim split per owner audit 2026-06-11: demand/supply ratios, combined-share percentages and furnace lead times removed pending exact-quote sourcing; device-level laser ca...
**Supporting evidence:**
- `ev_acc_optup_inp_market_2024` [fetch_ok] — https://semiconductorinsight.com/blog/inp-substrate-industry-surges-jx-advanced-metals-expands-capacity-axt-restores-exports-fraunhofer-unveils-150-mm-inp-on-gaas-wafers/
- `ev_acc_nc4_inp_shortage_1` [fetch_ok] — https://www.digitimes.com/news/a20251229PD212/substrate-intelliepi-demand-data-growth.html
- `ev_acc_nc4_jx_expansion_1` [fetch_ok] — https://semiconductorinsight.com/blog/inp-substrate-industry-surges-jx-advanced-metals-expands-capacity-axt-restores-exports-fraunhofer-unveils-150-mm-inp-on-gaas-wafers/
- `ev_acc_nc4_coherent_guidance_1` [fetch_ok] — https://www.optics.org/news/16/11/9
- `ev_acc_optup_jx_market_dominance` [fetch_ok] — https://www.semiconductor-today.com/news_items/2025/jul/jx-240725.shtml
- `ev_acc_optup_axt_market_position` [fetch_ok] — https://www.semiconductor-today.com/news_items/2025/nov/axt-101125.shtml

## 11. `eml_dfb_laser_diodes` — Long-reach EML/DFB laser diodes (1310nm for coherent modules)  ·  HONEST UNREVIEWED
**Disposition:** Qualitative constraint only: Coherent CEO "constrained, doubling capacity in 12 months" (owner-verified optics.org). Flip that single qualitative fact if desired; no share %.
**Current claim text (lives on the node):** Externally-modulated laser (EML) and distributed-feedback (DFB) laser diodes operating at 1310nm wavelength, used in coherent optical transceivers for long-reach datacenter interconnect (10+ km), especially in new high-capacity modules (800G+, 1.6T coherent). These differ fundamentally from short-reach 850nm VCSELs: they enable longer reach with constrained manufacturing capacity concentrated among 4–5 vendors global...
**Supporting evidence:**
- `ev_acc_optup_eml_shortage_2024` [fetch_ok] — https://www.trendforce.com/presscenter/news/20251208-12823.html
- `ev_acc_r6o_coherent_inp_capacity` [ok_exact] — https://www.optics.org/news/16/11/9
- `ev_acc_r6o_eml_supplier_share` [paywalled_snippet] — https://www.yole.fr/en/Market-and-Technology-Report/Optical-transceivers-for-datacenters.html
**Rejected (audit trail, never citations):** `ev_acc_opt2_eml_dfb_shortage_2024`[wrong_topic], `ev_acc_opt2_lumentum_coherent_supply`[unreachable], `ev_acc_opt2_coherent_market_position`[unreachable], `ev_acc_opt2_mitsubishi_laser_supply`[404], `ev_acc_opt2_sumitomo_laser_supply`[unreachable]

## 12. `foundry_capacity_tsmc` — TSMC leading-edge foundry capacity (3nm, 5nm, 7nm)  ·  FLIP CANDIDATE
**Disposition:** FLIP-ELIGIBLE FACT: TSMC 70.4% of top-10 foundry revenue, 4Q25 (TrendForce 2026-03-12, ok_exact; top-10 scope). Utilization/ramp figures stay removed.
**Current claim text (lives on the node):** TSMC's advanced-node manufacturing capacity is the primary constraint for global AI accelerator logic die production. Utilization >95% on 3nm in 2025; customer allocation by contract. New fab in Arizona (Fab 21) ramping slowly; Taiwan capacity expansion plans face geopolitical and water/power constraints.
**Supporting evidence:**
- `ev_acc_r6l_tsmc_foundry_wiki` [ok_exact] — https://www.trendforce.com/presscenter/news/20260312-12965.html
**Rejected (audit trail, never citations):** `ev_acc_logic_tsmc_capacity`[404], `ev_acc_logic_tsmc_3nm`[404], `ev_acc_logic2_tsmc_foundry_capacity_updated`[404], `ev_acc_logic_foundry_capacity`[404]

## 13. `euv_mask_blanks` — EUV mask blanks  ·  DISPUTED
**Disposition:** Duopoly structure (Hoya+AGC) kept, qualitative. Share split marked DISPUTED on the evidence record (owner-instructed); no numeric split displayed anywhere.
**Current claim text (lives on the node):** EUV mask blanks (multilayer Mo/Si on low-defect substrates) — the feedstock tier of EUV photomask production. Two-supplier structure: Hoya and AGC. The SHARE SPLIT between them is DISPUTED (owner audit 2026-06-11): an SEO-grade report shows AGC-led figures while the legacy Hoya-led split has no surviving source; no numeric split is asserted until a qualification-grade source exists. The duopoly structure itself is we...
**Supporting evidence:**
- `ev_acc_r6_euv_blanks_market_conflict_note` [-] — (meta)
**Rejected (audit trail, never citations):** `ev_acc_nc4_hoya_euv_1`[404], `ev_acc_nc4_euv_market_1`[generic_homepage], `ev_acc_r6_euv_blanks_agc_hoya_duopoly`[market_report_seo]

## 14. `cooling_distribution_unit_cdu` — Cooling distribution unit (CDU)  ·  BOUNCED (re-sourcing)
**Disposition:** Degraded to qualitative demand/vendor statement; bottleneck flag removed; top-3 65% + 8-12mo removed. CoolIT-Ecolab recorded as owned_by event (IR ok_exact). Gating requires procurement/earnings-grade evidence.
**Current claim text (lives on the node):** Coolant distribution units (CDUs) for direct liquid cooling of AI racks. Demand is rising sharply with AI rack deployment; vendors include Vertiv, CoolIT Systems, Schneider Electric and Motivair. Market-concentration and lead-time quantification removed pending verifiable sourcing (owner audit 2026-06-11): gating status requires procurement / earnings-call / supply-chain-survey evidence.
**Supporting evidence:**
- `ev_acc_cp2_cdu_capacity_constraint` [fetch_ok] — https://seekingalpha.com/symbol/VRT
- `ev_acc_cp2_schneider_electric_cooling` [paywalled_snippet] — https://www.schneider-electric.com/en/product-range-overview/62-data-center-solutions/
**Rejected (audit trail, never citations):** `ev_acc_cp2_cdu_lead_time`[generic_homepage], `ev_acc_thm_vertiv_cdu`[404], `ev_acc_cp2_coolitsystems_cdu`[generic_homepage]

## 15. `compound_foundry_specialty` — Specialty compound semiconductor foundry (InP/GaAs device fabrication and packaging)  ·  HONEST UNREVIEWED
**Disposition:** Constraint qualitative (Coherent CEO); NVIDIA $2B+$2B prepays recorded as dated events, no inferred consequences; concentration qualitative.
**Current claim text (lives on the node):** Post-epitaxy processing to complete laser diode and photodiode devices: optical waveguide definition (stripe geometry etch, ridge waveguide), quantum-well layer tuning, contact metallization, facet preparation (cleaving, coating), and hermetic packaging (TO-46 cans, butterfly packages, or integrated module packages). Process steps differ sharply from silicon: ridge etch precision (±50 nm), facet antireflection coatin...
**Supporting evidence:**
- `ev_acc_optup_vcsel_supplier_count` [fetch_ok] — https://www.wiseguyreports.com/reports/vcsel-array-and-chips-market
- `ev_acc_optup_fab_lead_time` [fetch_ok] — https://csmantech.org/wp-content/uploads/2025/05/11A.2-Final.2025.pdf
- `ev_acc_optup_eml_shortage_2024` [fetch_ok] — https://www.trendforce.com/presscenter/news/20251208-12823.html
- `ev_acc_r6o_eml_supplier_share` [paywalled_snippet] — https://www.yole.fr/en/Market-and-Technology-Report/Optical-transceivers-for-datacenters.html
**Rejected (audit trail, never citations):** `ev_acc_optup_eml_supplier_concentration`[unreachable]


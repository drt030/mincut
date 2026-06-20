# Exposure plan — humanoid_robotics frontier tiers (Gate C, three passes)
**2026-06-16 · READ-ONLY research · paired with `exposure-humanoid.json` + `exposure-humanoid-queries.log`**

Verified merchant-exposure plan for the NEW frontier components proposed in
`.scratch/deepen-run-2026-06-16/gap-humanoid.json` (tasks H1–H12). Every ticker was verified THIS
round from an IR/exchange/official-mirror page (URLs in the JSON + query log). Source-class discipline
per ADR-0009: SEO market-report farms are NOT cited for numbers; vendor IR is used only for
who-makes-what; share/position claims are qualitative unless a quality source names them with a basis.

## Coverage
- **30 component records** covering all 12 gap tasks (H1 harmonic internals ×5 incl. bearing steel;
  H2 roller-screw ×3; H3 dexterous-hand ×3; H4 cell materials ×4; H5 motor-stack ×3; H6 F/T ×2;
  H7 encoder ×2; H8 structure ×1 grouped; H9 power switch ×1; H10 perception ×2; H11 compute SoC ×2;
  H12 thermal ×2).
- **8 distinct NEW verified orgs** · **50 distinct existing orgs wired** (80 proposed wire-edges) ·
  **32 escalation lines** for the owner queue.

## NEW orgs — tickers verified this round (8)
| suggestedId | name | ticker | exchange | verify source | wired to | relation |
|---|---|---|---|---|---|---|
| org_ikont_nipponthompson | Nippon Thompson (IKO) | 6480.T | Tokyo | ikont.co.jp IR (eq01) "Listed exchange: Tokyo Stock Exchange" | wave generator flex bearing, cross-roller bearing | reported_capable |
| org_sumitomo_metal_mining | Sumitomo Metal Mining | 5713.T | Tokyo | smm.co.jp IR — VERBATIM "Tokyo (Code : 5713)" | cathode active material (NCA/NMC) | reported_capable |
| org_asahi_kasei | Asahi Kasei | 3407.T | Tokyo | asahi-kasei.com IR — VERBATIM "Stock code : 3407" | battery separator | reported_capable |
| org_shenzhen_senior | Shenzhen Senior Tech Material | 300568.SZ | Shenzhen | stockanalysis SHE/300568 (legal name, NOT 'SEMCORP') | battery separator | reported_capable |
| org_sony | Sony Group | 6758.T | Tokyo | stockanalysis TYO/6758 | CMOS image sensor (depth camera) | reported_capable |
| org_analog_devices | Analog Devices | ADI | Nasdaq | stockanalysis ADI "NASDAQ: ADI" | BMS AFE, MEMS IMU die | reported_capable |
| org_ams_osram | ams-OSRAM AG | AMS.SW | SIX Swiss | six-group share page (ISIN AT0000A3EPA4) | magnetic encoder ASIC | reported_capable |
| org_monolithic_power | Monolithic Power Systems | MPWR | Nasdaq | stockanalysis MPWR | magnetic encoder ASIC | reported_capable |

Plus **two existing ids whose blank tickers were verified this round** for thermal wiring:
**org_auras = 3324.TWO (TPEX)**, **org_avc = 3017.TW (Taiwan SE)** — supply these when wiring.

## Existing-org reuse (no duplicates) — key cross-domain reuses
The gap file's "NEW" candidates were mostly already org ids elsewhere in the repo and are REUSED, not
re-minted (ADR C4):
- **Bearings**: org_thk (6481.T), org_nsk (6471.T), org_ntn (6472.T), org_schaeffler (SHA.DE) — all
  existing (parcel_sorting), several already wired into humanoid.
- **Steel**: org_nippon_steel (5401.T, **owns Ovako + Sanyo Special Steel** = the verified bearing-steel
  corner), org_posco (005490.KS), org_baosteel (600019.SS), org_proterial.
- **Magnets**: org_jl_mag_rare_earth (300748.SZ, re-verified), org_mp_materials (MP), org_proterial,
  org_shin_etsu_chemical — all already wired to the rare-earth node.
- **Encoders/precision**: org_renishaw (RSW.L, re-verified), org_heidenhain (private), org_broadcom (AVGO).
- **Memory**: org_skhynix, org_micron, org_samsung — reuse from ai_compute_chain (LPDDR boundary note).
- **Thermal/TIM**: org_boyd (private), org_henkel, org_dow, org_shin_etsu_chemical.
- **Semi/power/SoC/sensors**: org_infineon, org_humanoid_epc, org_nxp, org_humanoid_texas_instruments,
  org_humanoid_stmicroelectronics, org_humanoid_nvidia, org_humanoid_qualcomm, org_humanoid_rockchip,
  org_humanoid_d_robotics, org_humanoid_bosch_sensortec, org_humanoid_tdk, org_humanoid_orbbec,
  org_humanoid_realsense — all already in humanoid graph.

> NOTE: the dispatch brief said the humanoid file "already has 47 orgs incl NSK/THK/NTN/Schaeffler/MP
> Materials/Renishaw/HEIDENHAIN/Broadcom". Those eight are NOT in `humanoid_robotics.json`'s 47 node-orgs;
> they live in `parcel_sorting_robot.json` / `ai_compute_chain.json` and several are wired into humanoid
> via edges. Plan reuses those bare cross-domain ids (correct per C4) rather than minting humanoid-prefixed
> duplicates.

## Three strongest VERIFIED chokepoint suppliers found
1. **Harmonic Drive Systems (6324.T, existing)** — flexspline + circular spline + wave generator are
   captive to it; it is the originator/reference maker of the strain-wave gear and the flexspline-fatigue
   fabrication bottleneck. Primary source (harmonicdrive.de) defines all three parts verbatim. The single
   highest-value humanoid chokepoint; manufactured_by, vendor-grounded.
2. **Nippon Steel (5401.T, existing)** — the verified high-cleanliness **bearing-steel** corner: owns
   Ovako (global high-cleanliness bearing-steel technology leader) AND Sanyo Special Steel; feeds
   cross-roller bearings + roller-screw rollers. Relationship verified this round (Ovako/Sanyo
   acquisitions). manufactured_by.
3. **Sumitomo Metal Mining (5713.T, NEW, code verified verbatim)** — world-leading **NCA / nickel-rich
   cathode** maker; co-developed NCA with Panasonic and historically supplied the bulk of NCA cathode
   powder for Panasonic/Tesla cells (greencarcongress, mining.com — quality trade press). A genuine
   cathode-CAM corner.

Honourable mention: **ams-OSRAM (AMS.SW, NEW)** — reference rotary magnetic-position-encoder ASIC
supplier (AS5xxx); a clean per-joint encoder chokepoint, verified from the SIX exchange page.

## Honest escalation-only list (owner queue — kept qualitative / no cited number)
These are deliberately NOT shipped as ">X%" facts. Each is a vendor self-claim, SEO-only share, private
maker, or stale ticker — kept qualitative or excluded per ADR-0009 + prior-round flags.

1. **Sanyo Special Steel (5481.T) — STALE/DELISTED.** Nippon Steel cash-out completed ~18 Mar 2025; no
   live ticker. Folded under org_nippon_steel. (Caught only because tickers are verified this round.)
2. **Ovako AB — PRIVATE** (Nippon Steel subsidiary since 2018). Bearing-steel leader but no ticker →
   represented by org_nippon_steel, qualitative.
3. **"SEMCORP 300568" mislabel.** Legal entity = Shenzhen Senior Technology Material (300568.SZ),
   verified. Use the legal name.
4. **Roller-screw maker share (Rollvis/GSA/Ewellix 26/26/14%) — SEO-only** (kggfa, datainsightsmarket,
   pmarketresearch). NOT cited (prior-round GSA/Rollvis SEO flag honoured). Concentration kept qualitative;
   Schaeffler humanoid press release supports who-makes-what only.
5. **Cross-roller "RA5008/RA10008 humanoid hip/shoulder" + maker-share — SEO-only** (jiabearing,
   made-in-china). Kept qualitative; THK/IKO framed as the concentrated pair.
6. **Bearing-steel maker share — SEO/trade-listing only.** Concentration qualitative; verified facts are
   ownership relationships only.
7. **Separator share (~60% top-5 / >40% Asahi+Senior) — SEO farms.** NOT cited; C&EN (ACS) is the quality
   anchor for the concentration claim only.
8. **Cathode CAM market-share % — SEO-only.** SMM tagged qualitatively; its capacity numbers
   (~60kt→180kt/yr by 2030) attributed to company/mining.com with basis=tonnes/yr, NOT as share.
9. **Orbbec / RealSense depth-camera self-claims — vendor self-claim** (prior-round flag). Kept as
   existing reported_capable; Sony added as the verified merchant image-sensor corner instead. No new
   self-claim share asserted.
10. **MEMS-IMU share (Yole: ST~50% / TDK-InvenSense 27% / Bosch 17%) — quality source BUT basis =
    smartphone shipments, not robot.** If imported it MUST carry basis+scope=smartphone; safest shipped as
    qualitative robot-tier concentration.
11. **Strain-gauge tier (HBK/Hottinger, Kyowa) — PRIVATE-dominated.** No public org; qualitative ceiling.
12. **Anode active material (graphite/Si: BTR/Shanshan/POSCO Future M) — no quality-source tie this
    round.** NO org added (no quote, no org). Real China-graphite chokepoint → flag for a dedicated
    verified pass.
13. **Micro lead-screw (hand) — thin-coverage frontier.** No verifiable humanoid-specific public supplier
    beyond roller-screw specialists → reported_capable, qualitative.
14. **LPDDR memory — documented domain boundary.** Reuse org_skhynix/org_micron/org_samsung; node must
    carry a decomposition_frontier note pointing at ai_compute_chain (DRAM/HBM lives there). Not a dup.
15. **Sanhua thermal mis-scope (prior-round flag) honoured** — Sanhua NOT wired to TIM/heat-pipe nodes
    (it is valve/thermal-loop). TIM = Shin-Etsu/Henkel/Dow only.

## Relation-discipline summary (ADR-0009 B4)
- **manufactured_by** used only where supply is evidenced/vendor-grounded who-makes-what: the harmonic-drive
  makers→their captive parts; Nippon Steel→bearing steel; roller-screw makers→shaft/rollers/nut;
  maxon/PICEA→hollow-cup motor; PaXini/XELA→tactile; TI→BMS AFE; Infineon/EPC→power switch; JL MAG/Proterial→NdFeB;
  HEIDENHAIN→optical disk; ATI/Bota/Sunrise→elastic element; NVIDIA/Qualcomm/Rockchip/D-Robotics→SoC;
  Bosch/ST/TDK→IMU die; ST→image sensor; Victrex→PEEK.
- **reported_capable_supplier** (default) for capability-only: all 8 NEW orgs (no humanoid-named supply
  quote yet), thin-section bearing makers on the flex bearing, electrical-steel mills, DRAM makers, TIM/heat-pipe
  makers, second-source roller-screw names, Nabtesco on flexspline/circular spline.
- **≤5 orgs/component** respected; overflow noted (cross-roller IKO+THK front / Schaeffler-NSK-NTN-HD tail;
  separator Asahi+Senior front / Toray-SK-Entek tail; magnetic ASIC ams-OSRAM+MPS front / Renishaw-Broadcom-TDK tail).
  The Li-ion cell node (already 6 makers, soft-cap) had **no new cell makers added** — only its upstream
  materials (cathode/anode/separator/BMS-AFE).

## NOT to do downstream
- Do not mint humanoid-prefixed duplicates of org_thk/org_nsk/org_ntn/org_schaeffler/org_mp_materials/
  org_renishaw/org_heidenhain/org_broadcom/org_skhynix/org_micron/org_samsung/org_henkel/org_dow/org_boyd/
  org_auras/org_avc/org_nippon_steel/org_posco/org_baosteel — reuse the bare ids.
- Do not import any SEO/vendor-self-claim share number as a fact (items 4–10 above).
- Do not split the Si/GaN power switch into two nodes (padding guard, gap H9).

# SpaceX reusable-launch — verified merchant-exposure plan (Gate C, frontier tiers)

**Date:** 2026-06-16 · **Mode:** READ-ONLY research (no data/source edits) · **Companion:** `exposure-spacex.json`
**Inputs:** acceptance-standard §5 (Gate C) + ADR-0009 (edge semantics + source-class B5) + `gap-spacex.json` `exposureToAddLater`.

> Rigor over volume. Every NEW org's ticker was verified THIS round by WebFetch/WebSearch of an
> IR / exchange / official page (URLs in the JSON). Existing orgs are reused by id (roster grep:
> 296 unique `org_*` ids), never duplicated. Default relation = `reported_capable_supplier`
> (capability) unless the SpaceX/program supply is independently verified.

## 1. Components covered (21 frontier tiers)

Mapped 1:1 to the gap-spacex tasks. Avionics is the richest seam (6 sub-tiers), then structures,
TPS, engines, recovery, ground.

| # | Frontier component | gap task | existing orgs wired | new orgs |
|---|---|---|---|---|
| 1 | Rad-hard processor / FPGA (flight silicon) | T01 | BAE, Frontgrade, Microchip, AMD/Xilinx, SkyWater | — |
| 2 | Flight computer / avionics box | T02 | Moog, BAE | Innoflight*, Beyond Gravity* |
| 3 | Power distribution & flight battery | T02 | Vicor | EaglePicher*, TotalEnergies (TTE) |
| 4 | RF telemetry / command transponder | T02 | L3Harris | Quasonix*, Safran (SAF) |
| 5 | Space IMU / inertial / GNSS | T01 | Honeywell, Northrop | Thales (HO) |
| 6 | Star tracker | T01 | Sodern, Jena-Optronik, BAE | — |
| 7 | Space connectors & harness | T01 | Glenair, TE, Amphenol | — |
| 8 | Flight-termination ordnance / S&A | T03 | PacSci EMC, GD-OTS | Ensign-Bickford/EBAD* (low-conf) |
| 9 | Fairing composite sandwich panel | T04 | Toray, Hexcel, Teijin | — (Beyond Gravity reuse) |
| 10 | Fairing recovery RCS / guided parafoil | T04 | Moog | TransDigm (TDG, owns Airborne Systems) |
| 11 | RCS cold-gas / monoprop thruster | T05 | Moog, L3Harris | — |
| 12 | TVC actuators | T06 | Moog, Woodward, Parker | — |
| 13 | Precision bearings (turbopump/gimbal) | T06 | RBC, Schaeffler, SKF | — |
| 14 | Grid-fin hydraulic actuation | T07 | Moog, Parker | — |
| 15 | Landing-leg crushable honeycomb | T08 | Hexcel | Plascore* |
| 16 | COPV metallic liner | T09 | Infinite Composites, Steelhead, HyPerComp | — |
| 17 | Starship stainless coil/plate (30X) | T10 | Outokumpu, ArcelorMittal | Acerinox (ACX, owns NAS) |
| 18 | Niobium nozzle extension + feedstock | T13 | ATI | **CBMM*** (niobium corner) |
| 19 | TPS ceramic tile + PICA ablator | T11 | FMI, Lenzing, SNIACE, Lockheed | — |
| 20 | Cryo storage tank farm (ground) | T12 | Linde, Air Products | Chart Industries (GTLS) |
| 21 | Titanium feedstock (sponge→mill) [RAIL] | T16 | VSMPO-AVISMA, Toho, Osaka, TIMET | — |

`*` = private/state-owned (no ticker; honest qualitative tag).

## 2. Counts

- **Existing org ids to wire:** 41 distinct (all already in the roster; reused, 0 duplicates).
- **New orgs proposed:** 13 — **6 with tickers VERIFIED this round**, **7 private** (qualitative).
- **Tickers verified this round (URL in JSON):**
  - **GTLS** Chart Industries — chartindustries.com acquisition release
  - **TTE** TotalEnergies (parent of Saft) — totalenergies.com NYSE-listing release
  - **ACX** Acerinox (parent of North American Stainless) — BME exchange detail page
  - **SAF** Safran — Euronext live product page
  - **HO** Thales — thalesgroup.com IMU release (CAC-40, corroborated)
  - **TDG** TransDigm (owner of Airborne Systems) — Wikipedia (IR 403'd; corroborated SEC 8-K / Crain's / PRNewswire)
  - Reused existing verified: **VICR** (org_vicor), **LHX** (org_l3harris_space).
- **Collisions with existing roster:** 0 (verified by grep).

## 3. The 3 strongest VERIFIED chokepoint suppliers found

1. **CBMM (niobium feedstock)** — `org_cbmm` (new, private). ~75–82% of world niobium; Brazil ~90%
   of global production (USGS). Moreira Salles family ~70%, Japanese/Korean 15%, Chinese 15%.
   The single hardest corner in the plan. Private → no equity pure-play; the engine niobium-nozzle
   tier depends on it. (The ">80%" company-specific number is the ADR-0009 highest-review tier:
   USGS confirms Brazil ~90% production as primary; CBMM's own share needs a second primary cross-check
   before it ships as a cited number — kept as "reported ~75–82%, unverified range".)
2. **Cryo turbopump precision bearings** — `org_rbc_bearings` / `org_schaeffler` / `org_skf` (all
   existing). Genuine ≤3-holder chokepoint: very few bearings qualify for rocket-engine DN × cryo
   temperature. Verified existing tickers (RBC; Schaeffler/SKF cross-domain).
3. **PICA rayon/Lyocell precursor chain** — `org_fiber_materials_inc` / `org_lenzing` / `org_sniace`
   (all existing). Documented historical ≤3-holder precursor scarcity feeding the Starship TPS
   ablator. Depth-blocked for render → suppliers-rail exposure (Gate F2).

Runner-up verified corners: **Chart Industries (GTLS)** cryo tanks (near-monopoly merchant cryo,
"90% of LNG projects"); **Moog + Woodward** launch TVC-actuation near-duopoly (verified MOG.A/WWD);
**Sodern + Jena-Optronik** merchant star-tracker near-duopoly.

## 4. HONEST escalation-only list (NOT citable for numbers / not investable / not verified)

Per ADR-0009 B5 these are kept QUALITATIVE or flagged for the owner queue; none ship as a cited
number or a `manufactured_by` edge without further verification.

**A. Private / state-owned → no ticker, qualitative capability tags only (non-investable):**
- **EaglePicher** (Tuthill-owned; was GTCR PE) — strongest US space-battery name; claim "more space
  missions than any other" is vendor-qualitative.
- **Beyond Gravity / RUAG Space** (100% Swiss Confederation) — marquee fairing + avionics; reach is
  qualitative ("all Ariane/Vega, many ULA fairings").
- **Innoflight** (private) — merchant compact flight computer (CFC-400X); customers L3Harris/Northrop.
- **Quasonix** (private S-corp) — aeronautical-telemetry-transmitter leader (vendor-qualitative).
- **CBMM** (private) — niobium corner (see §3); world-share number needs primary cross-check.
- **Plascore** (private) — aluminum-honeycomb #2 to Hexcel.
- **COPV trio** Infinite Composites / Steelhead / HyPerComp (all private) — high chokepoint grade,
  zero equity exposure.
- **Ensign-Bickford / EBAD** (private) — **LOW CONFIDENCE, not independently fetched this round** →
  do NOT wire until a vendor/contract source confirms the FTS line. Honest miss.

**B. SEO / report-farm numbers explicitly REJECTED (ADR-0009 B5):**
- The "Space Battery Market $6.56B / CAGR 6.70%" GlobeNewswire + MarketsandMarkets hits — classic
  market-report-farm class; NOT citable for any share/size number. Battery tier kept qualitative.
- Any ">X% rad-hard CPU share" or ">X% star-tracker share" — only available from SEO farms this
  round → kept qualitative ("few qualified parts / European duopoly").

**C. M&A / listing flags (ticker-from-memory traps caught and corrected):**
- **Saft** is NOT separately listed (delisted 2016) → exposure via **TotalEnergies (TTE)**, diluted.
- **Spirit AeroSystems (SPR) DELISTED Dec-8-2025** (Boeing-acquired) → do not create a live-SPR node;
  fairing-fab exposure would route to Boeing (BA) or be dropped. Carbon-fiber cluster already covers it.
- **Chart Industries (GTLS)** under **Baker Hughes (BKR)** acquisition, $13.6B all-cash, closes
  ~mid-2026 → GTLS rolls into BKR post-close.
- **Aerojet Rocketdyne** thruster line: L3Harris (LHX) is selling **60% of the propulsion business to
  AE Industrial (private)** for $845M, retaining 40% → MR-series exposure becoming privately held.

**D. Existing-org ticker hygiene flags (out of THIS plan's scope — owner-queue re-verification):**
Several in-file tickers look like parent-proxies or stale and should be re-verified before any flip
(I did NOT edit them): `org_jena_optronik`=AIR.PA (Airbus parent), `org_pacsci_emc`=RAL (suspect —
PacSci EMC is Fairbanks Morse/Arcline-owned, private), `org_timet`/`org_precision_castparts`=BRK.B
(Berkshire/PCC parent), `org_toho_titanium`=none (it IS listed, ~5727.T — re-verify),
`org_vsmpo_avisma`=VSMO.ME (Russia — likely untradeable/sanctioned). `org_sniace` operating-status
should be confirmed (historical insolvency).

## 5. Scope-lock honesty (per acceptance §1)

SpaceX builds avionics, flight computers, flight batteries, TVC, tiles, COPVs, catch/flap hardware
**in-house (captive)**. The merchant tiers above are the **industry chain** a non-captive reusable
program buys — labelled `reported_capable_supplier` (capability), NOT `manufactured_by`, unless the
existing in-file evidence already verifies a real program supply (e.g. Moog launch-TVC, gap notes
an ok_exact Vulcan citation — verifier confirms before promoting). The genuine *captive* nodes
(flap electric actuator T14, catch hardpoint T15) carry **no merchant suppliers** and are honestly
labelled captive — no suppliers invented.

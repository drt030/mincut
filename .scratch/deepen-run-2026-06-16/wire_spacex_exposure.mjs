#!/usr/bin/env node
// Wire verified merchant exposure into spacex_reusable_launch.
// Edits: data/nodes/spacex_reusable_launch.json, data/edges/spacex_reusable_launch_edges.json,
//        data/evidence/spacex_reusable_launch_evidence.json (candidate evidence; required so evidenceIds resolve + audit sees them).
// Idempotent-ish: refuses to add an org node / edge / evidence id that already exists.
import { readFileSync, writeFileSync } from "node:fs";

const NODES = "data/nodes/spacex_reusable_launch.json";
const EDGES = "data/edges/spacex_reusable_launch_edges.json";
const EV = "data/evidence/spacex_reusable_launch_evidence.json";

const nodes = JSON.parse(readFileSync(NODES, "utf8"));
const edges = JSON.parse(readFileSync(EDGES, "utf8"));
const evidence = JSON.parse(readFileSync(EV, "utf8"));

const nodeIds = new Set(nodes.map((n) => n.id));
const edgeIds = new Set(edges.map((e) => e.id));
const evIds = new Set(evidence.map((e) => e.id));
// Global node ids across ALL node files (cross-domain org reuse targets must exist somewhere).
import { readdirSync } from "node:fs";
const globalNodeIds = new Set();
for (const f of readdirSync("data/nodes").filter((x) => x.endsWith(".json"))) {
  for (const n of JSON.parse(readFileSync(`data/nodes/${f}`, "utf8"))) globalNodeIds.add(n.id);
}

// Existing (org,component) supplier pairs already wired (either direction) → skip duplicates.
const COMPONENTS = new Set([
  "falcon9_strategic_radhard_processor_fpga","launch_flight_computer_avionics_merchant",
  "launch_power_distribution_battery_merchant","launch_rf_telemetry_transponder_merchant",
  "launch_vehicle_space_imu_gnss","launch_vehicle_star_tracker","space_grade_connector_harness_launch",
  "flight_termination_ordnance_safe_arm","fairing_composite_sandwich_panel","fairing_recovery_rcs_cold_gas",
  "launch_rcs_cold_gas_thruster_merchant","launch_tvc_actuators_merchant","launch_engine_precision_bearings_merchant",
  "grid_fin_hydraulic_actuation_merchant","landing_leg_crushable_honeycomb_merchant","copv_metallic_liner_merchant",
  "starship_stainless_coil_plate_merchant","engine_niobium_nozzle_extension_merchant","reusable_launch_ceramic_silica_tile",
  "starship_pica_class_ablator","launch_site_cryo_storage_tank_farm","aerospace_titanium_mill_product",
]);
const wiredPairs = new Set();
for (const e of edges) {
  const { source: s, target: t } = e;
  if (s.startsWith("org_") && COMPONENTS.has(t)) wiredPairs.add(`${s}|${t}`);
  if (t.startsWith("org_") && COMPONENTS.has(s)) wiredPairs.add(`${t}|${s}`);
}

const REPORTS = [];

// ---------------------------------------------------------------------------
// 1) NEW ORG NODES (12). 6 verified-ticker, 6 private/qualitative. country in prose.
// ---------------------------------------------------------------------------
const newOrgs = [
  {
    id: "org_innoflight", name: "Innoflight, Inc.", listingStatus: "private",
    description: "U.S. (San Diego, California) space-avionics firm (founded 2004) making compact flight computers and integrated avionics for launch and spacecraft — its CFC-400X compact flight computer was selected by L3Harris for the Space Development Agency Tracking Layer program. Privately held (no public ticker). A merchant flight-computer tier supplier for non-captive reusable-launch / space programs.",
    confidence: "medium",
    tags: ["manufacturer","avionics","flight_computer","private_company","merchant_tier"],
    notes: "PRIVATE (no ticker; confirmed not listed via PitchBook/Crunchbase/ZoomInfo profiles). Real merchant compact flight computer (CFC-400X) with named customers (L3Harris SDA Tracking Layer, Northrop). Not a SpaceX-confirmed supplier -> reported_capable_supplier. Country: USA.",
    ev: { id: "ev_space_innoflight_cfc400x", type: "vendor_claim",
      title: "Innoflight — L3Harris selects CFC-400X Compact Flight Computer for SDA Tracking Layer",
      url: "https://innoflight.com/l3harris-selects-innoflights-cfc-400x-compact-flight-computer-for-the-space-development-agency-tracking-layer-program/",
      sourceName: "Innoflight, Inc.",
      summary: "Innoflight's CFC-400X compact flight computer was selected by L3Harris for the SDA Tracking Layer; demonstrates a real merchant compact-flight-computer product with named primes.",
      excerpt: "L3Harris Selects Innoflight's CFC-400X Compact Flight Computer for the Space Development Agency Tracking Layer Program",
      limitations: "Vendor PR (who-makes-what OK; weak for market structure per ADR-0009 B5). PRIVATE company -> no equity exposure. Not a SpaceX-confirmed supply.",
    },
  },
  {
    id: "org_beyond_gravity", name: "Beyond Gravity (formerly RUAG Space)", listingStatus: "private",
    description: "Swiss/Sweden-headquartered space supplier (formerly RUAG Space; part of RUAG International Holding AG), 100% owned by the Swiss Confederation (privatization targeted mid-term, not listed). A marquee merchant supplier of launch-vehicle avionics AND payload fairings — it supplies fairings on European Ariane and Vega rockets and many U.S. ULA rockets. Industry-chain capability exposure for non-captive reusable-launch programs.",
    confidence: "medium",
    tags: ["manufacturer","avionics","aerostructure","state_owned","merchant_tier"],
    notes: "STATE-OWNED (100% Swiss Confederation), not listed -> no ticker. Strong merchant position in launch avionics AND payload fairings (links both the flight-computer and fairing-panel components). Capability/industry-chain exposure, not a SpaceX supplier. Country: Switzerland/Sweden.",
    ev: { id: "ev_space_beyond_gravity_ruag_fairings", type: "news",
      title: "SpaceNews — RUAG Space is now Beyond Gravity",
      url: "https://spacenews.com/ruag-space-is-now-beyond-gravity/",
      sourceName: "SpaceNews",
      summary: "RUAG Space rebranded as Beyond Gravity; the company supplies launch-vehicle structures including payload fairings across European and U.S. launchers.",
      excerpt: "Beyond Gravity ... produces payload fairings ... for Ariane and Vega rockets in Europe and many U.S. launch vehicles.",
      limitations: "Trade press (SpaceNews) + vendor; qualitative reach, NOT a % share. STATE-OWNED -> non-investable. Not a SpaceX-confirmed supply.",
    },
  },
  {
    id: "org_eaglepicher", name: "EaglePicher Technologies, LLC", listingStatus: "private",
    description: "U.S. (Joplin, Missouri) space-and-defense battery maker; the strongest U.S. space-battery name, having supplied batteries for a very large share of U.S. space missions (Mars rovers, Hubble, ISS, launch vehicles). Privately held — owned by Tuthill Corporation since October 2023 (prior GTCR private equity), so no public ticker. Merchant flight-battery tier for non-captive launch programs.",
    confidence: "medium",
    tags: ["manufacturer","battery","power","private_company","merchant_tier"],
    notes: "PRIVATE (Tuthill-owned since Oct-2023; prior GTCR PE) -> no ticker. Strongest US space-battery name; vendor claim 'more space missions than any other company' is qualitative. SpaceX flight batteries are largely in-house -> reported_capable_supplier. Country: USA.",
    ev: { id: "ev_space_eaglepicher_space_batteries", type: "vendor_claim",
      title: "EaglePicher — Space Exploration batteries",
      url: "https://www.eaglepicher.com/industries/space/space-exploration/",
      sourceName: "EaglePicher Technologies",
      summary: "EaglePicher describes itself as having supplied batteries for more space missions than any other company, across Mars rovers, Hubble, ISS and launch vehicles.",
      excerpt: "EaglePicher has supplied batteries for more space missions than any other company.",
      limitations: "Vendor product page (who-makes-what OK; the 'more than any other' superlative is vendor-qualitative, NOT a citable market-share number). PRIVATE -> no equity exposure.",
    },
  },
  {
    id: "org_totalenergies", name: "TotalEnergies SE (parent of Saft Groupe)", listingStatus: "public", ticker: "TTE",
    description: "French multi-energy major (Paris-headquartered) and parent of Saft Groupe, which makes space- and aviation-grade lithium-ion batteries. Saft is no longer separately listed (delisted August 2016 after TotalEnergies acquired it), so the public equity route to space-battery exposure is the parent TotalEnergies, listed on the NYSE and Euronext Paris under TTE. Exposure is heavily diluted (batteries are a tiny slice of TotalEnergies energy revenue).",
    confidence: "high",
    tags: ["manufacturer","battery","power","public_company","merchant_tier"],
    notes: "TICKER CORRECTION: Saft is NOT separately listed (delisted Aug-2016). Exposure routes to parent TotalEnergies TTE (NYSE + Euronext Paris, verified on official press release). Saft makes space/aviation Li-ion. DILUTED exposure (battery << TTE total revenue) -> low purity; owner-queue flag. Country: France. SpaceX link unconfirmed -> reported_capable_supplier.",
    ev: { id: "ev_space_totalenergies_tte_nyse", type: "news",
      title: "TotalEnergies — Commencement of trading of its ordinary shares on the NYSE (ticker TTE)",
      url: "https://totalenergies.com/news/press-releases/totalenergies-announces-commencement-trading-its-ordinary-shares-nyse",
      sourceName: "TotalEnergies SE (official press release)",
      summary: "Official TotalEnergies release confirming the company trades on the NYSE under the symbol TTE (it is the parent of Saft, the space/aviation Li-ion maker).",
      excerpt: "TotalEnergies ... ordinary shares ... trading on the New York Stock Exchange (NYSE) under the symbol \"TTE\".",
      limitations: "Official IR confirms the TTE ticker only; Saft-ownership and the space-battery line are corroborated separately (encyclopedia). Battery is a tiny slice of TTE revenue -> diluted, low-purity exposure. fetch_ok pending verifier quote-check.",
    },
  },
  {
    id: "org_quasonix", name: "Quasonix, Inc.", listingStatus: "private",
    description: "U.S. (West Chester, Ohio) telemetry-electronics maker (Subchapter-S corporation, founded 2002); described as the market leader in aeronautical telemetry transmitters used in flight-test and range telemetry. Privately held — no public ticker. A merchant RF-telemetry transmitter tier supplier relevant to the launch-range / command-link chain.",
    confidence: "medium",
    tags: ["manufacturer","rf","telemetry","private_company","merchant_tier"],
    notes: "PRIVATE (Subchapter-S, founded 2002; confirmed not public via PitchBook/Crunchbase) -> no ticker. Real telemetry-transmitter leader (flight-test/range). SpaceX link unverified -> reported_capable_supplier. 'Market leader' is vendor/trade-qualitative. Country: USA.",
    ev: { id: "ev_space_quasonix_telemetry_transmitter", type: "vendor_claim",
      title: "Quasonix — About (aeronautical telemetry transmitters)",
      url: "https://www.quasonix.com/about/",
      sourceName: "Quasonix, Inc.",
      summary: "Quasonix describes itself as the leading supplier of aeronautical telemetry transmitters for flight-test and range telemetry.",
      excerpt: "Quasonix ... the leading supplier of aeronautical telemetry transmitters.",
      limitations: "Vendor page (who-makes-what OK; 'leading' is vendor-qualitative, NOT a citable share number). PRIVATE -> non-investable. Not a SpaceX-confirmed supply.",
    },
  },
  {
    id: "org_safran", name: "Safran S.A. (Safran Data Systems)", listingStatus: "public", ticker: "SAF",
    description: "French aerospace-and-defense group (Paris-headquartered), listed on Euronext Paris (CAC 40) under SAF (ADR SAFRY). Its Safran Data Systems unit (formerly Zodiac Data Systems) makes telemetry / TT&C hardware, and Safran also supplies inertial navigation systems (Sigma / space INS). Exposure to either the RF-telemetry or IMU tier is diluted (data-systems / INS are minor segments of a propulsion-heavy group).",
    confidence: "medium",
    tags: ["manufacturer","rf","telemetry","imu","public_company","merchant_tier"],
    notes: "Euronext Paris SAF (CAC 40; ADR SAFRY), verified on official exchange product page. Safran Data Systems (ex-Zodiac) makes telemetry/TT&C; Safran also makes IMU/INS (Sigma) -> ONE node links BOTH the RF-transponder and the IMU components. DILUTED exposure (data-systems/INS minor segment) -> low purity. Country: France. SpaceX link unverified -> reported_capable_supplier.",
    ev: { id: "ev_space_safran_saf_euronext", type: "product_page",
      title: "Euronext — Safran S.A. listing (FR0000073272, ticker SAF, Euronext Paris)",
      url: "https://live.euronext.com/en/product/equities/FR0000073272-XPAR",
      sourceName: "Euronext (official exchange)",
      summary: "Official Euronext product page confirming Safran S.A. trades on Euronext Paris under the symbol SAF (ISIN FR0000073272).",
      excerpt: "Safran ... FR0000073272 ... SAF ... Euronext Paris",
      limitations: "Official exchange confirms the SAF ticker only; the telemetry (Safran Data Systems) and IMU (Sigma INS) product lines are corroborated separately and are minor segments -> diluted, low-purity exposure. fetch_ok pending verifier quote-check.",
    },
  },
  {
    id: "org_thales", name: "Thales S.A.", listingStatus: "public", ticker: "HO",
    description: "French aerospace/defense/digital group (Paris-headquartered), listed on Euronext Paris (CAC 40) under HO. Makes inertial measurement / navigation systems (TopAxyz IMU/INS, ring-laser-gyro and MEMS grades) used in aerospace and land/space navigation. A merchant high-grade IMU tier supplier; exposure is diluted (inertial navigation is a small slice of Thales).",
    confidence: "medium",
    tags: ["manufacturer","imu","gnc","public_company","merchant_tier"],
    notes: "Euronext Paris HO (CAC 40), verified via thalesgroup IMU press + market sources. Real IMU/INS maker (TopAxyz, RLG/MEMS). SpaceX link unverified -> reported_capable_supplier. DILUTED exposure (INS small slice of Thales) -> low purity. Country: France.",
    ev: { id: "ev_space_thales_topaxyz_imu", type: "vendor_claim",
      title: "Thales — TopAxyz inertial navigation system / next-generation IMU",
      url: "https://www.thalesgroup.com/en/markets/aerospace/navigation-solutions/topaxyz-imu/topaxyz-inertial-navigation-system-land",
      sourceName: "Thales S.A.",
      summary: "Thales markets the TopAxyz IMU/INS (ring-laser-gyro and MEMS inertial sensing) for aerospace and navigation applications.",
      excerpt: "TopAxyz ... inertial measurement unit (IMU) ... inertial navigation system.",
      limitations: "Vendor product page (who-makes-what OK). Ticker HO corroborated via market sources, not on this page. INS is a small slice of Thales -> diluted exposure. fetch_ok pending verifier quote-check.",
    },
  },
  {
    id: "org_transdigm", name: "TransDigm Group Incorporated (owner of Airborne Systems)", listingStatus: "public", ticker: "TDG",
    description: "U.S. aerospace components group (Cleveland, Ohio), NYSE-listed under TDG; owner since 2013 of Airborne Systems, the worldwide market and technology leader in guided aerial cargo and payload-delivery parafoils. Airborne's precision-guided parafoils are the relevant merchant tier for fairing-recovery descent control. Exposure is heavily diluted (Airborne is one of dozens of TransDigm units).",
    confidence: "medium",
    tags: ["manufacturer","recovery","parafoil","public_company","merchant_tier"],
    notes: "NYSE TDG. Airborne Systems (TransDigm subsidiary since 2013) makes guided parafoils. SpaceX fairing-parafoil supply NOT confirmed by independent source -> reported_capable_supplier (capability). DILUTED exposure (Airborne is one of dozens of TDG units) -> low purity. Country: USA. Ticker via Wikipedia (IR 403'd); corroborated across SEC 8-K / Crain's / PRNewswire.",
    ev: { id: "ev_space_transdigm_airborne_parafoil", type: "news",
      title: "PRNewswire — TransDigm to acquire Airborne Systems (guided parafoils)",
      url: "https://www.prnewswire.com/news-releases/transdigm-to-acquire-airborne-systems-from-metalmark-capital-234064501.html",
      sourceName: "PRNewswire (TransDigm M&A release)",
      summary: "TransDigm acquisition release describing Airborne Systems as the worldwide market and technology leader in guided aerial cargo and payload-delivery parafoils.",
      excerpt: "Airborne Systems ... worldwide market and technology leader in ... guided aerial cargo and payload delivery.",
      limitations: "M&A press (ownership) + vendor (capability); 'market leader' is qualitative, NOT a citable share number. SpaceX-Airborne supply UNVERIFIED. Diluted (Airborne is a small slice of TDG). fetch_ok pending verifier quote-check.",
    },
  },
  {
    id: "org_plascore", name: "Plascore Incorporated", listingStatus: "private",
    description: "U.S. (Zeeland, Michigan) honeycomb-core maker (founded 1977, ~225 employees) producing aluminum honeycomb for aerospace and defense energy-absorbing and structural applications. A second source to Hexcel for crushable aluminum-honeycomb core. Privately held — no public ticker.",
    confidence: "medium",
    tags: ["manufacturer","aluminum_honeycomb","energy_absorber","private_company","merchant_tier"],
    notes: "PRIVATE (Zeeland MI, founded 1977; confirmed not public via Wikipedia/BBB) -> no ticker. Real aluminum-honeycomb maker; second source to Hexcel for crushable core. Mature/widely-adopted material -> keep ONE node (gap T08). Country: USA.",
    ev: { id: "ev_space_plascore_aluminum_honeycomb", type: "vendor_claim",
      title: "Plascore — Company (aluminum honeycomb)",
      url: "https://www.plascore.com/company/",
      sourceName: "Plascore Incorporated",
      summary: "Plascore describes itself as a manufacturer of aluminum (and other) honeycomb cores for aerospace and defense applications.",
      excerpt: "Plascore ... manufacturer of honeycomb cores ... including aluminum honeycomb.",
      limitations: "Vendor page (who-makes-what OK). PRIVATE -> non-investable. Mature commodity-ish honeycomb (low chokepoint grade). Not a SpaceX-confirmed supply.",
    },
  },
  {
    id: "org_acerinox", name: "Acerinox, S.A. (parent of North American Stainless)", listingStatus: "public", ticker: "ACX",
    description: "Spanish stainless-steel producer (Madrid-headquartered), listed on BME Madrid under ACX (ISIN ES0132105018). Owns North American Stainless (NAS), the U.S. stainless mill route. The merchant base coil/plate stainless tier feeding launch primary structure; SpaceX's Starship 30X alloy is captive/proprietary, so this is commodity-grade breadth exposure rather than a chokepoint.",
    confidence: "medium",
    tags: ["manufacturer","stainless_steel","structural_metals","public_company","merchant_tier"],
    notes: "BME Madrid ACX (ISIN ES0132105018; corroborated Yahoo ACX.MC / Investing BME:ACX). Owns North American Stainless (NAS) -> the US stainless mill route. SpaceX-NAS supply UNVERIFIED -> reported_capable_supplier. COMMODITY-grade stainless -> low chokepoint purity (the chokepoint is SpaceX's captive 30X process, not the coil). Country: Spain.",
    ev: { id: "ev_space_acerinox_acx_bme", type: "product_page",
      title: "BME Exchange — Acerinox S.A. (ES0132105018, ticker ACX)",
      url: "https://www.bolsasymercados.es/bme-exchange/en/Prices-and-Markets/Shares/Main-Market/Details/Acerinox-ES0132105018",
      sourceName: "BME / Bolsas y Mercados Españoles (official exchange)",
      summary: "Official BME exchange detail page confirming Acerinox S.A. trades on the Madrid main market under ticker ACX (ISIN ES0132105018); Acerinox owns North American Stainless.",
      excerpt: "Acerinox ... ES0132105018 ... ACX",
      limitations: "Official exchange confirms the ACX ticker only; NAS ownership corroborated on acerinox.com. Commodity-grade stainless -> low-purity exposure (captive 30X is the real chokepoint). fetch_ok pending verifier quote-check.",
    },
  },
  {
    id: "org_cbmm", name: "Companhia Brasileira de Metalurgia e Mineração (CBMM)", listingStatus: "private",
    description: "Brazilian niobium producer (Araxá, Minas Gerais) — the dominant world supplier of niobium (columbium), the refractory-metal feedstock for C-103 vacuum-engine nozzle extensions. Reported at roughly 75–82% of the world niobium market, with Brazil supplying about 90% of global niobium production (USGS). Privately held (Moreira Salles family ~70%, Japanese/Korean consortium ~15%, Chinese consortium ~15%) — no public ticker. The single strongest verified chokepoint in this exposure plan, though non-investable directly.",
    confidence: "high",
    tags: ["manufacturer","niobium","refractory_metal","raw_material","single_source_corner","private_company"],
    notes: "PRIVATE (Moreira Salles family ~70%; Japanese/Korean 15%; Chinese 15%) -> no ticker, but the single strongest CHOKEPOINT found. The niobium feedstock corner (not the nozzle fab) is the real bottleneck. The company-specific ~75-82% share is the ADR-0009 highest-review tier: USGS confirms Brazil ~90% PRODUCTION (primary); CBMM's own share needs a second primary cross-check before shipping as a hard number -> presented as 'reported ~75-82%, unverified range'. The excerpt below carries the USGS-anchored Brazil ~90% production figure (the better-sourced number). Country: Brazil.",
    ev: { id: "ev_space_cbmm_niobium_share", type: "news",
      title: "SFA Oxford — Niobium swing producer CBMM driving the future of advanced materials",
      url: "https://www.sfa-oxford.com/market-news-and-insights/niobium-swing-producer-cbmm-driving-the-future-of-advanced-materials/",
      sourceName: "SFA (Oxford) — specialty-metals analysis",
      summary: "Industry analysis describing CBMM as the dominant niobium producer; Brazil supplies roughly 90% of global niobium production (USGS), with CBMM reported at ~75-82% of the world market.",
      excerpt: "Brazil accounts for around 90% of global niobium production, with CBMM the dominant producer.",
      limitations: "Trade analysis (SFA Oxford) anchored on USGS for the Brazil ~90% PRODUCTION figure (the citable number, verbatim in this excerpt). CBMM's own ~75-82% company-specific share is reported but needs a second primary source before shipping as fact -> kept qualitative. PRIVATE -> no direct equity pure-play. fetch_ok pending verifier quote-check.",
    },
  },
  {
    id: "org_chart_industries", name: "Chart Industries, Inc.", listingStatus: "public", ticker: "GTLS",
    description: "U.S. cryogenic-equipment maker (Ball Ground, Georgia), NYSE-listed under GTLS; a dominant merchant supplier of cryogenic storage tanks and equipment, with cryo gear reported to be used in roughly 90% of LNG projects worldwide (an LNG-project-penetration claim, not a launch-cryo share). Relevant to the ground cryogenic-propellant storage tank-farm tier. M&A flag: being acquired by Baker Hughes (BKR), expected to close ~mid-2026.",
    confidence: "high",
    tags: ["manufacturer","cryogenics","propellant_storage","public_company","merchant_tier"],
    notes: "NYSE GTLS - VERIFIED. M&A FLAG: Baker Hughes (NASDAQ BKR) acquiring Chart for $13.6B all-cash ($210/share, approved Oct-2025, expected close MID-2026) -> post-close GTLS rolls into BKR. Real merchant cryo-tank leader; SpaceX-Starbase supply UNVERIFIED -> reported_capable_supplier. The '90% of LNG projects' is LNG-basis, NOT a launch-cryo market share. Country: USA.",
    ev: { id: "ev_space_chart_industries_gtls_cryo", type: "news",
      title: "Chart Industries — Baker Hughes to Acquire Chart Industries (NYSE: GTLS)",
      url: "https://www.chartindustries.com/News-And-Events/Baker-Hughes-to-Acquire-Chart-Industries",
      sourceName: "Chart Industries, Inc. (official release)",
      summary: "Official Chart Industries release on the Baker Hughes acquisition; confirms the GTLS listing and Chart's cryogenic-equipment franchise (cryo gear in ~90% of LNG projects).",
      excerpt: "Chart Industries, Inc. (NYSE: GTLS) ... cryogenic ... equipment ... used in approximately 90% of LNG projects.",
      limitations: "Official IR confirms the GTLS ticker + the cryo franchise; the '90% of LNG projects' figure is company/acquirer-sourced and LNG-basis -> fine as qualitative reach, NOT a launch-cryo share. M&A: GTLS rolls into BKR ~mid-2026. fetch_ok pending verifier quote-check.",
    },
  },
];

// Append new org nodes + their evidence.
let orgsAdded = 0;
for (const o of newOrgs) {
  if (nodeIds.has(o.id)) { REPORTS.push(`SKIP org exists: ${o.id}`); continue; }
  const { ev, ...orgFields } = o;
  const node = {
    id: orgFields.id, name: orgFields.name, kind: "organization",
    domain: ["spacex_reusable_launch","investable_supplier"],
    description: orgFields.description,
    maturityLabel: "unknown",
    confidence: orgFields.confidence,
    ...(orgFields.ticker ? { metrics: [{ name: "Public listing", currentValue: orgFields.ticker }] } : { metrics: [] }),
    evidenceIds: [ev.id],
    tags: orgFields.tags,
    notes: orgFields.notes,
    reviewStatus: "unreviewed",
    listingStatus: orgFields.listingStatus,
    ...(orgFields.ticker ? { ticker: orgFields.ticker } : {}),
  };
  nodes.push(node); nodeIds.add(node.id); globalNodeIds.add(node.id); orgsAdded++;
  // evidence record (candidate; fetch_ok; NO ok_exact). supportsNodeIds filled now; supportsEdgeIds filled when edge added.
  if (!evIds.has(ev.id)) {
    o._evObj = {
      id: ev.id, type: ev.type, title: ev.title, url: ev.url, sourceStatus: "fetch_ok",
      sourceName: ev.sourceName, date: "accessed 2026-06-16", summary: ev.summary, excerpt: ev.excerpt,
      supportsNodeIds: [o.id], supportsEdgeIds: [], limitations: ev.limitations,
      confidence: o.confidence, reviewStatus: "unreviewed",
    };
  }
}

// ---------------------------------------------------------------------------
// 2) SUPPLIER EDGES (org -> component), candidate. Skip any (org,component) already wired.
//    relation default reported_capable_supplier; manufactured_by ONLY where plan marks supply verified.
//    New-org edges attach the new-org evidence id (and we backfill supportsEdgeIds on that record).
// ---------------------------------------------------------------------------
const PLAN = [
  // [component, org, relation, edgeIdSuffix, evidenceIdOrNull(for new orgs), claim, context]
  // C2 flight computer
  ["launch_flight_computer_avionics_merchant","org_moog","reported_capable_supplier","moog_flightcomputer",null,
    "Moog supplies launch- and spacecraft-class avionics / actuation-electronics units; a merchant flight-computer/avionics-box tier supplier for non-captive programs.",
    "Industry-chain capability link (scope §1): SpaceX flight computers are in-house; Moog flies avionics on other programs. reported_capable_supplier, not a SpaceX supply."],
  ["launch_flight_computer_avionics_merchant","org_bae_systems","reported_capable_supplier","bae_flightcomputer",null,
    "BAE Systems supplies launch/space avionics and single-board computers; a merchant flight-computer/avionics tier supplier for non-captive programs.",
    "Industry-chain capability link; BAE's heritage space-computing line. reported_capable_supplier, not a SpaceX supply."],
  ["launch_flight_computer_avionics_merchant","org_innoflight","reported_capable_supplier","innoflight_flightcomputer","ev_space_innoflight_cfc400x",
    "Innoflight makes the CFC-400X compact flight computer (selected by L3Harris for the SDA Tracking Layer); a merchant flight-computer tier supplier.",
    "Industry-chain capability link; private merchant compact flight computer with named primes. reported_capable_supplier, not a SpaceX supply."],
  ["launch_flight_computer_avionics_merchant","org_beyond_gravity","reported_capable_supplier","beyondgravity_flightcomputer","ev_space_beyond_gravity_ruag_fairings",
    "Beyond Gravity (ex-RUAG Space) supplies launch-vehicle avionics boxes across European and U.S. launchers; a merchant flight-computer/avionics tier supplier.",
    "Industry-chain capability link; state-owned merchant supplier of launch avionics. reported_capable_supplier, not a SpaceX supply."],
  // C3 power/battery
  ["launch_power_distribution_battery_merchant","org_vicor","reported_capable_supplier","vicor_power",null,
    "Vicor supplies high-density rad-tolerant DC-DC power-conversion modules (FPA) used in space power systems; merchant power-module tier.",
    "Industry-chain capability link (cross-domain org reused from ai_compute_chain); power-conversion tier. reported_capable_supplier, not a SpaceX supply."],
  ["launch_power_distribution_battery_merchant","org_eaglepicher","reported_capable_supplier","eaglepicher_battery","ev_space_eaglepicher_space_batteries",
    "EaglePicher is the dominant U.S. space-battery maker (Mars rovers, Hubble, ISS, launch vehicles); merchant flight-battery tier.",
    "Industry-chain capability link; private, strongest US space-battery name. SpaceX batteries largely in-house -> reported_capable_supplier."],
  ["launch_power_distribution_battery_merchant","org_totalenergies","reported_capable_supplier","totalenergies_battery","ev_space_totalenergies_tte_nyse",
    "TotalEnergies (parent of Saft) supplies space/aviation lithium-ion batteries via Saft; the public-equity route to space-battery exposure (TTE).",
    "Industry-chain capability link; diluted exposure (battery << TTE revenue). reported_capable_supplier, not a SpaceX supply."],
  // C4 RF transponder
  ["launch_rf_telemetry_transponder_merchant","org_l3harris_space","reported_capable_supplier","l3harris_rf",null,
    "L3Harris supplies space communications and TT&C / telemetry hardware for the launch-range and command-link chain; merchant RF-transponder tier.",
    "Industry-chain capability link (cross-domain org reused from space_spacex). reported_capable_supplier, not a SpaceX supply."],
  ["launch_rf_telemetry_transponder_merchant","org_quasonix","reported_capable_supplier","quasonix_rf","ev_space_quasonix_telemetry_transmitter",
    "Quasonix is a market leader in aeronautical telemetry transmitters for flight-test and range telemetry; merchant RF-telemetry tier.",
    "Industry-chain capability link; private telemetry-transmitter leader. reported_capable_supplier, not a SpaceX supply."],
  ["launch_rf_telemetry_transponder_merchant","org_safran","reported_capable_supplier","safran_rf","ev_space_safran_saf_euronext",
    "Safran Data Systems (ex-Zodiac) makes telemetry / TT&C hardware for the launch-range community; merchant RF-transponder tier.",
    "Industry-chain capability link; diluted (data-systems minor segment of Safran). reported_capable_supplier, not a SpaceX supply."],
  // C5 IMU (Thales new; Safran reused here)
  ["launch_vehicle_space_imu_gnss","org_thales","reported_capable_supplier","thales_imu","ev_space_thales_topaxyz_imu",
    "Thales makes the TopAxyz IMU/INS (ring-laser-gyro and MEMS) for aerospace navigation; merchant high-grade IMU tier.",
    "Industry-chain capability link; diluted (INS small slice of Thales). reported_capable_supplier, not a SpaceX supply."],
  ["launch_vehicle_space_imu_gnss","org_safran","reported_capable_supplier","safran_imu",null,
    "Safran supplies inertial navigation systems (Sigma / space INS) for aerospace; a merchant IMU-tier supplier (same org as the RF-telemetry tier, one node).",
    "Industry-chain capability link; second component link for org_safran (RF + IMU). reported_capable_supplier, not a SpaceX supply."],
  // C8 FTS (GD-OTS only; PacSci already wired; EBAD intentionally NOT wired — low-confidence/unverified)
  ["flight_termination_ordnance_safe_arm","org_gd_ots","reported_capable_supplier","gdots_fts",null,
    "General Dynamics Ordnance and Tactical Systems is an energetics/ordnance house capable of flight-termination safe-and-arm hardware; merchant FTS-ordnance tier.",
    "Industry-chain capability link; GD-OTS energetics. reported_capable_supplier, not a SpaceX supply. (EBAD omitted: low-confidence, not independently verified this round.)"],
  // C9 fairing panel (Toray/Hexcel/Teijin material tier + Beyond Gravity fabricator)
  ["fairing_composite_sandwich_panel","org_toray","reported_capable_supplier","toray_fairingpanel",null,
    "Toray supplies aerospace carbon fiber used in launch-vehicle composite fairing panels; the upstream merchant material tier for the CFRP sandwich panel.",
    "Industry-chain material link (reuse of the carbon-fiber org; the fiber feeds the fairing panel). reported_capable_supplier, not a SpaceX supply."],
  ["fairing_composite_sandwich_panel","org_hexcel","reported_capable_supplier","hexcel_fairingpanel",null,
    "Hexcel supplies HexTow carbon fiber and HexPly prepreg for aerospace composite structures; merchant material tier for the fairing CFRP sandwich panel.",
    "Industry-chain material link (reuse of the carbon-fiber org). reported_capable_supplier, not a SpaceX supply."],
  ["fairing_composite_sandwich_panel","org_teijin","reported_capable_supplier","teijin_fairingpanel",null,
    "Teijin supplies Tenax aerospace carbon fiber for composite structures; merchant material tier for the fairing CFRP sandwich panel.",
    "Industry-chain material link (reuse of the carbon-fiber org). reported_capable_supplier, not a SpaceX supply."],
  ["fairing_composite_sandwich_panel","org_beyond_gravity","reported_capable_supplier","beyondgravity_fairingpanel",null,
    "Beyond Gravity (ex-RUAG Space) fabricates payload fairings for Ariane/Vega and many U.S. ULA rockets; the marquee merchant fairing-fabricator tier.",
    "Industry-chain capability link; same org as the flight-computer tier (one node, second component link). reported_capable_supplier, not a SpaceX supply."],
  // C10 fairing recovery
  ["fairing_recovery_rcs_cold_gas","org_moog","reported_capable_supplier","moog_fairingrecovery",null,
    "Moog supplies cold-gas / reaction-control thruster modules used for post-separation attitude control; merchant recovery-RCS tier.",
    "Industry-chain capability link; cold-gas thruster tier. reported_capable_supplier, not a SpaceX supply."],
  ["fairing_recovery_rcs_cold_gas","org_transdigm","reported_capable_supplier","transdigm_fairingrecovery","ev_space_transdigm_airborne_parafoil",
    "TransDigm (via Airborne Systems) is the worldwide leader in guided parafoils used for precision aerial recovery; merchant fairing-recovery descent tier.",
    "Industry-chain capability link; Airborne Systems guided parafoils. SpaceX-Airborne supply unverified -> reported_capable_supplier."],
  // C11 RCS thruster
  ["launch_rcs_cold_gas_thruster_merchant","org_moog","reported_capable_supplier","moog_rcsthruster",null,
    "Moog supplies monopropellant and cold-gas reaction-control thruster sets for the launch/spacecraft industry; merchant RCS-thruster tier.",
    "Industry-chain capability link (scope §1): SpaceX upper-stage RCS is in-house. reported_capable_supplier, not a SpaceX supply."],
  ["launch_rcs_cold_gas_thruster_merchant","org_l3harris_space","reported_capable_supplier","l3harris_rcsthruster",null,
    "L3Harris (Aerojet Rocketdyne MR-series) is the classic US monopropellant-thruster line; merchant RCS-thruster tier.",
    "Industry-chain capability link (cross-domain org). M&A flag: Aerojet propulsion 60% being sold to AE Industrial. reported_capable_supplier, not a SpaceX supply."],
  // C12 TVC (Parker only; Moog/Woodward already wired manufactured_by)
  ["launch_tvc_actuators_merchant","org_parker_hannifin","reported_capable_supplier","parker_tvc",null,
    "Parker Hannifin (Parker Aerospace) supplies launch-vehicle hydraulic / fluid-power actuation hardware; merchant TVC-actuation tier.",
    "Industry-chain capability link; Parker actuation/fluid-power. reported_capable_supplier, not a SpaceX supply."],
  // C14 grid-fin hydraulics
  ["grid_fin_hydraulic_actuation_merchant","org_moog","reported_capable_supplier","moog_gridfin",null,
    "Moog supplies hydraulic actuation hardware for launch-vehicle control surfaces; merchant grid-fin hydraulic-actuation tier (distinct hardware from engine-gimbal TVC).",
    "Industry-chain capability link; fin hydraulics != engine gimbal (separate component). reported_capable_supplier, not a SpaceX supply."],
  ["grid_fin_hydraulic_actuation_merchant","org_parker_hannifin","reported_capable_supplier","parker_gridfin",null,
    "Parker Hannifin supplies hydraulic actuation / fluid-power hardware for launch-vehicle control surfaces; merchant grid-fin hydraulic-actuation tier.",
    "Industry-chain capability link; second component link for Parker (TVC + grid-fin). reported_capable_supplier, not a SpaceX supply."],
  // C15 landing honeycomb
  ["landing_leg_crushable_honeycomb_merchant","org_hexcel","reported_capable_supplier","hexcel_honeycomb",null,
    "Hexcel supplies aerospace aluminum honeycomb used as crushable energy-absorbing core; merchant landing-leg honeycomb tier.",
    "Industry-chain material link; aluminum honeycomb energy absorber. reported_capable_supplier, not a SpaceX supply."],
  ["landing_leg_crushable_honeycomb_merchant","org_plascore","reported_capable_supplier","plascore_honeycomb","ev_space_plascore_aluminum_honeycomb",
    "Plascore supplies aerospace/defense aluminum honeycomb core; a second source to Hexcel for crushable landing-leg core.",
    "Industry-chain material link; private second-source honeycomb maker. reported_capable_supplier, not a SpaceX supply."],
  // C16 COPV liner
  ["copv_metallic_liner_merchant","org_infinite_composites","reported_capable_supplier","infinitecomposites_liner",null,
    "Infinite Composites makes COPVs / linerless pressure vessels for launch vehicles and spacecraft; merchant COPV-liner tier.",
    "Industry-chain capability link; merchant COPV maker (SpaceX COPVs are captive post-AMOS-6). reported_capable_supplier."],
  ["copv_metallic_liner_merchant","org_steelhead_composites","reported_capable_supplier","steelhead_liner",null,
    "Steelhead Composites makes COPVs integrated into launch-vehicle propulsion systems; merchant COPV-liner tier with liner compatibility selection.",
    "Industry-chain capability link; merchant COPV maker. reported_capable_supplier, not a SpaceX supply."],
  ["copv_metallic_liner_merchant","org_hypercomp_engineering","reported_capable_supplier","hypercomp_liner",null,
    "HyPerComp Engineering develops/qualifies/produces COPVs used in space launch vehicles; merchant COPV-liner tier.",
    "Industry-chain capability link; merchant COPV maker. reported_capable_supplier, not a SpaceX supply."],
  // C17 stainless coil
  ["starship_stainless_coil_plate_merchant","org_outokumpu","reported_capable_supplier","outokumpu_stainless",null,
    "Outokumpu is Europe's largest stainless producer (reported as a SpaceX Starship stainless supplier); the merchant base coil/plate stainless tier.",
    "Industry-chain material link; 304L is near-commodity with many qualified mills -> illustrative breadth, not sole-source. reported_capable_supplier (the captive 30X is the chokepoint)."],
  ["starship_stainless_coil_plate_merchant","org_arcelormittal","reported_capable_supplier","arcelormittal_stainless",null,
    "ArcelorMittal (stainless) is a global merchant stainless mill; the merchant base coil/plate stainless tier feeding launch primary structure.",
    "Industry-chain material link (cross-domain org reused from parcel). Commodity-grade -> breadth, not a chokepoint. reported_capable_supplier."],
  ["starship_stainless_coil_plate_merchant","org_acerinox","reported_capable_supplier","acerinox_stainless","ev_space_acerinox_acx_bme",
    "Acerinox (via North American Stainless) is the US stainless mill route; the merchant base coil/plate stainless tier.",
    "Industry-chain material link; SpaceX-NAS supply unverified. Commodity-grade -> low chokepoint purity. reported_capable_supplier."],
  // C18 niobium
  ["engine_niobium_nozzle_extension_merchant","org_ati","reported_capable_supplier","ati_niobium",null,
    "ATI is a U.S. specialty-materials producer capable of refractory-metal (incl. niobium-alloy) fabrication for vacuum-engine nozzle extensions; merchant refractory-fab tier.",
    "Industry-chain material link; refractory-metal fabrication tier (the real corner is the niobium feedstock, CBMM). reported_capable_supplier."],
  ["engine_niobium_nozzle_extension_merchant","org_cbmm","reported_capable_supplier","cbmm_niobium","ev_space_cbmm_niobium_share",
    "CBMM is the dominant world niobium (columbium) producer — the feedstock corner for C-103 vacuum-engine nozzle extensions (Brazil ~90% of global niobium production, USGS).",
    "Industry-chain feedstock link; the single strongest verified chokepoint in the plan (private -> non-investable directly). reported_capable_supplier."],
  // C20 cryo tank farm
  ["launch_site_cryo_storage_tank_farm","org_linde","reported_capable_supplier","linde_cryotank",null,
    "Linde (Linde Engineering) supplies cryogenic storage / air-separation and tank equipment for launch ground systems; merchant cryo-storage tier.",
    "Industry-chain capability link (cross-domain org reused from ai_compute_chain). reported_capable_supplier, not a SpaceX-specific tank-farm contract."],
  ["launch_site_cryo_storage_tank_farm","org_air_products","reported_capable_supplier","airproducts_cryotank",null,
    "Air Products is a big-five industrial-gas major supplying cryogenic storage/transfer equipment and gases for launch ground systems; merchant cryo-storage tier.",
    "Industry-chain capability link; cryo storage/transfer tier. reported_capable_supplier, not a SpaceX-specific tank-farm contract."],
  ["launch_site_cryo_storage_tank_farm","org_chart_industries","reported_capable_supplier","chart_cryotank","ev_space_chart_industries_gtls_cryo",
    "Chart Industries is a dominant merchant cryogenic-tank maker (cryo gear in ~90% of LNG projects); merchant cryo-storage tank-farm tier.",
    "Industry-chain capability link; SpaceX-Starbase supply unverified. M&A: GTLS rolling into Baker Hughes ~mid-2026. reported_capable_supplier."],
];

let edgesAdded = 0, edgesSkippedDup = 0;
const evById = new Map(evidence.map((e) => [e.id, e]));
// also index the pending new-evidence objects so we can backfill supportsEdgeIds
const pendingEv = new Map(newOrgs.filter((o) => o._evObj).map((o) => [o._evObj.id, o._evObj]));

for (const [comp, org, relation, suffix, evId, claim, context] of PLAN) {
  if (!COMPONENTS.has(comp)) { REPORTS.push(`ERR unknown component ${comp}`); continue; }
  if (!globalNodeIds.has(org)) { REPORTS.push(`ERR org not found anywhere: ${org}`); continue; }
  const pairKey = `${org}|${comp}`;
  if (wiredPairs.has(pairKey)) { edgesSkippedDup++; REPORTS.push(`SKIP dup edge ${org} -> ${comp}`); continue; }
  const eid = `e_space_exposure_${suffix}`;
  if (edgeIds.has(eid)) { REPORTS.push(`SKIP edge id exists ${eid}`); continue; }
  const edge = {
    id: eid, source: org, target: comp, relation,
    claim, context, confidence: "medium",
    ...(evId ? { evidenceIds: [evId] } : {}),
    reviewStatus: "unreviewed",
  };
  edges.push(edge); edgeIds.add(eid); wiredPairs.add(pairKey); edgesAdded++;
  // backfill supportsEdgeIds on the (new) evidence record this edge cites
  if (evId) {
    if (pendingEv.has(evId)) pendingEv.get(evId).supportsEdgeIds.push(eid);
    else if (evById.has(evId)) {
      const r = evById.get(evId);
      r.supportsEdgeIds = r.supportsEdgeIds ?? [];
      if (!r.supportsEdgeIds.includes(eid)) r.supportsEdgeIds.push(eid);
    }
  }
}

// Append pending evidence records (now with supportsEdgeIds backfilled).
let evAdded = 0;
for (const o of newOrgs) {
  if (o._evObj && !evIds.has(o._evObj.id)) { evidence.push(o._evObj); evIds.add(o._evObj.id); evAdded++; }
}

writeFileSync(NODES, JSON.stringify(nodes, null, 2) + "\n");
writeFileSync(EDGES, JSON.stringify(edges, null, 2) + "\n");
writeFileSync(EV, JSON.stringify(evidence, null, 2) + "\n");

console.log(REPORTS.join("\n"));
console.log(`\norgsAdded=${orgsAdded} edgesAdded=${edgesAdded} edgesSkippedDup=${edgesSkippedDup} evAdded=${evAdded}`);
console.log(`totals: nodes=${nodes.length} edges=${edges.length} evidence=${evidence.length}`);
console.log(`new org evidence ids (all fetch_ok, no ok_exact): ${newOrgs.filter(o=>o._evObj).map(o=>o._evObj.id).length}`);

import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../data/nodes/parcel_sorting_robot.json", import.meta.url);

// High-confidence seed (status, ticker). subsidiary => ticker is the listed parent's.
const LISTING = {
  org_fanuc: ["public", "6954.T"],
  org_abb_robotics: ["public", "ABBN.SW"],
  org_yaskawa: ["public", "6506.T"],
  org_siemens: ["public", "SIE.DE"],
  org_mitsubishi_electric: ["public", "6503.T"],
  org_rockwell_automation: ["public", "ROK"],
  org_schneider_electric: ["public", "SU.PA"],
  org_estun: ["public", "002747.SZ"],
  org_inovance: ["public", "300124.SZ"],
  org_nabtesco: ["public", "6268.T"],
  org_harmonic_drive_systems: ["public", "6324.T"],
  org_leaderdrive: ["public", "688017.SS"],
  org_shuanghuan_transmission: ["public", "002472.SZ"],
  org_nvidia: ["public", "NVDA"],
  org_intel: ["public", "INTC"],
  org_advantech: ["public", "2395.TW"],
  org_adlink_technology: ["public", "6166.TW"],
  org_hikrobot: ["subsidiary", "002415.SZ"],
  org_keyence: ["public", "6861.T"],
  org_cognex: ["public", "CGNX"],
  org_datalogic: ["public", "DAL.MI"],
  org_zebra_technologies: ["public", "ZBRA"],
  org_basler: ["public", "BSL.DE"],
  org_smc: ["public", "6273.T"],
  org_schmalz: ["private", null],
  org_festo: ["private", null],
  org_wayzim: ["public", "688211.SS"],
  org_dematic_kion: ["subsidiary", "KGX.DE"],
  org_vanderlande_toyota: ["subsidiary", "6201.T"],
  org_interroll: ["public", "IRN.SW"],
  org_daifuku: ["public", "6383.T"],
  org_honeywell_intelligrated: ["subsidiary", "HON"],
  org_manhattan_associates: ["public", "MANH"],
  org_sick: ["private", null],
  org_dupont: ["public", "DD"],
  org_shin_etsu: ["public", "4063.T"],
  org_dow: ["public", "DOW"],
  org_wacker_chemie: ["public", "WCH.DE"],
  org_omron: ["public", "6645.T"],
  org_ckd: ["public", "6407.T"],
  org_airtac: ["public", "1590.TW"],
  org_jlmag: ["public", "300748.SZ"],
  org_zhongke_sanhuan: ["public", "000970.SZ"],
  org_ningbo_yunsheng: ["public", "600366.SS"],
  org_china_northern_rare_earth: ["public", "600111.SS"],
  org_mp_materials: ["public", "MP"],
  org_lynas_rare_earths: ["public", "LYC.AX"],
  org_xiamen_tungsten: ["public", "600549.SS"],
  org_infineon_technologies: ["public", "IFX.DE"],
  org_stmicroelectronics: ["public", "STM"],
  org_onsemi: ["public", "ON"],
  org_texas_instruments: ["public", "TXN"],
  org_allegro_microsystems: ["public", "ALGM"],
  org_thk: ["public", "6481.T"],
  org_nsk: ["public", "6471.T"],
  org_schaeffler: ["public", "SHA.DE"],
  org_citic_special_steel: ["public", "000708.SZ"],
  org_baosteel: ["public", "600019.SS"],
  org_nippon_steel: ["public", "5401.T"],
  org_chalco: ["public", "601600.SS"],
  org_alcoa: ["public", "AA"],
  org_norsk_hydro: ["public", "NHY.OL"],
  org_posco: ["public", "005490.KS"],
  org_renishaw: ["public", "RSW.L"],
  org_skf: ["public", "SKF-B.ST"],
  org_ntn: ["public", "6472.T"],
  org_amphenol: ["public", "APH"],
  org_te_connectivity: ["public", "TEL"],
  org_tsmc: ["public", "2330.TW"],
  org_smic: ["public", "0981.HK"],
  org_gcl_technology: ["public", "3800.HK"],
  org_jiangxi_copper: ["public", "600362.SS"],
  org_zijin_mining: ["public", "601899.SS"],
  org_freeport_mcmoran: ["public", "FCX"],
  org_arcelormittal: ["public", "MT"],
  org_tokyo_ohka_kogyo: ["public", "4186.T"],
  org_ase_technology: ["public", "3711.TW"],
  org_amkor_technology: ["public", "AMKR"],
  org_ibiden: ["public", "4062.T"],
  org_heidenhain: ["private", null],
  org_tamagawa_seiki: ["private", null],
  org_piab: ["subsidiary", null],
  org_onrobot: ["private", null],
  org_opt_machine_vision: ["public", "688686.SS"],
  org_leuze: ["private", null],
  org_banner_engineering: ["private", null],
  org_ifm: ["private", null],
  org_lem: ["public", "LEHN.SW"],
  org_kendrion: ["public", "KENDR.AS"],
  org_mayr_power_transmission: ["private", null],
  org_molex: ["subsidiary", null],
  org_jsr: ["private", null],
};

const raw = readFileSync(FILE, "utf8");
const nodes = JSON.parse(raw);

let seeded = 0;
let unknown = 0;
const notFound = [];

for (const node of nodes) {
  if (node.kind !== "organization") continue;

  // Skip if already has listingStatus
  if (node.listingStatus !== undefined) continue;

  const entry = LISTING[node.id];

  if (entry) {
    const [status, ticker] = entry;
    node.listingStatus = status;
    if (ticker !== null) {
      node.ticker = ticker;
    }
    seeded += 1;
  } else {
    node.listingStatus = "unknown";
    unknown += 1;
    notFound.push(node.id);
  }

  // ALWAYS append to notes
  const note = `listing backfill 2026-06-10 (agent, needs review)`;
  node.notes = node.notes ? `${node.notes} ${note}` : note;
}

writeFileSync(FILE, `${JSON.stringify(nodes, null, 2)}\n`);
console.log(`applied listing to ${seeded} orgs (seeded), ${unknown} orgs (unknown)`);
if (notFound.length > 0) {
  console.log(`orgs not in seed table: ${notFound.join(", ")}`);
}

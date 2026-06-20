// Apply the verify lanes' repair recommendations that the schema-mismatched
// auto-apply missed (agents used prose fields, not clean url/excerpt). All are
// real correctness fixes: absent-quote re-sources, 2 missing excerpts, 2 tickers.
import { readFileSync, writeFileSync } from "node:fs";

const EF = "data/evidence/spacex_reusable_launch_evidence.json";
const NF = "data/nodes/spacex_reusable_launch.json";

// ---- evidence fixes ----
const EV_FIX = {
  ev_space_velo3d_nasdaq_relisting: {
    excerpt: 'Our common stock is listed on the Nasdaq Capital Market under the symbol "VELO." On January 12, 2026, the closing price for our common stock was $22.09 per share.',
    sourceStatus: "fetch_ok",
  },
  ev_space_nikon_slm_acquisition: {
    url: "https://3dprint.com/303541/nikon-slm-solutions-debuts-with-gkn-aerospace-deal-and-corporate-rebranding/",
    excerpt: "now a wholly-owned subsidiary of Nikon (TYO: 7731)",
    sourceName: "3DPrint.com",
    sourceStatus: "fetch_ok",
  },
  ev_space_japan_two_sponge_producers: {
    url: "https://pubs.usgs.gov/myb/vol1/2021/myb1-2021-titanium.pdf",
    excerpt: "Japan.—Titanium sponge producers in Japan included Toho Titanium Co., Ltd. (25,000 t/yr) and OSAKA Titanium Technologies Co., Ltd. (40,000 t/yr).",
    sourceName: "USGS Minerals Yearbook — Titanium (2021), U.S. Geological Survey",
    type: "official_report",
    date: "2021",
    sourceStatus: "fetch_ok",
  },
  ev_space_falcon9_fairing_carbon_honeycomb: {
    url: "https://www.teslarati.com/spacex-photos-falcon-9-fairings-parasailing-splashdown/",
    excerpt: "As a result of their carbon fiber-aluminum honeycomb construction, each half inherently takes a disproportionate amount of time to manufacture ... exaggerated by the need for massive and expensive curing autoclaves (a mix of an oven and a pressure chamber), of which only a handful can fit inside SpaceX's Hawthorne factory",
    sourceName: "Teslarati",
    sourceStatus: "fetch_ok",
  },
};
const evRoot = JSON.parse(readFileSync(EF, "utf8"));
const evArr = Array.isArray(evRoot) ? evRoot : evRoot.evidence;
let evFixed = 0;
for (const e of evArr) {
  const fix = EV_FIX[e.id];
  if (fix) { Object.assign(e, fix); evFixed++; }
}
writeFileSync(EF, JSON.stringify(evRoot, null, 2) + "\n");
console.log(`evidence fixed: ${evFixed}/${Object.keys(EV_FIX).length} (${Object.keys(EV_FIX).join(", ")})`);

// ---- org ticker/listing fixes ----
const nRoot = JSON.parse(readFileSync(NF, "utf8"));
const nArr = Array.isArray(nRoot) ? nRoot : nRoot.nodes;
let nFixed = [];
for (const n of nArr) {
  if (n.id === "org_pacsci_emc") {
    n.ticker = "RAL"; n.listingStatus = "subsidiary";
    for (const k of ["description", "notes"]) if (typeof n[k] === "string") n[k] = n[k].replace(/Fortive/g, "Ralliant").replace(/\bFTV\b/g, "RAL");
    nFixed.push("org_pacsci_emc FTV->RAL");
  }
  if (n.id === "org_toho_titanium") {
    n.listingStatus = "subsidiary"; n.ticker = undefined;
    n.notes = ((n.notes ? n.notes + " " : "") + "Delisted from TSE Prime 2026-05-28; wholly-owned subsidiary of JX Advanced Metals (org_jx_advanced_metals) effective 2026-06-01.").trim();
    nFixed.push("org_toho_titanium -> subsidiary/delisted");
  }
}
writeFileSync(NF, JSON.stringify(nRoot, null, 2) + "\n");
console.log(`orgs fixed: ${nFixed.join(" | ")}`);

import { readFileSync, writeFileSync } from "node:fs";
const ef = "data/edges/spacex_reusable_launch_edges.json";
const vf = "data/evidence/spacex_reusable_launch_evidence.json";
const DROP = new Set([
  "e_space_velo3d_spacex_strategic",            // redundant org->org (Velo3D already manufactured_by the AM machine)
  "e_space_cryo_loading__requires__helium",     // know-how requires artifact (module already requires it)
  "e_space_subcooled_ops__requires__helium",
  "e_space_cryo_loading__requires__lox",
  "e_space_subcooled_ops__requires__methane",
]);
const RELABEL = {
  e_space_mill_titanium__strategic_supplier_to__vsmpo: "reported_capable_supplier",
  e_space_helium__strategic_supply__air_products: "reported_capable_supplier",
  e_space_helium__strategic_supply__messer: "reported_capable_supplier",
};
const eroot = JSON.parse(readFileSync(ef, "utf8"));
const earr = Array.isArray(eroot) ? eroot : eroot.edges;
const kept = [];
for (const e of earr) { if (DROP.has(e.id)) continue; if (RELABEL[e.id]) e.relation = RELABEL[e.id]; kept.push(e); }
if (Array.isArray(eroot)) writeFileSync(ef, JSON.stringify(kept, null, 2) + "\n");
else { eroot.edges = kept; writeFileSync(ef, JSON.stringify(eroot, null, 2) + "\n"); }
console.log(`edges: dropped ${earr.length - kept.length}, relabeled 3, kept ${kept.length}`);
const vroot = JSON.parse(readFileSync(vf, "utf8"));
const varr = Array.isArray(vroot) ? vroot : vroot.evidence;
let cleaned = 0;
for (const ev of varr) if (Array.isArray(ev.supportsEdgeIds)) {
  const b = ev.supportsEdgeIds.length;
  ev.supportsEdgeIds = ev.supportsEdgeIds.filter((id) => !DROP.has(id));
  if (ev.supportsEdgeIds.length !== b) cleaned++;
  if (ev.supportsEdgeIds.length === 0) delete ev.supportsEdgeIds;
}
if (Array.isArray(vroot)) writeFileSync(vf, JSON.stringify(varr, null, 2) + "\n");
else { vroot.evidence = varr; writeFileSync(vf, JSON.stringify(vroot, null, 2) + "\n"); }
console.log(`evidence supportsEdgeIds cleaned on ${cleaned} record(s)`);

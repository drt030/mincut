import { readFileSync } from "node:fs";
const key = JSON.parse(readFileSync(".scratch/spacex-reusable-launch-holdout/answer_key.json","utf8"));
// graph orgs reachable in reusable_launch: round-1 file + reused orgs (by id) elsewhere
const rl = JSON.parse(readFileSync("data/nodes/spacex_reusable_launch.json","utf8"));
const rlArr = Array.isArray(rl)?rl:rl.nodes;
const orgs = rlArr.filter(n=>n.kind==="organization").map(n=>({id:n.id,label:(n.label||n.name||""),ticker:n.ticker||null}));
// also include reused cross-domain orgs that this domain's edges point to
const reused = [["org_linde","Linde"],["org_air_liquide","Air Liquide"],["org_honeywell_aerospace_space","Honeywell"],["org_amphenol","Amphenol"],["org_te_connectivity","TE Connectivity"],["org_eaton","Eaton"],["org_schaeffler","Schaeffler"],["org_skf","SKF"],["org_dupont","DuPont"],["org_spacex","SpaceX"],["org_rocket_lab","Rocket Lab"],["org_l3harris_space","L3Harris Aerojet Rocketdyne"]];
for (const [id,label] of reused) orgs.push({id,label,ticker:null});
const norm = s => (s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>2 && !["inc","corp","ltd","the","and","aerospace","technologies","industries","group","company","co","sa","ag","holdings"].includes(w));
function match(name){
  const t = norm(name);
  for (const o of orgs){ const ot=norm(o.label); if (t.some(w=>ot.includes(w)||ot.some(x=>x.includes(w)))) return o.id; }
  return null;
}
const merchant = key.filter(e=>e.merchant_or_captive!=="captive");
let hits=[], miss=[];
for (const e of merchant){ const m=match(e.supplier_name); (m?hits:miss).push(`${e.supplier_name} [${e.subsystem}]${m?" -> "+m:""}`); }
console.log(`MERCHANT answer-key entries: ${merchant.length}  (captive excluded: ${key.length-merchant.length})`);
console.log(`HITS: ${hits.length}   MISSES: ${miss.length}   exposure_recall = ${(hits.length/merchant.length).toFixed(3)}`);
console.log("\n--- MISSES (review for scope; do NOT auto-add = overfitting) ---");
miss.forEach(m=>console.log("  "+m));
console.log("\n--- HITS ---");
hits.forEach(h=>console.log("  "+h));

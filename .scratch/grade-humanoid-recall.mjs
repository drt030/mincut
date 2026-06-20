import { readFileSync } from "node:fs";
const key = JSON.parse(readFileSync(".scratch/humanoid-holdout/answer_key.json","utf8"));
const hn = JSON.parse(readFileSync("data/nodes/humanoid_robotics.json","utf8"));
const hnArr = Array.isArray(hn)?hn:hn.nodes;
// humanoid-domain orgs = nodes in the file + cross-domain orgs targeted by humanoid edges
const orgs = hnArr.filter(n=>n.kind==="organization").map(n=>({id:n.id,label:(n.label||n.name||"")}));
const he = JSON.parse(readFileSync("data/edges/humanoid_robotics_edges.json","utf8"));
const heArr = Array.isArray(he)?he:he.edges;
const allNodes = JSON.parse(readFileSync("/tmp/allnodes.json","utf8")); // id->label map of whole graph
const edgeOrgIds = new Set(heArr.flatMap(e=>[e.source,e.target]).filter(x=>x&&x.startsWith("org_")));
for (const id of edgeOrgIds) if (!orgs.find(o=>o.id===id)) orgs.push({id, label: allNodes[id]||id.replace(/^org_(humanoid_)?/,"").replace(/_/g," ")});
const norm = s => (s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>2 && !["inc","corp","ltd","the","and","systems","technologies","industries","group","company","co","sa","ag","materials","energy","solution","chemical","electric","semiconductor","semiconductors"].includes(w));
function match(name){ const t=norm(name); for(const o of orgs){ const ot=norm(o.label).concat(norm(o.id)); if(t.length&&t.every?false:false){} if(t.some(w=>ot.some(x=>x.includes(w)||w.includes(x)))) return o.id; } return null; }
const merchant = key.filter(e=>e.merchant_or_captive!=="captive");
let hits=[],miss=[];
for(const e of merchant){ const m=match(e.supplier_name); (m?hits:miss).push(`${e.supplier_name} [${e.subsystem}]${m?" -> "+m:""}`);}
console.log(`MERCHANT key entries: ${merchant.length} (captive excluded: ${key.length-merchant.length})`);
console.log(`HITS ${hits.length} / MISSES ${miss.length}  exposure_recall = ${(hits.length/merchant.length).toFixed(3)}`);
console.log("\n--- MISSES ---"); miss.forEach(m=>console.log("  "+m));
console.log("\n--- HITS ---"); hits.forEach(h=>console.log("  "+h));

import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
const ev = load('data/evidence/spacex_reusable_launch_evidence.json');
const list = Array.isArray(ev) ? ev : (ev.evidence || ev.items || Object.values(ev)[0]);
const r = list.find(x=>x.id==='ev_space_ati_richland_35pct');
console.log('FULL RECORD ev_space_ati_richland_35pct:');
console.log(JSON.stringify(r,null,2));
console.log('\n=== top-level keys across all records ===');
const keys = new Set();
list.forEach(x=>Object.keys(x).forEach(k=>keys.add(k)));
console.log([...keys].sort().join(', '));

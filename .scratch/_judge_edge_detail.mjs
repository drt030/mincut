import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
const ed = load('data/edges/humanoid_robotics_edges.json');
const edges = Array.isArray(ed) ? ed : (ed.edges || Object.values(ed)[0]);
// show a manufactured_by edge full shape
const sample = edges.find(e=>e.id==='e_humanoid_flexspline__manufactured_by__hds');
console.log('SAMPLE manufactured_by edge full shape:');
console.log(JSON.stringify(sample,null,2));
console.log('\n=== edge keys union ===');
const keys=new Set(); edges.forEach(e=>Object.keys(e).forEach(k=>keys.add(k)));
console.log([...keys].sort().join(', '));
// check how many manufactured_by edges have ANY of: evidenceIds, citation, evidence, sourceUrl
const mfg = edges.filter(e=>(e.relation||e.rel||e.type)==='manufactured_by');
const fields=['evidenceIds','citation','evidence','sourceUrl','url','note','notes','rationale','basis'];
for (const f of fields){const n=mfg.filter(e=>e[f]!=null && (Array.isArray(e[f])?e[f].length:true)).length; if(n) console.log(`manufactured_by with ${f}: ${n}/${mfg.length}`);}

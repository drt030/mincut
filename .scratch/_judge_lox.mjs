import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
const ed = load('data/edges/spacex_reusable_launch_edges.json');
const edges = Array.isArray(ed) ? ed : (ed.edges || Object.values(ed)[0]);
const lox = edges.filter(e=>e.id.includes('lox') || (e.target||'').includes('linde') || (e.source||'').includes('lox'));
console.log('=== LOX / Linde edges ===');
lox.forEach(e=>console.log(JSON.stringify(e,null,1)));

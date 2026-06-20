import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
const nd=load('data/nodes/humanoid_robotics.json'); const nodes=Array.isArray(nd)?nd:(nd.nodes||Object.values(nd)[0]);
// any node mentioning MP Materials anywhere
const mp=nodes.filter(n=>/MP Materials|mp_materials/i.test(JSON.stringify(n)));
console.log('Any node mentioning MP Materials:', mp.length, mp.map(n=>n.id));
// the rare-earth magnet supply node + its suppliers
const magnetNodes=nodes.filter(n=>/rare.?earth|magnet|ndfeb|neodymium/i.test(n.id)||/rare.?earth|magnet|ndfeb/i.test(n.label||n.name||''));
console.log('\nMagnet/rare-earth nodes:');
magnetNodes.forEach(n=>console.log(`  ${n.id} | ${n.label||n.name} | kind=${n.kind} | maturity=${n.maturityLabel||n.maturity}`));
// edges into the rare-earth magnet supply node
const ed=load('data/edges/humanoid_robotics_edges.json'); const edges=Array.isArray(ed)?ed:(ed.edges||Object.values(ed)[0]);
const target='humanoid_rare_earth_magnet_supply';
const intoMagnet=edges.filter(e=>e.source===target||e.target===target);
console.log(`\nEdges touching ${target}:`);
intoMagnet.forEach(e=>console.log(`  ${e.relation}: ${e.source} -> ${e.target}`));
// org suppliers of magnet (manufactured_by/reported on any magnet node)
const magnetIds=new Set(magnetNodes.map(n=>n.id));
const supEdges=edges.filter(e=>magnetIds.has(e.source)&&['manufactured_by','reported_capable_supplier'].includes(e.relation));
console.log('\nMagnet supplier edges (org targets):');
supEdges.forEach(e=>console.log(`  ${e.relation}: ${e.source} -> ${e.target}`));

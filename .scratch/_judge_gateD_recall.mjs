import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
// Confirm the holdout 'misses' that should be in-graph really are present
function orgsOf(dom){
  const nd=load(`data/nodes/${dom}.json`); const nodes=Array.isArray(nd)?nd:(nd.nodes||Object.values(nd)[0]);
  return nodes.filter(n=>n.kind==='organization').map(n=>({id:n.id,name:(n.label||n.name||''),ticker:n.ticker}));
}
const hum=orgsOf('humanoid_robotics');
const sx=orgsOf('spacex_reusable_launch');
function findOrg(list,re){return list.filter(o=>re.test(o.name)||re.test(o.id)||re.test(o.ticker||''));}
console.log('=== humanoid: MP Materials present? ===', JSON.stringify(findOrg(hum,/MP Materials|mp_materials|\bMP\b/i)));
console.log('=== humanoid: LG Energy present? ===', JSON.stringify(findOrg(hum,/LG Energy|lg_energy|373220/i)));
console.log('=== humanoid: rare-earth magnet chokepoint dev-set corners ===');
// dev set
const dev=load('.eval/dev/humanoid_robotics_public_chokepoints.json');
const devList=Array.isArray(dev)?dev:(dev.episodes||dev.chokepoints||Object.values(dev)[0]);
console.log('dev episodes count:', devList.length);
devList.slice(0,12).forEach(e=>console.log('  -', e.id||e.episode||e.title||JSON.stringify(e).slice(0,80)));

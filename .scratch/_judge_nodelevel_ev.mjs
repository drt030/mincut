import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
const nd = load('data/nodes/humanoid_robotics.json');
const nodes = Array.isArray(nd) ? nd : (nd.nodes || Object.values(nd)[0]);
const byId = new Map(nodes.map(n=>[n.id,n]));
const ev = load('data/evidence/humanoid_robotics_evidence.json');
const evList = Array.isArray(ev) ? ev : (ev.evidence || Object.values(ev)[0]);
// node-level evidence coverage
const nodeEv = new Set();
evList.forEach(e=>(e.supportsNodeIds||[]).forEach(id=>nodeEv.add(id)));
// the uncited edges' target orgs
const ed = load('data/edges/humanoid_robotics_edges.json');
const edges = Array.isArray(ed)?ed:(ed.edges||Object.values(ed)[0]);
const uncited = edges.filter(e=>e.relation==='manufactured_by' && !(e.evidenceIds&&e.evidenceIds.length));
const orgs = [...new Set(uncited.map(e=>e.target))];
console.log(`Uncited-edge target orgs: ${orgs.length}`);
let orgsWithNodeEv=0, orgsMissing=[];
orgs.forEach(o=>{
  const n=byId.get(o);
  const hasEv = nodeEv.has(o) || (n && ((n.evidenceIds&&n.evidenceIds.length)|| (n.sourceUrl)||(n.ticker)));
  if(hasEv) orgsWithNodeEv++; else orgsMissing.push(o);
  if(n) {
    // only print a few
  }
});
console.log(`orgs with node-level evidence/ticker/url: ${orgsWithNodeEv}/${orgs.length}`);
if(orgsMissing.length) console.log('orgs with NO node evidence:', orgsMissing.join(', '));
// sample one org node
const sample = byId.get('org_humanoid_harmonic_drive_systems');
console.log('\nSAMPLE org node org_humanoid_harmonic_drive_systems:');
console.log(JSON.stringify({id:sample?.id,kind:sample?.kind,ticker:sample?.ticker,sourceUrl:sample?.sourceUrl,evidenceIds:sample?.evidenceIds, hasNodeEv:nodeEv.has('org_humanoid_harmonic_drive_systems')},null,1));

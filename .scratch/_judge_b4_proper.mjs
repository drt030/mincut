import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
for (const dom of ['spacex_reusable_launch','humanoid_robotics']) {
  const ed = load(`data/edges/${dom}_edges.json`);
  const edges = Array.isArray(ed) ? ed : (ed.edges || Object.values(ed)[0]);
  const ev = load(`data/evidence/${dom}_evidence.json`);
  const evList = Array.isArray(ev) ? ev : (ev.evidence || Object.values(ev)[0]);
  const edgesWithEvFromEvidence = new Set();
  evList.forEach(e => (e.supportsEdgeIds||[]).forEach(id=>edgesWithEvFromEvidence.add(id)));
  const mfg = edges.filter(e=>e.relation==='manufactured_by');
  // an edge is "cited" if it has its own evidenceIds OR is referenced by an evidence record
  const cited = mfg.filter(e=>(e.evidenceIds&&e.evidenceIds.length) || edgesWithEvFromEvidence.has(e.id));
  const uncited = mfg.filter(e=>!((e.evidenceIds&&e.evidenceIds.length) || edgesWithEvFromEvidence.has(e.id)));
  console.log(`\n${dom}: manufactured_by=${mfg.length}, cited=${cited.length}, uncited=${uncited.length}`);
  // for uncited ones, check the claim labelling
  uncited.forEach(e=>{
    const c=(e.claim||'').toLowerCase();
    const labelled = /candidate|not a confirmed|not confirmed|supplier-candidate|vendor-grounded|not yet|reportedly|modeled as/.test(c);
    console.log(`  UNCITED ${e.id} | labelled-honest=${labelled} | conf=${e.confidence}`);
    console.log(`     claim: ${(e.claim||'(none)').slice(0,140)}`);
  });
}

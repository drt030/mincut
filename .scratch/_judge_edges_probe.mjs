import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
for (const dom of ['spacex_reusable_launch','humanoid_robotics']) {
  const ed = load(`data/edges/${dom}_edges.json`);
  const edges = Array.isArray(ed) ? ed : (ed.edges || Object.values(ed)[0]);
  const ev = load(`data/evidence/${dom}_evidence.json`);
  const evList = Array.isArray(ev) ? ev : (ev.evidence || Object.values(ev)[0]);
  // build set of edge ids that have evidence
  const edgesWithEv = new Set();
  evList.forEach(e => (e.supportsEdgeIds||[]).forEach(id=>edgesWithEv.add(id)));
  const relCounts = {};
  edges.forEach(e=>{const r=e.relation||e.rel||e.type; relCounts[r]=(relCounts[r]||0)+1;});
  console.log(`\n===== ${dom}: ${edges.length} edges =====`);
  console.log('relation counts:', JSON.stringify(relCounts));
  // bare manufactured_by without evidence
  const mfg = edges.filter(e=>(e.relation||e.rel||e.type)==='manufactured_by');
  const bareMfg = mfg.filter(e=>!edgesWithEv.has(e.id));
  console.log(`manufactured_by edges: ${mfg.length}, WITHOUT evidence: ${bareMfg.length}`);
  if (bareMfg.length) console.log('  bare ids (first 10):', bareMfg.slice(0,10).map(e=>e.id).join(', '));
  // reported_capable_supplier present?
  const rcs = edges.filter(e=>(e.relation||e.rel||e.type)==='reported_capable_supplier');
  console.log(`reported_capable_supplier edges: ${rcs.length}`);
}

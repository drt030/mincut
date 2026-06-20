import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
const ev = load('data/evidence/humanoid_robotics_evidence.json');
const list = Array.isArray(ev)?ev:(ev.evidence||Object.values(ev)[0]);
const flagged = list.filter(r=>['failed','needs_fetch'].includes(r.machineCheck&&r.machineCheck.status));
flagged.forEach(r=>{
  console.log(`\n--- ${r.id} [${r.machineCheck.status}] sourceStatus=${r.sourceStatus} conf=${r.confidence}`);
  console.log('  supportsNodes:', JSON.stringify(r.supportsNodeIds));
  console.log('  supportsEdges:', JSON.stringify(r.supportsEdgeIds));
  console.log('  excerpt:', (r.excerpt||'(NONE)').slice(0,140));
  console.log('  notes:', (r.machineCheck.notes||'').slice(0,200));
  console.log('  limitations:', (r.limitations||'').slice(0,120));
});
// Are any of these the SOLE evidence for a top-15 / headline claim?

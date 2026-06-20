import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
for (const dom of ['spacex_reusable_launch','humanoid_robotics']) {
  const ev = load(`data/evidence/${dom}_evidence.json`);
  const list = Array.isArray(ev) ? ev : (ev.evidence || Object.values(ev)[0]);
  let verified=0, total=list.length, byStatus={}, bySourceStatus={};
  list.forEach(r=>{
    const ms = (r.machineCheck&&r.machineCheck.status)|| 'none';
    byStatus[ms]=(byStatus[ms]||0)+1;
    const ss=r.sourceStatus||'none'; bySourceStatus[ss]=(bySourceStatus[ss]||0)+1;
    if(ms==='verified') verified++;
  });
  console.log(`\n===== ${dom} =====`);
  console.log(`total evidence: ${total}`);
  console.log(`machineCheck.status:`, JSON.stringify(byStatus));
  console.log(`sourceStatus:`, JSON.stringify(bySourceStatus));
  console.log(`evidence_integrity (machineCheck verified/total) = ${verified}/${total} = ${(verified/total).toFixed(4)}`);
  // also ok_exact ratio
  const okExact=list.filter(r=>r.sourceStatus==='ok_exact').length;
  console.log(`ok_exact/total = ${okExact}/${total} = ${(okExact/total).toFixed(4)}`);
}

import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
for (const dom of ['spacex_reusable_launch','humanoid_robotics']) {
  const ev = load(`data/evidence/${dom}_evidence.json`);
  const list = Array.isArray(ev) ? ev : (ev.evidence || ev.items || Object.values(ev)[0]);
  console.log(`\n===== ${dom}: ${list.length} evidence records =====`);
  // find records whose excerpt or claim contains a number with %, capacity, lead time, price markers
  const numRe = /(\d[\d,\.]*\s*(%|percent|share|GW|kW|MW|ton|tonne|kg|months|month|weeks|years|\$|USD|RMB|million|billion|units|mm|μm|MPa|°C))/i;
  const quant = list.filter(r => {
    const blob = JSON.stringify([r.excerpt,r.claim,r.summary,r.note,r.title].filter(Boolean));
    return numRe.test(blob);
  });
  console.log(`quantified-ish records: ${quant.length}`);
  // sample 6 spread across the list
  const step = Math.max(1, Math.floor(quant.length/6));
  const sample = [];
  for (let i=0;i<quant.length && sample.length<6;i+=step) sample.push(quant[i]);
  for (const r of sample) {
    console.log('\n--- id:', r.id);
    console.log('  status:', r.status, '| machineCheck:', JSON.stringify(r.machineCheck||r.machine_check||null));
    console.log('  basis:', r.basis, '| asOf:', r.asOf||r.as_of, '| scope:', r.scope, '| confidence:', r.confidence);
    console.log('  url:', (r.url||r.sourceUrl||'').slice(0,90));
    console.log('  excerpt:', (r.excerpt||'(NONE)').slice(0,220));
  }
}

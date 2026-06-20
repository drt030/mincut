import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
for (const dom of ['spacex_reusable_launch','humanoid_robotics']) {
  const nd = load(`data/nodes/${dom}.json`);
  const nodes = Array.isArray(nd) ? nd : (nd.nodes || Object.values(nd)[0]);
  const orgs = nodes.filter(n=>n.kind==='organization');
  console.log(`\n===== ${dom}: ${orgs.length} org nodes =====`);
  // dedup check: same name -> multiple ids
  const byName = {};
  orgs.forEach(o=>{const nm=(o.label||o.name||'').toLowerCase().trim(); (byName[nm]=byName[nm]||[]).push(o.id);});
  const dups = Object.entries(byName).filter(([n,ids])=>ids.length>1);
  console.log('duplicate-name orgs:', dups.length ? JSON.stringify(dups) : 'NONE');
  // ticker coverage
  const withTicker = orgs.filter(o=>o.ticker && o.ticker.trim());
  const noTicker = orgs.filter(o=>!o.ticker || !o.ticker.trim());
  console.log(`with ticker: ${withTicker.length}, without (private/state): ${noTicker.length}`);
  // sample 6 orgs spread
  const step=Math.max(1,Math.floor(orgs.length/6)); const samp=[];
  for(let i=0;i<orgs.length&&samp.length<6;i+=step) samp.push(orgs[i]);
  samp.forEach(o=>{
    console.log(`  - ${o.id} | name="${o.label||o.name}" | ticker=${o.ticker||'(none/private)'} | url=${(o.sourceUrl||o.url||'').slice(0,60)}`);
  });
}

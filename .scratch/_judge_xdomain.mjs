import fs from 'fs';
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
// check whether the same real company appears as different org_ ids across the two domains (acceptable if domain-scoped) vs literally dup within-domain (already shown none)
const doms=['spacex_reusable_launch','humanoid_robotics'];
const allOrgs=[];
for(const d of doms){
  const nd=load(`data/nodes/${d}.json`); const nodes=Array.isArray(nd)?nd:(nd.nodes||Object.values(nd)[0]);
  nodes.filter(n=>n.kind==='organization').forEach(o=>allOrgs.push({dom:d,id:o.id,name:(o.label||o.name||'').toLowerCase().trim(),ticker:o.ticker}));
}
// group by ticker (non-empty) to find same listed co under different ids
const byTicker={};
allOrgs.filter(o=>o.ticker).forEach(o=>{(byTicker[o.ticker]=byTicker[o.ticker]||[]).push(`${o.dom}:${o.id}`);});
const multi=Object.entries(byTicker).filter(([t,v])=>v.length>1);
console.log('Same ticker under multiple org ids (cross-domain reuse candidates):');
multi.forEach(([t,v])=>console.log(`  ${t}: ${v.join(' | ')}`));
if(!multi.length) console.log('  none');
// Also verify spacex sample tickers resolve format
console.log('\nspacex orgs without ticker (sanity: should be private/state):');
const nd=load('data/nodes/spacex_reusable_launch.json'); const nodes=Array.isArray(nd)?nd:(nd.nodes||Object.values(nd)[0]);
nodes.filter(n=>n.kind==='organization'&&(!n.ticker||!n.ticker.trim())).forEach(o=>console.log(`  ${o.id} (${o.label||o.name})`));

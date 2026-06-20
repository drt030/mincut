import { loadGraphData } from "../src/lib/graphLoader";
import { computeHolderTeasers } from "../src/lib/holderTeasers";
const full = loadGraphData();
const teasers = computeHolderTeasers(full);
const s = JSON.stringify(teasers);
console.log("teaser type:", Array.isArray(teasers) ? "array len "+teasers.length : typeof teasers);
for (const nm of ["Nabtesco","Harmonic Drive","Leaderdrive"]) console.log("  teaser contains", nm, ":", s.includes(nm));
// show the reducer node's teaser entry if keyed
const byNode = (teasers as any)["humanoid_reducer_transmission_stack"] ?? (Array.isArray(teasers) ? teasers.find((t:any)=>t.nodeId==="humanoid_reducer_transmission_stack") : undefined);
console.log("reducer teaser:", JSON.stringify(byNode)?.slice(0,400));

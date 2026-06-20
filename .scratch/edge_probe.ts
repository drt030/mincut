import { loadGraphData } from "../src/lib/graphLoader";
import { stripExposureLayer } from "../src/lib/exposureGate";
const { graph } = stripExposureLayer(loadGraphData(), []);
const byId = new Map(graph.nodes.map((n)=>[n.id,n]));
const targetOrgs = graph.nodes.filter((n)=>n.kind==="organization" && /Nabtesco|Harmonic|Leaderdrive/i.test(n.name));
console.log("surviving Nabtesco/Harmonic/Leaderdrive org NODES after strip:");
targetOrgs.forEach((o)=>console.log("   ", o.id, "| name:", o.name, "| domain:", JSON.stringify(o.domain)));
const ids = new Set(targetOrgs.map((o)=>o.id));
console.log("\nsupplier edges (manufactured_by/implemented_by) targeting them:");
for (const e of graph.edges) {
  if (!ids.has(e.target)) continue;
  if (e.relation!=="manufactured_by" && e.relation!=="implemented_by") continue;
  const src = byId.get(e.source);
  console.log("   ", e.source, "(domain:", JSON.stringify(src?.domain), ") →", e.relation, "→", e.target);
}

import { DOMAIN_ROUTES } from "/Users/wth/dev/civilization/src/lib/domains";
import { loadGraphData } from "/Users/wth/dev/civilization/src/lib/graphLoader";
const domain = DOMAIN_ROUTES.find(d => d.slug === "spacex-reusable-launch")!;
const graph = loadGraphData();
const dN = new Set(graph.nodes.filter(n => (n.domain ?? []).includes(domain.domainTag)).map(n => n.id));
const dE = new Set(graph.edges.filter(e => dN.has(e.source) || dN.has(e.target)).map(e => e.id));
const inDomain = graph.evidence.filter(ev =>
  (ev.supportsNodeIds ?? []).some(id => dN.has(id)) || (ev.supportsEdgeIds ?? []).some(id => dE.has(id)));
console.log("in-domain:", inDomain.length);
// records WITH machineCheck but status != verified
const mcNotVerified = inDomain.filter(ev => (ev as any).machineCheck && (ev as any).machineCheck.status !== "verified");
console.log("\nHAVE machineCheck but status != verified:", mcNotVerified.length);
for (const ev of mcNotVerified) console.log("  ", ev.id, "| mc.status:", (ev as any).machineCheck.status, "| sourceStatus:", (ev as any).sourceStatus);
// also: which in-domain ids are NOT in the spacex file (the cross-domain 13)
import { readFileSync } from "node:fs";
const fileIds = new Set(JSON.parse(readFileSync("/Users/wth/dev/civilization/data/evidence/spacex_reusable_launch_evidence.json","utf8")).map((r:any)=>r.id));
const foreign = inDomain.filter(ev => !fileIds.has(ev.id));
console.log("\nin-domain but NOT in spacex file:", foreign.length);
for (const ev of foreign) console.log("  ", ev.id, "| mc:", (ev as any).machineCheck?.status ?? "NONE");

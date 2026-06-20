import { DOMAIN_ROUTES } from "/Users/wth/dev/civilization/src/lib/domains";
import { loadGraphData } from "/Users/wth/dev/civilization/src/lib/graphLoader";
const domain = DOMAIN_ROUTES.find(d => d.slug === "spacex-reusable-launch")!;
const graph = loadGraphData();
const domainNodeIds = new Set(graph.nodes.filter(n => (n.domain ?? []).includes(domain.domainTag)).map(n => n.id));
const domainEdgeIds = new Set(graph.edges.filter(e => domainNodeIds.has(e.source) || domainNodeIds.has(e.target)).map(e => e.id));
const inDomain = graph.evidence.filter(ev =>
  (ev.supportsNodeIds ?? []).some(id => domainNodeIds.has(id)) ||
  (ev.supportsEdgeIds ?? []).some(id => domainEdgeIds.has(id)));
const verified = inDomain.filter(ev => (ev as any).machineCheck?.status === "verified");
console.log("in-domain scoped:", inDomain.length);
console.log("verified:", verified.length);
console.log("integrity:", (verified.length/inDomain.length).toFixed(4));
const noMc = inDomain.filter(ev => !(ev as any).machineCheck);
console.log("\nin-domain WITHOUT machineCheck (", noMc.length, "):");
for (const ev of noMc) console.log("  ", ev.id, "|", (ev as any).sourceStatus, "| node?", (ev.supportsNodeIds??[]).some((id:string)=>domainNodeIds.has(id)), "| edge?", (ev.supportsEdgeIds??[]).some((id:string)=>domainEdgeIds.has(id)));

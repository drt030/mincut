// Merge the 6 round-1 breadth batches into one candidate for import.
// - rename org_moog_space -> org_moog (avionics used the non-canonical id)
// - dedupe nodes by id (org_ati x2, org_moog x2 after rename); keep-first
//   with actuation ordered first so its canonical org_moog/org_ati win
// - keep ALL edges + evidence (no dup ids; multiple edges may point at one org)
import { readFileSync, writeFileSync } from "node:fs";

const R = ".scratch/spacex-reusable-launch-round-1";
// actuation first => its org_moog / org_ati are the kept canonical records
const ORDER = [
  "actuation_engine_merchant", "structural_metals", "avionics_radhard",
  "composites_copv", "propellants_gases", "thermal_protection",
];
const RENAME = { org_moog_space: "org_moog" };
const rn = (id) => (id != null && RENAME[id]) || id;

const out = { nodes: [], edges: [], evidence: [], tasks: [] };
const seenNode = new Set(), seenEdge = new Set(), seenEv = new Set();
let droppedNodes = 0, droppedEdges = 0, droppedEv = 0;

for (const name of ORDER) {
  const b = JSON.parse(readFileSync(`${R}/${name}.json`, "utf8"));
  for (const n of b.nodes ?? []) {
    n.id = rn(n.id);
    if (Array.isArray(n.bottleneckOf)) n.bottleneckOf = n.bottleneckOf.map(rn);
    else if (typeof n.bottleneckOf === "string") n.bottleneckOf = rn(n.bottleneckOf);
    if (seenNode.has(n.id)) { droppedNodes++; continue; }
    seenNode.add(n.id); out.nodes.push(n);
  }
  for (const e of b.edges ?? []) {
    e.source = rn(e.source); e.target = rn(e.target);
    if (e.id && seenEdge.has(e.id)) { droppedEdges++; continue; }
    if (e.id) seenEdge.add(e.id); out.edges.push(e);
  }
  for (const ev of b.evidence ?? []) {
    if (Array.isArray(ev.supportsNodeIds)) ev.supportsNodeIds = ev.supportsNodeIds.map(rn);
    if (ev.id && seenEv.has(ev.id)) { droppedEv++; continue; }
    if (ev.id) seenEv.add(ev.id); out.evidence.push(ev);
  }
  for (const t of b.tasks ?? []) out.tasks.push(t);
}

writeFileSync(`${R}/MERGED.json`, JSON.stringify(out, null, 2));
console.log(`MERGED: ${out.nodes.length} nodes, ${out.edges.length} edges, ${out.evidence.length} evidence, ${out.tasks.length} tasks`);
console.log(`deduped: ${droppedNodes} nodes, ${droppedEdges} edges, ${droppedEv} evidence`);
// integrity: every edge endpoint + every evidence support must resolve within
// MERGED nodes OR be an existing graph node id (passed in via argv file)
const existing = new Set(JSON.parse(readFileSync(process.argv[2], "utf8")));
const known = new Set([...seenNode, ...existing]);
const badEdges = out.edges.filter((e) => !known.has(e.source) || !known.has(e.target));
const orphanSupports = new Set();
for (const ev of out.evidence) for (const s of ev.supportsNodeIds ?? []) if (!known.has(s)) orphanSupports.add(s);
console.log(`unresolved edge endpoints: ${badEdges.length}`);
if (badEdges.length) console.log("  " + badEdges.slice(0, 20).map((e) => `${e.id}: ${e.source}->${e.target}`).join("\n  "));
console.log(`evidence supports pointing nowhere: ${orphanSupports.size}`);
if (orphanSupports.size) console.log("  " + [...orphanSupports].slice(0, 20).join(", "));

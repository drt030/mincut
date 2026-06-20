// Merge the 6 humanoid round-1 breadth batches into one candidate.
// - fold org_humanoid_{renishaw,heidenhain,broadcom} -> canonical org_* (already in graph)
// - dedupe nodes by id; DROP any node whose (folded) id already exists in the live graph
//   (the 3 folds collide with existing org_renishaw/heidenhain/broadcom -> drop, repoint edges)
// - keep ALL edges + evidence (repointed); integrity-check endpoints vs (merged ∪ graph)
import { readFileSync, writeFileSync } from "node:fs";
const R = ".scratch/humanoid-round-1";
const LANES = ["reducers_screws","motors_magnets","sensing","battery_power","compute_control","structure_bearings_thermal"];
const RENAME = {
  org_humanoid_renishaw: "org_renishaw",
  org_humanoid_heidenhain: "org_heidenhain",
  org_humanoid_broadcom: "org_broadcom",
};
const rn = (id) => (id != null && RENAME[id]) || id;
const graphIds = new Set(JSON.parse(readFileSync(process.argv[2], "utf8")));

const out = { nodes: [], edges: [], evidence: [], tasks: [] };
const seenNode = new Set(), seenEdge = new Set(), seenEv = new Set();
let droppedDup = 0, droppedCollision = 0;

for (const name of LANES) {
  const b = JSON.parse(readFileSync(`${R}/${name}.json`, "utf8"));
  for (const n of b.nodes ?? []) {
    n.id = rn(n.id);
    if (Array.isArray(n.bottleneckOf)) n.bottleneckOf = n.bottleneckOf.map(rn);
    else if (typeof n.bottleneckOf === "string") n.bottleneckOf = rn(n.bottleneckOf);
    if (graphIds.has(n.id)) { droppedCollision++; continue; }   // exists in live graph -> reuse it
    if (seenNode.has(n.id)) { droppedDup++; continue; }
    seenNode.add(n.id); out.nodes.push(n);
  }
  for (const e of b.edges ?? []) {
    e.source = rn(e.source); e.target = rn(e.target);
    if (e.id && seenEdge.has(e.id)) continue;
    if (e.id) seenEdge.add(e.id); out.edges.push(e);
  }
  for (const ev of b.evidence ?? []) {
    if (Array.isArray(ev.supportsNodeIds)) ev.supportsNodeIds = ev.supportsNodeIds.map(rn);
    if (ev.id && seenEv.has(ev.id)) continue;
    if (ev.id) seenEv.add(ev.id); out.evidence.push(ev);
  }
  for (const t of b.tasks ?? []) out.tasks.push(t);
}

writeFileSync(`${R}/MERGED.json`, JSON.stringify(out, null, 2) + "\n");
console.log(`MERGED: ${out.nodes.length} nodes, ${out.edges.length} edges, ${out.evidence.length} evidence, ${out.tasks.length} tasks`);
console.log(`dropped: ${droppedCollision} graph-collision (folded to existing), ${droppedDup} intra-batch dup`);
const known = new Set([...seenNode, ...graphIds]);
const bad = out.edges.filter((e) => !known.has(e.source) || !known.has(e.target));
console.log(`unresolved edge endpoints: ${bad.length}`);
if (bad.length) console.log("  " + bad.slice(0,25).map((e) => `${e.id}: ${e.source}->${e.target}`).join("\n  "));
const orphan = new Set();
for (const ev of out.evidence) for (const s of ev.supportsNodeIds ?? []) if (!known.has(s)) orphan.add(s);
console.log(`evidence supports pointing nowhere: ${orphan.size}${orphan.size?" -> "+[...orphan].slice(0,15).join(", "):""}`);

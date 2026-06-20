import { loadGraphData } from "../src/lib/graphLoader";
import { writeFileSync } from "node:fs";
const g = loadGraphData();
const bott = new Set(g.nodes.filter((n) => (n.bottleneckOf?.length ?? 0) > 0).map((n) => n.id));
const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
const dom = (id: string) => nodeById.get(id)?.domain ?? [];
const ev = g.evidence.filter((e) => (e.supportsNodeIds ?? []).some((id) => dom(id).includes("parcel_sorting_robot")));
const hot = ev.filter((e) => (e.supportsNodeIds ?? []).some((id) => bott.has(id)) && e.url);
const recs = hot.map((e) => {
  const sn = (e.supportsNodeIds ?? []).map((id) => nodeById.get(id)).filter(Boolean);
  const claim = sn.map((n) => n!.name + ": " + (n!.description || "").slice(0, 150)).join(" | ");
  return { id: e.id, url: e.url, title: e.title, claim };
});
const per = Math.ceil(recs.length / 3);
for (let i = 0; i < 3; i++) {
  const batch = recs.slice(i * per, (i + 1) * per);
  writeFileSync(`.scratch/enrich-2026-06-15/parcel-${i + 1}.json`, JSON.stringify(batch, null, 2));
  console.log(`parcel-${i + 1}: ${batch.length} records`);
}

import { loadGraphData } from "../src/lib/graphLoader";
const g = loadGraphData();
const bott = new Set(g.nodes.filter((n) => (n.bottleneckOf?.length ?? 0) > 0).map((n) => n.id));
const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
const dom = (id: string) => nodeById.get(id)?.domain ?? [];
const ev = g.evidence.filter((e) => (e.supportsNodeIds ?? []).some((id) => dom(id).includes("parcel_sorting_robot")));
const hot = ev.filter((e) => (e.supportsNodeIds ?? []).some((id) => bott.has(id)) && e.url);
const haveEx = ev.filter((e) => (e.excerpt ?? "").trim()).length;
console.log("parcel evidence=" + ev.length + " high-stakes(bottleneck,url)=" + hot.length + " alreadyExcerpt=" + haveEx);

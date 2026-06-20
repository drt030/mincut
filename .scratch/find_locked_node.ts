import { loadGraphData } from "../src/lib/graphLoader";
const g = loadGraphData();
const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
const supplierRel = new Set(["manufactured_by","implemented_by","qualified_supplier","reported_capable_supplier","second_source_candidate","capacity_provider","strategic_supplier_to"]);
// humanoid host node that points (supplier edge) at an org, and is itself a humanoid artifact (kind module/product/material)
for (const e of g.edges) {
  if (!supplierRel.has(e.relation)) continue;
  const src = nodeById.get(e.source); const tgt = nodeById.get(e.target);
  if (tgt?.kind !== "organization") continue;
  if (!(src?.domain ?? []).includes("humanoid_robotics")) continue;
  if (!["module","product","material","equipment"].includes(src?.kind ?? "")) continue;
  console.log(src!.id, "→", e.relation, "→", tgt!.name);
}

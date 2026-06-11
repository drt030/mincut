import type { GraphData } from "@/lib/schema";

export type GatedDomain = { domainTag: string; entitlement: string };

export const GATED_DOMAINS: GatedDomain[] = [
  { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  { domainTag: "humanoid_actuator", entitlement: "humanoid" },
  { domainTag: "ai_dc_power_chain", entitlement: "power" },
  // parcel_sorting_robot is deliberately absent — full free demo.
];

export function stripExposureLayer(
  graph: GraphData,
  entitlements: string[],
  gatedDomains: GatedDomain[] = GATED_DOMAINS,
) {
  const lockedTags = gatedDomains.filter(
    (d) => !entitlements.includes("all") && !entitlements.includes(d.entitlement),
  );
  const locked: { domainTag: string; entitlement: string; hiddenOrgCount: number }[] = [];
  const hiddenNodeIds = new Set<string>();

  for (const d of lockedTags) {
    let count = 0;
    for (const n of graph.nodes) {
      const tags = (n as { domain?: string[] }).domain ?? [];
      const tagsLockedOnly = tags.length > 0 && tags.every((t) =>
        lockedTags.some((lt) => lt.domainTag === t),
      );
      if (n.kind === "organization" && tags.includes(d.domainTag) && tagsLockedOnly) {
        hiddenNodeIds.add(n.id);
        count += 1;
      }
    }
    locked.push({ domainTag: d.domainTag, entitlement: d.entitlement, hiddenOrgCount: count });
  }

  if (hiddenNodeIds.size === 0) return { graph, locked };

  const nodes = graph.nodes.filter((n) => !hiddenNodeIds.has(n.id));
  const edges = graph.edges.filter((e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target));
  const referenced = new Set([
    ...nodes.flatMap((n) => n.evidenceIds ?? []),
    ...edges.flatMap((e) => e.evidenceIds ?? []),
  ]);
  const evidence = graph.evidence.filter((ev) => {
    const supports = (ev as { supportsNodeIds?: string[] }).supportsNodeIds ?? [];
    if (supports.some((id) => hiddenNodeIds.has(id)) && !supports.some((id) => !hiddenNodeIds.has(id))) {
      return false;
    }
    return referenced.size === 0 || referenced.has(ev.id) || supports.length > 0;
  });
  return { graph: { ...graph, nodes, edges, evidence }, locked };
}

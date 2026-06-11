import type { GraphData } from "@/lib/schema";

export type GatedDomain = { domainTag: string; entitlement: string };

export const GATED_DOMAINS: GatedDomain[] = [
  { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  { domainTag: "humanoid_actuator", entitlement: "humanoid" },
  { domainTag: "ai_dc_power_chain", entitlement: "power" },
  // parcel_sorting_robot is deliberately absent — full free demo.
];

/**
 * Chain tags identifying fully-free domains. Real imported nodes mix chain
 * tags with category labels inside `domain` (investable_supplier,
 * semiconductor_equipment, ...), so gating keys on registered chain tags
 * only and fails closed: an org escapes stripping only through a free
 * chain tag, an entitlement on one of its chains, or an explicit
 * `free_teaser` tag (Decision 5) — never through a category label.
 */
export const FREE_CHAIN_TAGS = ["parcel_sorting_robot"];

export function stripExposureLayer(
  graph: GraphData,
  entitlements: string[],
  gatedDomains: GatedDomain[] = GATED_DOMAINS,
) {
  const lockedDomains = gatedDomains.filter(
    (d) => !entitlements.includes("all") && !entitlements.includes(d.entitlement),
  );
  const lockedChainTags = new Set(lockedDomains.map((d) => d.domainTag));
  const openChainTags = new Set([
    ...FREE_CHAIN_TAGS,
    ...gatedDomains.filter((d) => !lockedChainTags.has(d.domainTag)).map((d) => d.domainTag),
  ]);

  const hiddenNodeIds = new Set<string>();
  for (const n of graph.nodes) {
    if (n.kind !== "organization") continue;
    if ((n.tags ?? []).includes("free_teaser")) continue;
    const domainTags = n.domain ?? [];
    if (!domainTags.some((t) => lockedChainTags.has(t))) continue;
    if (domainTags.some((t) => openChainTags.has(t))) continue;
    hiddenNodeIds.add(n.id);
  }

  const locked = lockedDomains.map((d) => ({
    domainTag: d.domainTag,
    entitlement: d.entitlement,
    hiddenOrgCount: graph.nodes.filter(
      (n) => hiddenNodeIds.has(n.id) && (n.domain ?? []).includes(d.domainTag),
    ).length,
  }));

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

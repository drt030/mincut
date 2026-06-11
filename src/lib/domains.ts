/**
 * Domain route registry (master-plan Decision 4/7): one site, one route per
 * domain at /d/<slug>, each loading only its root's reachable subgraph.
 * The global V0 closed-loop target stays the parcel robot; flagship switching
 * happens per-route via this registry, never by flipping V0_TARGET_NODE_ID
 * (that flip broke 12 parcel-scoped tests on 2026-06-11 and was reverted).
 */
export type DomainRoute = {
  slug: string;
  rootId: string;
  /** English display title (zh handled by the LanguageProvider node dictionary). */
  title: string;
  description: string;
};

export const DOMAIN_ROUTES: DomainRoute[] = [
  {
    slug: "ai-compute",
    rootId: "ai_accelerator_module_hbm_cowos",
    title: "AI compute chain",
    description:
      "Wafer to rack: CoWoS packaging, HBM, ABF substrates, InP photonics — every chokepoint cited and labeled.",
  },
  {
    slug: "parcel-robot",
    rootId: "low_cost_parcel_sorting_robot_300k_rmb",
    title: "Parcel-sorting robot (full free demo)",
    description:
      "A 300k-RMB parcel-sorting cell decomposed to commodity leaves — the complete demo including the exposure layer.",
  },
];

export function domainBySlug(slug: string): DomainRoute | undefined {
  return DOMAIN_ROUTES.find((domain) => domain.slug === slug);
}

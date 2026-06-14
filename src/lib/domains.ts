/**
 * Domain route registry (master-plan Decision 4/7): one site, one route per
 * domain at /d/<slug>, each loading only its root's reachable subgraph.
 * The global V0 closed-loop target stays the parcel robot; flagship switching
 * happens per-route via this registry, never by flipping V0_TARGET_NODE_ID
 * (that flip broke 12 parcel-scoped tests on 2026-06-11 and was reverted).
 */
export const DOMAIN_PORTFOLIO_STATES = [
  "full-free-flagship",
  "full-free-depth-demo",
  "waitlist",
  "preview",
  "audit-preview",
  "paid-candidate",
] as const;

export type DomainPortfolioState = (typeof DOMAIN_PORTFOLIO_STATES)[number];

type DomainPortfolioBase = {
  slug: string;
  /** English display title (zh handled by the LanguageProvider node dictionary). */
  title: string;
  description: string;
  portfolioState: DomainPortfolioState;
  statusLabel: string;
  detail: string;
  href: string;
  cta: string;
  liveGraphRoute: boolean;
  domainTag?: string;
  entitlement?: string;
};

export type DomainRoute = DomainPortfolioBase & {
  rootId: string;
  domainTag: string;
  liveGraphRoute: true;
  portfolioState: "full-free-flagship" | "full-free-depth-demo" | "audit-preview" | "paid-candidate";
  href: `/d/${string}`;
};

export type DomainPortfolioEntry =
  | DomainRoute
  | (DomainPortfolioBase & {
    liveGraphRoute: false;
    portfolioState: "waitlist" | "preview";
    rootId?: never;
    entitlement?: never;
  });

export const DOMAIN_PORTFOLIO_ENTRIES: readonly DomainPortfolioEntry[] = [
  {
    slug: "ai-compute",
    rootId: "ai_accelerator_module_hbm_cowos",
    domainTag: "ai_compute_chain",
    portfolioState: "full-free-flagship",
    statusLabel: "Reference map",
    title: "AI compute chain",
    description:
      "AI accelerator supply chain from wafer fabrication through CoWoS, HBM, substrates, power delivery, and cooling.",
    detail: "Complete map with supplier exposure, tickers, and cited evidence.",
    href: "/d/ai-compute",
    cta: "Open AI compute map",
    liveGraphRoute: true,
  },
  {
    slug: "parcel-robot",
    rootId: "low_cost_parcel_sorting_robot_300k_rmb",
    domainTag: "parcel_sorting_robot",
    portfolioState: "full-free-depth-demo",
    statusLabel: "Depth reference",
    title: "Parcel-sorting robot",
    description:
      "300k-RMB robot-arm parcel-sorting cell decomposed from product architecture to commodity leaves.",
    detail: "Depth reference map for the v0 parcel-sorting robot graph and validation workflow.",
    href: "/d/parcel-robot",
    cta: "Open parcel map",
    liveGraphRoute: true,
  },
  {
    slug: "humanoid-robotics",
    rootId: "humanoid_robot_key_component_stack",
    domainTag: "humanoid_robotics",
    entitlement: "humanoid",
    portfolioState: "audit-preview",
    statusLabel: "Future paid domain",
    title: "Humanoid robotics component stack",
    description:
      "Humanoid robot component chain across actuators, hands, battery, thermal, sensing, compute, control software, manufacturing, and service.",
    detail:
      "Map, bottleneck thesis, and evidence trail are visible. Supplier/ticker exposure opens only when this paid domain launches.",
    href: "/d/humanoid-robotics",
    cta: "Review candidate map",
    liveGraphRoute: true,
  },
  {
    slug: "controlled-fusion",
    rootId: "controlled_fusion_route_portfolio",
    domainTag: "controlled_fusion",
    entitlement: "power",
    portfolioState: "audit-preview",
    statusLabel: "Future paid domain",
    title: "Controlled fusion route portfolio",
    description:
      "Fusion route portfolio comparing tokamak, stellarator, laser inertial, MTF/FRC/Z-pinch, and shared tritium, blanket, materials, and maintenance constraints.",
    detail:
      "Route logic and evidence are visible. Organization exposure opens only when this paid domain launches.",
    href: "/d/controlled-fusion",
    cta: "Review route portfolio",
    liveGraphRoute: true,
  },
  {
    slug: "spacex-reusable-launch",
    rootId: "spacex_reusable_launch_stack",
    domainTag: "spacex_reusable_launch",
    entitlement: "space",
    portfolioState: "audit-preview",
    statusLabel: "Future paid domain",
    title: "SpaceX reusable launch stack",
    description:
      "SpaceX-centered reusable launch map separating Falcon 9 operational reuse from Starship/Super Heavy rapid-reuse development constraints.",
    detail:
      "Reuse mechanics, launch cadence, refurbishment constraints, and customer exposure hypotheses are visible. Public-market exposure opens only when this paid domain launches.",
    href: "/d/spacex-reusable-launch",
    cta: "Open SpaceX reuse map",
    liveGraphRoute: true,
  },
  {
    slug: "spacex-orbital-data-center",
    rootId: "spacex_orbital_data_center_system",
    domainTag: "spacex_orbital_data_center",
    entitlement: "space",
    portfolioState: "audit-preview",
    statusLabel: "Future paid domain",
    title: "SpaceX orbital data center system",
    description:
      "SpaceX-centered future-product map for orbital AI compute, grounded in FCC application evidence but not presented as a mature commercial service.",
    detail:
      "Future-product map highlighting power, thermal, radiation, optical-link, launch, and regulatory bottlenecks. Organization exposure opens only when this paid domain launches.",
    href: "/d/spacex-orbital-data-center",
    cta: "Open orbital compute map",
    liveGraphRoute: true,
  },
];

function isDomainRoute(entry: DomainPortfolioEntry): entry is DomainRoute {
  return entry.liveGraphRoute;
}

export const DOMAIN_ROUTES: DomainRoute[] = DOMAIN_PORTFOLIO_ENTRIES.filter(isDomainRoute);

export function domainBySlug(slug: string): DomainRoute | undefined {
  return DOMAIN_ROUTES.find((domain) => domain.slug === slug);
}

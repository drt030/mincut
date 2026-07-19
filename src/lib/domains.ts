/**
 * Domain route registry (master-plan Decision 4/7): one site, one route per
 * domain at /d/<slug>, each loading only its root's reachable subgraph.
 * The global V0 closed-loop target stays the parcel robot for internal
 * validation, but public portfolio switching happens per-route via this
 * registry. Do not flip V0_TARGET_NODE_ID to change the commercial homepage.
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

export const ALL_ACCESS_ROLES = [
  "core",
  "early-research-addon",
  "hypothesis-addon",
] as const;

export type AllAccessRole = (typeof ALL_ACCESS_ROLES)[number];

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
  /**
   * Explicit inclusion in the current $9 snapshot. This is separate from
   * portfolioState: the role describes the offer, while portfolioState keeps
   * communicating the research/evidence maturity of the map.
   */
  allAccessRole?: AllAccessRole;
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
    slug: "humanoid-robotics",
    rootId: "humanoid_robot_key_component_stack",
    domainTag: "humanoid_robotics",
    entitlement: "humanoid",
    allAccessRole: "core",
    portfolioState: "audit-preview",
    statusLabel: "Paid exposure preview",
    title: "Humanoid robotics component stack",
    description:
      "Humanoid robot component chain across actuators, hands, battery, thermal, sensing, compute, control software, manufacturing, and service.",
    detail:
      "Map, bottleneck thesis, and evidence trail are visible. $9 all-access unlocks the current company/ticker mapping layer.",
    href: "/d/humanoid-robotics",
    cta: "Review candidate map",
    liveGraphRoute: true,
  },
  {
    slug: "controlled-fusion",
    rootId: "controlled_fusion_route_portfolio",
    domainTag: "controlled_fusion",
    entitlement: "power",
    allAccessRole: "early-research-addon",
    portfolioState: "audit-preview",
    statusLabel: "Paid exposure preview",
    title: "Controlled fusion route portfolio",
    description:
      "Fusion route portfolio comparing tokamak, stellarator, laser inertial, MTF/FRC/Z-pinch, and shared tritium, blanket, materials, and maintenance constraints.",
    detail:
      "Early-research add-on with three currently modeled public-market candidates; $9 all-access opens the current organization layer.",
    href: "/d/controlled-fusion",
    cta: "Review route portfolio",
    liveGraphRoute: true,
  },
  {
    slug: "spacex-reusable-launch",
    rootId: "spacex_reusable_launch_stack",
    domainTag: "spacex_reusable_launch",
    entitlement: "space",
    allAccessRole: "core",
    portfolioState: "audit-preview",
    statusLabel: "Paid exposure preview",
    title: "SpaceX reusable launch stack",
    description:
      "SpaceX-centered reusable launch map separating Falcon 9 operational reuse from Starship/Super Heavy rapid-reuse development constraints.",
    detail:
      "Reuse mechanics, launch cadence, refurbishment constraints, and relationship hypotheses are visible. $9 all-access opens the current public-market mapping layer.",
    href: "/d/spacex-reusable-launch",
    cta: "Open SpaceX reuse map",
    liveGraphRoute: true,
  },
  {
    slug: "spacex-orbital-data-center",
    rootId: "spacex_orbital_data_center_system",
    domainTag: "spacex_orbital_data_center",
    entitlement: "space",
    allAccessRole: "hypothesis-addon",
    portfolioState: "audit-preview",
    statusLabel: "Paid exposure preview",
    title: "SpaceX orbital data center system",
    description:
      "SpaceX-centered future-product map for orbital AI compute, grounded in FCC application evidence but not presented as a mature commercial service.",
    detail:
      "Hypothesis add-on highlighting power, thermal, radiation, optical-link, launch, and regulatory bottlenecks; companies are capability candidates, not confirmed suppliers.",
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

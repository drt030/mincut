import type { DomainPortfolioState } from "./domains";

export type RouteExposureAccessState =
  | { status: "locked"; hiddenOrgCount: number }
  | { status: "unlocked" }
  | { status: "full-free" }
  | { status: "waitlist" }
  | { status: "preview" }
  | { status: "audit-preview" }
  | { status: "paid-candidate" };

export type RouteLockedDomainSummary = {
  domainTag: string;
  entitlement: string;
  hiddenOrgCount: number;
};

export function resolveRouteExposureAccess(
  domain: {
    domainTag?: string;
    entitlement?: string;
    portfolioState?: DomainPortfolioState;
  },
  locked: readonly RouteLockedDomainSummary[],
): RouteExposureAccessState {
  if (domain.portfolioState === "full-free-flagship" || domain.portfolioState === "full-free-depth-demo") {
    return { status: "full-free" };
  }
  if (domain.portfolioState === "audit-preview") return { status: "audit-preview" };
  if (domain.portfolioState === "preview") return { status: "preview" };
  if (domain.portfolioState === "waitlist") return { status: "waitlist" };
  if (domain.portfolioState === "paid-candidate" && !domain.entitlement) return { status: "paid-candidate" };
  if (!domain.entitlement) return { status: "preview" };

  const lockedEntry = locked.find(
    (entry) => entry.domainTag === domain.domainTag && entry.hiddenOrgCount > 0,
  );
  if (!lockedEntry) return { status: "unlocked" };

  return { status: "locked", hiddenOrgCount: lockedEntry.hiddenOrgCount };
}

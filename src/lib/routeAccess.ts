import type { AllAccessRole, DomainPortfolioState } from "./domains";

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
    allAccessRole?: AllAccessRole;
    portfolioState?: DomainPortfolioState;
  },
  locked: readonly RouteLockedDomainSummary[],
  checkoutAvailable = false,
): RouteExposureAccessState {
  if (domain.portfolioState === "full-free-flagship" || domain.portfolioState === "full-free-depth-demo") {
    return { status: "full-free" };
  }
  if (domain.portfolioState === "preview") return { status: "preview" };
  if (domain.portfolioState === "waitlist") return { status: "waitlist" };
  if (
    (domain.portfolioState === "audit-preview" || domain.portfolioState === "paid-candidate") &&
    !domain.entitlement
  ) {
    return { status: domain.portfolioState };
  }
  if (!domain.entitlement) return { status: "preview" };

  const lockedEntry = locked.find(
    (entry) => entry.domainTag === domain.domainTag && entry.hiddenOrgCount > 0,
  );
  if (!lockedEntry) return { status: "unlocked" };

  // An entitlement alone is not an offer decision. Only routes explicitly
  // included in the current all-access snapshot may become purchasable.
  if (!domain.allAccessRole) return { status: domain.portfolioState ?? "preview" };

  // Audit-preview describes content maturity, not a permanent denial of paid
  // access. Once the one live checkout is available, a locked route must expose
  // the real paywall state; after an `all` entitlement removes the locked entry,
  // the same route resolves to `unlocked` above. When checkout is disabled we
  // keep the honest preview state and avoid implying that a purchase is live.
  if (domain.portfolioState === "audit-preview" && !checkoutAvailable) {
    return { status: "audit-preview" };
  }
  if (domain.portfolioState === "paid-candidate" && !checkoutAvailable) {
    return { status: "paid-candidate" };
  }

  return { status: "locked", hiddenOrgCount: lockedEntry.hiddenOrgCount };
}

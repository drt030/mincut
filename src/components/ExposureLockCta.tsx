"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import type { Node } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";

/**
 * Per the exposure-layer paywall (commercial launch plan Task 10):
 * `stripExposureLayer` removes organization nodes server-side for gated
 * domains the viewer has not unlocked. The pages provide the resulting
 * `locked` summaries through this context so detail panels can render
 * an unlock CTA in the slots where candidate exposure would have been.
 */
export type LockedDomainSummary = {
  domainTag: string;
  entitlement: string;
  hiddenOrgCount: number;
};

const LockedDomainsContext = createContext<LockedDomainSummary[]>([]);

export function ExposureLockProvider({
  locked,
  children,
}: {
  locked: LockedDomainSummary[];
  children: ReactNode;
}) {
  return <LockedDomainsContext.Provider value={locked}>{children}</LockedDomainsContext.Provider>;
}

/**
 * The locked-domain entry for a node, or null when the node's domain is
 * unlocked (or carries no hidden organizations — nothing to sell yet).
 */
export function useLockedDomainForNode(node: Pick<Node, "domain"> | null | undefined): LockedDomainSummary | null {
  const locked = useContext(LockedDomainsContext);
  if (!node) return null;
  const tags = node.domain ?? [];
  return locked.find((entry) => entry.hiddenOrgCount > 0 && tags.includes(entry.domainTag)) ?? null;
}

function unlockHrefForEntitlement(entitlement: string): string | undefined {
  switch (entitlement) {
    case "humanoid":
    case "power":
      return undefined;
    default:
      return undefined;
  }
}

// Shared so every locked surface (landing hero, domain banners, node-detail
// lock) points at the same founding all-access checkout when it is enabled.
export function foundingCheckoutHref(): string | undefined {
  if (process.env.NEXT_PUBLIC_ENABLE_PAID_CHECKOUT !== "1") {
    return undefined;
  }
  return process.env.NEXT_PUBLIC_STRIPE_LINK_FOUNDING;
}

export function ExposureCheckoutLinks({
  entry,
  missingLabel,
  className = "pill-row",
}: {
  entry: LockedDomainSummary;
  missingLabel?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const unlockHref = unlockHrefForEntitlement(entry.entitlement);
  const foundingLink = foundingCheckoutHref();

  if (!unlockHref && !foundingLink) {
    return (
      <div className={className}>
        {missingLabel ? <p className="exposure-checkout-missing">{missingLabel}</p> : null}
        <Link
          className="link-button"
          href="/#private-beta"
          onClick={() => track("waitlist_click", { domain: entry.domainTag, product: "private_beta" })}
        >
          {t("exposureLockWaitlist")}
        </Link>
      </div>
    );
  }

  return (
    <div className={className}>
      {unlockHref ? (
        <a
          className="link-button"
          href={unlockHref}
          onClick={() => track("unlock_click", { domain: entry.domainTag })}
        >
          {t("exposureLockUnlock")}
        </a>
      ) : null}
      {foundingLink ? (
        <a
          className="link-button"
          href={foundingLink}
          onClick={() => track("unlock_click", { domain: entry.domainTag, product: "founding" })}
        >
          {t("exposureLockFounding")}
        </a>
      ) : null}
    </div>
  );
}

export function ExposureLockCta({ entry }: { entry: LockedDomainSummary }) {
  const { t } = useLanguage();
  return (
    <div className="evidence-gap-callout exposure-lock-cta" data-testid="exposure-lock-cta">
      <strong>{t("exposureLockHeading")}</strong>
      <p>{t("exposureLockSummary").replace("{n}", String(entry.hiddenOrgCount))}</p>
      <ExposureCheckoutLinks entry={entry} missingLabel={t("exposureCheckoutMissing")} />
    </div>
  );
}

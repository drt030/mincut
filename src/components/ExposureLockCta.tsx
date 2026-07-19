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

type ExposureLockContextValue = {
  locked: LockedDomainSummary[];
  foundingCheckoutLink: string | null;
};

const LockedDomainsContext = createContext<ExposureLockContextValue>({
  locked: [],
  foundingCheckoutLink: null,
});

export function ExposureLockProvider({
  locked,
  foundingCheckoutLink = null,
  children,
}: {
  locked: LockedDomainSummary[];
  foundingCheckoutLink?: string | null;
  children: ReactNode;
}) {
  return (
    <LockedDomainsContext.Provider value={{ locked, foundingCheckoutLink }}>
      {children}
    </LockedDomainsContext.Provider>
  );
}

/**
 * The locked-domain entry for a node, or null when the node's domain is
 * unlocked (or carries no hidden organizations — nothing to sell yet).
 */
export function useLockedDomainForNode(node: Pick<Node, "domain"> | null | undefined): LockedDomainSummary | null {
  const { locked } = useContext(LockedDomainsContext);
  if (!node) return null;
  const tags = node.domain ?? [];
  return locked.find((entry) => entry.hiddenOrgCount > 0 && tags.includes(entry.domainTag)) ?? null;
}

function useFoundingCheckoutLink(): string | null {
  return useContext(LockedDomainsContext).foundingCheckoutLink;
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
  const foundingCheckoutLink = useFoundingCheckoutLink();
  const note = foundingCheckoutLink ? t("exposureCheckoutLiveNote") : missingLabel;
  return (
    <div className={className}>
      {note ? <p className="exposure-checkout-missing">{note}</p> : null}
      {foundingCheckoutLink ? (
        <>
          <a
            className="link-button"
            href={foundingCheckoutLink}
            onClick={() => track("checkout_click", { domain: entry.domainTag, product: "all_access", price_usd: 9 })}
          >
            {t("exposureLockBuy")}
          </a>
          <Link className="purchase-policy-link" href="/policies">
            {t("homeFoundingPolicyLink")}
          </Link>
        </>
      ) : (
        <Link
          className="link-button"
          href="/#private-beta"
          onClick={() => track("waitlist_click", { domain: entry.domainTag, product: "private_beta" })}
        >
          {t("exposureLockWaitlist")}
        </Link>
      )}
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

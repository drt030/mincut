"use client";

import type { DomainPortfolioState } from "@/lib/domains";
import { ExposureCheckoutLinks, type LockedDomainSummary } from "./ExposureLockCta";
import { useLanguage } from "./LanguageProvider";

const freeLayerKeys = [
  "exposureAccessFreeDecomposition",
  "exposureAccessFreeHeat",
  "exposureAccessFreeEvidence",
  "exposureAccessFreeValidation",
];

const paidLayerKeys = [
  "exposureAccessPaidSupplierIdentities",
  "exposureAccessPaidTickers",
  "exposureAccessPaidMarketSignals",
  "exposureAccessPaidOrgEvidence",
  "exposureAccessPaidUpdates",
];

type ExposureAccessBannerDomain = {
  slug: string;
  rootId?: string;
  title: string;
  description: string;
  domainTag?: string;
  entitlement?: string;
  portfolioState?: DomainPortfolioState;
};

function formatCopy(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function ExposureAccessBanner({
  domain,
  locked,
}: {
  domain: ExposureAccessBannerDomain;
  locked: LockedDomainSummary[];
}) {
  const { nodeName, t } = useLanguage();
  const domainName = domain.rootId ? nodeName(domain.rootId, domain.title) : domain.title;
  const lockedEntry =
    domain.entitlement && domain.domainTag
      ? locked.find((entry) => entry.domainTag === domain.domainTag && entry.hiddenOrgCount > 0) ?? null
      : null;

  if (
    domain.portfolioState === "full-free-flagship" ||
    domain.portfolioState === "full-free-depth-demo"
  ) {
    return null;
  }

  if (domain.portfolioState === "preview") {
    return (
      <section
        className="exposure-access-banner exposure-access-banner-preview"
        data-testid="exposure-access-banner"
        id="paid-exposure-access"
      >
        <div>
          <p className="exposure-access-eyebrow">{t("exposureAccessPreviewEyebrow")}</p>
          <h2>{t("exposureAccessPreviewTitle")}</h2>
          <p>{formatCopy(t("exposureAccessPreviewBody"), { domain: domainName })}</p>
        </div>
      </section>
    );
  }

  if (domain.portfolioState === "waitlist") {
    return (
      <section
        className="exposure-access-banner exposure-access-banner-waitlist"
        data-testid="exposure-access-banner"
        id="paid-exposure-access"
      >
        <div>
          <p className="exposure-access-eyebrow">{t("exposureAccessWaitlistEyebrow")}</p>
          <h2>{t("exposureAccessWaitlistTitle")}</h2>
          <p>{formatCopy(t("exposureAccessWaitlistBody"), { domain: domainName })}</p>
        </div>
      </section>
    );
  }

  if (domain.portfolioState === "paid-candidate" && !domain.entitlement) {
    return (
      <section
        className="exposure-access-banner exposure-access-banner-paid-candidate"
        data-testid="exposure-access-banner"
        id="paid-exposure-access"
      >
        <div>
          <p className="exposure-access-eyebrow">{t("exposureAccessPaidCandidateEyebrow")}</p>
          <h2>{t("exposureAccessPaidCandidateTitle")}</h2>
          <p>{formatCopy(t("exposureAccessPaidCandidateBody"), { domain: domainName })}</p>
        </div>
      </section>
    );
  }

  if (!domain.entitlement) {
    return (
      <section
        className="exposure-access-banner exposure-access-banner-preview"
        data-testid="exposure-access-banner"
        id="paid-exposure-access"
      >
        <div>
          <p className="exposure-access-eyebrow">{t("exposureAccessPreviewEyebrow")}</p>
          <h2>{t("exposureAccessPreviewTitle")}</h2>
          <p>{formatCopy(t("exposureAccessPreviewBody"), { domain: domainName })}</p>
        </div>
      </section>
    );
  }

  if (!lockedEntry) {
    return (
      <section
        className="exposure-access-banner exposure-access-banner-unlocked"
        data-testid="exposure-access-banner"
        id="paid-exposure-access"
      >
        <div>
          <p className="exposure-access-eyebrow">{t("exposureAccessUnlockedEyebrow")}</p>
          <h2>{t("exposureAccessUnlockedTitle")}</h2>
          <p>{formatCopy(t("exposureAccessUnlockedBody"), { domain: domainName })}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="exposure-access-banner exposure-access-banner-locked"
      data-testid="exposure-access-banner"
      id="paid-exposure-access"
    >
      <div className="exposure-access-copy">
        <p className="exposure-access-eyebrow">{t("exposureAccessLockedEyebrow")}</p>
        <h2>{formatCopy(t("exposureAccessLockedTitle"), { n: lockedEntry.hiddenOrgCount })}</h2>
        <p>{formatCopy(t("exposureAccessLockedBody"), { domain: domainName })}</p>
      </div>
      <div className="exposure-access-grid" aria-label={t("exposureAccessLayerComparison")}>
        <div className="exposure-access-column exposure-access-column-free">
          <h2>{t("exposureAccessFreeLayer")}</h2>
          <ul>
            {freeLayerKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
        <div className="exposure-access-column exposure-access-column-paid">
          <h2>{t("exposureAccessPaidLayer")}</h2>
          <ul>
            {paidLayerKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <ExposureCheckoutLinks
            entry={{ ...lockedEntry, entitlement: "founding" }}
            className="exposure-access-actions"
            missingLabel={t("exposureCheckoutMissing")}
          />
        </div>
      </div>
    </section>
  );
}

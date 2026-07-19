"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useEffect } from "react";
import type { AllAccessRole, DomainPortfolioState } from "@/lib/domains";
import { useLanguage } from "./LanguageProvider";

type DomainThesisBannerDomain = {
  slug: string;
  rootId: string;
  title: string;
  description: string;
  portfolioState: DomainPortfolioState;
  allAccessRole?: AllAccessRole;
};

type EvidenceReviewSummary = {
  reviewed: number;
  sourceChecked?: number;
  total: number;
};

function formatCopy(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function statusKey(domain: Pick<DomainThesisBannerDomain, "portfolioState" | "allAccessRole">): string {
  const { portfolioState } = domain;
  if (portfolioState === "full-free-flagship") return "domainThesisStatusFlagship";
  if (portfolioState === "full-free-depth-demo") return "domainThesisStatusDepthDemo";
  if (portfolioState === "audit-preview" && domain.allAccessRole === "early-research-addon") {
    return "domainThesisStatusEarlyResearch";
  }
  if (portfolioState === "audit-preview" && domain.allAccessRole === "hypothesis-addon") {
    return "domainThesisStatusHypothesis";
  }
  if (portfolioState === "audit-preview") return "domainThesisStatusAuditPreview";
  if (portfolioState === "paid-candidate") return "domainThesisStatusPaidCandidate";
  if (portfolioState === "waitlist") return "domainThesisStatusWaitlist";
  return "domainThesisStatusPreview";
}

function accessKey(portfolioState: DomainPortfolioState): string {
  if (portfolioState === "full-free-flagship") return "domainThesisAccessFlagship";
  if (portfolioState === "full-free-depth-demo") return "domainThesisAccessDepthDemo";
  if (portfolioState === "audit-preview") return "domainThesisAccessAuditPreview";
  if (portfolioState === "paid-candidate") return "domainThesisAccessPaidCandidate";
  if (portfolioState === "waitlist") return "domainThesisAccessWaitlist";
  return "domainThesisAccessPreview";
}

function shouldExplainAccess(portfolioState: DomainPortfolioState): boolean {
  return portfolioState !== "full-free-flagship" &&
    portfolioState !== "full-free-depth-demo";
}

export function DomainThesisBanner({
  domain,
  evidence,
  foundingCheckoutLink = null,
  isUnlocked = false,
}: {
  domain: DomainThesisBannerDomain;
  evidence: EvidenceReviewSummary;
  foundingCheckoutLink?: string | null;
  isUnlocked?: boolean;
}) {
  const { nodeDescription, nodeName, t } = useLanguage();
  const domainName = nodeName(domain.rootId, domain.title);
  const domainDescription = nodeDescription(domain.rootId, domain.description);
  const explainsAccess = shouldExplainAccess(domain.portfolioState);
  const showWaitlistCta =
    !isUnlocked &&
    Boolean(domain.allAccessRole) &&
    (domain.portfolioState === "paid-candidate" || domain.portfolioState === "audit-preview");
  const showAccessDetailsCta = false;
  const evidenceText = domain.portfolioState === "paid-candidate"
    ? t("domainThesisEvidenceCandidate")
    : evidence.total > 0 && evidence.reviewed === 0 && (evidence.sourceChecked ?? 0) > 0
      ? formatCopy(t("domainThesisEvidenceSourceChecked"), {
        checked: evidence.sourceChecked ?? 0,
        total: evidence.total,
      })
      : evidence.total > 0 && evidence.reviewed === 0
        ? formatCopy(t("domainThesisEvidenceUnreviewed"), { total: evidence.total })
        : formatCopy(t("domainThesisEvidenceReviewed"), {
          reviewed: evidence.reviewed,
          total: evidence.total,
        });

  useEffect(() => {
    track("domain_open", {
      domain: domain.slug,
      access: isUnlocked ? "all_access" : domain.portfolioState,
      surface: "domain_thesis",
    });
  }, [domain.portfolioState, domain.slug, isUnlocked]);

  return (
    <section
      className={["domain-thesis-banner", explainsAccess ? "" : "domain-thesis-banner-direct"]
        .concat(`domain-thesis-banner-${domain.portfolioState}`)
        .filter(Boolean)
        .join(" ")}
      data-testid="domain-thesis-banner"
    >
      <div className="domain-thesis-copy">
        <p className="domain-thesis-eyebrow">{t("domainThesisEyebrow")}</p>
        <h1>{domainName}</h1>
        <p>{domainDescription}</p>
      </div>
      {explainsAccess ? (
        <div className="domain-thesis-actions" aria-label={t("domainThesisNextSteps")}>
          <span className="domain-thesis-status">
            {isUnlocked
              ? `${t(statusKey(domain))} · ${t("domainThesisStatusUnlocked")}`
              : t(statusKey(domain))}
          </span>
          <p>{t(isUnlocked ? "domainThesisAccessUnlocked" : accessKey(domain.portfolioState))}</p>
          <p className="domain-thesis-evidence">{evidenceText}</p>
          {showWaitlistCta ? (
            foundingCheckoutLink ? (
              <>
                <a
                  className="domain-thesis-cta"
                  href={foundingCheckoutLink}
                  onClick={() => track("checkout_click", {
                    domain: domain.slug,
                    product: "all_access",
                    price_usd: 9,
                    surface: "domain_thesis",
                  })}
                >
                  {t("exposureLockBuy")}
                </a>
                <Link className="purchase-policy-link" href="/policies">
                  {t("homeFoundingPolicyLink")}
                </Link>
              </>
            ) : (
              <Link className="domain-thesis-cta" href="/#private-beta">
                {t("domainThesisJoinWaitlist")}
              </Link>
            )
          ) : null}
          {showAccessDetailsCta ? (
            <a className="domain-thesis-cta domain-thesis-cta-muted" href="#paid-exposure-access">
              {t("domainThesisReviewAccess")}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

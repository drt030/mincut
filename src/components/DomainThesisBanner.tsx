"use client";

import type { DomainPortfolioState } from "@/lib/domains";
import { useLanguage } from "./LanguageProvider";

type DomainThesisBannerDomain = {
  slug: string;
  rootId: string;
  title: string;
  description: string;
  portfolioState: DomainPortfolioState;
};

type EvidenceReviewSummary = {
  reviewed: number;
  total: number;
};

function formatCopy(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function statusKey(portfolioState: DomainPortfolioState): string {
  if (portfolioState === "full-free-flagship") return "domainThesisStatusFlagship";
  if (portfolioState === "full-free-depth-demo") return "domainThesisStatusDepthDemo";
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
  return portfolioState !== "full-free-flagship" && portfolioState !== "full-free-depth-demo";
}

export function DomainThesisBanner({
  domain,
  evidence,
}: {
  domain: DomainThesisBannerDomain;
  evidence: EvidenceReviewSummary;
}) {
  const { nodeName, t } = useLanguage();
  const domainName = nodeName(domain.rootId, domain.title);
  const explainsAccess = shouldExplainAccess(domain.portfolioState);
  const evidenceText = domain.portfolioState === "paid-candidate"
    ? t("domainThesisEvidenceCandidate")
    : evidence.total > 0 && evidence.reviewed === 0
      ? formatCopy(t("domainThesisEvidenceUnreviewed"), { total: evidence.total })
      : formatCopy(t("domainThesisEvidenceReviewed"), {
      reviewed: evidence.reviewed,
      total: evidence.total,
    });

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
        <p>{domain.description}</p>
      </div>
      {explainsAccess ? (
        <div className="domain-thesis-actions" aria-label={t("domainThesisNextSteps")}>
          <span className="domain-thesis-status">{t(statusKey(domain.portfolioState))}</span>
          <p>{t(accessKey(domain.portfolioState))}</p>
          <p className="domain-thesis-evidence">{evidenceText}</p>
        </div>
      ) : null}
    </section>
  );
}

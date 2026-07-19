"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useEffect } from "react";
import { DOMAIN_ROUTES, type DomainRoute } from "@/lib/domains";
import { useLanguage } from "./LanguageProvider";

const buttondownEndpoint = "https://buttondown.com/api/emails/embed-subscribe/drt030";
const offerRoleOrder: Record<NonNullable<DomainRoute["allAccessRole"]>, number> = {
  core: 0,
  "early-research-addon": 1,
  "hypothesis-addon": 2,
};
const paidDomains = DOMAIN_ROUTES
  .filter((entry) => Boolean(entry.allAccessRole))
  .sort((left, right) => offerRoleOrder[left.allAccessRole!] - offerRoleOrder[right.allAccessRole!]);

function offerRoleKey(role: DomainRoute["allAccessRole"]): string | null {
  if (role === "early-research-addon") return "homeFoundingEarlyResearchAddon";
  if (role === "hypothesis-addon") return "homeFoundingHypothesisAddon";
  return null;
}

export type HomePurchaseState = "success" | "issue" | null;

export function HomeLaunchSections({
  domain,
  foundingCheckoutLink,
  hasAllAccess = false,
  purchaseState = null,
}: {
  domain: DomainRoute;
  foundingCheckoutLink: string | null;
  hasAllAccess?: boolean;
  purchaseState?: HomePurchaseState;
}) {
  const { nodeDescription, nodeName, t } = useLanguage();
  const checkoutAvailable = Boolean(foundingCheckoutLink) && !hasAllAccess;
  const purchaseConfirmed = purchaseState === "success" && hasAllAccess;

  useEffect(() => {
    track("domain_open", {
      domain: domain.slug,
      access: hasAllAccess ? "all_access" : "free_flagship",
      surface: "home",
    });
  }, [domain.slug, hasAllAccess]);

  useEffect(() => {
    if (!purchaseConfirmed) return;
    const storageKey = "mincut_purchase_verified_all_v1";
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") return;
      track("purchase_verified", { product: "all_access", price_usd: 9, surface: "home" });
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      track("purchase_verified", { product: "all_access", price_usd: 9, surface: "home" });
    }
  }, [purchaseConfirmed]);

  return (
    <>
      <section className="graph-first-home-thesis" aria-labelledby="home-map-title">
        <div>
          <p className="graph-first-eyebrow">{t("homeResearchWorkspace")}</p>
          <h1 id="home-map-title">{nodeName(domain.rootId, domain.title)}</h1>
          <p>{nodeDescription(domain.rootId, domain.description)}</p>
        </div>
        <span>{t("domainThesisStatusFlagship")}</span>
      </section>
      <section
        className={`graph-first-waitlist${hasAllAccess ? " graph-first-purchase-success" : ""}`}
        id="private-beta"
        aria-labelledby="home-waitlist-title"
      >
        <div>
          <p className="graph-first-eyebrow">
            {hasAllAccess ? t("homeAllAccessActive") : t("homeFoundingAccess")}
          </p>
          <h2 id="home-waitlist-title">
            {hasAllAccess
              ? t("homeFoundingUnlockedTitle")
              : checkoutAvailable
                ? t("homeFoundingBuyTitle")
                : t("homeFoundingWaitlistTitle")}
          </h2>
          <p>{hasAllAccess ? t("homeFoundingUnlockedBody") : t("homeFoundingBody")}</p>
          <ul className="graph-first-offer-list" aria-label={t("homeFoundingIncludedMaps")}>
            {paidDomains.map((entry) => {
              const roleKey = offerRoleKey(entry.allAccessRole);
              return (
                <li key={entry.slug}>
                  <Link href={entry.href}>{nodeName(entry.rootId, entry.title)}</Link>
                  {roleKey ? <span className="graph-first-offer-role"> — {t(roleKey)}</span> : null}
                </li>
              );
            })}
          </ul>
          <p className="graph-first-offer-meta">{t("homeFoundingSnapshot")}</p>
          {checkoutAvailable && foundingCheckoutLink ? (
            <a
              className="link-button"
              href={foundingCheckoutLink}
              onClick={() => track("checkout_click", { domain: "home", product: "all_access", price_usd: 9, surface: "home" })}
            >
              {t("exposureLockBuy")}
            </a>
          ) : null}
          {hasAllAccess ? (
            <p className="graph-first-purchase-status" role="status" aria-live="polite">
              {purchaseConfirmed ? t("homeFoundingPaymentReceived") : t("homeFoundingAccessActive")}
            </p>
          ) : null}
          {purchaseState === "issue" ? (
            <p className="graph-first-purchase-issue" role="alert">
              {t("homeFoundingPaymentIssue")}
            </p>
          ) : null}
          <p className="graph-first-policy-link">
            <Link href="/policies">{t("homeFoundingPolicyLink")}</Link>
          </p>
        </div>
        {!checkoutAvailable && !hasAllAccess ? (
          <form action={buttondownEndpoint} method="post" target="_blank" className="buttondown-form graph-first-waitlist-form">
            <label htmlFor="home-beta-email">{t("homeFoundingEmailLabel")}</label>
            <div>
              <input id="home-beta-email" name="email" type="email" placeholder="you@example.com" required />
              <input type="hidden" name="embed" value="1" />
              <input type="hidden" name="metadata__source" value="graph-first-all-access" />
              <button type="submit">{t("homeFoundingEmailCta")}</button>
            </div>
          </form>
        ) : null}
      </section>
    </>
  );
}

"use client";

import { createContext, useContext, type ReactNode } from "react";
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

const UNLOCK_LINKS: Record<string, string | undefined> = {
  ai_compute: process.env.NEXT_PUBLIC_STRIPE_LINK_AI_COMPUTE,
  humanoid: process.env.NEXT_PUBLIC_STRIPE_LINK_HUMANOID,
  power: process.env.NEXT_PUBLIC_STRIPE_LINK_POWER,
};
const FOUNDING_LINK = process.env.NEXT_PUBLIC_STRIPE_LINK_FOUNDING;

export function ExposureLockCta({ entry }: { entry: LockedDomainSummary }) {
  const { t } = useLanguage();
  const unlockHref = UNLOCK_LINKS[entry.entitlement];
  return (
    <div className="evidence-gap-callout exposure-lock-cta" data-testid="exposure-lock-cta">
      <strong>{t("exposureLockHeading")}</strong>
      <p>{t("exposureLockSummary").replace("{n}", String(entry.hiddenOrgCount))}</p>
      <div className="pill-row">
        {unlockHref ? (
          <a
            className="link-button"
            href={unlockHref}
            onClick={() => track("unlock_click", { domain: entry.domainTag })}
          >
            {t("exposureLockUnlock")}
          </a>
        ) : null}
        {FOUNDING_LINK ? (
          <a
            className="link-button"
            href={FOUNDING_LINK}
            onClick={() => track("unlock_click", { domain: entry.domainTag, product: "founding" })}
          >
            {t("exposureLockFounding")}
          </a>
        ) : null}
      </div>
    </div>
  );
}

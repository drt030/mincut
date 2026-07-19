"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DOMAIN_ROUTES } from "@/lib/domains";
import { useLanguage } from "./LanguageProvider";

const dockOrder = [
  "ai-compute",
  "spacex-reusable-launch",
  "humanoid-robotics",
  "controlled-fusion",
  "spacex-orbital-data-center",
] as const;

const abbreviations: Record<string, string> = {
  "ai-compute": "AI",
  "spacex-reusable-launch": "SX",
  "humanoid-robotics": "HR",
  "controlled-fusion": "CF",
  "spacex-orbital-data-center": "OD",
};

function orderedDomains() {
  const bySlug = new Map(DOMAIN_ROUTES.map((domain) => [domain.slug, domain]));
  const ordered = dockOrder.flatMap((slug) => {
    const domain = bySlug.get(slug);
    return domain ? [domain] : [];
  });
  const included = new Set(ordered.map((domain) => domain.slug));
  return ordered.concat(DOMAIN_ROUTES.filter((domain) => !included.has(domain.slug)));
}

function statusKey(portfolioState: string): string {
  if (portfolioState === "full-free-flagship") return "domainThesisStatusFlagship";
  if (portfolioState === "full-free-depth-demo") return "domainThesisStatusDepthDemo";
  if (portfolioState === "audit-preview") return "domainThesisStatusAuditPreview";
  if (portfolioState === "paid-candidate") return "domainThesisStatusPaidCandidate";
  if (portfolioState === "waitlist") return "domainThesisStatusWaitlist";
  return "domainThesisStatusPreview";
}

function domainHref(slug: string): string {
  return slug === "ai-compute" ? "/" : `/d/${slug}`;
}

export function HomeMapDock({ activeSlug }: { activeSlug: string }) {
  const { nodeName, t } = useLanguage();
  const dockRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const domains = orderedDomains();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!dockRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <aside className="home-map-dock" aria-label={t("homeMapPortfolioLabel")} ref={dockRef}>
      <div className="home-map-dock-stack">
        <button
          className="home-map-trigger"
          type="button"
          aria-label={t("homeMapOpenLabel")}
          aria-controls="home-map-popover"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
        >
          {t("homeMapTrigger")}
        </button>
        {domains.map((domain) => {
          const active = domain.slug === activeSlug;
          const domainName = nodeName(domain.rootId, domain.title);
          return (
            <Link
              key={domain.slug}
              href={domainHref(domain.slug)}
              className={["home-map-shortcut", active ? "active" : ""].filter(Boolean).join(" ")}
              aria-current={active ? "page" : undefined}
              aria-label={domainName}
              title={domainName}
            >
              <span className="home-map-shortcut-code" aria-hidden="true">
                {abbreviations[domain.slug] ?? domain.title.slice(0, 2).toUpperCase()}
              </span>
              <span className="home-map-shortcut-name" aria-hidden="true">
                {domainName}
              </span>
            </Link>
          );
        })}
      </div>

      {open ? (
        <div className="home-map-popover" id="home-map-popover" role="menu" aria-label={t("homeMapMenuLabel")}>
          <div>
            <h2>{t("homeMapDomains")}</h2>
            <p>{t("homeMapMenuBody")}</p>
          </div>
          <div className="home-map-popover-list">
            {domains.map((domain) => {
              const active = domain.slug === activeSlug;
              return (
                <Link
                  key={domain.slug}
                  href={domainHref(domain.slug)}
                  className={["home-map-popover-item", active ? "active" : ""].filter(Boolean).join(" ")}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <strong>{nodeName(domain.rootId, domain.title)}</strong>
                  <span>{t(statusKey(domain.portfolioState))}</span>
                </Link>
              );
            })}
          </div>
          <p className="home-map-popover-note">{t("homeMapMenuNote")}</p>
        </div>
      ) : null}
    </aside>
  );
}

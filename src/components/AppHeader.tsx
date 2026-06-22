"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOMAIN_ROUTES } from "@/lib/domains";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

export function AppHeader() {
  const { nodeName, t } = useLanguage();
  const pathname = usePathname() ?? "";
  const activeDomainPath = pathname === "/" ? "/d/ai-compute" : pathname.startsWith("/d/") ? pathname.split("?")[0] : "";

  return (
    <header className="app-header">
      <Link href="/" className="brand">
        {t("brand")}
      </Link>
      <div className="header-actions">
        <nav className="header-nav" aria-label={t("primaryNavigation")}>
          <span className="header-nav-label">{t("navLiveMaps")}</span>
          <label className="header-domain-select-label">
            <span>{t("navLiveMaps")}</span>
            <select
              data-testid="mobile-domain-select"
              aria-label={t("primaryNavigation")}
              value={activeDomainPath}
              onChange={(event) => {
                if (event.target.value) window.location.href = event.target.value;
              }}
            >
              <option value="" disabled>
                {t("navLiveMaps")}
              </option>
              {DOMAIN_ROUTES.map((domain) => (
                <option key={domain.slug} value={`/d/${domain.slug}`}>
                  {nodeName(domain.rootId, domain.title)}
                </option>
              ))}
            </select>
          </label>
          {DOMAIN_ROUTES.map((domain) => {
            const href = `/d/${domain.slug}`;
            const isActive = activeDomainPath === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={domain.slug}
                href={href}
                className={["header-domain-link", isActive ? "active" : ""].filter(Boolean).join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {nodeName(domain.rootId, domain.title)}
              </Link>
            );
          })}
          <span className="header-nav-separator" aria-hidden="true" />
          <Link href="/explore" className="header-secondary-link">
            {t("navExplore")}
          </Link>
          <Link href="/gate" className="header-secondary-link">
            {t("navGate")}
          </Link>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

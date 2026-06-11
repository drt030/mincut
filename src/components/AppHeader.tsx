"use client";

import Link from "next/link";
import { V0_TARGET_NODE_ID } from "@/lib/graphTraversal";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

export function AppHeader() {
  const { t } = useLanguage();
  return (
    <header className="app-header">
      <Link href="/" className="brand">
        {t("brand")}
      </Link>
      <div className="header-actions">
        <nav>
          <Link href="/graph">{t("navGraph")}</Link>
          <Link href={`/product/${V0_TARGET_NODE_ID}`}>{t("navProduct")}</Link>
          <Link href="/gate">{t("navGate")}</Link>
          <Link href="/tasks">{t("navTasks")}</Link>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

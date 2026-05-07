"use client";

import { useLanguage } from "./LanguageProvider";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="language-switcher" aria-label={t("language")}>
      <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")} type="button">
        {t("switchToZh")}
      </button>
      <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} type="button">
        {t("switchToEn")}
      </button>
    </div>
  );
}

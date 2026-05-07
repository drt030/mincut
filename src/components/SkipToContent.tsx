"use client";

import { useLanguage } from "./LanguageProvider";

/**
 * Per iter-45 a11y audit: skip-to-content link surfaced as the first
 * interactive element on every page so KB users can bypass the 5-link
 * header and land on `<main id="main">` in one Tab press. Visually
 * hidden until focused (off-screen positioning), then animates back
 * on-screen with a high-contrast amber background that matches the
 * project-wide :focus-visible ring.
 *
 * Localised: `t("skipToContent")` returns "Skip to content" in EN
 * and "跳转到主要内容" in ZH.
 */
export function SkipToContent() {
  const { t } = useLanguage();
  return (
    <a href="#main" className="skip-link">
      {t("skipToContent")}
    </a>
  );
}

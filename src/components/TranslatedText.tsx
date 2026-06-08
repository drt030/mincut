"use client";

import React from "react";
import { useLanguage } from "./LanguageProvider";

export function TranslatedHeading({ textKey }: { textKey: string }) {
  const { t } = useLanguage();
  return <h1>{t(textKey)}</h1>;
}

export function TranslatedParagraph({ textKey, className }: { textKey: string; className?: string }) {
  const { t } = useLanguage();
  return <p className={className}>{t(textKey)}</p>;
}

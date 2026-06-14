"use client";

import React from "react";
import { useLanguage } from "./LanguageProvider";
import type { Evidence } from "@/lib/schema";

type EvidenceListProps = {
  evidence: Evidence[];
  showInternalReviewState?: boolean;
};

export function EvidenceList({ evidence, showInternalReviewState = false }: EvidenceListProps) {
  const { t } = useLanguage();
  const displayEvidenceText = showInternalReviewState ? rawEvidenceText : publicEvidenceText;
  return (
    <div className="evidence-list-section" data-testid="evidence-list">
      <strong>{t("evidence")}</strong>
      {evidence.length ? (
        <ul className="metric-detail-list evidence-detail-list">
          {evidence.map((item) => {
            return (
              <li className="metric-detail-row" key={item.id}>
                <div className="metric-detail-row-head">
                  {item.url ? (
                    <a className="link-button" href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    <span>{item.title}</span>
                  )}
                  <span className="pill">{t("evidenceTypeLabel")}: {humanizeEvidenceToken(item.type)}</span>
                  {showInternalReviewState ? (
                    <span className="pill">{t("reviewStatusLabel")}: {item.reviewStatus ?? "unreviewed"}</span>
                  ) : null}
                  {item.confidence ? (
                    <span className="pill">{t("confidence")}: {item.confidence}</span>
                  ) : null}
                  {item.machineCheck?.status === "verified" ? (
                    <span className="pill pill-source-checked" title={t("evidenceSourceCheckedHint")}>
                      ✓ {t("evidenceSourceChecked")}
                    </span>
                  ) : null}
                </div>
                {item.sourceName || item.date ? (
                  <div className="metric-detail-row-values">
                    {item.sourceName ? (
                      <span>
                        <strong>{t("evidenceSource")}:</strong> {item.sourceName}
                      </span>
                    ) : null}
                    {item.date ? (
                      <span>
                        <strong>{t("evidenceDate")}:</strong> {item.date}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {item.summary ? <p className="metric-detail-description">{displayEvidenceText(item.summary)}</p> : null}
                {item.limitations ? (
                  <p className="metric-detail-description">
                    <strong>{t("evidenceLimitations")}:</strong> {displayEvidenceText(item.limitations)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="warning">{t("noDirectEvidence")}</p>
      )}
    </div>
  );
}

function humanizeEvidenceToken(value: string): string {
  return value.replace(/_/g, " ");
}

function rawEvidenceText(value: string): string {
  return value;
}

function publicEvidenceText(value: string): string {
  return value
    .replace(/\bunreviewed\b/gi, "not independently validated")
    .replace(/\bneed human review\b/gi, "pending independent validation")
    .replace(/\bneeds human review\b/gi, "pending independent validation")
    .replace(/\bneed review\b/gi, "pending independent validation")
    .replace(/\bneeds review\b/gi, "pending independent validation");
}

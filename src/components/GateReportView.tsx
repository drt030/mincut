"use client";

import type { GateReport } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";

type Props = {
  reports: GateReport[];
  targetNodeId: string;
};

export function GateReportView({ reports, targetNodeId }: Props) {
  const { t } = useLanguage();
  const [latestReport, ...historicalReports] = selectGateReportsForTarget(reports, targetNodeId);

  if (!latestReport) {
    return <p className="warning">{t("noGateReports")}</p>;
  }

  return (
    <div className="detail-list">
      <section className="panel" key={`${latestReport.targetNodeId}-${latestReport.generatedAt}`}>
        <p className="muted">{t("latestGateReport")}</p>
        <GateReportDetails report={latestReport} />
      </section>

      {historicalReports.length > 0 ? (
        <section className="panel">
          <h2>{t("historicalGateReports")}</h2>
          <p className="muted">{t("historicalGateReportsHint")}</p>
          <div className="detail-list">
            {historicalReports.map((report) => (
              <details key={`${report.targetNodeId}-${report.generatedAt}`}>
                <summary>
                  <span className="pill">{t("staleReport")}</span>{" "}
                  <strong>{report.generatedAt}</strong> · {t("score")}: {report.overallScore}/5 ·{" "}
                  <span className={report.passed ? "" : "danger"}>{report.passed ? t("passed") : t("failed")}</span>
                </summary>
                <div className="details-body">
                  <GateReportDetails report={report} compact />
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function selectGateReportsForTarget(reports: GateReport[], targetNodeId: string): GateReport[] {
  return reports
    .filter((report) => report.targetNodeId === targetNodeId)
    .slice()
    .sort((left, right) => timestampForSort(right.generatedAt) - timestampForSort(left.generatedAt));
}

function timestampForSort(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function GateReportDetails({ report, compact = false }: { report: GateReport; compact?: boolean }) {
  const { t } = useLanguage();

  return (
    <>
      <h2>{report.targetNodeId}</h2>
      <p>
        {t("score")}: <strong>{report.overallScore}/5</strong> · {t("status")}:{" "}
        <span className={report.passed ? "" : "danger"}>{report.passed ? t("passed") : t("failed")}</span>
      </p>
      <p className="muted">
        {t("generatedAt")}: {report.generatedAt}
      </p>
      {!compact ? (
        <>
          <h3>{t("recommendedTasks")}</h3>
          <ul>
            {report.recommendedNextTasks.map((task) => (
              <li key={task.title}>
                {task.title} <span className="muted">({task.priority})</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>{t("questions")}</h3>
      <table>
        <tbody>
          {report.questionResults.map((result) => (
            <tr key={result.question}>
              <td>{result.score}/5</td>
              <td>
                <strong>{result.question}</strong>
                <p>{result.answer}</p>
                <GateResultGaps result={result} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function GateResultGaps({ result }: { result: GateReport["questionResults"][number] }) {
  const { t } = useLanguage();
  const sections = [
    { title: t("missingNodes"), items: result.missingNodeIds },
    { title: t("missingEdges"), items: result.missingEdgeDescriptions },
    { title: t("missingEvidence"), items: result.missingEvidenceDescriptions },
    { title: t("safetyNotes"), items: result.safetyNotes },
  ].filter((section): section is { title: string; items: string[] } => Boolean(section.items?.length));

  if (!sections.length && !result.notes) return null;

  return (
    <div className="gate-result-gaps">
      {sections.map((section) => (
        <div key={section.title}>
          <strong>{section.title}</strong>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {result.notes ? (
        <p>
          <strong>{t("notes")}:</strong> {result.notes}
        </p>
      ) : null}
    </div>
  );
}

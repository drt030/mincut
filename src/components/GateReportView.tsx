"use client";

import { maturityAsOfVisualFor, maturityVisualFor } from "@/lib/maturityVisual";
import type { GateReport, Node } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";

type Props = {
  reports: GateReport[];
  targetNodeId: string;
  /**
   * Target Product node, used to render the paired "Node maturity" stat
   * (`maturityScore` / `maturityLabel` / `maturityAsOf`) alongside the
   * report's own "Gate overall" score so a learner cannot confuse the
   * two scales (per CONTEXT.md "Gate overall score").
   */
  targetNode?: Node;
};

export function GateReportView({ reports, targetNodeId, targetNode }: Props) {
  const { t } = useLanguage();
  const [latestReport, ...historicalReports] = selectGateReportsForTarget(reports, targetNodeId);

  if (!latestReport) {
    return <p className="warning">{t("noGateReports")}</p>;
  }

  return (
    <div className="detail-list">
      <section className="panel" key={`${latestReport.targetNodeId}-${latestReport.generatedAt}`}>
        <p className="muted">{t("latestGateReport")}</p>
        <GateReportDetails report={latestReport} targetNode={targetNode} />
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
                  <strong>{report.generatedAt}</strong> · {t("gateOverallLabel")}: {report.overallScore}/5 ·{" "}
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

function GateReportDetails({
  report,
  compact = false,
  targetNode,
}: {
  report: GateReport;
  compact?: boolean;
  targetNode?: Node;
}) {
  const { t } = useLanguage();

  return (
    <>
      <h2>{report.targetNodeId}</h2>
      <p className="gate-scale-stat">
        <strong>{t("gateOverallLabel")}:</strong> <strong>{report.overallScore}/5</strong> · {t("status")}:{" "}
        <span className={report.passed ? "" : "danger"}>{report.passed ? t("passed") : t("failed")}</span>
      </p>
      {targetNode ? <NodeMaturityStat node={targetNode} /> : null}
      {!compact ? <p className="muted scale-separation-note">{t("scaleSeparationNote")}</p> : null}
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

function NodeMaturityStat({ node }: { node: Node }) {
  const { t } = useLanguage();
  const visual = maturityVisualFor(node);
  const asOf = maturityAsOfVisualFor(node);
  const asOfTooltip = asOf.hasValue
    ? t("maturityAsOfTooltip").replace("{date}", asOf.label)
    : t("maturityAsOfMissing");
  const scoreText = typeof node.maturityScore === "number" ? `${node.maturityScore}/100` : t("nodeMaturityScoreMissing");
  return (
    <p className="gate-scale-stat node-maturity-stat">
      <strong>{t("nodeMaturityLabel")}:</strong> <strong>{scoreText}</strong>{" "}
      <span
        className={["maturity-pill", visual.hasLabel ? "" : "missing"].filter(Boolean).join(" ")}
        style={{
          background: visual.bg,
          color: visual.fg,
          opacity: visual.hasLabel ? 1 : 0.65,
        }}
        title={visual.hasLabel ? visual.label : t("maturityLabelMissing")}
      >
        {visual.label}
      </span>{" "}
      <span
        className={["maturity-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
        title={asOfTooltip}
        aria-label={asOfTooltip}
      >
        <span className="maturity-asof-icon" aria-hidden="true">🕒</span>
        {t("maturityAsOf")}: {asOf.label}
      </span>
    </p>
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

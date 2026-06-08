"use client";

import React from "react";
import { maturityAsOfVisualFor, maturityVisualFor } from "@/lib/maturityVisual";
import type { GateReport, GraphData, Node } from "@/lib/schema";
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
  /**
   * Active graph, used to resolve coverage-gap node ids on the cost question
   * into human-readable names + kinds (per ADR-0003 cost UI iter).
   */
  graph?: GraphData;
};

export function GateReportView({ reports, targetNodeId, targetNode, graph }: Props) {
  const { t } = useLanguage();
  const [latestReport, ...historicalReports] = selectGateReportsForTarget(reports, targetNodeId);

  if (!latestReport) {
    return <p className="warning">{t("noGateReports")}</p>;
  }

  return (
    <div className="detail-list">
      <section className="panel" key={`${latestReport.targetNodeId}-${latestReport.generatedAt}`}>
        <p className="muted">{t("latestGateReport")}</p>
        <GateReportDetails report={latestReport} targetNode={targetNode} graph={graph} headingLevel={2} />
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
                  {/*
                   * Per iter-45 a11y audit (MINOR): historical reports nest
                   * inside the parent `<section>` (already an h2-context via
                   * "Historical Reports"). Bump the inner heading level from
                   * h2 -> h3 so SR-mode hierarchy reads h1 -> h2 -> h3, not
                   * h1 -> h2 -> h2. The non-historical (latest) report sits
                   * directly under the page h1 so it keeps headingLevel=2.
                   */}
                  <GateReportDetails report={report} compact graph={graph} headingLevel={3} />
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
  graph,
  headingLevel = 2,
}: {
  report: GateReport;
  compact?: boolean;
  targetNode?: Node;
  graph?: GraphData;
  /**
   * Per iter-45 a11y audit (MINOR): the report renders the same heading
   * tags whether nested under an h1 (latest, sibling to "Historical
   * Reports" h2) or under an h2 (each historical-row inside `<details>`,
   * which is itself inside an h2-section). Pass the depth so SR mode
   * sees a sane hierarchy (h2/h3 for latest, h3/h4 for historical-row).
   */
  headingLevel?: 2 | 3;
}) {
  const { t } = useLanguage();
  // Per iter-45: render the section heading and the sub-headings at
  // headingLevel and headingLevel+1, respectively. We keep the JSX
  // explicit (rather than React.createElement at render time) so the
  // call sites read like normal h2/h3 markup.
  const SectionHeading = headingLevel === 2 ? "h2" : "h3";
  const SubHeading = headingLevel === 2 ? "h3" : "h4";

  return (
    <>
      <SectionHeading>{report.targetNodeId}</SectionHeading>
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
          <SubHeading>{t("recommendedTasks")}</SubHeading>
          <ul>
            {report.recommendedNextTasks.map((task) => (
              <li key={task.title} className={taskKindClass(task.kind)}>
                {task.kind === "resolve_dispute" ? (
                  <span className="task-kind-chip task-kind-resolve-dispute">{t("resolveDisputeChip")}</span>
                ) : task.kind === "human_review" ? (
                  <span className="task-kind-chip task-kind-human-review">{t("humanReviewChip")}</span>
                ) : null}
                {task.title} <span className="muted">({task.priority})</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <SubHeading>{t("questions")}</SubHeading>
      <table>
        <tbody>
          {report.questionResults.map((result) => (
            <tr key={result.question}>
              <td>{result.score}/5</td>
              <td>
                <strong>{result.question}</strong>
                <p>{result.answer}</p>
                {isCostConstraintsResult(result) ? (
                  <CostCoverageGapSection result={result} graph={graph} />
                ) : (
                  <GateResultGaps result={result} />
                )}
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

/**
 * Per ADR-0001, "Resolve dispute" tasks need human resolution and are
 * surfaced distinctly from the rest of the gate-derived task backlog.
 * "Human review" tasks come from `unreviewed`-status records and are also
 * called out, though less urgently than disputes.
 */
function taskKindClass(kind: GateReport["recommendedNextTasks"][number]["kind"]): string {
  if (kind === "resolve_dispute") return "task-kind-row task-kind-row-resolve-dispute";
  if (kind === "human_review") return "task-kind-row task-kind-row-human-review";
  return "";
}

/**
 * Per ADR-0003 the cost-constraints question's score is dominated by the
 * coverage-gap fraction. Surface a learner-friendly collapsible listing the
 * subsystems whose subtree contributed nothing to the rolled-up cost — so
 * "0/5 because no data" reads as "the rolled-up number is unreliable
 * because we have no cost data on these N subsystems."
 *
 * Per iter-15 review (P0 #2), identification routes through the persisted
 * `questionId === "cost_constraints"`; older gate-report files predating
 * the schema bump lack `questionId` and fall back to literal text-match
 * against the canonical English question text.
 */
const COST_CONSTRAINTS_QUESTION_ID = "cost_constraints";
const COST_CONSTRAINTS_QUESTION_TEXT = "What cost constraints dominate the product's feasibility?";
function isCostConstraintsResult(result: GateReport["questionResults"][number]): boolean {
  if (result.questionId) return result.questionId === COST_CONSTRAINTS_QUESTION_ID;
  return result.question.trim() === COST_CONSTRAINTS_QUESTION_TEXT;
}

function CostCoverageGapSection({
  result,
  graph,
}: {
  result: GateReport["questionResults"][number];
  graph?: GraphData;
}) {
  const { kindName, nodeName, t } = useLanguage();
  const gapIds = result.missingNodeIds ?? [];
  if (gapIds.length === 0) {
    return (
      <div className="cost-coverage-complete">
        {/* Per iter-44 a11y: glyph alongside color so the signal is not color-only. */}
        <span className="cost-coverage-dot green" aria-hidden="true">✓</span>
        {t("costCoverageComplete")}
      </div>
    );
  }
  const resolved = gapIds.map((id) => {
    const node = graph?.nodes.find((entry) => entry.id === id);
    return {
      id,
      displayName: node ? nodeName(node.id, node.name) : id,
      kind: node?.kind,
    };
  });
  return (
    <details className="cost-coverage-gap">
      <summary>
        {/* Per iter-44 a11y: glyph alongside color so the signal is not color-only. */}
        <span className="cost-coverage-dot red" aria-hidden="true">⨯</span>
        <strong>
          {t("costCoverageGapTitle").replace("{count}", String(gapIds.length))}
        </strong>
        <span className="muted"> · {t("costCoverageGapHint")}</span>
      </summary>
      <ul className="cost-coverage-gap-list">
        {resolved.map((entry) => (
          <li key={entry.id}>
            <span className="cost-coverage-gap-name">{entry.displayName}</span>
            {entry.kind ? (
              <span className="cost-coverage-gap-kind">{kindName(entry.kind)}</span>
            ) : null}
            <span className="muted cost-coverage-gap-cta">{t("costAddCostHint")}</span>
          </li>
        ))}
      </ul>
      {result.notes ? (
        <p className="muted cost-coverage-gap-notes">
          <strong>{t("notes")}:</strong> {result.notes}
        </p>
      ) : null}
    </details>
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

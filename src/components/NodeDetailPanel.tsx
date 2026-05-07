"use client";

import {
  bottlenecksForNode,
  downstream,
  evidenceForNode,
  isDecompositionFrontier,
  metricsForNode,
  siblingProductsForProduct,
  upstream,
} from "@/lib/graphTraversal";
import { maturityAsOfVisualFor, maturityVisualFor } from "@/lib/maturityVisual";
import type { GraphData, Node } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";

type Props = {
  graph: GraphData;
  node: Node;
  onSelectNode?: (nodeId: string) => void;
};

export function NodeDetailPanel({ graph, node, onSelectNode }: Props) {
  const { kindName, nodeName, t } = useLanguage();
  const up = upstream(graph, node.id);
  // Per ADR-0001: exclude deprecated children from the auto-rendered child
  // lists (Downstream / Bottlenecks / Sibling). The selected node itself is
  // always shown — the user explicitly clicked through — but its child
  // lists hide deprecated entries by default and surface a count.
  const downRawAll = downstream(graph, node.id);
  const downRaw = downRawAll.filter((child) => child.kind !== "metric");
  const down = downRaw.filter((child) => child.reviewStatus !== "deprecated");
  const downDeprecatedCount = downRaw.length - down.length;
  const metrics = metricsForNode(graph, node.id).filter((child) => child.reviewStatus !== "deprecated");
  const bottlenecksAll = bottlenecksForNode(graph, node.id).filter((child) => child.kind !== "metric");
  const bottlenecks = bottlenecksAll.filter((child) => child.reviewStatus !== "deprecated");
  const bottlenecksDeprecatedCount = bottlenecksAll.length - bottlenecks.length;
  const evidence = evidenceForNode(graph, node.id);
  const isExpansionFrontier = node.tags?.includes("decomposition_frontier") ?? false;
  // Per ADR-0005, the broader frontier judgment is: explicit `decomposition_frontier`
  // tag OR (maturityLabel ∉ {mature, widely_adopted} AND no expanded children).
  // The Frontier pill below surfaces that judgment for the learner.
  const isFrontierByJudgment = isDecompositionFrontier(graph, node);
  const isHardToDevelop = node.tags?.includes("hard_to_develop") ?? false;
  const siblingCandidatesAll = node.kind === "product" ? siblingProductsForProduct(graph, node.id) : [];
  const siblingCandidates = siblingCandidatesAll.filter((child) => child.reviewStatus !== "deprecated");
  const siblingDeprecatedCount = siblingCandidatesAll.length - siblingCandidates.length;
  const isDeprecated = node.reviewStatus === "deprecated";
  const isDisputed = node.reviewStatus === "disputed";

  return (
    <aside className="panel detail-list">
      <div>
        <h2>
          {nodeName(node.id, node.name)}
          {isDeprecated ? (
            <span
              className="deprecated-badge"
              title={t("deprecatedBadgeTooltip")}
              aria-label={t("deprecatedBadgeTooltip")}
            >
              {t("deprecatedBadge")}
            </span>
          ) : null}
          {isDisputed ? (
            <span
              className="disputed-badge"
              title={t("disputedBadgeTooltip")}
              aria-label={t("disputedBadgeTooltip")}
            >
              {t("disputedBadge")}
            </span>
          ) : null}
        </h2>
        <div className="pill-row">
          <span className="pill">{kindName(node.kind)}</span>
          {node.domain.map((item) => (
            <span className="pill" key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
      <p>{node.description ?? t("noDescription")}</p>
      {isDeprecated && node.notes?.trim() ? (
        <div className="deprecated-callout">
          <strong>{t("supersessionReason")}</strong>
          <p>{node.notes}</p>
        </div>
      ) : null}
      {isDisputed && node.notes?.trim() ? (
        <div className="disputed-callout">
          <strong>{t("disputeReason")}</strong>
          <p>{node.notes}</p>
        </div>
      ) : null}
      {isExpansionFrontier ? (
        <div className="frontier-callout">
          <strong>{t("expansionFrontier")}</strong>
          <p>{node.notes ?? t("expansionFrontierHint")}</p>
        </div>
      ) : null}
      <div>
        <strong>{t("maturity")}</strong>
        <div className="maturity-pill-row">
          {(() => {
            const visual = maturityVisualFor(node);
            const asOf = maturityAsOfVisualFor(node);
            const asOfTooltip = asOf.hasValue
              ? t("maturityAsOfTooltip").replace("{date}", asOf.label)
              : t("maturityAsOfMissing");
            return (
              <>
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
                  {typeof node.maturityScore === "number" ? (
                    <span className="maturity-pill-score">· {node.maturityScore}</span>
                  ) : null}
                </span>
                <span
                  className={["maturity-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
                  title={asOfTooltip}
                  aria-label={asOfTooltip}
                >
                  <span className="maturity-asof-icon" aria-hidden="true">🕒</span>
                  {t("maturityAsOf")}: {asOf.label}
                </span>
                {isHardToDevelop ? (
                  <span
                    className="key-technology-pill"
                    title={t("hardToDevelopGlyphTooltip")}
                    aria-label={t("hardToDevelopGlyphTooltip")}
                  >
                    <span className="key-technology-pill-icon" aria-hidden="true">🔑</span>
                    {t("keyTechnologyPill")}
                  </span>
                ) : null}
                {isFrontierByJudgment ? (
                  <span
                    className="frontier-pill"
                    title={t("frontierPillTooltip")}
                    aria-label={t("frontierPillTooltip")}
                  >
                    {t("frontierPill")}
                  </span>
                ) : null}
              </>
            );
          })()}
          {node.confidence ? (
            <span className="muted">
              {t("confidence")}: {node.confidence}
            </span>
          ) : null}
        </div>
      </div>
      {node.targetContext ? (
        <div>
          <strong>{t("targetContext")}</strong>
          <ul>
            {Object.entries(node.targetContext).map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <NodeList title={t("metrics")} nodes={metrics} onSelectNode={onSelectNode} />
      <NodeList
        title={t("bottlenecks")}
        nodes={bottlenecks}
        onSelectNode={onSelectNode}
        deprecatedHiddenCount={bottlenecksDeprecatedCount}
      />
      <NodeList title={t("upstream")} nodes={up} onSelectNode={onSelectNode} />
      <NodeList
        title={t("downstream")}
        nodes={down}
        onSelectNode={onSelectNode}
        subtitle={t("nonMetricChildrenHint")}
        deprecatedHiddenCount={downDeprecatedCount}
      />
      {node.kind === "product" ? (
        <NodeList
          title={t("siblingCandidates")}
          nodes={siblingCandidates}
          onSelectNode={onSelectNode}
          subtitle={t("siblingCandidatesHint")}
          deprecatedHiddenCount={siblingDeprecatedCount}
        />
      ) : null}
      <div>
        <strong>{t("evidence")}</strong>
        {evidence.length ? (
          <ul>
            {evidence.map((item) => (
              <li key={item.id}>
                {item.title} <span className="muted">({item.type}, {item.reviewStatus ?? "unreviewed"})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="warning">{t("noDirectEvidence")}</p>
        )}
      </div>
    </aside>
  );
}

function NodeList({
  title,
  nodes,
  onSelectNode,
  subtitle,
  deprecatedHiddenCount = 0,
}: {
  title: string;
  nodes: Node[];
  onSelectNode?: (nodeId: string) => void;
  subtitle?: string;
  deprecatedHiddenCount?: number;
}) {
  const { nodeName, t } = useLanguage();
  // Per ADR-0001, deprecated children are excluded from the auto-rendered
  // child lists by default. We surface a count inline so the learner knows
  // soft-deleted records exist without burying it in the tree.
  const deprecatedNote =
    deprecatedHiddenCount > 0
      ? t("deprecatedHiddenChildrenSuffix").replace("{count}", String(deprecatedHiddenCount))
      : null;
  return (
    <div>
      <strong>{title}</strong>
      {subtitle ? <span className="muted node-list-subtitle"> ({subtitle})</span> : null}
      {deprecatedNote ? (
        <span className="muted node-list-deprecated-note"> ({deprecatedNote})</span>
      ) : null}
      {nodes.length ? (
        <ul>
          {nodes.map((node) => (
            <li key={node.id}>
              {onSelectNode ? (
                <button className="link-button" type="button" onClick={() => onSelectNode(node.id)}>
                  {nodeName(node.id, node.name)}
                </button>
              ) : (
                nodeName(node.id, node.name)
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("none")}</p>
      )}
    </div>
  );
}

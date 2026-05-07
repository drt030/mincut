"use client";

import { bottlenecksForNode, downstream, evidenceForNode, metricsForNode, upstream } from "@/lib/graphTraversal";
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
  // Metrics already render in the dedicated "Metrics" section below (and in
  // the per-node metric-fold strip on graph cards). Filtering them out of
  // Downstream + Bottlenecks keeps each list scoped to its semantic role and
  // avoids the iter-5 punch-list duplication where "Total system cost" /
  // "Parcels per hour" appeared twice.
  const down = downstream(graph, node.id).filter((child) => child.kind !== "metric");
  const metrics = metricsForNode(graph, node.id);
  const bottlenecks = bottlenecksForNode(graph, node.id).filter((child) => child.kind !== "metric");
  const evidence = evidenceForNode(graph, node.id);
  const isExpansionFrontier = node.tags?.includes("decomposition_frontier") ?? false;

  return (
    <aside className="panel detail-list">
      <div>
        <h2>{nodeName(node.id, node.name)}</h2>
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
      <NodeList title={t("bottlenecks")} nodes={bottlenecks} onSelectNode={onSelectNode} />
      <NodeList title={t("upstream")} nodes={up} onSelectNode={onSelectNode} />
      <NodeList
        title={t("downstream")}
        nodes={down}
        onSelectNode={onSelectNode}
        subtitle={t("nonMetricChildrenHint")}
      />
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
}: {
  title: string;
  nodes: Node[];
  onSelectNode?: (nodeId: string) => void;
  subtitle?: string;
}) {
  const { nodeName, t } = useLanguage();
  return (
    <div>
      <strong>{title}</strong>
      {subtitle ? <span className="muted node-list-subtitle"> ({subtitle})</span> : null}
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

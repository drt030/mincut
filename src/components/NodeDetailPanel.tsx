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
import { isCostBearingMetric, rollupCost, targetCostFor, type CostRollupResult } from "@/lib/costRollup";
import { costAsOfVisualFor, formatMetricValue } from "@/lib/metricValueFormat";
import type { GraphData, MetricCurrency, MetricValue, Node } from "@/lib/schema";
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
      <MetricNodeList title={t("metrics")} metrics={metrics} onSelectNode={onSelectNode} />
      {node.kind === "product" ? <ProductCostRollupCard graph={graph} product={node} /> : null}
      {node.kind === "metric" ? <MetricValueDetailRow node={node} /> : null}
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

/**
 * Per ADR-0003, the metric list on the detail panel surfaces the formatted
 * `currentValue` / `targetValue` (range-aware) along with a small `costAsOf`
 * year pill for cost-bearing metrics. The pill mirrors the iter-7
 * `maturityAsOf` treatment so a learner can scan the freshness of every cost
 * claim.
 */
function MetricNodeList({
  title,
  metrics,
  onSelectNode,
}: {
  title: string;
  metrics: Node[];
  onSelectNode?: (nodeId: string) => void;
}) {
  const { nodeName, t } = useLanguage();
  return (
    <div>
      <strong>{title}</strong>
      {metrics.length ? (
        <ul className="metric-detail-list">
          {metrics.map((metricNode) => (
            <MetricNodeListItem
              key={metricNode.id}
              metric={metricNode}
              displayName={nodeName(metricNode.id, metricNode.name)}
              onSelectNode={onSelectNode}
            />
          ))}
        </ul>
      ) : (
        <p className="muted">{t("none")}</p>
      )}
    </div>
  );
}

function MetricNodeListItem({
  metric,
  displayName,
  onSelectNode,
}: {
  metric: Node;
  displayName: string;
  onSelectNode?: (nodeId: string) => void;
}) {
  const { t } = useLanguage();
  const inline = metric.metrics?.[0];
  const unit = inline?.unit;
  const currency = inline?.currency;
  const isCost = isCostBearingMetric(metric);
  const asOf = costAsOfVisualFor(inline?.costAsOf);
  const current = formatMetricValue(inline?.currentValue, unit, currency);
  const target = formatMetricValue(inline?.targetValue, unit, currency);
  return (
    <li className="metric-detail-row">
      <div className="metric-detail-row-head">
        {onSelectNode ? (
          <button type="button" className="link-button" onClick={() => onSelectNode(metric.id)}>
            {displayName}
          </button>
        ) : (
          <span>{displayName}</span>
        )}
        {isCost ? (
          <span
            className={["cost-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
            title={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
            aria-label={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
          >
            <span className="cost-asof-pill-icon" aria-hidden="true">¥</span>
            {t("costAsOf")}: {asOf.label}
          </span>
        ) : null}
        {currency && currency !== "RMB" ? (
          <span className="currency-pill" title={`Currency: ${currency}`}>
            {currency}
          </span>
        ) : null}
      </div>
      <div className="metric-detail-row-values">
        {current.full !== "—" ? (
          <span>
            <strong>{t("current")}:</strong> {current.full}
          </span>
        ) : null}
        {target.full !== "—" ? (
          <span>
            <strong>{t("target")}:</strong> {target.full}
          </span>
        ) : null}
        {current.full === "—" && target.full === "—" ? (
          <span className="muted">{t("metricNoValue")}</span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Per ADR-0003, when a `metric` node is selected its detail panel surfaces
 * the formatted current/target values plus a `costAsOf` year pill if
 * cost-bearing. Mirrors the iter-7 `maturityAsOf` treatment.
 */
function MetricValueDetailRow({ node }: { node: Node }) {
  const { t } = useLanguage();
  const inline = node.metrics?.[0];
  if (!inline) return null;
  const isCost = isCostBearingMetric(node);
  const asOf = costAsOfVisualFor(inline.costAsOf);
  const current = formatMetricValue(inline.currentValue as MetricValue | undefined, inline.unit, inline.currency);
  const target = formatMetricValue(inline.targetValue as MetricValue | undefined, inline.unit, inline.currency);
  const currency = inline.currency as MetricCurrency | undefined;
  return (
    <div className="metric-value-detail">
      <strong>{t("metricValue")}</strong>
      <div className="metric-value-detail-pills">
        {isCost ? (
          <span
            className={["cost-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
            title={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
            aria-label={asOf.hasValue ? `${t("costAsOfTooltip")} ${asOf.label}` : t("costAsOfMissing")}
          >
            <span className="cost-asof-pill-icon" aria-hidden="true">¥</span>
            {t("costAsOf")}: {asOf.label}
          </span>
        ) : null}
        {currency && currency !== "RMB" ? (
          <span className="currency-pill" title={`Currency: ${currency}`}>
            {currency}
          </span>
        ) : null}
      </div>
      <ul>
        {current.full !== "—" ? (
          <li>
            <strong>{t("current")}:</strong> {current.full}
          </li>
        ) : null}
        {target.full !== "—" ? (
          <li>
            <strong>{t("target")}:</strong> {target.full}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Per ADR-0003 the bottom-up cost rollup is exposed at the product level so
 * a learner sees the rolled-up range, the coverage-gap dot (green / amber /
 * red), and the reference target sitting next to each other. The rollup
 * walker is pure and cheap; we run it on every render.
 */
function ProductCostRollupCard({ graph, product }: { graph: GraphData; product: Node }) {
  const { t } = useLanguage();
  let rollup: CostRollupResult | null = null;
  try {
    rollup = rollupCost(graph, product.id);
  } catch {
    rollup = null;
  }
  const target = targetCostFor(graph, product.id);
  // Total subsystems = nodes reachable from this product that the rollup
  // walker would consider "eligible" for cost (mirrors gateRunner.costConstraints).
  const reachable = reachableEligibleSubsystems(graph, product.id);
  const denominator = Math.max(reachable.size, rollup ? rollup.coverageGap.length : 0, 1);
  const gapCount = rollup ? rollup.coverageGap.length : 0;
  const gapFraction = gapCount / denominator;
  const dotClass = coverageDotClass(gapFraction);
  const rolledUp = rollup
    ? formatMetricValue(rollup.rolledUp, "RMB", "RMB")
    : { compact: "—", full: "—", isRange: false };
  const targetFull = target ? formatMetricValue(target.range, "RMB", "RMB").full : null;
  const targetCostString = product.targetContext?.targetCost?.trim();
  return (
    <div className="cost-rollup-card">
      <strong>{t("costRollupTitle")}</strong>
      <div className="cost-rollup-row">
        <span className="cost-rollup-value">{rolledUp.full}</span>
        <span className={["cost-coverage-dot", dotClass].join(" ")} aria-hidden="true" />
        <span className="muted cost-coverage-text">
          {t("costCoverageGapStat")
            .replace("{gap}", String(gapCount))
            .replace("{total}", String(denominator))}
        </span>
      </div>
      {targetFull ? (
        <p className="muted cost-rollup-target">
          <strong>{t("target")}:</strong> {targetFull}
          {target?.costAsOf ? <> · {t("costAsOf")} {target.costAsOf}</> : null}
        </p>
      ) : targetCostString ? (
        <p className="muted cost-rollup-target">
          <strong>{t("target")}:</strong> {targetCostString}
        </p>
      ) : null}
      {rollup?.costAsOf ? (
        <p className="muted">
          <em>{t("costAsOfEarliest")}:</em> {rollup.costAsOf}
        </p>
      ) : null}
      <p className="muted cost-rollup-hint">{t("costRollupHint")}</p>
    </div>
  );
}

function reachableEligibleSubsystems(graph: GraphData, productId: string): Set<string> {
  const ids = new Set<string>();
  const queue: string[] = [productId];
  const seen = new Set<string>();
  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    for (const edge of graph.edges) {
      if (edge.source !== nodeId || edge.relation !== "requires") continue;
      const child = graph.nodes.find((node) => node.id === edge.target);
      if (!child) continue;
      if (
        child.kind === "metric" ||
        child.kind === "evidence" ||
        child.kind === "bottleneck" ||
        child.kind === "placeholder_breakthrough"
      ) {
        continue;
      }
      if (child.reviewStatus === "deprecated") continue;
      ids.add(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

function coverageDotClass(gapFraction: number): string {
  if (gapFraction <= 0.1) return "green";
  if (gapFraction <= 0.5) return "amber";
  return "red";
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

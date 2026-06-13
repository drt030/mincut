"use client";

import React, { useMemo } from "react";
import { useLanguage } from "./LanguageProvider";
import { EvidenceList } from "./EvidenceList";
import { ExposureLockCta, useLockedDomainForNode } from "./ExposureLockCta";
import {
  bottlenecksForNode,
  evidenceForNode,
  implementersForNode,
  manufacturersForNode,
  metricsForNode,
  nodeById,
  requiredModules,
  uniqueNodes,
} from "@/lib/graphTraversal";
import { productMaturity } from "@/lib/maturity";
import { maturityAsOfVisualFor, formatMaturityLabel } from "@/lib/maturityVisual";
import { nodeRisk } from "@/lib/nodeRisk";
import {
  eligibleCostSubsystemIds,
  isCostBearingMetric,
  rollupCost,
  targetCostFor,
  type CostRollupResult,
} from "@/lib/costRollup";
import { costAsOfVisualFor, formatMetricValue } from "@/lib/metricValueFormat";
import { selectCostDriverRoute } from "@/lib/routeHighlight";
import type { GraphData, Node } from "@/lib/schema";

type Props = {
  graph: GraphData;
  product: Node;
};

function heatScoreValue(score: number): string {
  return `${Math.round(score * 100)}/100`;
}

function heatScoreLabel(t: (key: string) => string, score: number): string {
  return `${t("risk")} ${heatScoreValue(score)}`;
}

export function ProductView({ graph, product }: Props) {
  const { language, nodeName, t } = useLanguage();
  const modules = requiredModules(graph, product.id);
  const metrics = metricsForNode(graph, product.id);
  const bottlenecks = uniqueNodes([...bottlenecksForNode(graph, product.id), ...modules.flatMap((module) => bottlenecksForNode(graph, module.id))]);
  const evidence = evidenceForNode(graph, product.id);
  const maturity = productMaturity(graph, product);
  const asOf = maturityAsOfVisualFor(product);
  const manufacturerCandidates = manufacturersForNode(graph, product.id).filter((node) => node.reviewStatus !== "deprecated");
  const serviceCandidates = implementersForNode(graph, product.id).filter((node) => node.reviewStatus !== "deprecated");
  const asOfTooltip = asOf.hasValue
    ? t("maturityAsOfTooltip").replace("{date}", asOf.label)
    : t("maturityAsOfMissing");
  const targetSummary = targetContextSummary(product.targetContext, language);

  return (
    <div className="product-view">
      <section className="product-summary-band">
        <div className="product-summary-main">
          <h1>{nodeName(product.id, product.name)}</h1>
          <p>{product.description}</p>
        </div>
        <div className="product-summary-stat">
          <span>{t("maturity")}</span>
          <strong>{maturity.label} · {maturity.score}/100</strong>
          <span
            className={["maturity-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
            title={asOfTooltip}
            aria-label={asOfTooltip}
          >
            <span className="maturity-asof-icon" aria-hidden="true">🕒</span>
            {t("maturityAsOf")}: {asOf.label}
          </span>
        </div>
        <div className="product-summary-stat">
          <span>{t("target")}</span>
          {targetSummary ? (
            <strong>{targetSummary}</strong>
          ) : (
            <strong className="warning">{t("noTargetContext")}</strong>
          )}
        </div>
      </section>
      {/* v3 iter-27 parity: Top blockers callout, surfaces top 3
          highest-risk requires children for the product. */}
      <ProductViewTopBlockers graph={graph} product={product} />
      {product.kind === "product" ? <ProductInvestorAnswerCard graph={graph} product={product} /> : null}
      <section className="card-grid">
        <ProductCostRollupSummary graph={graph} product={product} />
        {manufacturerCandidates.length ? (
          <CandidateOrganizationCard
            title={t("manufacturerCandidates")}
            subtitle={t("manufacturerCandidatesHint")}
            nodes={manufacturerCandidates}
          />
        ) : null}
        {serviceCandidates.length ? (
          <CandidateOrganizationCard
            title={t("serviceCandidates")}
            subtitle={t("serviceCandidatesHint")}
            nodes={serviceCandidates}
          />
        ) : null}
      </section>
      <section className="card-grid">
        <SummaryCard title={t("requiredModules")} nodes={modules} />
        <KeyMetricsCard title={t("keyMetrics")} metrics={metrics} />
        <SummaryCard title={t("bottlenecks")} nodes={bottlenecks} />
        <div className="card">
          <EvidenceList evidence={evidence} />
        </div>
      </section>
    </div>
  );
}

function ProductInvestorAnswerCard({ graph, product }: { graph: GraphData; product: Node }) {
  const { nodeName, t } = useLanguage();
  const lockedEntry = useLockedDomainForNode(product);
  const answer = useMemo(() => investorAnswerForProduct(graph, product), [graph, product]);
  const hasSignal =
    answer.topRiskNode ||
    answer.costGapRmb !== null ||
    answer.topCostNode ||
    answer.startupOpportunities.length > 0 ||
    answer.throughputConstraints.length > 0 ||
    lockedEntry !== null;
  if (!hasSignal) return null;
  const throughputMetricValues = answer.throughputMetric ? metricNodeValueSummary(answer.throughputMetric) : null;
  const throughputStatus = answer.throughputMetric ? throughputStatusText(answer.throughputMetric, t) : null;
  const throughputConstraintFactors = constraintFactorSummary(answer.throughputConstraints, t);
  return (
    <section className="card investor-answer-card" data-testid="product-investor-answer-panel">
      <h2>{t("investorAnswerPanel")}</h2>
      <p className="muted">{t("investorAnswerCaveat")}</p>
      <ul className="metric-detail-list">
        {answer.topRiskNode ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("topRiskBottleneck")}</span>
              {answer.topRiskScore !== null ? (
                <span
                  className="pill"
                  title={t("heatScoreTooltip")}
                  aria-label={heatScoreLabel(t, answer.topRiskScore)}
                >
                  {heatScoreLabel(t, answer.topRiskScore)}
                </span>
              ) : null}
            </div>
            <p className="metric-detail-description">
              <a className="link-button" href={`/product/${encodeURIComponent(answer.topRiskNode.id)}`}>
                {nodeName(answer.topRiskNode.id, answer.topRiskNode.name)}
              </a>
            </p>
          </li>
        ) : null}
        {answer.costGapRmb !== null ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("costGap")}</span>
            </div>
            <p className="metric-detail-description">
              {formatMetricValue(answer.costGapRmb, "RMB", "RMB").full}{" "}
              {answer.costGapDirection === "under" ? t("costGapUnderTarget") : t("costGapOverTarget")}
            </p>
          </li>
        ) : null}
        {answer.throughputConstraints.length > 0 ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("throughputConstraints")}</span>
              <span className="pill">{answer.throughputConstraints.length}</span>
            </div>
            <p className="metric-detail-description">
              {answer.throughputConstraints.map((constraint, index) => (
                <React.Fragment key={constraint.id}>
                  {index > 0 ? ", " : null}
                  <a className="link-button" href={`/product/${encodeURIComponent(constraint.id)}`}>
                    {nodeName(constraint.id, constraint.name)}
                  </a>
                </React.Fragment>
              ))}
            </p>
            {throughputMetricValues ? (
              <div className="metric-detail-row-values">
                {throughputMetricValues.current ? (
                  <span>
                    <strong>{t("current")}:</strong> {throughputMetricValues.current}
                  </span>
                ) : null}
                {throughputMetricValues.target ? (
                  <span>
                    <strong>{t("target")}:</strong> {throughputMetricValues.target}
                  </span>
                ) : null}
              </div>
            ) : null}
            {throughputStatus ? (
              <p className="metric-detail-description">
                <strong>{t("throughputStatus")}:</strong> {throughputStatus}
              </p>
            ) : null}
            {throughputConstraintFactors ? (
              <p className="metric-detail-description">
                <strong>{t("constraintTypes")}:</strong> {throughputConstraintFactors}
              </p>
            ) : null}
          </li>
        ) : null}
        {answer.topCostNode ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("topCostDriver")}</span>
              {answer.topCostTypicalRmb !== null ? (
                <span className="pill">{formatMetricValue(answer.topCostTypicalRmb, "RMB", "RMB").compact}</span>
              ) : null}
            </div>
            <p className="metric-detail-description">
              <a className="link-button" href={`/product/${encodeURIComponent(answer.topCostNode.id)}`}>
                {nodeName(answer.topCostNode.id, answer.topCostNode.name)}
              </a>
            </p>
            {answer.candidateExposure.length > 0 ? (
              <p className="metric-detail-description">
                <strong>{t("candidateExposure")}:</strong>{" "}
                {answer.candidateExposure
                  .map((org) => candidateExposureSummary(org, nodeName(org.id, org.name)))
                  .join("; ")}
              </p>
            ) : null}
          </li>
        ) : null}
        {lockedEntry ? (
          <li className="metric-detail-row">
            <ExposureLockCta entry={lockedEntry} />
          </li>
        ) : null}
        {answer.startupOpportunities.length > 0 ? (
          <li className="metric-detail-row">
            <div className="metric-detail-row-head">
              <span>{t("topStartupOpportunities")}</span>
              <span className="pill">{answer.startupOpportunities.length}</span>
            </div>
          </li>
        ) : null}
        {answer.startupOpportunities.map((entry, index) => {
          const constraintFactors = constraintFactorsForNode(entry.node, t);
          return (
            <li className="metric-detail-row" key={entry.node.id}>
              <div className="metric-detail-row-head">
                <span>
                  #{index + 1}{" "}
                  <a className="link-button" href={`/product/${encodeURIComponent(entry.node.id)}`}>
                    {nodeName(entry.node.id, entry.node.name)}
                  </a>
                </span>
                <span className="pill">{t("opportunityScore")} {Math.round(entry.score)}</span>
              </div>
              <div className="metric-detail-row-values">
                <span>
                  <strong>{t("risk")}:</strong> {heatScoreValue(nodeRisk(entry.node, graph))}
                </span>
                {entry.costTypicalRmb !== null ? (
                  <span>
                    <strong>{t("costSignal")}:</strong>{" "}
                    {formatMetricValue(entry.costTypicalRmb, "RMB", "RMB").compact}
                  </span>
                ) : null}
              </div>
              {constraintFactors.length > 0 ? (
                <div className="pill-row">
                  {constraintFactors.map((factor) => (
                    <span className="pill" key={factor.tag}>
                      {factor.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {entry.candidateExposure.length > 0 ? (
                <p className="metric-detail-description">
                  <strong>{t("candidateExposure")}:</strong>{" "}
                  {entry.candidateExposure
                    .map((org) => candidateExposureSummary(org, nodeName(org.id, org.name)))
                    .join("; ")}
                </p>
              ) : null}
              {entry.opportunityText ? <p className="metric-detail-description">{entry.opportunityText}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type ProductInvestorAnswer = {
  topRiskNode: Node | null;
  topRiskScore: number | null;
  costGapRmb: number | null;
  costGapDirection: "over" | "under" | null;
  topCostNode: Node | null;
  topCostTypicalRmb: number | null;
  candidateExposure: Node[];
  startupOpportunities: ProductStartupOpportunity[];
  throughputConstraints: Node[];
  throughputMetric: Node | null;
};

type ProductStartupOpportunity = {
  node: Node;
  score: number;
  costTypicalRmb: number | null;
  candidateExposure: Node[];
  opportunityText: string;
};

function investorAnswerForProduct(graph: GraphData, product: Node): ProductInvestorAnswer {
  const topRiskNode = topRiskNodeForProduct(graph, product.id);
  const topRiskScore = topRiskNode ? nodeRisk(topRiskNode, graph) : null;
  const costGap = productCostGapRmb(graph, product.id);
  const costRoute = selectCostDriverRoute(graph, product.id, { limit: 1 });
  const topCostStep = costRoute.steps[0] ?? null;
  const topCostNode = topCostStep ? nodeById(graph, topCostStep.nodeId) : null;
  const throughputMetric = throughputMetricNodesForProduct(graph, product.id)[0] ?? null;
  return {
    topRiskNode,
    topRiskScore,
    costGapRmb: costGap === null ? null : Math.round(Math.abs(costGap)),
    costGapDirection: costGap === null ? null : costGap >= 0 ? "over" : "under",
    topCostNode: topCostNode && topCostNode.reviewStatus !== "deprecated" ? topCostNode : null,
    topCostTypicalRmb: topCostStep ? topCostStep.costTypicalRmb : null,
    candidateExposure: topCostStep ? candidateExposureForNode(graph, topCostStep.nodeId) : [],
    startupOpportunities: rankedStartupOpportunitiesForProduct(graph, product),
    throughputConstraints: throughputConstraintNodesForProduct(graph, product.id),
    throughputMetric,
  };
}

const INVESTOR_RISK_NODE_KINDS = new Set<Node["kind"]>([
  "module",
  "technical_route",
  "scientific_principle",
  "empirical_principle",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "material",
]);

function topRiskNodeForProduct(graph: GraphData, productId: string): Node | null {
  const reachable = requiresReachableIds(graph, productId);
  let best: { node: Node; risk: number } | null = null;
  for (const node of graph.nodes) {
    if (node.id === productId || !reachable.has(node.id)) continue;
    if (node.reviewStatus === "deprecated") continue;
    if (!INVESTOR_RISK_NODE_KINDS.has(node.kind)) continue;
    const risk = nodeRisk(node, graph);
    if (!best || risk > best.risk || (risk === best.risk && node.name.localeCompare(best.node.name) < 0)) {
      best = { node, risk };
    }
  }
  return best?.node ?? null;
}

function productCostGapRmb(graph: GraphData, productId: string): number | null {
  const target = targetCostFor(graph, productId);
  if (!target) return null;
  try {
    const rollup = rollupCost(graph, productId);
    if (!rollup.anyChildContributed) return null;
    return rollup.rolledUp.typical - target.range.typical;
  } catch {
    return null;
  }
}

function rankedStartupOpportunitiesForProduct(graph: GraphData, product: Node, limit = 3): ProductStartupOpportunity[] {
  const reachable = requiresReachableIds(graph, product.id);
  return graph.nodes
    .filter((node) => node.id !== product.id && node.reviewStatus !== "deprecated")
    .filter((node) => node.tags?.includes("startup_opportunity_candidate") && reachable.has(node.id))
    .map((node) => {
      const riskScore = nodeRisk(node, graph) * 100;
      const costTypicalRmb = opportunityCostSignalRmb(graph, node.id);
      const costScore = costTypicalRmb === null ? 0 : Math.min(costTypicalRmb / 5000, 12);
      const exposure = candidateExposureForNode(graph, node.id);
      return {
        node,
        score: riskScore + costScore + constraintTagCount(node) * 4 + Math.min(exposure.length, 5),
        costTypicalRmb,
        candidateExposure: exposure,
        opportunityText: startupOpportunityText(node),
      };
    })
    .sort((a, b) => b.score - a.score || nodeRisk(b.node, graph) - nodeRisk(a.node, graph) || a.node.name.localeCompare(b.node.name))
    .slice(0, limit);
}

function opportunityCostSignalRmb(graph: GraphData, nodeId: string): number | null {
  try {
    const rollup = rollupCost(graph, nodeId);
    return rollup.anyChildContributed ? rollup.rolledUp.typical : null;
  } catch {
    return null;
  }
}

function throughputConstraintNodesForProduct(graph: GraphData, productId: string): Node[] {
  const throughputMetricIds = new Set(throughputMetricNodesForProduct(graph, productId).map((node) => node.id));
  if (throughputMetricIds.size === 0) return [];
  const candidates = new Map<string, Node>();
  for (const edge of graph.edges) {
    if (edge.relation !== "depends_on_metric" || !throughputMetricIds.has(edge.target)) continue;
    const node = nodeById(graph, edge.source);
    if (!node || node.reviewStatus === "deprecated") continue;
    if (!INVESTOR_RISK_NODE_KINDS.has(node.kind)) continue;
    candidates.set(node.id, node);
  }
  return [...candidates.values()]
    .sort((a, b) => nodeRisk(b, graph) - nodeRisk(a, graph) || (a.maturityScore ?? 101) - (b.maturityScore ?? 101) || a.name.localeCompare(b.name))
    .slice(0, 3);
}

function throughputMetricNodesForProduct(graph: GraphData, productId: string): Node[] {
  return graph.edges
    .filter((edge) => edge.relation === "measured_by" && edge.source === productId)
    .map((edge) => nodeById(graph, edge.target))
    .filter((node): node is Node => Boolean(node && node.kind === "metric" && node.reviewStatus !== "deprecated"))
    .filter((node) => node.id === "parcels_per_hour" || (node.tags ?? []).includes("throughput"));
}

function metricNodeValueSummary(node: Node): { current: string | null; target: string | null } | null {
  const metric = node.metrics?.[0];
  if (!metric) return null;
  const current = formatMetricValue(metric.currentValue, metric.unit, metric.currency).full;
  const target = formatMetricValue(metric.targetValue, metric.unit, metric.currency).full;
  if (current === "—" && target === "—") return null;
  return {
    current: current === "—" ? null : current,
    target: target === "—" ? null : target,
  };
}

function throughputStatusText(node: Node, t: (key: string) => string): string | null {
  const metric = node.metrics?.[0];
  if (!metric) return null;
  const currentTypical = metricTypicalNumber(metric.currentValue);
  const targetTypical = metricTypicalNumber(metric.targetValue);
  if (currentTypical === null || targetTypical === null) return t("throughputSensitivityUnknown");
  return currentTypical >= targetTypical
    ? t("throughputSensitivityAtTarget")
    : t("throughputSensitivityBelowTarget");
}

function metricTypicalNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return null;
  const typical = (value as { typical?: unknown }).typical;
  return typeof typical === "number" ? typical : null;
}

function requiresReachableIds(graph: GraphData, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) continue;
    for (const edge of graph.edges) {
      if (edge.source !== source || edge.relation !== "requires") continue;
      if (ids.has(edge.target)) continue;
      const target = nodeById(graph, edge.target);
      if (!target || target.reviewStatus === "deprecated") continue;
      ids.add(edge.target);
      queue.push(edge.target);
    }
  }
  return ids;
}

function candidateExposureForNode(graph: GraphData, nodeId: string): Node[] {
  const seen = new Set<string>();
  const exposure: Node[] = [];
  for (const edge of graph.edges) {
    if (edge.source !== nodeId) continue;
    if (edge.relation !== "manufactured_by" && edge.relation !== "implemented_by") continue;
    if (edge.reviewStatus === "deprecated") continue;
    const org = nodeById(graph, edge.target);
    if (!org || org.kind !== "organization" || org.reviewStatus === "deprecated") continue;
    if (seen.has(org.id)) continue;
    seen.add(org.id);
    exposure.push(org);
  }
  return exposure;
}

const CONSTRAINT_FACTOR_TAG_KEYS: ReadonlyArray<{ tag: string; labelKey: string }> = [
  { tag: "constraint_technical_maturity", labelKey: "constraintFactorTechnicalMaturity" },
  { tag: "constraint_integration_commissioning", labelKey: "constraintFactorIntegrationCommissioning" },
  { tag: "constraint_maintenance_operations", labelKey: "constraintFactorMaintenanceOperations" },
  { tag: "constraint_component_availability", labelKey: "constraintFactorComponentAvailability" },
  { tag: "constraint_material_supply_chain", labelKey: "constraintFactorMaterialSupplyChain" },
  { tag: "constraint_capacity_scale", labelKey: "constraintFactorCapacityScale" },
];

function constraintFactorsForNode(node: Node, t: (key: string) => string): Array<{ tag: string; label: string }> {
  const tags = new Set(node.tags ?? []);
  return CONSTRAINT_FACTOR_TAG_KEYS
    .filter((entry) => tags.has(entry.tag))
    .map((entry) => ({ tag: entry.tag, label: t(entry.labelKey) }));
}

function constraintFactorSummary(nodes: Node[], t: (key: string) => string): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const node of nodes) {
    for (const factor of constraintFactorsForNode(node, t)) {
      if (seen.has(factor.tag)) continue;
      seen.add(factor.tag);
      labels.push(factor.label);
    }
  }
  return labels.join(", ");
}

function startupOpportunityText(node: Node): string {
  return node.notes?.split("Startup opportunity:")[1]?.trim() ?? "";
}

function constraintTagCount(node: Node): number {
  const tags = new Set(node.tags ?? []);
  return CONSTRAINT_FACTOR_TAG_KEYS.filter((entry) => tags.has(entry.tag)).length;
}

function candidateExposureSummary(organization: Node, displayName: string): string {
  const summary = organizationMetricSummary(organization);
  return summary ? `${displayName} (${summary})` : displayName;
}

function targetContextSummary(context: Node["targetContext"], language: "en" | "zh"): string | null {
  if (!context) return null;
  const labels: Partial<Record<keyof NonNullable<Node["targetContext"]>, { en: string; zh: string }>> = {
    targetCost: { en: "Cost target", zh: "成本目标" },
    targetScale: { en: "Scale", zh: "规模" },
    targetPerformance: { en: "Performance", zh: "性能" },
    targetUseCase: { en: "Use case", zh: "使用场景" },
    targetEnvironment: { en: "Environment", zh: "环境" },
    targetDate: { en: "Date", zh: "日期" },
    targetEndEffector: { en: "End-effector", zh: "末端执行器" },
    facilitySize: { en: "Facility size", zh: "设施规模" },
    dailyThroughput: { en: "Daily throughput", zh: "日吞吐量" },
    parcelSpecRange: { en: "Parcel range", zh: "包裹范围" },
  };
  const ordered: Array<keyof NonNullable<Node["targetContext"]>> = [
    "targetCost",
    "targetScale",
    "targetPerformance",
    "targetUseCase",
    "targetEndEffector",
  ];
  const parts = ordered.flatMap((key) => {
    const value = context[key]?.trim();
    if (!value) return [];
    return [`${labels[key]?.[language] ?? key}: ${humanizeTargetContextValue(value)}`];
  });
  return parts.slice(0, 2).join(" · ") || null;
}

function humanizeTargetContextValue(value: string): string {
  return value.replace(/_/g, " ");
}

function CandidateOrganizationCard({
  title,
  subtitle,
  nodes,
}: {
  title: string;
  subtitle: string;
  nodes: Node[];
}) {
  const { nodeName } = useLanguage();
  return (
    <div className="card candidate-organization-card" data-testid="product-candidate-organizations">
      <h2>{title}</h2>
      <p className="muted">{subtitle}</p>
      <ul className="metric-detail-list">
        {nodes.map((node) => {
          const summary = organizationMetricSummary(node);
          return (
            <li key={node.id} className="metric-detail-row">
              <div className="metric-detail-row-head">
                <a className="link-button" href={`/product/${encodeURIComponent(node.id)}`}>
                  {nodeName(node.id, node.name)}
                </a>
                {summary ? <span className="pill">{summary}</span> : null}
              </div>
              {node.notes ? <p className="metric-detail-description">{node.notes}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type InlineNodeMetric = NonNullable<Node["metrics"]>[number];

function organizationMetricSummary(organization: Node): string | null {
  const metrics = organization.metrics ?? [];
  const selected: InlineNodeMetric[] = [];
  const push = (metric: InlineNodeMetric | undefined) => {
    if (!metric || selected.includes(metric)) return;
    if (metric.currentValue === undefined) return;
    selected.push(metric);
  };
  push(metrics.find((metric) => metric.name.toLowerCase().includes("share") || metric.unit === "%"));
  push(metrics.find((metric) => metric.name.toLowerCase().includes("public listing")));
  push(metrics.find((metric) => metric.name.toLowerCase().includes("capacity")));
  push(metrics.find((metric) => metric.name.toLowerCase().includes("revenue")));
  push(metrics.find((metric) => metric.currentValue !== undefined));

  const parts = selected.slice(0, 2).map((metric) => {
    const value = formatMetricValue(metric.currentValue, metric.unit, metric.currency).compact;
    return `${metric.name}: ${value}`;
  });
  return parts.length ? parts.join(" · ") : null;
}

function ProductCostRollupSummary({ graph, product }: { graph: GraphData; product: Node }) {
  const { t } = useLanguage();
  // Memoize on [graph, product.id] per iter-20 P1 review — the walker is
  // pure but iterates O(N·E) over the eligible-subsystem closure, and the
  // parent ProductView re-renders frequently in client navigation.
  const rollup = useMemo<CostRollupResult | null>(() => {
    try {
      return rollupCost(graph, product.id);
    } catch {
      return null;
    }
  }, [graph, product.id]);
  const target = targetCostFor(graph, product.id);
  // Per iter-15 review (P0 #3), use the shared gate-aligned eligibility set.
  const reachable = eligibleCostSubsystemIds(graph, product.id);
  const denominator = Math.max(reachable.size, rollup ? rollup.coverageGap.length : 0, 1);
  const gapCount = rollup ? rollup.coverageGap.length : 0;
  const gapFraction = gapCount / denominator;
  const dotClass = coverageDotClass(gapFraction);
  // Per iter-15 review (P0 #1), avoid surfacing "0 RMB" when no child
  // contributed cost data — see ProductCostRollupCard for the rationale.
  const hasRollupValue = rollup ? rollup.anyChildContributed : false;
  const rolledUpFull = hasRollupValue && rollup
    ? formatMetricValue(rollup.rolledUp, "RMB", "RMB").full
    : t("metricNoValue");
  const rolledUpTooltip = hasRollupValue ? undefined : t("costRollupNoData");
  const targetFull = target ? formatMetricValue(target.range, "RMB", "RMB").full : null;
  const targetCostString = product.targetContext?.targetCost?.trim();
  return (
    <div className="card cost-rollup-card">
      <h2>{t("costRollupTitle")}</h2>
      <p className="cost-rollup-value-line">
        <strong
          className={hasRollupValue ? undefined : "missing"}
          title={rolledUpTooltip}
          aria-label={rolledUpTooltip}
        >
          {rolledUpFull}
        </strong>{" "}
        {/*
          Per iter-44 a11y audit (MAJOR): paired with a glyph so the
          coverage signal does not depend on color alone. See
          NodeDetailPanel.coverageDotGlyph for parity.
        */}
        <span className={["cost-coverage-dot", dotClass].join(" ")} aria-hidden="true">
          {coverageDotGlyph(dotClass)}
        </span>
        <span className="muted cost-coverage-text">
          {coverageStatusText(t, gapCount, denominator)}
        </span>
      </p>
      <p className="muted">
        {t("costCoverageGapStat")
          .replace("{gap}", String(gapCount))
          .replace("{total}", String(denominator))}
      </p>
      {/* Parity with NodeDetailPanel v3 iter-20: surface a warning
          banner when > 50% of subsystems lack cost data so the
          rolled-up number reads as "lower bound", not "estimate". */}
      {gapFraction > 0.5 && hasRollupValue ? (
        <p className="cost-coverage-warning" role="alert">
          ⚠ {t("costCoverageHighGapWarning")
            .replace("{percent}", String(Math.round(gapFraction * 100)))}
        </p>
      ) : null}
      {rollup && (rollup.directOnly || rollup.fromChildren) ? (
        <div className="cost-rollup-breakdown">
          {rollup.directOnly ? (
            <span className="cost-rollup-breakdown-chunk">
              <em>{t("costBreakdownDirect")}:</em>{" "}
              {formatMetricValue(rollup.directOnly, "RMB", "RMB").compact}
            </span>
          ) : null}
          {rollup.fromChildren ? (
            <span className="cost-rollup-breakdown-chunk">
              <em>{t("costBreakdownChildren")}:</em>{" "}
              {formatMetricValue(rollup.fromChildren, "RMB", "RMB").compact}
            </span>
          ) : null}
          {rollup.directLowerThanChildren ? (
            <span
              className="cost-rollup-inversion-warning"
              role="img"
              aria-label={t("costInversionWarning")}
              title={t("costInversionWarning")}
            >
              ⚠ {t("costInversionWarning")}
            </span>
          ) : null}
        </div>
      ) : null}
      {targetFull ? (
        <p>
          <strong>{t("target")}:</strong> {targetFull}
          {target?.costAsOf ? <> · {t("costAsOf")} {target.costAsOf}</> : null}
        </p>
      ) : targetCostString ? (
        <p>
          <strong>{t("target")}:</strong> {targetCostString}
        </p>
      ) : null}
      {rollup?.costAsOf ? (
        <p className="muted">
          <em>{t("costAsOfEarliest")}:</em> {rollup.costAsOf}
        </p>
      ) : null}
      <p className="muted">{t("costRollupHint")}</p>
    </div>
  );
}

function coverageDotClass(gapFraction: number): string {
  if (gapFraction <= 0.1) return "green";
  if (gapFraction <= 0.5) return "amber";
  return "red";
}

/**
 * Per iter-44 a11y audit, the cost-coverage dot pairs its color with a
 * glyph so color-blind viewers get the same signal. Mirrors the helper
 * in NodeDetailPanel.tsx.
 */
function coverageDotGlyph(dotClass: string): string {
  if (dotClass === "green") return "✓";
  if (dotClass === "amber") return "⚠";
  return "⨯";
}

function coverageStatusText(t: (key: string) => string, gapCount: number, denominator: number): string {
  if (gapCount === 0) return t("costCoverageComplete");
  return t("costCoverageGapStat")
    .replace("{gap}", String(gapCount))
    .replace("{total}", String(denominator));
}

function KeyMetricsCard({ title, metrics }: { title: string; metrics: Node[] }) {
  const { nodeName, t } = useLanguage();
  return (
    <div className="card">
      <h2>{title}</h2>
      {metrics.length ? (
        <ul className="metric-detail-list">
          {metrics.map((metricNode) => {
            const inline = metricNode.metrics?.[0];
            const isCost = isCostBearingMetric(metricNode);
            const asOf = costAsOfVisualFor(inline?.costAsOf);
            const current = formatMetricValue(inline?.currentValue, inline?.unit, inline?.currency);
            const target = formatMetricValue(inline?.targetValue, inline?.unit, inline?.currency);
            return (
              <li key={metricNode.id} className="metric-detail-row">
                <div className="metric-detail-row-head">
                  <span>{nodeName(metricNode.id, metricNode.name)}</span>
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
                  {inline?.currency && inline.currency !== "RMB" ? (
                    <span
                      className="currency-pill"
                      title={t("currencyPillTooltip").replace("{currency}", inline.currency)}
                      aria-label={t("currencyPillTooltip").replace("{currency}", inline.currency)}
                    >
                      {inline.currency}
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
          })}
        </ul>
      ) : (
        <p className="muted">{t("none")}</p>
      )}
    </div>
  );
}

function SummaryCard({ title, nodes }: { title: string; nodes: Array<{ id: string; name: string }> }) {
  const { nodeName, t } = useLanguage();
  return (
    <div className="card">
      <h2>{title}</h2>
      {nodes.length ? (
        <ul>
          {nodes.map((node) => (
            <li key={node.id}>{nodeName(node.id, node.name)}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("none")}</p>
      )}
    </div>
  );
}

/**
 * Top blockers callout for /product/... view (parity with the
 * version in NodeDetailPanel). Surfaces the top 3 highest-risk
 * substantive requires-children so a learner can drill from the
 * product page directly to the blocker subsystem.
 */
function ProductViewTopBlockers({ graph, product }: { graph: GraphData; product: Node }) {
  const { nodeName, t } = useLanguage();
  const ranked = useMemo(() => {
    const out: { id: string; child: Node; risk: number }[] = [];
    for (const edge of graph.edges) {
      if (edge.source !== product.id || edge.relation !== "requires") continue;
      const child = graph.nodes.find((n) => n.id === edge.target);
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
      out.push({ id: child.id, child, risk: nodeRisk(child, graph) });
    }
    out.sort((a, b) => b.risk - a.risk);
    return out.slice(0, 3).filter((entry) => entry.risk > 0.1);
  }, [graph, product.id]);
  if (ranked.length === 0) return null;
  return (
    <div className="top-blockers">
      <strong>🎯 {t("topBlockersTitle")}</strong>
      <ol className="top-blockers-list">
        {ranked.map((entry) => {
          const maturityLabel = entry.child.maturityLabel ?? "unknown";
          const maturityText = formatMaturityLabel(maturityLabel);
          return (
            <li key={entry.id}>
              <a
                className="link-button top-blockers-link"
                href={`/graph?stage=focused&focus=${encodeURIComponent(entry.id)}`}
                title={t("topBlockersRiskTooltip")}
                aria-label={`${nodeName(entry.id, entry.child.name)} — ${maturityText} · ${heatScoreLabel(t, entry.risk)}`}
              >
                <span className="top-blockers-name">{nodeName(entry.id, entry.child.name)}</span>
                <span className="top-blockers-meta muted">{maturityText}</span>
              </a>
              <span className="top-blockers-risk" aria-hidden="true">
                {heatScoreLabel(t, entry.risk)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

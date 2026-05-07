"use client";

import { useLanguage } from "./LanguageProvider";
import { bottlenecksForNode, evidenceForNode, metricsForNode, requiredModules, uniqueNodes } from "@/lib/graphTraversal";
import { productMaturity } from "@/lib/maturity";
import { maturityAsOfVisualFor } from "@/lib/maturityVisual";
import {
  eligibleCostSubsystemIds,
  isCostBearingMetric,
  rollupCost,
  targetCostFor,
  type CostRollupResult,
} from "@/lib/costRollup";
import { costAsOfVisualFor, formatMetricValue } from "@/lib/metricValueFormat";
import type { GraphData, Node } from "@/lib/schema";

type Props = {
  graph: GraphData;
  product: Node;
};

export function ProductView({ graph, product }: Props) {
  const { nodeName, t } = useLanguage();
  const modules = requiredModules(graph, product.id);
  const metrics = metricsForNode(graph, product.id);
  const bottlenecks = uniqueNodes([...bottlenecksForNode(graph, product.id), ...modules.flatMap((module) => bottlenecksForNode(graph, module.id))]);
  const evidence = evidenceForNode(graph, product.id);
  const maturity = productMaturity(graph, product);
  const asOf = maturityAsOfVisualFor(product);
  const asOfTooltip = asOf.hasValue
    ? t("maturityAsOfTooltip").replace("{date}", asOf.label)
    : t("maturityAsOfMissing");

  return (
    <div>
      <h1>{nodeName(product.id, product.name)}</h1>
      <p>{product.description}</p>
      <section className="card-grid">
        <div className="card">
          <h2>{t("maturity")}</h2>
          <p>
            <strong>{maturity.label}</strong> · {maturity.score}/100
          </p>
          <div className="maturity-pill-row">
            <span
              className={["maturity-asof-pill", asOf.hasValue ? "" : "missing"].filter(Boolean).join(" ")}
              title={asOfTooltip}
              aria-label={asOfTooltip}
            >
              <span className="maturity-asof-icon" aria-hidden="true">🕒</span>
              {t("maturityAsOf")}: {asOf.label}
            </span>
          </div>
          <p className="muted">{maturity.explanation}</p>
        </div>
        <div className="card">
          <h2>{t("target")}</h2>
          {product.targetContext ? (
            <ul>
              {Object.entries(product.targetContext).map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              ))}
            </ul>
          ) : (
            <p className="warning">{t("noTargetContext")}</p>
          )}
        </div>
      </section>
      <section className="card-grid">
        <ProductCostRollupSummary graph={graph} product={product} />
      </section>
      <section className="card-grid">
        <SummaryCard title={t("requiredModules")} nodes={modules} />
        <KeyMetricsCard title={t("keyMetrics")} metrics={metrics} />
        <SummaryCard title={t("bottlenecks")} nodes={bottlenecks} />
        <SummaryCard title={t("evidence")} nodes={evidence.map((item) => ({ id: item.id, name: item.title }))} />
      </section>
    </div>
  );
}

function ProductCostRollupSummary({ graph, product }: { graph: GraphData; product: Node }) {
  const { t } = useLanguage();
  let rollup: CostRollupResult | null = null;
  try {
    rollup = rollupCost(graph, product.id);
  } catch {
    rollup = null;
  }
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
        <span className={["cost-coverage-dot", dotClass].join(" ")} aria-hidden="true" />
      </p>
      <p className="muted">
        {t("costCoverageGapStat")
          .replace("{gap}", String(gapCount))
          .replace("{total}", String(denominator))}
      </p>
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

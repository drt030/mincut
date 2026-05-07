"use client";

import { useLanguage } from "./LanguageProvider";
import { bottlenecksForNode, evidenceForNode, metricsForNode, requiredModules, uniqueNodes } from "@/lib/graphTraversal";
import { productMaturity } from "@/lib/maturity";
import { maturityAsOfVisualFor } from "@/lib/maturityVisual";
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
        <SummaryCard title={t("requiredModules")} nodes={modules} />
        <SummaryCard title={t("keyMetrics")} nodes={metrics} />
        <SummaryCard title={t("bottlenecks")} nodes={bottlenecks} />
        <SummaryCard title={t("evidence")} nodes={evidence.map((item) => ({ id: item.id, name: item.title }))} />
      </section>
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

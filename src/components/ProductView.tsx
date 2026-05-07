"use client";

import { RouteComparisonView } from "./RouteComparisonView";
import { useLanguage } from "./LanguageProvider";
import { bottlenecksForNode, evidenceForNode, metricsForNode, requiredModules, routesForProduct, uniqueNodes } from "@/lib/graphTraversal";
import { productMaturity } from "@/lib/maturity";
import type { GraphData, Node } from "@/lib/schema";

type Props = {
  graph: GraphData;
  product: Node;
};

export function ProductView({ graph, product }: Props) {
  const { nodeName, t } = useLanguage();
  const modules = requiredModules(graph, product.id);
  const routes = routesForProduct(graph, product.id);
  const metrics = metricsForNode(graph, product.id);
  const bottlenecks = uniqueNodes([...bottlenecksForNode(graph, product.id), ...modules.flatMap((module) => bottlenecksForNode(graph, module.id))]);
  const evidence = evidenceForNode(graph, product.id);
  const maturity = productMaturity(graph, product);

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
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>{t("routeComparison")}</h2>
        <RouteComparisonView graph={graph} routes={routes} />
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

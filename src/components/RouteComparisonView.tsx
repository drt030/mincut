"use client";

import { bottlenecksForNode, evidenceForNode, metricsForNode, targets } from "@/lib/graphTraversal";
import { routeMaturity } from "@/lib/maturity";
import type { GraphData, Node } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";

type Props = {
  graph: GraphData;
  routes: Node[];
};

export function RouteComparisonView({ graph, routes }: Props) {
  const { nodeName, t } = useLanguage();
  if (!routes.length) return <p className="warning">{t("noRoutesDefined")}</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{t("route")}</th>
          <th>{t("requirements")}</th>
          <th>{t("bottlenecks")}</th>
          <th>{t("metrics")}</th>
          <th>{t("maturity")}</th>
          <th>{t("evidence")}</th>
        </tr>
      </thead>
      <tbody>
        {routes.map((route) => {
          const maturity = routeMaturity(graph, route);
          const requirements = targets(graph, route.id, "requires");
          const bottlenecks = bottlenecksForNode(graph, route.id);
          const metrics = metricsForNode(graph, route.id);
          const evidence = evidenceForNode(graph, route.id);
          return (
            <tr key={route.id}>
              <td>
                <strong>{nodeName(route.id, route.name)}</strong>
                <p className="muted">{route.notes}</p>
              </td>
              <td>{requirements.map((node) => nodeName(node.id, node.name)).join(", ") || t("none")}</td>
              <td>{bottlenecks.map((node) => nodeName(node.id, node.name)).join(", ") || t("none")}</td>
              <td>{metrics.map((node) => nodeName(node.id, node.name)).join(", ") || t("none")}</td>
              <td>
                {maturity.label} ({maturity.score}/100)
              </td>
              <td>{evidence.length ? evidence.map((item) => item.title).join(", ") : t("noDirectEvidence")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

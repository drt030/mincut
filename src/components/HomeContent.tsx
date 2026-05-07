"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import type { GraphData } from "@/lib/schema";

export function HomeContent({ graph }: { graph: GraphData }) {
  const { nodeName, t } = useLanguage();
  const product = graph.nodes.find((node) => node.id === "low_cost_parcel_sorting_robot_300k_rmb");

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>{t("brand")}</h1>
          <p>{t("homeIntro")}</p>
          <p className="muted">
            {t("homeV0Focus")} <strong>{product ? nodeName(product.id, product.name) : ""}</strong>.
          </p>
          <div className="button-row">
            <Link href="/graph" className="button">
              {t("openGraph")}
            </Link>
            <Link href="/product/low_cost_parcel_sorting_robot_300k_rmb" className="button secondary">
              {t("productView")}
            </Link>
          </div>
        </div>
        <div className="panel">
          <h2>{t("currentGraph")}</h2>
          <p>{t("nodesCount").replace("{count}", String(graph.nodes.length))}</p>
          <p>{t("edgesCount").replace("{count}", String(graph.edges.length))}</p>
          <p>{t("evidenceItemsCount").replace("{count}", String(graph.evidence.length))}</p>
        </div>
      </section>
      <section className="card-grid">
        <div className="card">
          <h3>{t("validationGate")}</h3>
          <p className="muted">{t("generatedReports")}</p>
          <code>npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run</code>
        </div>
        <div className="card">
          <h3>{t("roadmap")}</h3>
          <p className="muted">/docs/roadmap.md</p>
        </div>
      </section>
    </div>
  );
}

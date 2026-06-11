"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { defaultFocalProduct } from "@/lib/graphTraversal";
import type { GraphData } from "@/lib/schema";

export function HomeContent({ graph }: { graph: GraphData }) {
  const { nodeName, t } = useLanguage();
  const product = defaultFocalProduct(graph);
  const productName = product ? nodeName(product.id, product.name) : "";
  const productHref = product ? `/product/${product.id}` : "/graph";

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>{t("brand")}</h1>
          <p>{t("homeIntro")}</p>
          <p className="muted">{t("homeIntroLearnerNote")}</p>
          <p className="muted">
            {t("homeV0Focus")} <strong>{productName}</strong>
            {productName ? " — " : ""}
            {t("homeV0FocusContext")}
          </p>
          <div className="button-row">
            <Link href="/graph" className="button">
              {t("homeStartCta")}
            </Link>
            <Link href={productHref} className="button secondary">
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
      <section className="panel home-signals">
        <h2>{t("homeVisualSignalsTitle")}</h2>
        <p className="muted">{t("homeVisualSignalsHint")}</p>
        <ul className="signal-legend">
          <li>
            <span className="signal-glyph signal-glyph-bottleneck" aria-hidden="true">
              ⚠
            </span>
            <div>
              <strong>{t("homeSignalBottleneckLabel")}</strong>
              <span className="muted"> — {t("homeSignalBottleneckHint")}</span>
            </div>
          </li>
          <li>
            <span className="signal-glyph signal-glyph-keytech" aria-hidden="true">
              🔑
            </span>
            <div>
              <strong>{t("homeSignalKeyTechLabel")}</strong>
              <span className="muted"> — {t("homeSignalKeyTechHint")}</span>
            </div>
          </li>
          <li>
            <span className="signal-glyph signal-glyph-frontier" aria-hidden="true">
              🔭
            </span>
            <div>
              <strong>{t("homeSignalFrontierLabel")}</strong>
              <span className="muted"> — {t("homeSignalFrontierHint")}</span>
            </div>
          </li>
        </ul>
      </section>
      <section className="card-grid">
        <Link href="/graph" className="card card-link">
          <h3>{t("homeCardGraphTitle")}</h3>
          <p className="muted">{t("homeCardGraphHint")}</p>
        </Link>
        <Link href="/gate" className="card card-link">
          <h3>{t("homeCardGateTitle")}</h3>
          <p className="muted">{t("homeCardGateHint")}</p>
          <code>{`npm run gate -- --target ${product?.id ?? "<product-id>"} --dry-run`}</code>
        </Link>
        <Link href="/tasks" className="card card-link">
          <h3>{t("homeCardTasksTitle")}</h3>
          <p className="muted">{t("homeCardTasksHint")}</p>
        </Link>
        <Link href={productHref} className="card card-link">
          <h3>{t("homeCardProductTitle")}</h3>
          <p className="muted">{t("homeCardProductHint")}</p>
        </Link>
      </section>
    </div>
  );
}

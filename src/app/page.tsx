import { Suspense } from "react";
import { cookies } from "next/headers";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { GraphExplorer } from "@/components/GraphExplorer";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { HomeMapDock } from "@/components/HomeMapDock";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
import { domainBySlug } from "@/lib/domains";
import { stripExposureLayer } from "@/lib/exposureGate";
import { loadActiveGraphData } from "@/lib/graphLoader";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { loadCurrentGraphLayoutArtifactsForRoot } from "@/lib/graphLayoutArtifacts";
import { resolveRouteExposureAccess } from "@/lib/routeAccess";

export default async function HomePage() {
  const domain = domainBySlug("ai-compute");
  if (!domain) throw new Error("Missing ai-compute domain route");

  const full = loadActiveGraphData(domain.rootId);
  const entitlements = await readEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const holderTeasers = computeHolderTeasers(full);
  const graphLayouts = loadCurrentGraphLayoutArtifactsForRoot(domain.rootId, full);
  const { graph, locked } = stripExposureLayer(full, entitlements);
  const exposureAccess = resolveRouteExposureAccess(domain, locked);

  return (
    <div className="graph-first-home">
      <HomeMapDock activeSlug={domain.slug} />
      <div className="graph-first-home-main">
        <section className="graph-first-home-thesis" aria-labelledby="home-map-title">
          <div>
            <p className="graph-first-eyebrow">Research workspace</p>
            <h1 id="home-map-title">{domain.title}</h1>
            <p>{domain.description}</p>
          </div>
          <span>Full-free flagship</span>
        </section>
        <Suspense fallback={<div className="panel">Loading graph...</div>}>
          <ExposureLockProvider locked={locked}>
            <HolderTeaserProvider teasers={holderTeasers}>
              <GraphExplorer
                graph={graph}
                initialRootId={domain.rootId}
                precomputedLayouts={graphLayouts}
                exposureAccess={exposureAccess}
                operatorMode={false}
              />
            </HolderTeaserProvider>
          </ExposureLockProvider>
        </Suspense>
      </div>
    </div>
  );
}

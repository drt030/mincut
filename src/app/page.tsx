import { Suspense } from "react";
import { cookies } from "next/headers";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { GraphExplorer } from "@/components/GraphExplorer";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { HomeLaunchSections, type HomePurchaseState } from "@/components/HomeLaunchSections";
import { HomeMapDock } from "@/components/HomeMapDock";
import { ENTITLEMENT_COOKIE, activeFoundingCheckoutLink, readActiveEntitlements } from "@/lib/entitlements";
import { domainBySlug } from "@/lib/domains";
import { stripExposureLayer } from "@/lib/exposureGate";
import { loadActiveGraphData } from "@/lib/graphLoader";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { loadCurrentGraphLayoutArtifactsForRoot } from "@/lib/graphLayoutArtifacts";
import { resolveRouteExposureAccess } from "@/lib/routeAccess";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const domain = domainBySlug("ai-compute");
  if (!domain) throw new Error("Missing ai-compute domain route");

  const full = loadActiveGraphData(domain.rootId);
  const entitlements = await readActiveEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const query = searchParams ? await searchParams : {};
  const hasAllAccess = entitlements.includes("all");
  const purchaseState: HomePurchaseState = query.purchase === "success" &&
    query.access === "all" &&
    query.unlocked === "1" &&
    hasAllAccess
    ? "success"
    : typeof query.purchase === "string"
      ? "issue"
      : null;
  const holderTeasers = computeHolderTeasers(full);
  const graphLayouts = loadCurrentGraphLayoutArtifactsForRoot(domain.rootId, full);
  const { graph, locked } = stripExposureLayer(full, entitlements);
  const exposureAccess = resolveRouteExposureAccess(domain, locked);
  const foundingCheckoutLink = hasAllAccess ? null : activeFoundingCheckoutLink();

  return (
    <div className="graph-first-home">
      <HomeMapDock activeSlug={domain.slug} />
      <div className="graph-first-home-main">
        <HomeLaunchSections
          domain={domain}
          foundingCheckoutLink={foundingCheckoutLink}
          hasAllAccess={hasAllAccess}
          purchaseState={purchaseState}
        />
        <Suspense fallback={<div className="panel">Loading graph...</div>}>
          <ExposureLockProvider locked={locked} foundingCheckoutLink={foundingCheckoutLink}>
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

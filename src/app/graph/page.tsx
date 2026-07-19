import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { GraphExplorer } from "@/components/GraphExplorer";
import { ENTITLEMENT_COOKIE, activeFoundingCheckoutLink, readActiveEntitlements } from "@/lib/entitlements";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { stripExposureLayer } from "@/lib/exposureGate";
import { loadActiveGraphData } from "@/lib/graphLoader";
import { loadCurrentGraphLayoutArtifactsForRoot } from "@/lib/graphLayoutArtifacts";
import { V0_TARGET_NODE_ID } from "@/lib/graphTraversal";
import { INTERNAL_ROUTE_METADATA, internalRoutesAvailable } from "@/lib/internalRouteGuard";

export const metadata = INTERNAL_ROUTE_METADATA;

/**
 * Per ADR-0006 §Chrome (toolbar), the previous "图谱浏览器" page heading
 * has been removed — it duplicated the route and consumed first-viewport
 * vertical space the radial canvas now uses for its overview. The
 * surface is the canvas.
 */
export default async function GraphPage() {
  if (!internalRoutesAvailable()) notFound();
  const full = loadActiveGraphData();
  const entitlements = await readActiveEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const holderTeasers = computeHolderTeasers(full);
  const graphLayouts = loadCurrentGraphLayoutArtifactsForRoot(V0_TARGET_NODE_ID, full);
  const { graph, locked } = stripExposureLayer(full, entitlements);
  const foundingCheckoutLink = activeFoundingCheckoutLink();
  return (
    <div className="page graph-page">
      <Suspense fallback={<div className="panel">Loading graph...</div>}>
        <ExposureLockProvider locked={locked} foundingCheckoutLink={foundingCheckoutLink}>
          <HolderTeaserProvider teasers={holderTeasers}>
            <GraphExplorer graph={graph} precomputedLayouts={graphLayouts} />
          </HolderTeaserProvider>
        </ExposureLockProvider>
      </Suspense>
    </div>
  );
}

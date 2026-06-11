import { Suspense } from "react";
import { cookies } from "next/headers";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { GraphExplorer } from "@/components/GraphExplorer";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { stripExposureLayer } from "@/lib/exposureGate";
import { loadActiveGraphData } from "@/lib/graphLoader";

/**
 * Per ADR-0006 §Chrome (toolbar), the previous "图谱浏览器" page heading
 * has been removed — it duplicated the route and consumed first-viewport
 * vertical space the radial canvas now uses for its overview. The
 * surface is the canvas.
 */
export default async function GraphPage() {
  const full = loadActiveGraphData();
  const entitlements = await readEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const holderTeasers = computeHolderTeasers(full);
  const { graph, locked } = stripExposureLayer(full, entitlements);
  return (
    <div className="page graph-page">
      <Suspense fallback={<div className="panel">Loading graph...</div>}>
        <ExposureLockProvider locked={locked}>
          <HolderTeaserProvider teasers={holderTeasers}>
            <GraphExplorer graph={graph} />
          </HolderTeaserProvider>
        </ExposureLockProvider>
      </Suspense>
    </div>
  );
}

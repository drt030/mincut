import { Suspense } from "react";
import { cookies } from "next/headers";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { GraphExplorer } from "@/components/GraphExplorer";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
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
  const { graph, locked } = stripExposureLayer(full, entitlements);
  return (
    <div className="page graph-page">
      <Suspense fallback={<div className="panel">Loading graph...</div>}>
        <ExposureLockProvider locked={locked}>
          <GraphExplorer graph={graph} />
        </ExposureLockProvider>
      </Suspense>
    </div>
  );
}

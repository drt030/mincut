import { cookies } from "next/headers";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { ProductView } from "@/components/ProductView";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { stripExposureLayer } from "@/lib/exposureGate";
import { loadGraphData } from "@/lib/graphLoader";
import { nodeById } from "@/lib/graphTraversal";
import { notFound } from "next/navigation";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entitlements = await readEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const full = loadGraphData();
  const holderTeasers = computeHolderTeasers(full);
  // Strip before the lookup so a hidden organization's product page 404s
  // instead of leaking the exposure layer to non-entitled viewers.
  const { graph, locked } = stripExposureLayer(full, entitlements);
  const product = nodeById(graph, id);
  if (!product) notFound();
  return (
    <div className="page">
      <ExposureLockProvider locked={locked}>
        <HolderTeaserProvider teasers={holderTeasers}>
          <ProductView graph={graph} product={product} />
        </HolderTeaserProvider>
      </ExposureLockProvider>
    </div>
  );
}

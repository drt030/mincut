import { cookies } from "next/headers";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { ProductView } from "@/components/ProductView";
import { ENTITLEMENT_COOKIE, activeFoundingCheckoutLink, readActiveEntitlements } from "@/lib/entitlements";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { stripExposureLayer } from "@/lib/exposureGate";
import { loadGraphData } from "@/lib/graphLoader";
import { nodeById } from "@/lib/graphTraversal";
import { INTERNAL_ROUTE_METADATA, internalRoutesAvailable } from "@/lib/internalRouteGuard";
import { notFound } from "next/navigation";

export const metadata = INTERNAL_ROUTE_METADATA;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!internalRoutesAvailable()) notFound();
  const { id } = await params;
  const entitlements = await readActiveEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const full = loadGraphData();
  const holderTeasers = computeHolderTeasers(full);
  // Strip before the lookup so a hidden organization's product page 404s
  // instead of leaking the exposure layer to non-entitled viewers.
  const { graph, locked } = stripExposureLayer(full, entitlements);
  const product = nodeById(graph, id);
  if (!product) notFound();
  const foundingCheckoutLink = activeFoundingCheckoutLink();
  return (
    <div className="page">
      <ExposureLockProvider locked={locked} foundingCheckoutLink={foundingCheckoutLink}>
        <HolderTeaserProvider teasers={holderTeasers}>
          <ProductView graph={graph} product={product} />
        </HolderTeaserProvider>
      </ExposureLockProvider>
    </div>
  );
}

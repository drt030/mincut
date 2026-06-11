import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { GraphExplorer } from "@/components/GraphExplorer";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { stripExposureLayer } from "@/lib/exposureGate";
import { domainBySlug } from "@/lib/domains";
import { loadActiveGraphData } from "@/lib/graphLoader";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const domain = domainBySlug(slug);
  if (!domain) return {};
  return {
    title: domain.title,
    description: domain.description,
    openGraph: { title: domain.title, description: domain.description },
  };
}

export default async function DomainPage({ params }: PageProps) {
  const { slug } = await params;
  const domain = domainBySlug(slug);
  if (!domain) notFound();

  const full = loadActiveGraphData(domain.rootId);
  const entitlements = await readEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const holderTeasers = computeHolderTeasers(full);
  const { graph, locked } = stripExposureLayer(full, entitlements);
  return (
    <div className="page graph-page">
      <Suspense fallback={<div className="panel">Loading graph...</div>}>
        <ExposureLockProvider locked={locked}>
          <HolderTeaserProvider teasers={holderTeasers}>
            <GraphExplorer graph={graph} initialRootId={domain.rootId} />
          </HolderTeaserProvider>
        </ExposureLockProvider>
      </Suspense>
    </div>
  );
}

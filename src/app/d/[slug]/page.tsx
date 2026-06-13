import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DomainThesisBanner } from "@/components/DomainThesisBanner";
import { ExposureAccessBanner } from "@/components/ExposureAccessBanner";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { GraphExplorer } from "@/components/GraphExplorer";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { stripExposureLayer } from "@/lib/exposureGate";
import { domainBySlug } from "@/lib/domains";
import { loadActiveGraphData } from "@/lib/graphLoader";
import { resolveRouteExposureAccess } from "@/lib/routeAccess";

type PageProps = { params: Promise<{ slug: string }> };

const defaultOgImage = "/og/default.png";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const domain = domainBySlug(slug);
  if (!domain) return {};
  const path = `/d/${domain.slug}`;
  return {
    title: domain.title,
    description: domain.description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: domain.title,
      description: domain.description,
      url: path,
      images: [
        {
          url: defaultOgImage,
          width: 1200,
          height: 630,
          alt: `${domain.title} bottleneck map preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: domain.title,
      description: domain.description,
      images: [defaultOgImage],
    },
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
  const exposureAccess = resolveRouteExposureAccess(domain, locked);
  const evidenceSummary = graph.evidence.reduce(
    (summary, item) => {
      if (item.reviewStatus === "deprecated") return summary;
      summary.total += 1;
      if (item.reviewStatus === "reviewed") summary.reviewed += 1;
      return summary;
    },
    { reviewed: 0, total: 0 },
  );
  return (
    <div className="page graph-page">
      <DomainThesisBanner domain={domain} evidence={evidenceSummary} />
      <Suspense fallback={<div className="panel">Loading graph...</div>}>
        <div id="domain-graph">
          <ExposureLockProvider locked={locked}>
            <HolderTeaserProvider teasers={holderTeasers}>
              <GraphExplorer
                graph={graph}
                initialRootId={domain.rootId}
                exposureAccess={exposureAccess}
                operatorMode={false}
              />
            </HolderTeaserProvider>
          </ExposureLockProvider>
        </div>
      </Suspense>
      <ExposureAccessBanner domain={domain} locked={locked} />
    </div>
  );
}

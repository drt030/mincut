import { notFound } from "next/navigation";
import { HomeContent } from "@/components/HomeContent";
import { loadActiveGraphData } from "@/lib/graphLoader";
import { INTERNAL_ROUTE_METADATA, internalRoutesAvailable } from "@/lib/internalRouteGuard";

export const metadata = INTERNAL_ROUTE_METADATA;

export default function ExplorePage() {
  if (!internalRoutesAvailable()) notFound();
  const graph = loadActiveGraphData();
  return <HomeContent graph={graph} />;
}

import { HomeContent } from "@/components/HomeContent";
import { loadActiveGraphData } from "@/lib/graphLoader";

export default function ExplorePage() {
  const graph = loadActiveGraphData();
  return <HomeContent graph={graph} />;
}

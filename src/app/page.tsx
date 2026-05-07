import { HomeContent } from "@/components/HomeContent";
import { loadActiveGraphData } from "@/lib/graphLoader";

export default function HomePage() {
  const graph = loadActiveGraphData();
  return <HomeContent graph={graph} />;
}

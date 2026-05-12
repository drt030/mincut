import { GraphExplorer } from "@/components/GraphExplorer";
import { TranslatedHeading } from "@/components/TranslatedText";
import { loadActiveGraphData } from "@/lib/graphLoader";

export default function GraphPage() {
  const graph = loadActiveGraphData();
  return (
    <div className="page graph-page">
      <TranslatedHeading textKey="graphExplorer" />
      <GraphExplorer graph={graph} />
    </div>
  );
}

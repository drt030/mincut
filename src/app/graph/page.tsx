import { Suspense } from "react";
import { GraphExplorer } from "@/components/GraphExplorer";
import { TranslatedHeading } from "@/components/TranslatedText";
import { loadActiveGraphData } from "@/lib/graphLoader";

export default function GraphPage() {
  const graph = loadActiveGraphData();
  return (
    <div className="page graph-page">
      <TranslatedHeading textKey="graphExplorer" />
      <Suspense fallback={<div className="panel">Loading graph...</div>}>
        <GraphExplorer graph={graph} />
      </Suspense>
    </div>
  );
}

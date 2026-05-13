import { Suspense } from "react";
import { GraphExplorer } from "@/components/GraphExplorer";
import { loadActiveGraphData } from "@/lib/graphLoader";

/**
 * Per ADR-0006 §Chrome (toolbar), the previous "图谱浏览器" page heading
 * has been removed — it duplicated the route and consumed first-viewport
 * vertical space the radial canvas now uses for its overview. The
 * surface is the canvas.
 */
export default function GraphPage() {
  const graph = loadActiveGraphData();
  return (
    <div className="page graph-page">
      <Suspense fallback={<div className="panel">Loading graph...</div>}>
        <GraphExplorer graph={graph} />
      </Suspense>
    </div>
  );
}

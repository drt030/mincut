import { DOMAIN_ROUTES } from "../src/lib/domains";
import { auditGraphGeometry } from "../src/lib/graphGeometryAudit";
import { loadActiveGraphData } from "../src/lib/graphLoader";

const failures: string[] = [];

const GEOMETRY_BUDGETS: Record<string, {
  maxEdgeCrossings: number;
  maxEdgeNodeIntersections: number;
  maxEdgeOverlaps: number;
}> = {
  "ai-compute": { maxEdgeCrossings: 10, maxEdgeNodeIntersections: 90, maxEdgeOverlaps: 0 },
  "humanoid-robotics": { maxEdgeCrossings: 14, maxEdgeNodeIntersections: 90, maxEdgeOverlaps: 2 },
};

const DEFAULT_GEOMETRY_BUDGET = {
  maxEdgeCrossings: 1,
  maxEdgeNodeIntersections: 90,
  maxEdgeOverlaps: 0,
};

for (const route of DOMAIN_ROUTES) {
  const audit = auditGraphGeometry(
    loadActiveGraphData(route.rootId),
    route.rootId,
    GEOMETRY_BUDGETS[route.slug] ?? DEFAULT_GEOMETRY_BUDGET,
  );
  console.log(
    [
      `${route.slug}: root=${audit.rootId}`,
      `visibleEdges=${audit.visibleEdgeCount}`,
      `score=${audit.geometryScore.toFixed(1)}`,
      `crossings=${audit.edgeCrossings.length}`,
      `edgeNode=${audit.edgeNodeIntersections.length}`,
      `overlaps=${audit.edgeOverlaps.length}`,
      `highFanout=${audit.highFanoutNodes.length}`,
      `fanoutPortFailures=${audit.fanoutPortFailures.length}`,
    ].join(" "),
  );

  for (const fanout of audit.highFanoutNodes.slice(0, 5)) {
    console.log(
      [
        `  ${fanout.nodeId}`,
        `outgoing=${fanout.outgoingEdgeCount}`,
        `uniqueAnchors=${fanout.uniqueSourceAnchorCount}`,
        `minAnchorDistance=${fanout.minimumSourceAnchorDistance.toFixed(1)}px`,
      ].join(" "),
    );
  }

  for (const failure of audit.fanoutPortFailures) {
    failures.push(`${route.slug}:${failure}`);
  }
  for (const failure of audit.edgeGeometryFailures) {
    failures.push(`${route.slug}:${failure}`);
  }

  for (const crossing of audit.edgeCrossings.slice(0, 3)) {
    console.log(
      [
        "  crossing",
        `${crossing.edgeA.source}->${crossing.edgeA.target}`,
        "x",
        `${crossing.edgeB.source}->${crossing.edgeB.target}`,
        `at=${crossing.x},${crossing.y}`,
      ].join(" "),
    );
  }
  for (const hit of audit.edgeNodeIntersections.slice(0, 3)) {
    console.log(
      [
        "  edge-node",
        `${hit.source}->${hit.target}`,
        `through=${hit.nodeId}`,
      ].join(" "),
    );
  }
  for (const overlap of audit.edgeOverlaps.slice(0, 3)) {
    console.log(
      [
        "  overlap",
        `${overlap.edgeA.source}->${overlap.edgeA.target}`,
        "near",
        `${overlap.edgeB.source}->${overlap.edgeB.target}`,
        `samples=${overlap.closeSampleCount}`,
      ].join(" "),
    );
  }
}

if (failures.length > 0) {
  console.error("Graph geometry checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Graph geometry checks passed.");

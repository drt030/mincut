import { DOMAIN_ROUTES } from "../src/lib/domains";
import { auditGraphGeometry } from "../src/lib/graphGeometryAudit";
import { loadActiveGraphData } from "../src/lib/graphLoader";

const failures: string[] = [];

for (const route of DOMAIN_ROUTES) {
  const audit = auditGraphGeometry(loadActiveGraphData(route.rootId), route.rootId);
  console.log(
    [
      `${route.slug}: root=${audit.rootId}`,
      `visibleEdges=${audit.visibleEdgeCount}`,
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
}

if (failures.length > 0) {
  console.error("Graph geometry checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Graph geometry checks passed.");

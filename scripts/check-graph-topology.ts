import { auditGraphTopology } from "../src/lib/graphTopologyAudit";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { loadActiveGraphData } from "../src/lib/graphLoader";

const failures: string[] = [];

for (const route of DOMAIN_ROUTES) {
  const audit = auditGraphTopology(loadActiveGraphData(route.rootId), route.rootId);
  const summary = [
    `${route.slug}: root=${audit.rootId}`,
    `structural=${audit.structuralNodeCount}`,
    `neutralMaterial=${audit.neutralMaterialCount}`,
    `neutralNonMaterial=${audit.neutralNonMaterialCount}`,
    `primaryEdges=${audit.primaryEdgeCount}`,
    `crossEdges=${audit.crossEdgeCount}`,
    `multiParent=${audit.multiParentVisibleNodes.length}`,
  ].join(" ");

  console.log(summary);

  if (audit.structuralNodeCount === 0) {
    failures.push(`${route.slug} rendered an empty structural canvas.`);
  }

  if (audit.neutralNonMaterialCount > 0) {
    failures.push(
      `${route.slug} has non-material neutral nodes: ${audit.neutralNonMaterialIds.join(", ")}`,
    );
  }

  for (const shared of audit.multiParentVisibleNodes) {
    if (!shared.primaryParentId) {
      failures.push(
        `${route.slug}:${shared.nodeId} has visible parents ${shared.parentIds.join(", ")} but no single primary parent.`,
      );
      continue;
    }

    if (!shared.parentIds.includes(shared.primaryParentId)) {
      failures.push(
        `${route.slug}:${shared.nodeId} primary parent ${shared.primaryParentId} is not one of ${shared.parentIds.join(", ")}.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Graph topology checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Graph topology checks passed.");

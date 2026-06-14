import { DOMAIN_ROUTES } from "../src/lib/domains";
import { hasCostDisclosure } from "../src/lib/costDisclosure";
import { nodeCostSignalRmb } from "../src/lib/edgeStyleFor";
import { loadActiveGraphData, loadGateReports } from "../src/lib/graphLoader";
import { selectTopN } from "../src/lib/prioritySelection";
import type { GraphData, Node } from "../src/lib/schema";

type TopNodeReadiness = {
  id: string;
  costAnswer: boolean;
  leadTime: boolean;
  constraint: boolean;
  reviewedNonVendorEvidence: number;
};

function hasConstraintReason(node: Node): boolean {
  return Boolean(node.tags?.some((tag) => tag.startsWith("constraint_")));
}

function isVendorSideEvidence(item: GraphData["evidence"][number]): boolean {
  return item.type === "vendor_claim" || item.sourceStatus === "vendor_marketing";
}

function directReviewedNonVendorEvidence(graph: GraphData, node: Node): number {
  const directIds = new Set(node.evidenceIds ?? []);
  const rejectedIds = new Set(node.rejectedEvidenceIds ?? []);
  return graph.evidence.filter((item) => {
    const linked = directIds.has(item.id) || item.supportsNodeIds?.includes(node.id);
    if (!linked || rejectedIds.has(item.id)) return false;
    if (item.reviewStatus !== "reviewed") return false;
    return !isVendorSideEvidence(item);
  }).length;
}

function topReadiness(graph: GraphData): TopNodeReadiness[] {
  return selectTopN(graph, "bottleneck-risk", 3, null).map((entry) => {
    const node = graph.nodes.find((candidate) => candidate.id === entry.nodeId);
    if (!node) {
      return {
        id: entry.nodeId,
        costAnswer: false,
        leadTime: false,
        constraint: false,
        reviewedNonVendorEvidence: 0,
      };
    }
    return {
      id: node.id,
      costAnswer: Boolean(nodeCostSignalRmb(node, graph)) || hasCostDisclosure(node),
      leadTime: typeof node.capacityLeadTimeMonths === "number",
      constraint: hasConstraintReason(node),
      reviewedNonVendorEvidence: directReviewedNonVendorEvidence(graph, node),
    };
  });
}

function formatTopNode(entry: TopNodeReadiness): string {
  const gaps = [
    entry.costAnswer ? null : "cost",
    entry.leadTime ? null : "leadTime",
    entry.constraint ? null : "constraint",
    entry.reviewedNonVendorEvidence > 0 ? null : "reviewedEvidence",
  ].filter((gap): gap is string => Boolean(gap));
  return `${entry.id}{${gaps.length > 0 ? `gap:${gaps.join("|")}` : "ready"}}`;
}

const gateReports = loadGateReports();
const failures: string[] = [];

for (const domain of DOMAIN_ROUTES) {
  const graph = loadActiveGraphData(domain.rootId);
  const reviewedEvidenceCount = graph.evidence.filter((item) => item.reviewStatus === "reviewed").length;
  const vendorEvidenceCount = graph.evidence.filter(isVendorSideEvidence).length;
  const hasGateReport = gateReports.some((report) => report.targetNodeId === domain.rootId);
  const top = topReadiness(graph);
  const topGapCount = top.reduce((count, entry) => {
    const ready =
      entry.costAnswer &&
      entry.leadTime &&
      entry.constraint &&
      entry.reviewedNonVendorEvidence > 0;
    return count + (ready ? 0 : 1);
  }, 0);

  console.log(
    [
      `${domain.slug}: state=${domain.portfolioState}`,
      `reviewedEvidence=${reviewedEvidenceCount}/${graph.evidence.length}`,
      `vendorEvidence=${vendorEvidenceCount}`,
      `gateReport=${hasGateReport ? "yes" : "no"}`,
      `topGaps=${topGapCount}/${top.length}`,
      `top=${top.map(formatTopNode).join(", ")}`,
    ].join(" "),
  );

  if (domain.portfolioState !== "paid-candidate") continue;

  if (reviewedEvidenceCount < 5) {
    failures.push(`${domain.slug} paid-candidate has only ${reviewedEvidenceCount} reviewed evidence records.`);
  }
  if (!hasGateReport) {
    failures.push(`${domain.slug} paid-candidate has no local gate report for ${domain.rootId}.`);
  }
  for (const entry of top) {
    if (!entry.costAnswer) failures.push(`${domain.slug}/${entry.id} missing cost answer.`);
    if (!entry.leadTime) failures.push(`${domain.slug}/${entry.id} missing capacityLeadTimeMonths.`);
    if (!entry.constraint) failures.push(`${domain.slug}/${entry.id} missing constraint_* tag.`);
    if (entry.reviewedNonVendorEvidence === 0) {
      failures.push(`${domain.slug}/${entry.id} missing reviewed non-vendor evidence.`);
    }
  }
}

if (failures.length > 0) {
  console.error("Commercial readiness checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Commercial readiness checks passed for current route states.");

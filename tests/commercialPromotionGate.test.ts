import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { hasCostDisclosure } from "../src/lib/costDisclosure";
import { nodeCostSignalRmb } from "../src/lib/edgeStyleFor";
import { loadActiveGraphData, loadGateReports } from "../src/lib/graphLoader";
import { selectTopN } from "../src/lib/prioritySelection";
import type { GraphData, Node } from "../src/lib/schema";

function hasConstraintReason(node: Node): boolean {
  return Boolean(node.tags?.some((tag) => tag.startsWith("constraint_")));
}

function isVendorSideEvidence(item: GraphData["evidence"][number]): boolean {
  return item.type === "vendor_claim" || item.sourceStatus === "vendor_marketing";
}

function directIndependentEvidence(graph: GraphData, node: Node): number {
  const directIds = new Set(node.evidenceIds ?? []);
  const rejectedIds = new Set(node.rejectedEvidenceIds ?? []);
  return graph.evidence.filter((item) => {
    const linked = directIds.has(item.id) || item.supportsNodeIds?.includes(node.id);
    if (!linked || rejectedIds.has(item.id)) return false;
    if (item.reviewStatus === "deprecated") return false;
    return !isVendorSideEvidence(item);
  }).length;
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

test("audit-preview routes require decision-grade top chokepoint coverage", () => {
  for (const domain of DOMAIN_ROUTES.filter((entry) => entry.portfolioState === "audit-preview")) {
    const graph = loadActiveGraphData(domain.rootId);
    const topEntries = selectTopN(graph, "bottleneck-risk", 3, null);
    assert.ok(topEntries.length >= 3, `${domain.slug} needs at least three top chokepoints before audit preview`);

    for (const entry of topEntries) {
      const node = graph.nodes.find((candidate) => candidate.id === entry.nodeId);
      assert.ok(node, `${domain.slug} top chokepoint ${entry.nodeId} is missing from graph`);
      assert.ok(
        nodeCostSignalRmb(node, graph) || hasCostDisclosure(node),
        `${domain.slug}/${node.id} needs a cost answer before audit preview`,
      );
      assert.equal(
        typeof node.capacityLeadTimeMonths,
        "number",
        `${domain.slug}/${node.id} needs capacityLeadTimeMonths before audit preview`,
      );
      assert.ok(
        hasConstraintReason(node),
        `${domain.slug}/${node.id} needs at least one constraint_* tag before audit preview`,
      );
      assert.ok(
        directIndependentEvidence(graph, node) > 0,
        `${domain.slug}/${node.id} needs direct independent non-vendor evidence before audit preview`,
      );
    }
  }
});

test("paid-candidate promotion requires decision-grade top chokepoint data", () => {
  const gateReports = loadGateReports();

  for (const domain of DOMAIN_ROUTES.filter((entry) => entry.portfolioState === "paid-candidate")) {
    const graph = loadActiveGraphData(domain.rootId);
    const reviewedEvidenceCount = graph.evidence.filter((item) => item.reviewStatus === "reviewed").length;
    assert.ok(
      reviewedEvidenceCount >= 5,
      `${domain.slug} cannot be paid-candidate with only ${reviewedEvidenceCount} reviewed evidence records`,
    );
    assert.ok(
      gateReports.some((report) => report.targetNodeId === domain.rootId),
      `${domain.slug} cannot be paid-candidate without a local gate report for ${domain.rootId}`,
    );

    const topEntries = selectTopN(graph, "bottleneck-risk", 3, null);
    assert.ok(topEntries.length >= 3, `${domain.slug} needs at least three top chokepoints before paid promotion`);

    for (const entry of topEntries) {
      const node = graph.nodes.find((candidate) => candidate.id === entry.nodeId);
      assert.ok(node, `${domain.slug} top chokepoint ${entry.nodeId} is missing from graph`);
      assert.ok(
        nodeCostSignalRmb(node, graph) || hasCostDisclosure(node),
        `${domain.slug}/${node.id} needs a cost magnitude before paid promotion`,
      );
      assert.equal(
        typeof node.capacityLeadTimeMonths,
        "number",
        `${domain.slug}/${node.id} needs capacityLeadTimeMonths before paid promotion`,
      );
      assert.ok(
        hasConstraintReason(node),
        `${domain.slug}/${node.id} needs at least one constraint_* tag before paid promotion`,
      );
      assert.ok(
        directReviewedNonVendorEvidence(graph, node) > 0,
        `${domain.slug}/${node.id} needs direct reviewed non-vendor evidence before paid promotion`,
      );
    }
  }
});

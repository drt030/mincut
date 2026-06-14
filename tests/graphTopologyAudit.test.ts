import test from "node:test";
import assert from "node:assert/strict";
import { isArtifactCanvasNode, isCanvasTreeEdge, isKnowHowNode } from "../src/lib/canvasGraph";
import { auditGraphTopology } from "../src/lib/graphTopologyAudit";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { loadActiveGraphData, loadGraphData } from "../src/lib/graphLoader";
import type { GraphData } from "../src/lib/schema";

function topologyFixture(): GraphData {
  return {
    graphVersion: "test-topology-audit",
    nodes: [
      { id: "P", name: "Focal product", kind: "product", domain: ["test"] },
      { id: "S0", name: "Subsystem 0", kind: "module", domain: ["test"] },
      { id: "S1", name: "Subsystem 1", kind: "module", domain: ["test"] },
      { id: "H", name: "Shared module", kind: "module", domain: ["test"] },
      { id: "M0", name: "Material 0", kind: "material", domain: ["test"], tags: ["bottleneck"] },
    ],
    edges: [
      { id: "ePS0", source: "P", target: "S0", relation: "requires" },
      { id: "ePS1", source: "P", target: "S1", relation: "requires" },
      { id: "eS0H", source: "S0", target: "H", relation: "requires" },
      { id: "eS1H", source: "S1", target: "H", relation: "requires" },
      { id: "eS1M0", source: "S1", target: "M0", relation: "requires" },
    ],
    evidence: [],
  };
}

function duplicateEdgeFixture(): GraphData {
  return {
    graphVersion: "test-topology-duplicate-parent-edge",
    nodes: [
      { id: "P", name: "Focal product", kind: "product", domain: ["test"] },
      { id: "S0", name: "Subsystem 0", kind: "module", domain: ["test"] },
      { id: "H", name: "Duplicated know-how child", kind: "engineering_method", domain: ["test"] },
    ],
    edges: [
      { id: "ePS0", source: "P", target: "S0", relation: "requires" },
      { id: "eS0H", source: "S0", target: "H", relation: "requires" },
      { id: "eS0HDuplicate", source: "S0", target: "H", relation: "implemented_by" },
    ],
    evidence: [],
  };
}

test("auditGraphTopology reports route topology counts and chosen primary parents", () => {
  const audit = auditGraphTopology(topologyFixture(), "P");

  assert.equal(audit.rootId, "P");
  assert.equal(audit.structuralNodeCount, 5);
  assert.equal(audit.neutralMaterialCount, 1);
  assert.equal(audit.neutralNonMaterialCount, 0);
  assert.deepEqual(audit.neutralNonMaterialIds, []);
  assert.equal(audit.primaryEdgeCount, 4);
  assert.equal(audit.crossEdgeCount, 1);
  assert.deepEqual(audit.multiParentVisibleNodes, [
    {
      nodeId: "H",
      parentIds: ["S0", "S1"],
      primaryParentId: "S0",
    },
  ]);
});

test("auditGraphTopology does not treat duplicate visible edges from one parent as multi-parent topology", () => {
  const audit = auditGraphTopology(duplicateEdgeFixture(), "P");

  assert.deepEqual(
    audit.multiParentVisibleNodes,
    [],
    "multi-parent entries require at least two unique visible parent ids, not two raw incoming edges",
  );
});

test("commercial route topology audits have no unexplained non-material neutral canvas nodes", () => {
  for (const route of DOMAIN_ROUTES) {
    const audit = auditGraphTopology(loadActiveGraphData(route.rootId), route.rootId);
    const minimumStructuralNodeCount =
      route.portfolioState === "paid-candidate" || route.portfolioState === "audit-preview" ? 45 : 80;

    assert.ok(
      audit.structuralNodeCount >= minimumStructuralNodeCount,
      `${route.slug} should audit enough route canvas depth for ${route.portfolioState}; got ${audit.structuralNodeCount} structural nodes`,
    );
    assert.equal(
      audit.neutralNonMaterialCount,
      0,
      `${route.slug} has non-material neutral nodes: ${JSON.stringify(audit.neutralNonMaterialIds)}`,
    );
    assert.deepEqual(
      audit.neutralNonMaterialIds,
      [],
      `${route.slug} should list no non-material neutral ids`,
    );
    assert.ok(audit.primaryEdgeCount > 0, `${route.slug} should report primary edge count`);
    assert.ok(audit.crossEdgeCount >= 0, `${route.slug} should report cross edge count`);
    for (const shared of audit.multiParentVisibleNodes) {
      assert.ok(
        shared.parentIds.length >= 2,
        `${route.slug}:${shared.nodeId} should only be listed when it has at least two unique visible parents; got ${JSON.stringify(shared.parentIds)}`,
      );
      assert.ok(
        shared.primaryParentId,
        `${route.slug}:${shared.nodeId} should report exactly one chosen primary parent`,
      );
      assert.ok(
        shared.parentIds.includes(shared.primaryParentId),
        `${route.slug}:${shared.nodeId} primary parent ${shared.primaryParentId} must be one of ${JSON.stringify(shared.parentIds)}`,
      );
    }
  }
});

test("product-layer artifacts are never tree-positioned under know-how nodes", () => {
  const graph = loadGraphData();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const violations = graph.edges.flatMap((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return [];
    if (!isCanvasTreeEdge(edge, nodeById)) return [];
    if (!isKnowHowNode(source) || !isArtifactCanvasNode(target)) return [];
    return [`${edge.id}:${source.id}->${target.id}`];
  });

  assert.deepEqual(
    violations,
    [],
    "product-first graph layout must not use know-how nodes as tree parents for artifact/product-layer nodes",
  );
});

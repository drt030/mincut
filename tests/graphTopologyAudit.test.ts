import test from "node:test";
import assert from "node:assert/strict";
import { filterCanvasGraph, isArtifactCanvasNode, isCanvasNode, isCanvasTreeEdge, isKnowHowNode } from "../src/lib/canvasGraph";
import { auditGraphTopology } from "../src/lib/graphTopologyAudit";
import { radialLayout } from "../src/lib/radialLayout";
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
  assert.equal(audit.neutralMaterialCount, 0);
  assert.deepEqual(audit.neutralMaterialIds, []);
  assert.equal(audit.neutralNonMaterialCount, 0);
  assert.deepEqual(audit.neutralNonMaterialIds, []);
  assert.equal(audit.primaryEdgeCount, 4);
  assert.equal(audit.crossEdgeCount, 1);
  assert.deepEqual(audit.materialParentNonMaterialChildEdges, []);
  assert.deepEqual(audit.artifactTitlePollutionNodeIds, []);
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

test("commercial route product roots require artifact modules before attaching know-how", () => {
  for (const route of DOMAIN_ROUTES) {
    const canvas = filterCanvasGraph(loadActiveGraphData(route.rootId), route.rootId);
    const nodeById = new Map(canvas.nodes.map((node) => [node.id, node]));
    const firstLayerKnowHow = canvas.edges.flatMap((edge) => {
      if (edge.relation !== "requires" || edge.source !== route.rootId) return [];
      const target = nodeById.get(edge.target);
      if (!target || !isKnowHowNode(target)) return [];
      return [`${target.id}:${target.kind}`];
    });

    assert.deepEqual(
      firstLayerKnowHow,
      [],
      `${route.slug} should build the product graph from artifact modules first, then attach know-how below those modules`,
    );
  }
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
    assert.equal(
      audit.neutralMaterialCount,
      0,
      `${route.slug} has material neutral nodes: ${JSON.stringify(audit.neutralMaterialIds)}`,
    );
    assert.deepEqual(
      audit.neutralMaterialIds,
      [],
      `${route.slug} should list no material neutral ids`,
    );
    assert.ok(audit.primaryEdgeCount > 0, `${route.slug} should report primary edge count`);
    assert.ok(audit.crossEdgeCount >= 0, `${route.slug} should report cross edge count`);
    assert.deepEqual(
      audit.materialParentNonMaterialChildEdges,
      [],
      `${route.slug} has material nodes acting as non-material structural parents`,
    );
    assert.deepEqual(
      audit.artifactTitlePollutionNodeIds,
      [],
      `${route.slug} has default artifact titles containing supplier/ticker/verdict language`,
    );
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

test("auditGraphTopology flags verdict and exposure copy in default artifact titles", () => {
  const fixture: GraphData = {
    graphVersion: "test-artifact-title-pollution",
    nodes: [
      { id: "P", name: "Focal product", kind: "product", domain: ["test"] },
      { id: "S", name: "MOCVD equipment - limiting tool", kind: "equipment", domain: ["test"] },
    ],
    edges: [
      { id: "ePS", source: "P", target: "S", relation: "requires" },
    ],
    evidence: [],
  };

  const audit = auditGraphTopology(fixture, "P");

  assert.deepEqual(audit.artifactTitlePollutionNodeIds, [
    "S:MOCVD equipment - limiting tool",
  ]);
});

test("auditGraphTopology flags organization names in non-product artifact titles", () => {
  const fixture: GraphData = {
    graphVersion: "test-artifact-org-name-title-pollution",
    nodes: [
      { id: "P", name: "Focal product", kind: "product", domain: ["test"] },
      { id: "S", name: "TSMC leading-edge foundry capacity", kind: "equipment", domain: ["test"] },
      { id: "org_tsmc", name: "TSMC", kind: "organization", domain: ["test"] },
    ],
    edges: [
      { id: "ePS", source: "P", target: "S", relation: "requires" },
    ],
    evidence: [],
  };

  const audit = auditGraphTopology(fixture, "P");

  assert.deepEqual(audit.artifactTitlePollutionNodeIds, [
    "S:TSMC leading-edge foundry capacity",
  ]);
});

test("AI compute default artifact titles keep MOCVD vendor leads and verdicts out of the canvas label", () => {
  const canvas = filterCanvasGraph(loadGraphData(), "ai_accelerator_module_hbm_cowos");
  const node = canvas.nodes.find((entry) => entry.id === "mocvd_equipment_systems");
  assert.ok(node, "MOCVD equipment should remain visible as an artifact node");
  assert.ok(isArtifactCanvasNode(node), "MOCVD equipment should be an artifact node, not an organization/exposure node");
  assert.doesNotMatch(
    node.name,
    /Aixtron|Veeco|limiting tool/i,
    "default canvas artifact title should not include vendor leads or verdict suffixes",
  );
});

test("AI compute MOCVD equipment uses one product-layer visible parent edge", () => {
  const rootId = "ai_accelerator_module_hbm_cowos";
  const graph = loadGraphData();
  const staleEpitaxyNamedEdge = graph.edges.find((edge) => edge.id === "e_acc_optup_epitaxy__requires__mocvd_equipment");

  assert.equal(
    staleEpitaxyNamedEdge,
    undefined,
    "stale edge id said epitaxy requires MOCVD but pointed at EML, masking a duplicate EML -> MOCVD canvas edge",
  );

  const canvas = filterCanvasGraph(graph, rootId);
  const mocvdRequiresEdges = canvas.edges
    .filter((edge) => edge.target === "mocvd_equipment_systems" && edge.relation === "requires")
    .map((edge) => `${edge.id}:${edge.source}->${edge.target}`)
    .sort((a, b) => a.localeCompare(b));

  assert.deepEqual(
    mocvdRequiresEdges,
    ["e_acc_product_eml_dfb_laser__requires__mocvd_equipment:eml_dfb_laser_diodes->mocvd_equipment_systems"],
    "MOCVD should have exactly one visible product-layer parent edge; epitaxy remains know-how context",
  );

  const layout = radialLayout(canvas, rootId);
  assert.equal(
    layout.edges.get("e_acc_product_eml_dfb_laser__requires__mocvd_equipment")?.style,
    "primary",
    "the single product-layer EML -> MOCVD edge should be the visible primary branch edge",
  );
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

test("source graph keeps artifact dependencies product-first before attaching know-how", () => {
  const graph = loadGraphData();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const structuralRelations = new Set(["requires", "has_route", "implemented_by", "enables"]);
  const violations = graph.edges.flatMap((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return [];
    if (!structuralRelations.has(edge.relation)) return [];
    if (!isKnowHowNode(source) || !isArtifactCanvasNode(target)) return [];
    return [`${edge.id}:${edge.relation}:${source.id}->${target.id}`];
  });

  assert.deepEqual(
    violations,
    [],
    "source data must model artifact dependencies under artifact hosts, then attach know-how to those artifacts",
  );
});

test("source graph does not use material leaves as structural parents for non-material canvas nodes", () => {
  const graph = loadGraphData();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const violations = graph.edges.flatMap((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return [];
    if (!isCanvasTreeEdge(edge, nodeById)) return [];
    if (source.kind !== "material" || target.kind === "material") return [];
    if (!isCanvasNode(source) || !isCanvasNode(target)) return [];
    return [`${edge.id}:${edge.relation}:${source.id}->${target.id}(${target.kind})`];
  });

  assert.deepEqual(
    violations,
    [],
    "material canvas nodes are leaf inputs; model structural/process children under a module/equipment/process host before attaching materials",
  );
});

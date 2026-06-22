import test from "node:test";
import assert from "node:assert/strict";
import { isArtifactCanvasNode } from "../src/lib/canvasGraph";
import { estimatedCostForGraphNode, estimatedCostForNode } from "../src/lib/costEstimate";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { nodeCostSignalKind, nodeCostSignalRmb, nodeTypicalCostRmb } from "../src/lib/edgeStyleFor";
import { loadActiveGraphData, loadGraphData } from "../src/lib/graphLoader";
import type { GraphData } from "../src/lib/schema";

test("estimatedCostForNode supplies low-confidence estimates without overwriting authored cost metrics", () => {
  const graph = loadGraphData();
  const estimatedNode = graph.nodes.find((node) => node.id === "humanoid_end_of_line_calibration_rig");
  const modeledNode = graph.nodes.find((node) => node.id === "humanoid_actuation_system");

  assert.ok(estimatedNode, "fixture should include an unpriced humanoid calibration rig");
  assert.ok(modeledNode, "fixture should include a modeled humanoid actuation cost");

  assert.equal(
    nodeTypicalCostRmb(estimatedNode!, graph),
    null,
    "heuristic estimates must not appear as authored typical-cost metrics",
  );
  const estimate = estimatedCostForNode(estimatedNode!);
  assert.ok(estimate, "unpriced paid-domain artifact should receive a low-confidence estimate");
  assert.ok(estimate!.range.typical > 0, "estimate should expose a positive p50 value");
  assert.equal(nodeCostSignalKind(estimatedNode!, graph), "estimated");
  assert.equal(nodeCostSignalRmb(estimatedNode!, graph), estimate!.range.typical);

  assert.equal(nodeCostSignalKind(modeledNode!, graph), "modeled");
  assert.notEqual(
    nodeCostSignalRmb(modeledNode!, graph),
    estimatedCostForNode(modeledNode!)?.range.typical ?? null,
    "modeled cost signals should use authored graph data before any heuristic fallback",
  );
});

test("live route artifact nodes always expose a modeled or estimated cost signal", () => {
  for (const route of DOMAIN_ROUTES) {
    const graph = loadActiveGraphData(route.rootId);
    const missing = graph.nodes.filter((node) => {
      if (!isArtifactCanvasNode(node)) return false;
      if (node.kind === "product") return false;
      if (node.reviewStatus === "deprecated") return false;
      return nodeCostSignalKind(node, graph) === "missing";
    });

    assert.deepEqual(
      missing.map((node) => `${node.id}:${node.kind}`),
      [],
      `${route.slug} should not render blank cost drivers for artifact nodes`,
    );
  }
});

test("all graph artifact nodes expose a modeled or estimated cost signal", () => {
  const graph = loadGraphData();
  const missing = graph.nodes.filter((node) => {
    if (!isArtifactCanvasNode(node)) return false;
    if (node.kind === "product") return false;
    if (node.reviewStatus === "deprecated") return false;
    return nodeCostSignalKind(node, graph) === "missing";
  });

  assert.deepEqual(
    missing.map((node) => `${node.id}:${node.kind}:${node.domain.join("|")}`),
    [],
    "artifact nodes should never leave reader-facing cost drivers blank; use low-confidence estimates when audited cost is absent",
  );
});

test("estimatedCostForGraphNode bounds unsourced child estimates against direct parent capex", () => {
  const graph: GraphData = {
    graphVersion: "parent-bounded-estimate-test",
    evidence: [],
    nodes: [
      {
        id: "parent_module",
        name: "Parent module",
        kind: "module",
        domain: ["ai_compute_chain"],
        maturityLabel: "early_deployment",
        maturityAsOf: "2026-06",
        metrics: [
          {
            name: "Module capex",
            unit: "RMB",
            currentValue: 100_000_000,
            currency: "RMB",
            costAsOf: "2026",
          },
        ],
      },
      {
        id: "high_na_euv_child",
        name: "High-NA EUV lithography child",
        kind: "equipment",
        domain: ["ai_compute_chain"],
        maturityLabel: "early_deployment",
        maturityAsOf: "2026-06",
      },
      {
        id: "cooling_child",
        name: "Cooling child",
        kind: "equipment",
        domain: ["ai_compute_chain"],
        maturityLabel: "early_deployment",
        maturityAsOf: "2026-06",
      },
    ],
    edges: [
      {
        id: "parent_requires_euv",
        source: "parent_module",
        target: "high_na_euv_child",
        relation: "requires",
      },
      {
        id: "parent_requires_cooling",
        source: "parent_module",
        target: "cooling_child",
        relation: "requires",
      },
    ],
  };
  const euv = graph.nodes.find((node) => node.id === "high_na_euv_child")!;
  const cooling = graph.nodes.find((node) => node.id === "cooling_child")!;

  const baseline = estimatedCostForNode(euv);
  const boundedEuv = estimatedCostForGraphNode(graph, euv);
  const boundedCooling = estimatedCostForGraphNode(graph, cooling);

  assert.equal(baseline?.range.typical, 300_000_000);
  assert.equal(boundedEuv?.basisKind, "parent_bounded");
  assert.equal(boundedCooling?.basisKind, "parent_bounded");
  assert.ok(
    boundedEuv && boundedEuv.range.typical < baseline!.range.typical,
    `expected EUV estimate to be scaled below ${baseline?.range.typical}, got ${boundedEuv?.range.typical}`,
  );
  assert.ok(
    boundedEuv && boundedCooling && boundedEuv.range.typical + boundedCooling.range.typical <= 100_000_000,
    `bounded child estimates should fit the parent capex budget, got ${
      (boundedEuv?.range.typical ?? 0) + (boundedCooling?.range.typical ?? 0)
    }`,
  );
  assert.equal(nodeCostSignalKind(euv, graph), "estimated");
  assert.equal(nodeCostSignalRmb(euv, graph), boundedEuv?.range.typical);
});

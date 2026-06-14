import test from "node:test";
import assert from "node:assert/strict";
import { isArtifactCanvasNode } from "../src/lib/canvasGraph";
import { estimatedCostForNode } from "../src/lib/costEstimate";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { nodeCostSignalKind, nodeCostSignalRmb, nodeTypicalCostRmb } from "../src/lib/edgeStyleFor";
import { loadActiveGraphData, loadGraphData } from "../src/lib/graphLoader";

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

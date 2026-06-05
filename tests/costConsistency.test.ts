import test from "node:test";
import assert from "node:assert/strict";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import {
  bandForValue,
  nodeCostSignalRmb,
  nodeTypicalCostRmb,
  type ColorMode,
} from "../src/lib/edgeStyleFor";
import { nodeRisk } from "../src/lib/nodeRisk";

test("active graph: every expanded direct high-cost node has at least one warm-cost direct dependency", () => {
  const graph = loadActiveGraphData();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  const costBand = (nodeId: string): number | null => {
    const node = nodeById.get(nodeId);
    if (!node) return null;
    const cost = nodeTypicalCostRmb(node, graph);
    if (cost === null || cost <= 0) return null;
    return bandForValue(cost, "cost", graph);
  };

  const violations: string[] = [];
  for (const node of graph.nodes) {
    if (costBand(node.id) !== 5) continue;
    const children = childrenByParent.get(node.id) ?? [];
    if (children.length === 0) continue;
    const highCostChildren = children.filter((id) => {
      const band = costBand(id);
      return band !== null && band >= 4;
    });
    if (highCostChildren.length > 0) continue;

    violations.push(
      `${node.id} has cost band 5 but no direct requires child has cost band >=4: ` +
        children.map((id) => `${id} (band ${costBand(id) ?? "none"})`).join(", "),
    );
  }

  assert.deepEqual(violations, []);
});

test("active graph: every expanded hottest node has a hottest direct dependency in graded modes", () => {
  const graph = loadActiveGraphData();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }

  const uiBand = (nodeId: string, mode: ColorMode): number | null => {
    const node = nodeById.get(nodeId);
    if (!node) return null;
    if (
      (mode === "bottleneck-risk" || mode === "overall") &&
      Array.isArray(node.bottleneckOf) &&
      node.bottleneckOf.length > 0
    ) {
      return 5;
    }
    switch (mode) {
      case "cost": {
        const cost = nodeCostSignalRmb(node, graph);
        if (cost === null || cost <= 0) return null;
        return bandForValue(cost, "cost", graph);
      }
      case "maturity": {
        if (typeof node.maturityScore !== "number") return null;
        return bandForValue(node.maturityScore, "maturity");
      }
      case "bottleneck-risk": {
        return bandForValue(nodeRisk(node, graph), "bottleneck-risk");
      }
      case "overall": {
        return bandForValue(nodeRisk(node, graph), "overall");
      }
      default:
        return null;
    }
  };

  const violations: string[] = [];
  for (const mode of ["maturity", "bottleneck-risk", "overall"] as ColorMode[]) {
    for (const node of graph.nodes) {
      if (uiBand(node.id, mode) !== 5) continue;
      const children = childrenByParent.get(node.id) ?? [];
      if (children.length === 0) continue;
      const hottestChildren = children.filter((id) => uiBand(id, mode) === 5);
      if (hottestChildren.length > 0) continue;

      violations.push(
        `${mode}: ${node.id} has band 5 but no direct requires child has band 5: ` +
          children.map((id) => `${id} (band ${uiBand(id, mode) ?? "none"})`).join(", "),
      );
    }
  }

  assert.deepEqual(violations, []);
});

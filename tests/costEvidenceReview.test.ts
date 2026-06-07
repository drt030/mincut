import test from "node:test";
import assert from "node:assert/strict";

import { loadGraphData } from "../src/lib/graphLoader";

test("cost measured_by edges do not claim reviewed/high confidence when their metric is unreviewed low-confidence", () => {
  const graph = loadGraphData();
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const mismatches = graph.edges.flatMap((edge) => {
    if (edge.relation !== "measured_by") return [];
    const metric = nodesById.get(edge.target);
    if (!metric || metric.kind !== "metric") return [];
    if (!metric.tags?.includes("cost")) return [];
    const metricIsWeak = metric.reviewStatus === "unreviewed" || metric.confidence === "low";
    const edgeOverclaims = edge.reviewStatus === "reviewed" || edge.confidence === "high";
    return metricIsWeak && edgeOverclaims ? [`${edge.id}->${metric.id}`] : [];
  });

  assert.deepEqual(mismatches, []);
});

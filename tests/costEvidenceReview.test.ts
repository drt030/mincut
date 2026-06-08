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

test("industrial robot arm body cost is calibrated above low-end marketplace prices", () => {
  const graph = loadGraphData();
  const metric = graph.nodes.find((node) => node.id === "industrial_robot_arm_body_cost");
  assert.equal(metric?.kind, "metric");

  const cost = metric.metrics?.find((item) => item.name === "Cost")?.currentValue;
  assert.ok(cost && typeof cost === "object" && "typical" in cost);
  assert.ok(
    cost.typical >= 150_000,
    `industrial robot arm body p50 should reflect mid-tier 5-10 kg six-axis arm pricing, got ${cost.typical}`,
  );
  assert.ok(
    cost.max >= 240_000,
    `industrial robot arm body high range should include public 7 kg arm listings above 20k USD, got ${cost.max}`,
  );

  const evidenceIds = new Set(metric.evidenceIds ?? []);
  assert.ok(
    evidenceIds.has("ev_industrial_robot_arm_body_cost_topstar_2026"),
    "metric should cite a named mid-tier 6/7 kg public price listing",
  );
  assert.ok(
    evidenceIds.has("ev_industrial_robot_arm_body_cost_grabarobot_2026"),
    "metric should cite a payload/reach price guide rather than only an internal note",
  );

  const evidence = graph.evidence.filter((item) => evidenceIds.has(item.id));
  assert.ok(
    evidence.some((item) => item.url?.includes("made-in-china.com")),
    "public calibration evidence should include the marketplace listing URL",
  );
  assert.ok(
    evidence.every((item) => item.reviewStatus === "unreviewed"),
    "public price samples are calibration evidence, not reviewed procurement quotes",
  );
});

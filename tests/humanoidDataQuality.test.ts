import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadActiveGraphData, loadGraphData, loadTasks } from "../src/lib/graphLoader";
import type { GraphData, Node } from "../src/lib/schema";

// Gate A8 (domain-expansion acceptance standard): pin decision-grade fields on the
// humanoid_robotics headline bottlenecks so a regression that strips maturity,
// bottleneck flags, or independent evidence fails CI instead of shipping silently.

function directEvidenceFor(graph: GraphData, node: Node): GraphData["evidence"] {
  const directIds = new Set(node.evidenceIds ?? []);
  const rejectedIds = new Set(node.rejectedEvidenceIds ?? []);
  return graph.evidence.filter((item) => {
    if (rejectedIds.has(item.id)) return false;
    return directIds.has(item.id) || item.supportsNodeIds?.includes(node.id);
  });
}

function isVendorSideEvidence(item: GraphData["evidence"][number]): boolean {
  return item.type === "vendor_claim" || item.sourceStatus === "vendor_marketing";
}

function readJsonArray(filePath: string): Array<Record<string, unknown>> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<Record<string, unknown>>;
}

const HEADLINE_BOTTLENECKS = [
  "humanoid_rare_earth_magnet_supply",
  "humanoid_strain_wave_reducer",
  "humanoid_planetary_roller_screw",
];

test("humanoid headline bottlenecks carry decision-grade fields + independent evidence", () => {
  const graph = loadActiveGraphData("humanoid_robot_key_component_stack");
  for (const id of HEADLINE_BOTTLENECKS) {
    const node = graph.nodes.find((candidate) => candidate.id === id);
    assert.ok(node, `${id} should exist in the humanoid graph`);

    assert.ok((node.tags ?? []).includes("bottleneck"), `${id} should be tagged a bottleneck`);
    assert.ok(
      typeof node.maturityLabel === "string" && node.maturityLabel.length > 0,
      `${id} needs a maturityLabel (decision-grade maturity)`,
    );
    assert.match(node.maturityAsOf ?? "", /^\d{4}-\d{2}$/, `${id} needs a dated maturityAsOf (YYYY-MM)`);

    const directEvidence = directEvidenceFor(graph, node);
    assert.ok(directEvidence.length > 0, `${id} needs direct evidence support`);
    assert.ok(
      directEvidence.every((item) => item.reviewStatus !== "deprecated"),
      `${id} must not rely on deprecated evidence`,
    );
    assert.ok(
      directEvidence.some((item) => !isVendorSideEvidence(item)),
      `${id} needs at least one independent (non-vendor) evidence record`,
    );
  }
});

test("humanoid rare-earth magnet chokepoint is wired as a motor-stack bottleneck with an independent source", () => {
  const graph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const node = graph.nodes.find((candidate) => candidate.id === "humanoid_rare_earth_magnet_supply");
  assert.ok(node, "rare-earth magnet supply node should exist");
  assert.equal(node.kind, "material");

  const bottleneckOf = Array.isArray(node.bottleneckOf)
    ? node.bottleneckOf
    : node.bottleneckOf
      ? [node.bottleneckOf]
      : [];
  assert.ok(
    bottleneckOf.includes("humanoid_motor_stack"),
    "the NdFeB magnet supply must read as a bottleneck of the motor stack",
  );

  // the China heavy-rare-earth export-control chokepoint needs a real independent (analyst/news) source,
  // not just vendor product pages.
  const directEvidence = directEvidenceFor(graph, node);
  assert.ok(
    directEvidence.some((item) => !isVendorSideEvidence(item) && item.type === "news"),
    "the magnet chokepoint needs an independent news/analyst source (e.g. the China export-control filing)",
  );
});

test("humanoid evidence audit demotes dead sources instead of leaving them active", () => {
  const graph = loadGraphData();
  const rawHosts = [
    ...readJsonArray(path.join(process.cwd(), "data", "nodes", "humanoid_robotics.json")),
    ...readJsonArray(path.join(process.cwd(), "data", "edges", "humanoid_robotics_edges.json")),
  ];
  const demotedIds = [
    "ev_humanoid_harmonic_ir",
    "ev_humanoid_leaderdrive_ticker",
    "ev_humanoid_infineon_humanoid_blocks",
    "ev_humanoid_syensqo_ketaspire_structural",
  ];

  for (const id of demotedIds) {
    const evidence = graph.evidence.find((item) => item.id === id);
    assert.ok(evidence, `${id} should remain in evidence records for audit traceability`);
    assert.equal(evidence.reviewStatus, "unreviewed", `${id} must not be owner-reviewed by the audit agent`);
    assert.equal(evidence.machineCheck?.status, "failed", `${id} should be machine-failed after source refresh`);
    assert.match(evidence.sourceStatus ?? "", /^(404|unreachable)$/);

    const activeHosts = rawHosts.filter((item) => ((item.evidenceIds as string[] | undefined) ?? []).includes(id));
    assert.equal(activeHosts.length, 0, `${id} must not remain in active evidenceIds`);

    const rejectedHosts = rawHosts.filter((item) =>
      ((item.rejectedEvidenceIds as string[] | undefined) ?? []).includes(id),
    );
    assert.ok(rejectedHosts.length > 0, `${id} should be retained under rejectedEvidenceIds`);
  }
});

test("humanoid graph pins Figure 03 as the unreviewed primary benchmark platform", () => {
  const graph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const reference = graph.nodes.find((candidate) => candidate.id === "humanoid_figure03_reference_platform");
  assert.ok(reference, "Figure 03 reference platform should exist");
  assert.equal(reference.kind, "product");
  assert.equal(reference.reviewStatus, "unreviewed");
  assert.ok((reference.tags ?? []).includes("benchmark"));
  assert.ok(
    (reference.evidenceIds ?? []).includes("ev_humanoid_figure03_intro_platform"),
    "Figure 03 reference platform should cite the official introduction evidence",
  );
  const directEvidence = directEvidenceFor(graph, reference);
  assert.ok(
    directEvidence.some((item) => item.sourceName === "BMW Group" && item.type === "field_case"),
    "Figure 03 benchmark should include a BMW customer/workcell field-case anchor",
  );
  assert.ok(
    directEvidence.some((item) => item.sourceName === "TIME" && item.type === "news"),
    "Figure 03 benchmark should include an independent home-readiness caveat",
  );
  assert.ok(
    !((reference.tags ?? []).includes("vendor_claim_only")),
    "Figure 03 benchmark should not be tagged as vendor-claim-only after independent caveat evidence is added",
  );

  const benchmarkEdge = graph.edges.find(
    (candidate) =>
      candidate.id === "e_humanoid_stack__validated_by__figure03_reference" &&
      candidate.source === "humanoid_robot_key_component_stack" &&
      candidate.target === "humanoid_figure03_reference_platform" &&
      candidate.relation === "validated_by",
  );
  assert.ok(benchmarkEdge, "root stack should be validated by the Figure 03 benchmark node");

  const benchmarkDetails = [
    "humanoid_inductive_charging_dock",
    "humanoid_hand_palm_camera",
    "humanoid_fleet_connectivity_data_offload",
  ];
  for (const id of benchmarkDetails) {
    const node = graph.nodes.find((candidate) => candidate.id === id);
    assert.ok(node, `${id} should exist as a Figure 03 benchmark detail`);
    assert.equal(node.reviewStatus, "unreviewed", `${id} should remain unreviewed`);
    assert.ok((node.tags ?? []).includes("benchmark_figure03"), `${id} should carry benchmark_figure03 tag`);
  }
});

test("Figure 03 benchmark keeps audit gaps explicit until non-vendor evidence exists", () => {
  const graph = loadActiveGraphData("humanoid_robot_key_component_stack");
  const reference = graph.nodes.find((candidate) => candidate.id === "humanoid_figure03_reference_platform");
  assert.ok(reference, "Figure 03 reference platform should exist");

  const requiredGapTags = [
    "not_decision_grade",
    "audit_gap_production_ramp",
    "audit_gap_uptime_reliability",
    "audit_gap_autonomy_rate",
    "audit_gap_safety_certification",
    "audit_gap_fleet_learning",
    "no_supplier_bom_inference",
  ];
  for (const tag of requiredGapTags) {
    assert.ok((reference.tags ?? []).includes(tag), `Figure 03 benchmark should keep ${tag} tag`);
  }

  const decisionStatus = reference.metrics?.find((metric) => metric.name === "Decision-grade evidence status");
  assert.ok(decisionStatus, "Figure 03 benchmark should expose a decision-grade evidence status metric");
  const statusText = String(decisionStatus.currentValue ?? "");
  for (const phrase of [
    "Not decision-grade",
    "production ramp",
    "uptime/reliability",
    "autonomy rate",
    "safety/certification",
    "fleet-learning/data-offload",
    "supplier/BOM",
  ]) {
    assert.match(statusText, new RegExp(phrase.replace("/", "\\/"), "i"), `status metric should mention ${phrase}`);
  }

  const directEvidence = directEvidenceFor(graph, reference);
  const figureSideEvidence = directEvidence.filter((item) => item.sourceName === "Figure AI");
  assert.ok(figureSideEvidence.length > 0, "Figure-side benchmark evidence should still be visible as vendor context");
  for (const item of figureSideEvidence) {
    assert.equal(item.reviewStatus, "unreviewed", `${item.id} must remain unreviewed`);
    assert.ok(
      /vendor|does not independently verify/i.test(item.limitations ?? ""),
      `${item.id} should explicitly limit Figure-side evidence to vendor/self-described scope`,
    );
  }

  const bmwFigure03 = directEvidence.find((item) => item.id === "ev_humanoid_bmw_figure03_spartanburg_logistics");
  assert.ok(bmwFigure03, "BMW Figure 03 field-case anchor should be direct evidence");
  assert.equal(bmwFigure03.reviewStatus, "unreviewed");
  assert.equal(
    bmwFigure03.machineCheck?.status,
    "verified",
    "BMW Figure 03 customer-side anchor can be source-checked while remaining unreviewed and bounded by limitations",
  );
  assert.equal(bmwFigure03.machineCheck?.quoteMatch, "exact");
  assert.match(
    bmwFigure03.limitations ?? "",
    /does not independently verify Figure production yield, autonomy rate, sustained uptime, detailed safety certification, BOM, or supplier identities/i,
    "BMW field case must not be over-extended into performance/supplier proof",
  );

  const bmwFigure02 = directEvidence.find((item) => item.id === "ev_humanoid_bmw_figure02_spartanburg_30000_vehicles");
  assert.ok(bmwFigure02, "BMW Figure 02 lineage record should be direct evidence");
  assert.match(
    bmwFigure02.limitations ?? "",
    /predecessor Figure 02, not Figure 03/i,
    "Figure 02 deployment lineage must not be treated as direct Figure 03 performance proof",
  );

  const productionRamp = directEvidence.find((item) => item.id === "ev_humanoid_figure03_production_ramp");
  assert.ok(productionRamp, "Figure 03 production-ramp vendor evidence should remain visible");
  assert.equal(
    productionRamp.machineCheck?.status,
    "verified",
    "Figure 03 production-ramp vendor evidence can be source-checked while remaining unreviewed vendor context",
  );
  assert.equal(productionRamp.machineCheck?.quoteMatch, "exact");
  assert.equal(productionRamp.machineCheck?.numberInQuote, true);
  assert.match(productionRamp.excerpt ?? "", /delivering over 350/i);
  assert.doesNotMatch(
    productionRamp.excerpt ?? "",
    /9,000 actuators|10 distinct SKUs/i,
    "production-ramp excerpt should not splice actuator/SKU facts into the robot-output quote",
  );

  const figureBattery = directEvidence.find((item) => item.id === "ev_humanoid_figure_battery");
  assert.ok(figureBattery, "Figure battery vendor evidence should remain visible");
  assert.match(figureBattery.summary ?? "", /in process/i);
  assert.match(figureBattery.limitations ?? "", /does not independently verify completed UN38\.3 or UL2271 certification/i);
  assert.match(
    figureBattery.limitations ?? "",
    /source conclusion uses stronger certified-benchmark language/i,
    "battery evidence should document the certification wording conflict",
  );
  assert.equal(
    figureBattery.machineCheck?.status,
    "needs_fetch",
    "Figure battery certification-in-process evidence must be re-fetched before machine verification is restored",
  );

  const tasksById = new Map(loadTasks().map((task) => [task.id, task]));
  for (const id of [
    "task_humanoid_figure03_production_ramp_nonvendor_verification_20260703",
    "task_humanoid_figure03_uptime_autonomy_metrics_20260703",
    "task_humanoid_figure03_safety_certification_customer_acceptance_20260703",
    "task_humanoid_figure03_fleet_learning_data_offload_nonvendor_20260703",
    "task_humanoid_figure03_supplier_bom_no_inference_guard_20260703",
  ]) {
    const task = tasksById.get(id);
    assert.ok(task, `${id} should remain as a pending Figure 03 audit gap task`);
    assert.equal(task.status, "pending");
    assert.equal(task.priority, "high");
  }
});

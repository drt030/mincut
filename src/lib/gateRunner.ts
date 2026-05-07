import {
  bottlenecksForNode,
  evidenceForEdge,
  evidenceForNode,
  evidenceForScope,
  metricsForNode,
  nodeById,
  reachableNodeIdsFrom,
  requiredModules,
  targets,
  uniqueNodes,
} from "./graphTraversal";
import { productMaturity } from "./maturity";
import type { Edge, Evidence, GateQuestion, GateReport, GraphData, Node } from "./schema";

type GateContext = {
  graph: GraphData;
  target: Node;
  questions: GateQuestion[];
  modules: Node[];
  bottlenecks: Node[];
  metrics: Node[];
  scopedNodeIds: Set<string>;
  scopedNodes: Node[];
  scopedEdges: Edge[];
  scopedEvidence: Evidence[];
};

const requiredParcelModules = [
  "vision_barcode_label_recognition",
  "parcel_detection_and_tracking",
  "parcel_manipulation_or_diverter",
  "industrial_robot_arm_body",
  "end_effector_gripper_or_suction",
  "conveyor_integration",
  "sorting_decision_system",
  "motion_planning",
  "safety_system",
  "mechanical_structure",
  "maintenance_workflow",
  "cost_optimized_hardware_stack",
];

const requiredParcelMetrics = [
  "total_system_cost",
  "parcels_per_hour",
  "sorting_accuracy",
  "allowed_parcel_weight_range",
  "allowed_parcel_size_range",
  "failure_jam_rate",
  "human_intervention_rate",
  "installation_time",
  "maintenance_cost",
  "payback_period",
];

const taskSampleLimit = 5;

export function runGate(graph: GraphData, questions: GateQuestion[], targetNodeId: string): GateReport {
  const target = nodeById(graph, targetNodeId);
  if (!target) throw new Error(`Target node not found: ${targetNodeId}`);

  const scopedNodeIds = reachableNodeIdsFrom(graph, targetNodeId);
  const scopedNodes = graph.nodes.filter((node) => scopedNodeIds.has(node.id));
  const scopedEdges = graph.edges.filter((edge) => scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target));
  const scopedEvidence = evidenceForScope(graph, scopedNodes, scopedEdges);

  const context: GateContext = {
    graph,
    target,
    questions,
    modules: requiredModules(graph, targetNodeId),
    bottlenecks: bottlenecksForNode(graph, targetNodeId),
    metrics: metricsForNode(graph, targetNodeId),
    scopedNodeIds,
    scopedNodes,
    scopedEdges,
    scopedEvidence,
  };

  const questionResults = questions.map((question) => answerQuestion(context, question));
  const overallScore = round(questionResults.reduce((sum, result) => sum + result.score, 0) / questionResults.length);
  const missingCriticalModules = requiredParcelModules.filter((id) => !context.modules.some((node) => node.id === id));
  const highConfidenceEdgesWithoutEvidence = context.scopedEdges.filter(
    (edge) =>
      edge.confidence === "high" &&
      evidenceForEdge(graph, edge.id).length === 0,
  );
  const criticalMetricsMissing = requiredParcelMetrics.filter((id) => !context.metrics.some((node) => node.id === id));
  const evidenceFindings = evidenceFindingsForContext(context);

  const passed =
    overallScore >= 4 &&
    missingCriticalModules.length === 0 &&
    highConfidenceEdgesWithoutEvidence.length === 0 &&
    criticalMetricsMissing.length === 0 &&
    evidenceFindings.weakEvidence.length === 0 &&
    evidenceFindings.unreviewedClaims.length === 0 &&
    evidenceFindings.missingReviewedEvidence.length === 0;

  return {
    graphVersion: graph.graphVersion,
    targetNodeId,
    generatedAt: new Date().toISOString(),
    questionResults,
    overallScore,
    passed,
    recommendedNextTasks: recommendedTasks(context, {
      missingCriticalModules,
      highConfidenceEdgesWithoutEvidence,
      criticalMetricsMissing,
      evidenceFindings,
    }),
  };
}

function answerQuestion(context: GateContext, question: GateQuestion): GateReport["questionResults"][number] {
  const { graph, target, modules, metrics } = context;
  const maturity = productMaturity(graph, target);
  const evidence = evidenceForNode(graph, target.id);
  const evidenceFindings = evidenceFindingsForContext(context);
  const allBottlenecks = uniqueNodes(context.bottlenecks);

  switch (question.id) {
    case "definition":
      return scoreResult(question.question, target.description ?? "No description is present.", target.description ? 5 : 1);
    case "target_context":
      return scoreResult(question.question, formatTargetContext(target), target.targetContext ? 5 : 1, undefined, missingTargetFields(target));
    case "separate_product_node":
      return scoreResult(
        question.question,
        target.targetContext?.targetCost
          ? `Separate node because the cost target ${target.targetContext.targetCost} changes feasible routes, hardware choices, and payback constraints.`
          : "The graph does not yet explain why this should be a separate product node.",
        target.targetContext?.targetCost ? 4 : 1,
      );
    case "scientific_principles": {
      const principles = targets(graph, target.id, "requires").filter((node) =>
        ["scientific_principle", "empirical_principle"].includes(node.kind),
      );
      return listResult(question.question, principles, "principle nodes");
    }
    case "empirical_assumptions": {
      const assumptions = graph.nodes.filter((node) => node.kind === "empirical_principle" && node.domain.includes("parcel_sorting_robot"));
      return listResult(question.question, assumptions, "empirical assumption nodes");
    }
    case "required_modules":
      return listResult(question.question, modules, "required modules", requiredParcelModules.filter((id) => !modules.some((node) => node.id === id)));
    case "main_bottlenecks":
      return listResult(question.question, allBottlenecks, "bottlenecks");
    case "key_metrics":
      return listResult(question.question, metrics, "metrics", requiredParcelMetrics.filter((id) => !metrics.some((node) => node.id === id)));
    case "estimated_maturity":
      return scoreResult(
        question.question,
        `${maturity.label} (${maturity.score}/100). ${maturity.explanation}`,
        evidenceFindings.missingReviewedEvidence.length || evidenceFindings.unreviewedClaims.length ? 3 : 4,
        undefined,
        undefined,
        evidenceFindings.missingReviewedEvidence.length
          ? ["Maturity is capped because key local claims still lack reviewed non-vendor evidence."]
          : undefined,
      );
    case "missing_breakthroughs": {
      const breakthroughs = graph.nodes.filter((node) => node.kind === "placeholder_breakthrough" && node.domain.includes("parcel_sorting_robot"));
      return listResult(question.question, breakthroughs, "placeholder breakthrough nodes");
    }
    case "important_evidence":
      return evidenceResult(question.question, evidence, "target evidence");
    case "weak_evidence": {
      const weak = evidenceFindings.weakEvidence;
      return scoreResult(
        question.question,
        weak.length ? formatEvidenceList(weak) : "No weak, missing, vendor-only, or unreviewed evidence is flagged in the scoped local graph.",
        weak.length ? (evidenceFindings.trustedEvidence.length ? 2 : 1) : 5,
        undefined,
        undefined,
        missingEvidenceDescriptions(evidenceFindings),
        weak.length
          ? "Weak evidence includes unreviewed evidence, low/medium confidence evidence, vendor claims, internal notes, and placeholders."
          : undefined,
      );
    }
    case "cost_constraints": {
      const costNodes = context.scopedNodes.filter((node) => node.tags?.includes("cost") || node.id.includes("cost") || node.id.includes("payback"));
      return listResult(question.question, costNodes, "cost constraint nodes");
    }
    case "manufacturing_constraints": {
      const manufacturing = context.scopedNodes.filter(
        (node) =>
          node.kind === "manufacturing_process" ||
          node.tags?.includes("manufacturing") ||
          node.id.includes("integration") ||
          node.id.includes("structure"),
      );
      return listResult(question.question, manufacturing, "manufacturing constraint nodes");
    }
    case "safety_regulatory_deployment": {
      const nodes = context.scopedNodes.filter(
        (node) => node.kind === "standard_or_regulation" || node.tags?.includes("safety") || node.tags?.includes("deployment"),
      );
      return listResult(question.question, nodes, "safety, regulatory, or deployment nodes");
    }
    case "downstream_unlocked": {
      const enabled = targets(graph, "low_cost_high_reliability_parcel_manipulation", "enables");
      return listResult(question.question, enabled, "downstream unlocked nodes");
    }
    case "research_next":
      return researchNextResult(context, question.question, evidenceFindings);
    case "excluded_claims":
      return excludedClaimsResult(context, question.question, evidenceFindings);
    default:
      return scoreResult(question.question, "No handler exists for this question yet.", 0);
  }
}

function scoreResult(
  question: string,
  answer: string,
  score: number,
  missingNodeIds?: string[],
  missingEdgeDescriptions?: string[],
  missingEvidenceDescriptions?: string[],
  notes?: string,
): GateReport["questionResults"][number] {
  return {
    question,
    answer,
    score,
    missingNodeIds,
    missingEdgeDescriptions,
    missingEvidenceDescriptions,
    notes,
  };
}

function listResult(question: string, nodes: Node[], label: string, missingNodeIds?: string[]): GateReport["questionResults"][number] {
  const unique = uniqueNodes(nodes);
  const score = unique.length >= 5 ? 5 : unique.length >= 3 ? 4 : unique.length >= 1 ? 2 : 0;
  return {
    question,
    answer: unique.length ? unique.map((node) => `${node.id}: ${node.name}`).join("; ") : `No ${label} found.`,
    score: missingNodeIds?.length ? Math.min(score, 3) : score,
    missingNodeIds: missingNodeIds?.length ? missingNodeIds : undefined,
  };
}

function evidenceResult(question: string, evidence: ReturnType<typeof evidenceForNode>, label: string): GateReport["questionResults"][number] {
  const trusted = evidence.filter(isTrustedEvidence);
  const weak = evidence.filter(isWeakEvidence);
  const score = trusted.length >= 2 ? (weak.length ? 4 : 5) : trusted.length ? 3 : evidence.length ? 1 : 0;

  return {
    question,
    answer: evidence.length ? formatEvidenceList(evidence) : `No ${label} found.`,
    score,
    missingEvidenceDescriptions:
      trusted.length >= 2
        ? undefined
        : ["Add reviewed, high-confidence, non-vendor field cases, benchmark data, or cost evidence for the target product."],
    notes: weak.length ? "Current supporting evidence includes weak, internal, vendor, or unreviewed records." : undefined,
  };
}

function formatTargetContext(target: Node): string {
  if (!target.targetContext) return "No target context is present.";
  return Object.entries(target.targetContext)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function missingTargetFields(target: Node): string[] | undefined {
  const missing = ["targetCost", "targetScale", "targetPerformance", "targetUseCase", "targetEnvironment"].filter(
    (key) => !target.targetContext?.[key as keyof NonNullable<Node["targetContext"]>],
  );
  return missing.length ? missing.map((key) => `Add target context field: ${key}`) : undefined;
}

function recommendedTasks(
  context: GateContext,
  findings: {
    missingCriticalModules: string[];
    highConfidenceEdgesWithoutEvidence: Edge[];
    criticalMetricsMissing: string[];
    evidenceFindings: EvidenceFindings;
  },
): GateReport["recommendedNextTasks"] {
  const tasks: GateReport["recommendedNextTasks"] = [];
  for (const moduleId of findings.missingCriticalModules) {
    tasks.push({
      title: `Add missing module ${moduleId}`,
      reason: "The target product requires this module for the parcel sorting closed loop.",
      suggestedNodeKind: "module",
      priority: "high",
    });
  }
  for (const metricId of findings.criticalMetricsMissing) {
    tasks.push({
      title: `Add missing metric ${metricId}`,
      reason: "The validation gate requires explicit product-level metrics.",
      suggestedNodeKind: "metric",
      priority: "high",
    });
  }
  if (findings.highConfidenceEdgesWithoutEvidence.length) {
    tasks.push({
      title: "Add evidence to high-confidence dependency edges",
      reason: `${findings.highConfidenceEdgesWithoutEvidence.length} high-confidence edges lack evidence references. ${formatEdgeSamples("Edge IDs", findings.highConfidenceEdgesWithoutEvidence)} Add evidenceIds with reviewed, high-confidence, non-vendor support or lower the edge confidence/review status if support is not available.`,
      suggestedNodeKind: "evidence",
      priority: "high",
    });
  }
  if (findings.evidenceFindings.weakEvidence.length) {
    tasks.push({
      title: "Review or replace weak parcel evidence records",
      reason: `${findings.evidenceFindings.weakEvidence.length} scoped evidence records are unreviewed, low/medium confidence, vendor-only, internal-only, or placeholders. ${formatEvidenceSamples("Evidence IDs", findings.evidenceFindings.weakEvidence)} Review these records; promote only if source quality supports it, otherwise replace them with reviewed high-confidence non-vendor field cases, benchmarks, standards, papers, or cost evidence.`,
      suggestedNodeKind: "evidence",
      priority: "high",
    });
  }
  if (findings.evidenceFindings.missingReviewedEvidence.length) {
    tasks.push({
      title: "Add reviewed field or benchmark evidence to unsupported parcel claims",
      reason: `${findings.evidenceFindings.missingReviewedEvidence.length} scoped medium/high-confidence claims lack reviewed non-vendor supporting evidence. ${formatClaimSamples(findings.evidenceFindings.missingReviewedEvidence)} Add reviewed evidence to the listed claims, or lower confidence/deprecate claims that cannot be supported.`,
      suggestedNodeKind: "evidence",
      priority: "high",
    });
  }
  if (findings.evidenceFindings.unreviewedClaims.length) {
    tasks.push({
      title: "Human-review unreviewed high and medium confidence parcel claims",
      reason: `${findings.evidenceFindings.unreviewedClaims.length} scoped claims are explicitly marked unreviewed and must not be treated as established. ${formatClaimSamples(findings.evidenceFindings.unreviewedClaims)} Human-review these node/edge claims, then mark them reviewed, disputed, deprecated, or keep them unreviewed with clearer limitations.`,
      suggestedNodeKind: "evidence",
      priority: "high",
    });
  }
  if (findings.evidenceFindings.frontiers.length) {
    const firstFrontier = findings.evidenceFindings.frontiers[0];
    tasks.push({
      title: "Decompose important parcel subsystem frontiers",
      reason: `Frontier node IDs: ${sampleIds(findings.evidenceFindings.frontiers.map((node) => node.id))}. Expected node kinds: ${expectedFrontierKinds(firstFrontier)}. Expand ${firstFrontier.id} first, adding the next layer where it affects maturity, cost, manufacturability, reliability, or deployment; add evidence where claims are medium/high confidence or leave explicit follow-up tasks for unsupported branches.`,
      targetNodeId: firstFrontier.id,
      suggestedNodeKind: "module",
      priority: "medium",
    });
  }
  if (evidenceForNode(context.graph, context.target.id).filter(isTrustedEvidence).length < 2) {
    tasks.push({
      title: "Add reviewed field evidence for the product target",
      reason: `Node ID: ${context.target.id}. The product target currently lacks at least two reviewed high-confidence non-vendor evidence records. Add field cases, benchmark data, standards, or cost evidence directly supporting the product boundary and target context.`,
      targetNodeId: context.target.id,
      suggestedNodeKind: "evidence",
      priority: "medium",
    });
  }
  return tasks.slice(0, 12);
}

function sampleIds(ids: string[]): string {
  const sample = ids.slice(0, taskSampleLimit).join(", ");
  const remaining = ids.length - taskSampleLimit;
  return remaining > 0 ? `${sample} (+${remaining} more)` : sample;
}

function formatEvidenceSamples(label: string, evidence: Evidence[]): string {
  return `${label}: ${sampleIds(evidence.map((item) => item.id))}.`;
}

function formatEdgeSamples(label: string, edges: Edge[]): string {
  return `${label}: ${sampleIds(edges.map((edge) => `${edge.id} (${edge.source}->${edge.target})`))}.`;
}

function formatClaimSamples(claims: Array<Node | Edge>): string {
  const nodeIds = claims.filter((claim): claim is Node => !("relation" in claim)).map((node) => node.id);
  const edgeIds = claims.filter((claim): claim is Edge => "relation" in claim).map((edge) => `${edge.id} (${edge.source}->${edge.target})`);
  const parts: string[] = [];
  if (nodeIds.length) parts.push(`Node IDs: ${sampleIds(nodeIds)}.`);
  if (edgeIds.length) parts.push(`Edge IDs: ${sampleIds(edgeIds)}.`);
  return parts.join(" ");
}

function expectedFrontierKinds(frontier: Node): string {
  if (frontier.kind === "engineering_method" || /vision|tracking|decision|planning|software|algorithm|control/i.test(frontier.id)) {
    return "engineering_method, metric, bottleneck, evidence";
  }
  if (frontier.kind === "material" || /material|steel|aluminum|copper|silicon|magnet|rare_earth|elastomer/i.test(frontier.id)) {
    return "material, manufacturing_process, metric, bottleneck, evidence";
  }
  if (frontier.kind === "manufacturing_process") {
    return "equipment, material, metric, bottleneck, evidence";
  }
  return "module, equipment, material, manufacturing_process, engineering_method, metric, bottleneck, evidence";
}

type EvidenceFindings = {
  trustedEvidence: Evidence[];
  weakEvidence: Evidence[];
  missingReviewedEvidence: Array<Node | Edge>;
  unreviewedClaims: Array<Node | Edge>;
  vendorOrInternalOnlyClaims: Array<Node | Edge>;
  frontiers: Node[];
};

function evidenceFindingsForContext(context: GateContext): EvidenceFindings {
  const claims = scopedClaims(context);
  return {
    trustedEvidence: context.scopedEvidence.filter(isTrustedEvidence),
    weakEvidence: context.scopedEvidence.filter(isWeakEvidence),
    missingReviewedEvidence: claims.filter((claim) => trustedEvidenceForClaim(context.graph, claim).length === 0),
    unreviewedClaims: claims.filter((claim) => claim.reviewStatus === "unreviewed"),
    vendorOrInternalOnlyClaims: claims.filter((claim) => {
      const evidence = evidenceForClaim(context.graph, claim);
      return evidence.length > 0 && evidence.every((item) => item.type === "vendor_claim" || item.type === "internal_note");
    }),
    frontiers: context.scopedNodes.filter(
      (node) => node.tags?.includes("decomposition_frontier") || node.notes?.toLowerCase().includes("frontier"),
    ),
  };
}

function scopedClaims(context: GateContext): Array<Node | Edge> {
  const confidentNodes = context.scopedNodes.filter((node) => node.confidence === "medium" || node.confidence === "high");
  const confidentEdges = context.scopedEdges.filter((edge) => edge.confidence === "medium" || edge.confidence === "high");
  return [...confidentNodes, ...confidentEdges];
}

function evidenceForClaim(graph: GraphData, claim: Node | Edge): Evidence[] {
  return "relation" in claim ? evidenceForEdge(graph, claim.id) : evidenceForNode(graph, claim.id);
}

function trustedEvidenceForClaim(graph: GraphData, claim: Node | Edge): Evidence[] {
  return evidenceForClaim(graph, claim).filter(isTrustedEvidence);
}

function isTrustedEvidence(item: Evidence): boolean {
  return item.reviewStatus === "reviewed" && item.confidence === "high" && item.type !== "vendor_claim" && item.type !== "internal_note";
}

function isWeakEvidence(item: Evidence): boolean {
  return item.reviewStatus !== "reviewed" || item.confidence !== "high" || item.type === "vendor_claim" || item.type === "internal_note";
}

function formatEvidenceList(evidence: Evidence[]): string {
  return evidence
    .map((item) => `${item.id}: ${item.title} [${item.reviewStatus ?? "unreviewed"}, ${item.confidence ?? "unknown"}, ${item.type}]`)
    .join("; ");
}

function missingEvidenceDescriptions(findings: EvidenceFindings): string[] | undefined {
  const descriptions: string[] = [];
  if (findings.weakEvidence.length) descriptions.push(`${findings.weakEvidence.length} scoped evidence records are weak or unreviewed.`);
  if (findings.missingReviewedEvidence.length) {
    descriptions.push(`${findings.missingReviewedEvidence.length} scoped medium/high-confidence claims lack reviewed non-vendor evidence.`);
  }
  if (findings.vendorOrInternalOnlyClaims.length) {
    descriptions.push(`${findings.vendorOrInternalOnlyClaims.length} scoped claims are supported only by vendor or internal evidence.`);
  }
  return descriptions.length ? descriptions : undefined;
}

function researchNextResult(
  context: GateContext,
  question: string,
  findings: EvidenceFindings,
): GateReport["questionResults"][number] {
  const tasks = recommendedTasks(context, {
    missingCriticalModules: requiredParcelModules.filter((id) => !context.modules.some((node) => node.id === id)),
    highConfidenceEdgesWithoutEvidence: context.scopedEdges.filter(
      (edge) => edge.confidence === "high" && evidenceForEdge(context.graph, edge.id).length === 0,
    ),
    criticalMetricsMissing: requiredParcelMetrics.filter((id) => !context.metrics.some((node) => node.id === id)),
    evidenceFindings: findings,
  });

  return {
    question,
    answer: tasks.length
      ? tasks.map((task) => `${task.priority}: ${task.title} - ${task.reason}`).join("; ")
      : "No next research tasks are currently derived from the local graph.",
    score: tasks.length ? (tasks.some((task) => task.priority === "high") ? 1 : 3) : 5,
    missingNodeIds: tasks.some((task) => task.suggestedNodeKind === "module")
      ? requiredParcelModules.filter((id) => !context.modules.some((node) => node.id === id))
      : undefined,
    missingEvidenceDescriptions: missingEvidenceDescriptions(findings),
  };
}

function excludedClaimsResult(
  context: GateContext,
  question: string,
  findings: EvidenceFindings,
): GateReport["questionResults"][number] {
  const boundaryOffenders = context.graph.nodes.filter((node) =>
    ["delta_robot_sorting_route", "conveyor_diverter_sorting_route", "mobile_robot_sorting_route", "hybrid_human_robot_assisted_sorting_route"].includes(
      node.id,
    ),
  );
  const unsupported = [...findings.unreviewedClaims, ...findings.vendorOrInternalOnlyClaims, ...boundaryOffenders];
  const answer = unsupported.length
    ? unsupported
        .slice(0, 20)
        .map((claim) =>
          "relation" in claim
            ? `${claim.id}: ${claim.source} ${claim.relation} ${claim.target}`
            : `${claim.id}: ${claim.name}`,
        )
        .join("; ")
    : "No scoped unreviewed, vendor/internal-only, or out-of-bound route claims are currently flagged.";

  return {
    question,
    answer,
    score: unsupported.length ? 2 : 5,
    missingEvidenceDescriptions: missingEvidenceDescriptions(findings),
    notes: unsupported.length
      ? "Flagged claims can remain in local data as candidates, but gate output must not treat them as reviewed established facts."
      : undefined,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

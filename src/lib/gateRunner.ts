import { eligibleCostSubsystemIds, isCostBearingMetric, rollupCost, targetCostFor, type CostRollupResult } from "./costRollup";
import {
  bottlenecksForNode,
  evidenceForEdge,
  evidenceForNode,
  evidenceForScope,
  isDecompositionFrontier,
  metricsForNode,
  nodeById,
  outgoingEdges,
  reachableNodeIdsFrom,
  requiredModules,
  targets,
  uniqueNodes,
} from "./graphTraversal";
import { productMaturity } from "./maturity";
import { formatMetricValueFull } from "./metricValueFormat";
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
  /**
   * Per ADR-0001, `deprecated` records are completely excluded from gate
   * scoring (not counted in trusted, weak, or coverage tallies). The
   * `*Active*` collections drop deprecated nodes/edges/evidence before any
   * downstream bucketing or coverage logic runs. The original `scoped*`
   * collections remain available for diagnostics, but every gate-effect
   * computation must read the active collections.
   */
  scopedNodesActive: Node[];
  scopedEdgesActive: Edge[];
  scopedEvidenceActive: Evidence[];
};

const DISPUTED_CAP = 2;
const UNREVIEWED_CAP = 3;

const requiredParcelModules = [
  "vision_barcode_label_recognition",
  "parcel_detection_and_tracking",
  "parcel_manipulation_or_diverter",
  "conveyor_integration",
  "sorting_decision_system",
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

  // Per ADR-0001, `deprecated` records are fully excluded from gate
  // scoring. We strip them once here so every downstream bucket
  // (trusted / weak / coverage / scopedClaims) reads from the active
  // collections without per-call filtering.
  const scopedNodesActive = scopedNodes.filter((node) => node.reviewStatus !== "deprecated");
  const scopedEdgesActive = scopedEdges.filter((edge) => edge.reviewStatus !== "deprecated");
  const scopedEvidenceActive = scopedEvidence.filter((item) => item.reviewStatus !== "deprecated");

  const context: GateContext = {
    graph,
    target,
    questions,
    modules: requiredModules(graph, targetNodeId).filter((node) => node.reviewStatus !== "deprecated"),
    bottlenecks: bottlenecksForNode(graph, targetNodeId).filter((node) => node.reviewStatus !== "deprecated"),
    metrics: metricsForNode(graph, targetNodeId).filter((node) => node.reviewStatus !== "deprecated"),
    scopedNodeIds,
    scopedNodes,
    scopedEdges,
    scopedEvidence,
    scopedNodesActive,
    scopedEdgesActive,
    scopedEvidenceActive,
  };

  const evidenceFindings = evidenceFindingsForContext(context);
  // Per iter-15 review (P0 #2), every questionResult carries `questionId`
  // so downstream UI doesn't need to string-match the localized question
  // text to identify a specific question (e.g. cost_constraints).
  const questionResults = questions.map((question) => ({
    questionId: question.id,
    ...answerQuestion(context, question, evidenceFindings),
  }));
  const overallScore = round(questionResults.reduce((sum, result) => sum + result.score, 0) / questionResults.length);
  const missingCriticalModules = requiredParcelModules.filter((id) => !context.modules.some((node) => node.id === id));
  const highConfidenceEdgesWithoutEvidence = context.scopedEdgesActive.filter(
    (edge) =>
      edge.confidence === "high" &&
      evidenceForEdge(graph, edge.id).length === 0,
  );
  const criticalMetricsMissing = requiredParcelMetrics.filter((id) => !context.metrics.some((node) => node.id === id));

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

function answerQuestion(
  context: GateContext,
  question: GateQuestion,
  evidenceFindings: EvidenceFindings,
): GateReport["questionResults"][number] {
  const { graph, target, modules, metrics } = context;
  const maturity = productMaturity(graph, target);
  // Per ADR-0001, deprecated evidence is fully excluded from the gate.
  const evidence = evidenceForNode(graph, target.id).filter((item) => item.reviewStatus !== "deprecated");
  const allBottlenecks = uniqueNodes(context.bottlenecks);
  const reviewStatusCap = applyReviewStatusCap(evidenceFindings);

  const result = answerQuestionInner();
  // Per ADR-0001, the reviewStatus ladder caps *relevant* question scores.
  // "Relevant" means the question's answer leans on the evidence/claim
  // ladder — definition / target_context / scientific_principles etc. are
  // structural and untouched by the cap, while evidence-bearing questions
  // (estimated_maturity, important_evidence, weak_evidence, research_next,
  // excluded_claims) MUST be capped when disputed claims are present.
  // The disputed cap (2/5) is *lower* than the unreviewed cap (3/5) — the
  // asymmetry is intentional, see CONTEXT.md "Review status ladder" L50:
  // "we looked and found a problem" must not lift the score above
  // "unknown".
  //
  // Per iter-19 review (P1): the `cost_constraints` cap MUST be scoped to
  // cost-relevant records only. The global `reviewStatusCap` reflects every
  // unreviewed/disputed claim in the target's reachable scope — including
  // bottleneck descriptions, requires-edges, and module nodes whose review
  // status has nothing to do with cost-question correctness. Per ADR-0003 +
  // ADR-0001 intent, "An *unreviewed cost claim* caps the cost question."
  // So we delegate to a cost-scoped cap function that walks the same
  // eligible cost subsystems the rollup walker uses.
  if (question.id === "cost_constraints") {
    const costCap = costScopedReviewStatusCap(graph, target.id);
    if (typeof costCap === "number" && result.score > costCap) {
      return { ...result, score: costCap };
    }
    return result;
  }
  if (
    typeof reviewStatusCap === "number" &&
    isReviewStatusCapRelevant(question.id) &&
    result.score > reviewStatusCap
  ) {
    return { ...result, score: reviewStatusCap };
  }
  return result;

  function answerQuestionInner(): GateReport["questionResults"][number] {
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
      return metricListResult(question.question, metrics, "metrics", requiredParcelMetrics.filter((id) => !metrics.some((node) => node.id === id)));
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
    case "cost_constraints":
      return costConstraintsResult(context, question.question);
    case "manufacturing_constraints": {
      const manufacturing = context.scopedNodesActive.filter(
        (node) =>
          node.kind === "manufacturing_process" ||
          node.tags?.includes("manufacturing") ||
          node.id.includes("integration") ||
          node.id.includes("structure"),
      );
      return listResult(question.question, manufacturing, "manufacturing constraint nodes");
    }
    case "safety_regulatory_deployment": {
      const nodes = context.scopedNodesActive.filter(
        (node) => node.kind === "standard_or_regulation" || node.tags?.includes("safety") || node.tags?.includes("deployment"),
      );
      return listResult(question.question, nodes, "safety, regulatory, or deployment nodes");
    }
    case "downstream_unlocked": {
      const enabled = targets(graph, "low_cost_high_reliability_parcel_manipulation", "enables").filter(
        (node) => node.reviewStatus !== "deprecated",
      );
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

function metricListResult(question: string, nodes: Node[], label: string, missingNodeIds?: string[]): GateReport["questionResults"][number] {
  const unique = uniqueNodes(nodes);
  const score = unique.length >= 5 ? 5 : unique.length >= 3 ? 4 : unique.length >= 1 ? 2 : 0;
  return {
    question,
    answer: unique.length ? unique.map(formatMetricForGate).join("; ") : `No ${label} found.`,
    score: missingNodeIds?.length ? Math.min(score, 3) : score,
    missingNodeIds: missingNodeIds?.length ? missingNodeIds : undefined,
  };
}

function formatMetricForGate(node: Node): string {
  const metric = node.metrics?.[0];
  if (!metric) return `${node.id}: ${node.name}`;
  const values: string[] = [];
  if (metric.currentValue !== undefined) {
    values.push(`current ${formatMetricValueFull(metric.currentValue, metric.unit, metric.currency)}`);
  }
  if (metric.targetValue !== undefined) {
    values.push(`target ${formatMetricValueFull(metric.targetValue, metric.unit, metric.currency)}`);
  }
  if (values.length === 0) return `${node.id}: ${node.name}`;
  return `${node.id}: ${node.name} — ${values.join("; ")}`;
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
      kind: "human_review",
    });
  }
  // Per ADR-0001, every disputed claim/evidence record is surfaced as its
  // own "Resolve dispute" auto-task — these need human resolution one at a
  // time and are kept distinct from generic review backlog so the UI can
  // style them differently. The disputed cap (2/5) already pushed the
  // gate score down; the task here is the call to action.
  for (const claim of findings.evidenceFindings.disputedClaims) {
    const id = "relation" in claim ? `${claim.id} (${claim.source}->${claim.target})` : claim.id;
    tasks.push({
      title: `Resolve dispute on ${id}`,
      reason: `${id} is marked reviewStatus: "disputed". Per ADR-0001, disputed claims cap relevant gate scores at 2/5 (lower than unreviewed) until a human resolves the dispute by marking it reviewed (with counter-evidence integrated), deprecated (superseded), or otherwise. See record notes for the dispute reason.`,
      targetNodeId: "relation" in claim ? undefined : claim.id,
      priority: "high",
      kind: "resolve_dispute",
    });
  }
  for (const item of findings.evidenceFindings.disputedEvidence) {
    tasks.push({
      title: `Resolve dispute on ${item.id}`,
      reason: `Evidence ${item.id} (${item.title}) is marked reviewStatus: "disputed". Per ADR-0001, disputed evidence caps relevant gate scores at 2/5 until a human resolves the dispute. See record notes for the dispute reason.`,
      priority: "high",
      kind: "resolve_dispute",
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
  /**
   * Per ADR-0001, `disputed` claims (and disputed-status evidence)
   * lower the relevant gate score to 2/5. They count toward coverage,
   * so they remain in `scopedClaims`, but they are surfaced separately
   * to drive the "Resolve dispute" auto-task.
   */
  disputedClaims: Array<Node | Edge>;
  disputedEvidence: Evidence[];
  vendorOrInternalOnlyClaims: Array<Node | Edge>;
  frontiers: Node[];
};

function evidenceFindingsForContext(context: GateContext): EvidenceFindings {
  const claims = scopedClaims(context);
  return {
    trustedEvidence: context.scopedEvidenceActive.filter(isTrustedEvidence),
    weakEvidence: context.scopedEvidenceActive.filter(isWeakEvidence),
    missingReviewedEvidence: claims.filter(
      (claim) =>
        trustedEvidenceForClaim(context.graph, claim).length === 0 && claim.reviewStatus !== "disputed",
    ),
    unreviewedClaims: claims.filter((claim) => claim.reviewStatus === "unreviewed"),
    disputedClaims: claims.filter((claim) => claim.reviewStatus === "disputed"),
    disputedEvidence: context.scopedEvidenceActive.filter((item) => item.reviewStatus === "disputed"),
    vendorOrInternalOnlyClaims: claims.filter((claim) => {
      const evidence = evidenceForClaim(context.graph, claim).filter((item) => item.reviewStatus !== "deprecated");
      return evidence.length > 0 && evidence.every((item) => item.type === "vendor_claim" || item.type === "internal_note");
    }),
    frontiers: context.scopedNodesActive.filter((node) => isDecompositionFrontier(context.graph, node)),
  };
}

/**
 * Per ADR-0001, the cap returned here applies to *every* question's score
 * once it has been computed by the question-specific logic. Deprecated
 * records are already excluded from `scopedClaims`, so they cannot raise
 * this cap. If both disputed and unreviewed claims are present, the
 * lower (disputed = 2/5) cap wins, since the asymmetry intentionally
 * pulls the score down — see CONTEXT.md "Review status ladder" L50.
 */
function applyReviewStatusCap(findings: EvidenceFindings): number | undefined {
  if (findings.disputedClaims.length > 0 || findings.disputedEvidence.length > 0) return DISPUTED_CAP;
  if (findings.unreviewedClaims.length > 0) return UNREVIEWED_CAP;
  return undefined;
}

/**
 * Per ADR-0001, the reviewStatus cap only applies to questions that lean on
 * the local-evidence ladder. Structural questions (definition, target
 * context, scientific principles, etc.) are unaffected — their answer comes
 * from the structural shape of the graph, not from claims supported by
 * evidence whose review status matters. The set below is intentionally
 * narrow: each entry is a question whose answer would otherwise be elevated
 * past the cap by graph-level coverage even when the underlying claims are
 * disputed or unreviewed.
 *
 * Per iter-19 review (P1): `cost_constraints` is NOT in this set because
 * the global cap pool (every unreviewed/disputed scoped claim) is too
 * broad to honestly cap the cost question. A bottleneck description left
 * unreviewed should not pull the cost-question score down. Cost is handled
 * by `costScopedReviewStatusCap` instead, which inspects only the cost
 * metric nodes and their evidence — same ladder, scoped to cost-domain
 * records.
 */
const REVIEW_STATUS_CAPPED_QUESTIONS = new Set<string>([
  "estimated_maturity",
  "important_evidence",
  "weak_evidence",
  "research_next",
  "excluded_claims",
]);

function isReviewStatusCapRelevant(questionId: string): boolean {
  return REVIEW_STATUS_CAPPED_QUESTIONS.has(questionId);
}

/**
 * Per iter-19 review (P1): the cost-question reviewStatus cap is computed
 * from cost-relevant records only, NOT from the global scoped pool. The
 * inspected set is:
 *   - the target product's `measured_by` cost metric nodes (e.g.
 *     `total_system_cost`), and
 *   - every eligible cost subsystem's `measured_by` cost metric nodes
 *     (i.e. metric nodes whose unit/currency identifies them as cost-bearing
 *     per `isCostBearingMetric`), and
 *   - the linked evidence (via the metric's `evidenceIds` and any
 *     `supportsNodeIds` evidence pointing at the metric).
 *
 * If ANY of those records is `disputed` → cap at 2.
 * If ANY is `unreviewed` (and none disputed) → cap at 3.
 * If all are `reviewed` → no cap (caller's score stands, capped only by 5).
 *
 * The cap is intentionally narrower than the global ladder: ADR-0003 +
 * ADR-0001 intent is "an unreviewed *cost claim* caps the cost question,"
 * not "any unreviewed claim in the scope caps it."
 */
function costScopedReviewStatusCap(graph: GraphData, productNodeId: string): number | undefined {
  const metricIds = new Set<string>();

  // Target-level cost metrics (e.g. total_system_cost).
  for (const edge of outgoingEdges(graph, productNodeId, "measured_by")) {
    const metric = nodeById(graph, edge.target);
    if (!metric || metric.kind !== "metric") continue;
    if (metric.reviewStatus === "deprecated") continue;
    if (!isCostBearingMetric(metric)) continue;
    metricIds.add(metric.id);
  }

  // Subsystem-level cost metrics for every eligible cost subsystem.
  for (const subsystemId of eligibleCostSubsystemIds(graph, productNodeId)) {
    for (const edge of outgoingEdges(graph, subsystemId, "measured_by")) {
      const metric = nodeById(graph, edge.target);
      if (!metric || metric.kind !== "metric") continue;
      if (metric.reviewStatus === "deprecated") continue;
      if (!isCostBearingMetric(metric)) continue;
      metricIds.add(metric.id);
    }
  }

  if (metricIds.size === 0) return undefined;

  let anyDisputed = false;
  let anyUnreviewed = false;

  for (const metricId of metricIds) {
    const metric = nodeById(graph, metricId);
    if (!metric) continue;
    if (metric.reviewStatus === "disputed") anyDisputed = true;
    else if (metric.reviewStatus === "unreviewed" || !metric.reviewStatus) anyUnreviewed = true;

    // Linked evidence — both via `evidenceIds` on the metric and any
    // evidence whose `supportsNodeIds` includes the metric.
    const linkedEvidence = evidenceForNode(graph, metricId).filter(
      (item) => item.reviewStatus !== "deprecated",
    );
    for (const item of linkedEvidence) {
      if (item.reviewStatus === "disputed") anyDisputed = true;
      else if (item.reviewStatus === "unreviewed" || !item.reviewStatus) anyUnreviewed = true;
    }
  }

  if (anyDisputed) return DISPUTED_CAP;
  if (anyUnreviewed) return UNREVIEWED_CAP;
  return undefined;
}

function scopedClaims(context: GateContext): Array<Node | Edge> {
  // Per ADR-0001, deprecated nodes/edges are fully excluded from
  // `scopedClaims` — they should not raise coverage, weak, or trusted
  // tallies. Disputed/unreviewed claims still count toward coverage.
  const confidentNodes = context.scopedNodesActive.filter((node) => node.confidence === "medium" || node.confidence === "high");
  const confidentEdges = context.scopedEdgesActive.filter((edge) => edge.confidence === "medium" || edge.confidence === "high");
  return [...confidentNodes, ...confidentEdges];
}

function evidenceForClaim(graph: GraphData, claim: Node | Edge): Evidence[] {
  return "relation" in claim ? evidenceForEdge(graph, claim.id) : evidenceForNode(graph, claim.id);
}

function trustedEvidenceForClaim(graph: GraphData, claim: Node | Edge): Evidence[] {
  return evidenceForClaim(graph, claim).filter(isTrustedEvidence);
}

function isTrustedEvidence(item: Evidence): boolean {
  // Per ADR-0001, deprecated evidence is fully excluded — it cannot count as
  // trusted. Callers that pass `scopedEvidenceActive` already filter
  // deprecated, but we re-check here so callers using the raw graph
  // evidence (e.g. `evidenceForNode`) get the same answer.
  if (item.reviewStatus === "deprecated") return false;
  return item.reviewStatus === "reviewed" && item.confidence === "high" && item.type !== "vendor_claim" && item.type !== "internal_note";
}

function isWeakEvidence(item: Evidence): boolean {
  // Deprecated evidence is excluded from BOTH trusted and weak — see ADR-0001.
  if (item.reviewStatus === "deprecated") return false;
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
    highConfidenceEdgesWithoutEvidence: context.scopedEdgesActive.filter(
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
    ["delta_robot_sorting", "conveyor_diverter_sorting", "mobile_robot_sorting", "hybrid_human_robot_assisted_sorting"].includes(
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

/**
 * Per ADR-0003, the cost competency question consumes the cost-rollup
 * walker rather than a flat tag-or-id keyword filter. Scoring formula
 * (documented inline so future tweaks don't drift from intent):
 *
 *   - We compute the rolled-up cost (interval RMB) for the target product
 *     and the target cost the gate is grading against.
 *   - **Coverage component (0–3 points)**: gap fraction = coverageGap.length
 *     divided by the total cost-relevant nodes touched (gap + nodes that
 *     contributed cost). Score scales linearly: 0% gap → 3, 50% gap → 1.5,
 *     ≥75% gap → 0. A 50% gap caps the question at ~3.5 even with a
 *     perfect target match — per dispatch instructions, "a coverage gap of
 *     50% should not score 5/5".
 *   - **Target proximity component (0–2 points)**: if both the rolled-up
 *     p50 and the target p50 are present, distance = |rolled - target|
 *     / target. distance ≤ 0.05 → 2; ≤ 0.20 → 1.5; ≤ 0.50 → 1; > 0.50 → 0.
 *     If either side is missing, this component is 0 (we cannot honestly
 *     judge proximity).
 *   - Sum is rounded to nearest integer in 0–5.
 *   - The reviewStatus cap (3 for unreviewed, 2 for disputed) from
 *     `costScopedReviewStatusCap` runs at the end of `answerQuestion` and
 *     is scoped to cost-relevant records only (cost metric nodes + linked
 *     evidence). Per iter-19 review (P1), this replaces the previous global
 *     `applyReviewStatusCap` so an unreviewed bottleneck description doesn't
 *     mask cost-question correctness. We don't double-cap here. We DO
 *     surface coverageGap details in missingNodeIds so the gate report
 *     explains the score.
 */
function costConstraintsResult(
  context: GateContext,
  question: string,
): GateReport["questionResults"][number] {
  let rollup: CostRollupResult;
  try {
    rollup = rollupCost(context.graph, context.target.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return scoreResult(
      question,
      `Cost rollup failed: ${message}`,
      0,
      undefined,
      undefined,
      undefined,
      "Cost rollup walker bailed out. Inspect the graph for circular requires edges or other structural errors.",
    );
  }

  const target = targetCostFor(context.graph, context.target.id);
  const coverageNodesTouched = rollup.coverageGap.length;
  // Per iter-15 review (P0 #3), the eligibility filter is hoisted into
  // `eligibleCostSubsystemIds` so the gate denominator and the
  // panel/ProductView denominators match exactly. The set walks `requires`
  // children and excludes metric / evidence / bottleneck /
  // placeholder_breakthrough / capability nodes, deprecated nodes, and the
  // target product itself — same as the rollup walker.
  const eligibleNodeCount = eligibleCostSubsystemIds(context.graph, context.target.id).size;
  const totalForGap = Math.max(eligibleNodeCount, coverageNodesTouched, 1);
  const gapFraction = coverageNodesTouched / totalForGap;

  // Coverage component: 0% gap → 3.0, 50% → 1.5, ≥75% → 0.
  const coverageScore = Math.max(0, Math.min(3, 3 * (1 - gapFraction / 0.75)));

  // Proximity component. Per iter-15 review (P0 #1), when no subsystem
  // contributed real cost data (`anyChildContributed === false`), the
  // rolled-up `{0,0,0}` is meaningless and proximity must be 0 — and the
  // answer text must say so honestly rather than implying `p50=0` is
  // a real number.
  let proximityScore = 0;
  let proximityNote = "";
  if (target && rollup.anyChildContributed && rollup.rolledUp.typical > 0 && target.range.typical > 0) {
    const distance = Math.abs(rollup.rolledUp.typical - target.range.typical) / target.range.typical;
    if (distance <= 0.05) proximityScore = 2;
    else if (distance <= 0.2) proximityScore = 1.5;
    else if (distance <= 0.5) proximityScore = 1;
    else proximityScore = 0;
    proximityNote = `Rolled-up p50 ${formatRmb(rollup.rolledUp.typical)} vs target p50 ${formatRmb(target.range.typical)} → distance ${(distance * 100).toFixed(1)}%.`;
  } else if (!target) {
    proximityNote = "No target cost metric found on the product (looked for a measured_by metric with a currency unit and a numeric targetValue).";
  } else if (!rollup.anyChildContributed) {
    proximityNote = "No subsystem cost data was entered, so proximity to the target cannot be judged.";
  } else {
    proximityNote = "Cost rollup produced no p50 value (no cost data reachable in the requires subtree).";
  }

  const score = Math.max(0, Math.min(5, Math.round(coverageScore + proximityScore)));

  const rollupSummary = rollup.anyChildContributed
    ? `Rolled-up cost (RMB): p50=${formatRmb(rollup.rolledUp.typical)}, range=${formatRmb(rollup.rolledUp.min)}–${formatRmb(rollup.rolledUp.max)}`
    : "No subsystem cost data has been entered, so no rolled-up cost is available.";

  const answer = [
    rollupSummary,
    target ? `Target cost (RMB): p50=${formatRmb(target.range.typical)}` : "No target cost on product.",
    `Coverage gap: ${rollup.coverageGap.length} node(s)${rollup.coverageGap.length ? ` — ${sampleIds(rollup.coverageGap)}` : ""}`,
    rollup.costAsOf ? `Earliest costAsOf: ${rollup.costAsOf}` : "No costAsOf year recorded.",
    proximityNote,
  ].join(" ");

  return {
    question,
    answer,
    score,
    missingNodeIds: rollup.coverageGap.length ? rollup.coverageGap : undefined,
    notes: `Coverage component ${coverageScore.toFixed(2)}/3 (gap ${(gapFraction * 100).toFixed(1)}%) + proximity component ${proximityScore.toFixed(2)}/2 → score ${score}/5. Per ADR-0003, ${rollup.coverageGap.length} subsystem(s) had no reachable cost data.`,
  };
}

function formatRmb(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "0";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

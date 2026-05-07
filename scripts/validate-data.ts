import { loadGateQuestions, loadGateReports, loadGraphData, loadTasks, validateGraphReferences } from "../src/lib/graphLoader";
import type { Edge, GateReport, GraphData, Node, ResearchTask } from "../src/lib/schema";

const graph = loadGraphData();
const questions = loadGateQuestions();
const reports = loadGateReports();
const tasks = loadTasks();
const errors = validateGraphReferences(graph);
const nodeIds = new Set(graph.nodes.map((node) => node.id));
const latestReportByTarget = latestReportsByTarget(reports);
const latestReports = new Set(latestReportByTarget.values());
const reportsById = new Map(reports.map((report) => [gateReportId(report), report]));

if (questions.length !== 18) {
  errors.push(`Expected 18 gate questions, found ${questions.length}`);
}

for (const task of tasks) {
  if (task.targetNodeId && !nodeIds.has(task.targetNodeId)) {
    errors.push(`Task ${task.id} references missing target node: ${task.targetNodeId}`);
  }
  errors.push(...validateTaskGateReportReference(task, reportsById, latestReportByTarget, graph));
}

for (const report of reports) {
  if (report.graphVersion !== graph.graphVersion) {
    errors.push(
      `Gate report ${report.targetNodeId}:${report.generatedAt} graphVersion is ${report.graphVersion}, expected ${graph.graphVersion}`,
    );
  }
  if (Number.isNaN(Date.parse(report.generatedAt))) {
    errors.push(`Gate report ${report.targetNodeId}:${report.generatedAt} has an invalid generatedAt timestamp`);
  }
  if (!nodeIds.has(report.targetNodeId)) {
    errors.push(`Gate report ${report.targetNodeId}:${report.generatedAt} references missing target node: ${report.targetNodeId}`);
  }
  if (report.questionResults.length !== questions.length) {
    errors.push(
      `Gate report ${report.targetNodeId}:${report.generatedAt} has ${report.questionResults.length} question results, expected ${questions.length}`,
    );
  }
  if (latestReports.has(report)) {
    for (const [index, question] of questions.entries()) {
      const result = report.questionResults[index];
      if (result && result.question !== question.question) {
        errors.push(
          `Latest gate report ${report.targetNodeId}:${report.generatedAt} question ${index + 1} does not match default gate question ${question.id}`,
        );
      }
    }
  }
}

errors.push(...validateParcelCoreProvenance(graph));
errors.push(...validateHardToDevelopExplainability(graph));
errors.push(...validateMaturityLabelPresence(graph));
errors.push(...validateDisputedHasNotes(graph));
errors.push(...validateDeprecatedHasNotes(graph));

if (errors.length) {
  console.error("Data validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Data validation passed: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.evidence.length} evidence items.`);

/**
 * Per ADR-0005 (decomposition stop condition): every node MUST carry a
 * non-null `maturityLabel`. The stop condition is "commodified at industrial
 * scale" operationalized as `maturityLabel ∈ {mature, widely_adopted}`. If
 * the label is unset, the stop condition is undefined for that node and the
 * gate's frontier judgment cannot decide whether decomposition has legitimately
 * stopped or is incompletely modeled.
 */
/**
 * Per ADR-0001 (review-status ladder), a `disputed` record asserts a human
 * looked AND found counter-evidence. The dispute reason MUST be captured
 * inline (otherwise the ladder collapses to "we don't know why this was
 * disputed", which loses the signal that justified the 2/5 cap). For nodes
 * the canonical place is `notes`; for edges `context`; for evidence
 * `limitations` is the closest existing field, falling back to `summary`.
 */
function validateDisputedHasNotes(graph: GraphData): string[] {
  const errors: string[] = [];
  for (const node of graph.nodes) {
    if (node.reviewStatus !== "disputed") continue;
    if (!node.notes?.trim()) {
      errors.push(
        `Node ${node.id} has reviewStatus: "disputed" but no notes. Per ADR-0001 the dispute reason must be captured in notes.`,
      );
    }
  }
  for (const edge of graph.edges) {
    if (edge.reviewStatus !== "disputed") continue;
    if (!edge.context?.trim()) {
      errors.push(
        `Edge ${edge.id} has reviewStatus: "disputed" but no context. Per ADR-0001 the dispute reason must be captured in context.`,
      );
    }
  }
  for (const item of graph.evidence) {
    if (item.reviewStatus !== "disputed") continue;
    const text = (item.limitations?.trim() ?? "") || (item.summary?.trim() ?? "");
    if (!text) {
      errors.push(
        `Evidence ${item.id} has reviewStatus: "disputed" but no limitations or summary. Per ADR-0001 the dispute reason must be captured in one of those fields.`,
      );
    }
  }
  return errors;
}

/**
 * Per ADR-0001, `deprecated` means a record was once true / once accepted but
 * is now superseded or no longer applicable. The supersession reason must be
 * captured inline so deprecation is not a silent soft-delete — graph history
 * stays auditable.
 */
function validateDeprecatedHasNotes(graph: GraphData): string[] {
  const errors: string[] = [];
  for (const node of graph.nodes) {
    if (node.reviewStatus !== "deprecated") continue;
    if (!node.notes?.trim()) {
      errors.push(
        `Node ${node.id} has reviewStatus: "deprecated" but no notes. Per ADR-0001 the supersession reason must be captured in notes.`,
      );
    }
  }
  for (const edge of graph.edges) {
    if (edge.reviewStatus !== "deprecated") continue;
    if (!edge.context?.trim()) {
      errors.push(
        `Edge ${edge.id} has reviewStatus: "deprecated" but no context. Per ADR-0001 the supersession reason must be captured in context.`,
      );
    }
  }
  for (const item of graph.evidence) {
    if (item.reviewStatus !== "deprecated") continue;
    const text = (item.limitations?.trim() ?? "") || (item.summary?.trim() ?? "");
    if (!text) {
      errors.push(
        `Evidence ${item.id} has reviewStatus: "deprecated" but no limitations or summary. Per ADR-0001 the supersession reason must be captured in one of those fields.`,
      );
    }
  }
  return errors;
}

function validateMaturityLabelPresence(graph: GraphData): string[] {
  const errors: string[] = [];
  for (const node of graph.nodes) {
    if (!node.maturityLabel) {
      errors.push(
        `Node ${node.id} is missing maturityLabel. Per ADR-0005 every node must carry a maturityLabel so the decomposition stop condition is defined.`,
      );
    }
  }
  return errors;
}

/**
 * Per ADR-0005: any node tagged `hard_to_develop` MUST carry a non-empty
 * `notes` or `description` so the explainability of "what makes this hard"
 * is captured next to the tag. This is the v0 substrate for a future
 * `developmentDifficulty` schema field, so missing rationale here would
 * silently lose information when the field is promoted.
 */
function validateHardToDevelopExplainability(graph: GraphData): string[] {
  const errors: string[] = [];
  for (const node of graph.nodes) {
    if (!node.tags?.includes("hard_to_develop")) continue;
    const hasDescription = Boolean(node.description?.trim());
    const hasNotes = Boolean(node.notes?.trim());
    if (!hasDescription && !hasNotes) {
      errors.push(
        `Node ${node.id} carries tag "hard_to_develop" (per ADR-0005) but has no notes or description explaining what makes it hard.`,
      );
    }
  }
  return errors;
}

function validateParcelCoreProvenance(graph: GraphData): string[] {
  const targetId = "low_cost_parcel_sorting_robot_300k_rmb";
  const scopedIds = scopedNodeIdsForTarget(graph, targetId);
  const errors: string[] = [];

  for (const node of graph.nodes) {
    if (!scopedIds.has(node.id) || !isMediumOrHigh(node)) continue;
    if (!hasClaimProvenance(node)) {
      errors.push(
        `Parcel core node ${node.id} has ${node.confidence} confidence but lacks provenance: add evidenceIds, reviewStatus: "unreviewed", or explicit notes/internal provenance.`,
      );
    }
  }

  for (const edge of graph.edges) {
    if (!scopedIds.has(edge.source) || !isMediumOrHigh(edge)) continue;
    if (!hasClaimProvenance(edge)) {
      errors.push(
        `Parcel core edge ${edge.id} has ${edge.confidence} confidence but lacks provenance: add evidenceIds, reviewStatus: "unreviewed", or explicit context/internal provenance.`,
      );
    }
  }

  return errors;
}

function scopedNodeIdsForTarget(graph: GraphData, targetId: string): Set<string> {
  const ids = new Set<string>([targetId]);
  const queue = [targetId];

  while (queue.length) {
    const source = queue.shift();
    if (!source) continue;
    for (const edge of graph.edges.filter((item) => item.source === source)) {
      if (ids.has(edge.target)) continue;
      ids.add(edge.target);
      queue.push(edge.target);
    }
  }

  return ids;
}

function isMediumOrHigh(claim: Node | Edge): boolean {
  return claim.confidence === "medium" || claim.confidence === "high";
}

function hasClaimProvenance(claim: Node | Edge): boolean {
  if (claim.evidenceIds?.length) return true;
  if (claim.reviewStatus === "unreviewed" || claim.reviewStatus === "reviewed" || claim.reviewStatus === "disputed") return true;
  const text = "relation" in claim ? claim.context : claim.notes;
  return Boolean(text && /\b(agent|candidate|frontier|internal|planning|placeholder|unreviewed)\b/i.test(text));
}

function validateTaskGateReportReference(
  task: ResearchTask,
  reportsById: Map<string, GateReport>,
  latestReportByTarget: Map<string, GateReport>,
  graph: GraphData,
): string[] {
  if (!task.sourceGateReportId) return [];

  const errors: string[] = [];
  const parsed = parseGateReportId(task.sourceGateReportId);

  if (!parsed) {
    errors.push(
      `Task ${task.id} sourceGateReportId must use targetNodeId:generatedAt format: ${task.sourceGateReportId}`,
    );
    return errors;
  }

  if (Number.isNaN(Date.parse(parsed.generatedAt))) {
    errors.push(`Task ${task.id} sourceGateReportId has an invalid generatedAt timestamp: ${task.sourceGateReportId}`);
  }

  const report = reportsById.get(task.sourceGateReportId);
  if (!report) {
    errors.push(`Task ${task.id} sourceGateReportId does not match a data/gate_reports report: ${task.sourceGateReportId}`);
    return errors;
  }

  if (task.targetNodeId && task.targetNodeId !== report.targetNodeId && !scopedNodeIdsForTarget(graph, report.targetNodeId).has(task.targetNodeId)) {
    errors.push(
      `Task ${task.id} targetNodeId ${task.targetNodeId} is outside source gate report scope ${report.targetNodeId}`,
    );
  }

  const latestReport = latestReportByTarget.get(report.targetNodeId);
  if (task.status === "pending" && latestReport && gateReportId(latestReport) !== task.sourceGateReportId) {
    errors.push(
      `Pending gate follow-up task ${task.id} points to historical gate report ${task.sourceGateReportId}; latest for ${report.targetNodeId} is ${gateReportId(latestReport)}. Mark it non-pending or update sourceGateReportId.`,
    );
  }

  return errors;
}

function parseGateReportId(id: string): { targetNodeId: string; generatedAt: string } | undefined {
  const separatorIndex = id.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === id.length - 1) return undefined;
  return {
    targetNodeId: id.slice(0, separatorIndex),
    generatedAt: id.slice(separatorIndex + 1),
  };
}

function gateReportId(report: GateReport): string {
  return `${report.targetNodeId}:${report.generatedAt}`;
}

function latestReportsByTarget<T extends { targetNodeId: string; generatedAt: string }>(items: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const item of items) {
    const existing = latest.get(item.targetNodeId);
    if (!existing || Date.parse(item.generatedAt) > Date.parse(existing.generatedAt)) {
      latest.set(item.targetNodeId, item);
    }
  }
  return latest;
}

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadGraphData, loadTasks } from "../src/lib/graphLoader";
import { reachableNodeIdsFrom, V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";
import {
  edgeSchema,
  evidenceSchema,
  type GraphData,
  nodeSchema,
  researchTaskSchema,
  type Edge,
  type Evidence,
  type Node,
  type ResearchTask,
} from "../src/lib/schema";

const dataRoot = path.join(process.cwd(), "data");
const nodeFile = path.join(dataRoot, "nodes", "parcel_sorting_robot.json");
const edgeFile = path.join(dataRoot, "edges", "parcel_sorting_robot_edges.json");
const evidenceFile = path.join(dataRoot, "evidence", "parcel_sorting_robot_evidence.json");
const taskFile = path.join(dataRoot, "tasks", "pending_tasks.json");

const candidateTaskSchema = researchTaskSchema
  .omit({ id: true, status: true, createdAt: true })
  .extend({
    id: z.string().min(1).optional(),
    status: researchTaskSchema.shape.status.optional(),
    createdAt: z.string().optional(),
  })
  .strict();

const candidateImportSchema = z.object({
  nodes: z.array(nodeSchema.strict()).optional().default([]),
  edges: z.array(edgeSchema.strict()).optional().default([]),
  evidence: z.array(evidenceSchema.strict()).optional().default([]),
  tasks: z
    .array(candidateTaskSchema)
    .optional()
    .default([]),
}).strict();

type CandidateImport = z.infer<typeof candidateImportSchema>;

function parseArgs(): { filePath: string; dryRun: boolean; allowReviewed: boolean; allowActiveScopeExpansion: boolean } {
  const fileIndex = process.argv.indexOf("--file");
  const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
  const dryRun = process.argv.includes("--dry-run");
  const allowReviewed = process.argv.includes("--allow-reviewed");
  const allowActiveScopeExpansion = process.argv.includes("--allow-active-scope-expansion");

  if (!filePath) {
    console.error(
      "Usage: npm run import:candidates -- --file <candidate-json> [--dry-run] [--allow-reviewed] [--allow-active-scope-expansion]",
    );
    process.exit(1);
  }

  if (allowReviewed && !dryRun) {
    console.error(
      "Candidate import failed: --allow-reviewed is only valid with --dry-run. Formal candidate imports cannot write reviewed nodes, edges, or evidence.",
    );
    process.exit(1);
  }

  return { filePath, dryRun, allowReviewed, allowActiveScopeExpansion };
}

function main(): void {
  const { filePath, dryRun, allowReviewed, allowActiveScopeExpansion } = parseArgs();
  const importedAt = new Date().toISOString();
  const input = readCandidateFile(filePath);
  const candidate = withImportDefaults(input, importedAt);
  const graph = loadGraphData();
  const existingTasks = loadTasks();
  const errors = validateCandidateImport(candidate, graph, existingTasks, { allowReviewed, allowActiveScopeExpansion });

  if (errors.length) {
    console.error("Candidate import failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `Candidate import ${dryRun ? "dry run" : "ready"}: ${candidate.nodes.length} nodes, ${candidate.edges.length} edges, ${candidate.evidence.length} evidence items, ${candidate.tasks.length} tasks.`,
  );

  if (dryRun) return;

  appendJsonArray<Node>(nodeFile, candidate.nodes);
  appendJsonArray<Edge>(edgeFile, candidate.edges);
  appendJsonArray<Evidence>(evidenceFile, candidate.evidence);
  appendJsonArray<ResearchTask>(taskFile, candidate.tasks);
  console.log("Candidate import written to local JSON graph files.");
}

function readCandidateFile(filePath: string): CandidateImport {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return candidateImportSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Candidate import failed schema validation:");
      for (const issue of error.issues) console.error(`- ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      process.exit(1);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Candidate import failed to read ${filePath}: ${message}`);
    process.exit(1);
  }
}

function withImportDefaults(candidate: CandidateImport, importedAt: string): {
  nodes: Node[];
  edges: Edge[];
  evidence: Evidence[];
  tasks: ResearchTask[];
} {
  const compactTime = importedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return {
    nodes: candidate.nodes.map((node) => ({
      ...node,
      reviewStatus: node.reviewStatus ?? "unreviewed",
    })),
    edges: candidate.edges.map((edge) => ({
      ...edge,
      reviewStatus: edge.reviewStatus ?? "unreviewed",
    })),
    evidence: candidate.evidence.map((item) => ({
      ...item,
      reviewStatus: item.reviewStatus ?? "unreviewed",
    })),
    tasks: candidate.tasks.map((task, index) => ({
      ...task,
      id: task.id ?? `task_import_${compactTime}_${index + 1}`,
      status: task.status ?? "pending",
      createdAt: task.createdAt ?? importedAt,
    })),
  };
}

function validateCandidateImport(
  candidate: { nodes: Node[]; edges: Edge[]; evidence: Evidence[]; tasks: ResearchTask[] },
  graph: ReturnType<typeof loadGraphData>,
  existingTasks: ResearchTask[],
  options: { allowReviewed: boolean; allowActiveScopeExpansion: boolean },
): string[] {
  const errors: string[] = [];
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));
  const existingEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const existingEvidenceIds = new Set(graph.evidence.map((item) => item.id));
  const existingTaskIds = new Set(existingTasks.map((task) => task.id));
  const candidateNodeIds = new Set(candidate.nodes.map((node) => node.id));
  const candidateEdgeIds = new Set(candidate.edges.map((edge) => edge.id));
  const candidateEvidenceIds = new Set(candidate.evidence.map((item) => item.id));
  const candidateTaskIds = new Set(candidate.tasks.map((task) => task.id));

  errors.push(...duplicateErrors("candidate node", candidate.nodes.map((node) => node.id)));
  errors.push(...duplicateErrors("candidate edge", candidate.edges.map((edge) => edge.id)));
  errors.push(...duplicateErrors("candidate evidence", candidate.evidence.map((item) => item.id)));
  errors.push(...duplicateErrors("candidate task", candidate.tasks.map((task) => task.id)));

  for (const node of candidate.nodes) {
    if (existingNodeIds.has(node.id)) errors.push(`Node id already exists: ${node.id}`);
    if (node.reviewStatus === "reviewed" && !options.allowReviewed) {
      errors.push(reviewedStatusError("Node", node.id));
    }
    if (node.reviewStatus === "disputed") errors.push(humanOnlyStatusError("Node", node.id, "disputed"));
    if (node.reviewStatus === "deprecated") errors.push(humanOnlyStatusError("Node", node.id, "deprecated"));
  }
  for (const edge of candidate.edges) {
    if (existingEdgeIds.has(edge.id)) errors.push(`Edge id already exists: ${edge.id}`);
    if (edge.reviewStatus === "reviewed" && !options.allowReviewed) {
      errors.push(reviewedStatusError("Edge", edge.id));
    }
    if (edge.reviewStatus === "disputed") errors.push(humanOnlyStatusError("Edge", edge.id, "disputed"));
    if (edge.reviewStatus === "deprecated") errors.push(humanOnlyStatusError("Edge", edge.id, "deprecated"));
    if (!existingNodeIds.has(edge.source) && !candidateNodeIds.has(edge.source)) errors.push(`Edge ${edge.id} source is missing: ${edge.source}`);
    if (!existingNodeIds.has(edge.target) && !candidateNodeIds.has(edge.target)) errors.push(`Edge ${edge.id} target is missing: ${edge.target}`);
    for (const evidenceId of edge.evidenceIds ?? []) {
      if (!existingEvidenceIds.has(evidenceId) && !candidateEvidenceIds.has(evidenceId)) {
        errors.push(`Edge ${edge.id} references missing evidence: ${evidenceId}`);
      }
    }
  }
  for (const item of candidate.evidence) {
    if (existingEvidenceIds.has(item.id)) errors.push(`Evidence id already exists: ${item.id}`);
    if (item.reviewStatus === "reviewed" && !options.allowReviewed) {
      errors.push(reviewedStatusError("Evidence", item.id));
    }
    if (item.reviewStatus === "disputed") errors.push(humanOnlyStatusError("Evidence", item.id, "disputed"));
    if (item.reviewStatus === "deprecated") errors.push(humanOnlyStatusError("Evidence", item.id, "deprecated"));
    for (const nodeId of item.supportsNodeIds ?? []) {
      if (!existingNodeIds.has(nodeId) && !candidateNodeIds.has(nodeId)) errors.push(`Evidence ${item.id} supports missing node: ${nodeId}`);
    }
    for (const edgeId of item.supportsEdgeIds ?? []) {
      if (!existingEdgeIds.has(edgeId) && !candidateEdgeIds.has(edgeId)) errors.push(`Evidence ${item.id} supports missing edge: ${edgeId}`);
    }
  }
  for (const task of candidate.tasks) {
    if (existingTaskIds.has(task.id)) errors.push(`Task id already exists: ${task.id}`);
    if (task.targetNodeId && !existingNodeIds.has(task.targetNodeId) && !candidateNodeIds.has(task.targetNodeId)) {
      errors.push(`Task ${task.id} target node is missing: ${task.targetNodeId}`);
    }
  }

  if (!options.allowActiveScopeExpansion) {
    errors.push(...activeScopeExpansionErrors(candidate, graph));
  }

  return errors;
}

function activeScopeExpansionErrors(
  candidate: { nodes: Node[]; edges: Edge[]; evidence: Evidence[] },
  graph: GraphData,
): string[] {
  const combinedGraph: GraphData = {
    ...graph,
    nodes: [...graph.nodes, ...candidate.nodes],
    edges: [...graph.edges, ...candidate.edges],
    evidence: [...graph.evidence, ...candidate.evidence],
  };
  const activeOrCandidateReachableIds = reachableNodeIdsFrom(combinedGraph, V0_TARGET_NODE_ID);
  const nodesById = new Map(combinedGraph.nodes.map((node) => [node.id, node]));
  const errors: string[] = [];

  for (const edge of candidate.edges) {
    const target = nodesById.get(edge.target);
    const expandsActiveScopeToProduct =
      activeOrCandidateReachableIds.has(edge.source) && target?.kind === "product" && target.id !== V0_TARGET_NODE_ID;

    if (!expandsActiveScopeToProduct) continue;

    errors.push(
      `Edge ${edge.id} would expand the active v0 scope from ${edge.source} to product ${edge.target}. ` +
        "Keep neighboring products disconnected by default, or rerun with --allow-active-scope-expansion only when intentionally expanding the current product boundary.",
    );
  }

  return errors;
}

function reviewedStatusError(label: "Node" | "Edge" | "Evidence", id: string): string {
  return `${label} ${id} is marked reviewed. Candidate imports default to unreviewed; use --dry-run --allow-reviewed only to inspect records that have already been human reviewed.`;
}

/**
 * Per ADR-0001, `disputed` and `deprecated` reviewStatus values both imply a
 * human has already engaged with the record (found counter-evidence, or
 * superseded it). Neither is a legitimate state for fresh agent-imported
 * candidates. The `--allow-reviewed` flag does NOT lift these — that flag
 * only relaxes the "reviewed" check.
 */
function humanOnlyStatusError(
  label: "Node" | "Edge" | "Evidence",
  id: string,
  status: "disputed" | "deprecated",
): string {
  const reason =
    status === "disputed"
      ? "implies a human has actively engaged and found counter-evidence"
      : "implies a human has soft-deleted a once-accepted record";
  return `${label} ${id} is marked reviewStatus: "${status}". This status ${reason} (per ADR-0001). Fresh agent-imported candidates cannot carry it; --allow-reviewed does not lift this check. Hand-edit the live data files to apply this status.`;
}

function duplicateErrors(label: string, ids: string[]): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate ${label} id in candidate file: ${id}`);
    seen.add(id);
  }
  return errors;
}

function appendJsonArray<T>(filePath: string, items: T[]): void {
  if (!items.length) return;
  const existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as T[];
  fs.writeFileSync(filePath, `${JSON.stringify([...existing, ...items], null, 2)}\n`);
}

main();

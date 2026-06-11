import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { loadGraphData, loadTasks } from "../src/lib/graphLoader";
import { reachableNodeIdsFrom, V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";
import {
  edgeSchema,
  evidenceSchema,
  type GraphData,
  maturityAsOfRequiredMessage,
  maturityAsOfRequiredWhenSet,
  researchTaskSchema,
  strictNodeSchemaLoose,
  type Edge,
  type Evidence,
  type Node,
  type ResearchTask,
} from "../src/lib/schema";

const dataRoot = path.join(process.cwd(), "data");

/**
 * `loadGraphData` reads every JSON file under data/{nodes,edges,evidence}, so
 * multi-domain data lives in per-domain files (e.g. `ai_compute_chain.json`)
 * while validation stays whole-graph. `--domain <name>` routes appends to the
 * domain's files; without it, appends keep targeting the parcel-sorting v0
 * files. Research tasks are a single shared queue either way.
 */
export function resolveDataFiles(domain?: string): {
  nodeFile: string;
  edgeFile: string;
  evidenceFile: string;
  taskFile: string;
} {
  if (domain !== undefined && !/^[a-z0-9_]+$/.test(domain)) {
    throw new Error(`--domain must be lower_snake_case, got: "${domain}"`);
  }
  const base = domain ?? "parcel_sorting_robot";
  return {
    nodeFile: path.join(dataRoot, "nodes", `${base}.json`),
    edgeFile: path.join(dataRoot, "edges", `${base}_edges.json`),
    evidenceFile: path.join(dataRoot, "evidence", `${base}_evidence.json`),
    taskFile: path.join(dataRoot, "tasks", "pending_tasks.json"),
  };
}

const candidateTaskSchema = researchTaskSchema
  .omit({ id: true, status: true, createdAt: true })
  .extend({
    id: z.string().min(1).optional(),
    status: researchTaskSchema.shape.status.optional(),
    createdAt: z.string().optional(),
  })
  .strict();

const candidateImportSchema = z.object({
  // Loose at read-time (no maturityAsOf-required refine) so we can default
  // `maturityAsOf` to the current YYYY-MM during `withImportDefaults` before
  // validating the conditional rule. The post-default validation pass below
  // applies `maturityAsOfRequiredWhenSet` on the filled-in nodes.
  nodes: z.array(strictNodeSchemaLoose).optional().default([]),
  edges: z.array(edgeSchema.strict()).optional().default([]),
  evidence: z.array(evidenceSchema.strict()).optional().default([]),
  tasks: z
    .array(candidateTaskSchema)
    .optional()
    .default([]),
}).strict();

type CandidateImport = z.infer<typeof candidateImportSchema>;

function parseArgs(): { filePath: string; domain?: string; dryRun: boolean; allowReviewed: boolean; allowActiveScopeExpansion: boolean } {
  const fileIndex = process.argv.indexOf("--file");
  const filePath = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
  const domainIndex = process.argv.indexOf("--domain");
  const domain = domainIndex >= 0 ? process.argv[domainIndex + 1] : undefined;
  const dryRun = process.argv.includes("--dry-run");
  const allowReviewed = process.argv.includes("--allow-reviewed");
  const allowActiveScopeExpansion = process.argv.includes("--allow-active-scope-expansion");

  if (!filePath || (domainIndex >= 0 && !domain)) {
    console.error(
      "Usage: npm run import:candidates -- --file <candidate-json> [--domain <data_file_base>] [--dry-run] [--allow-reviewed] [--allow-active-scope-expansion]",
    );
    process.exit(1);
  }

  if (allowReviewed && !dryRun) {
    console.error(
      "Candidate import failed: --allow-reviewed is only valid with --dry-run. Formal candidate imports cannot write reviewed nodes, edges, or evidence.",
    );
    process.exit(1);
  }

  return { filePath, domain, dryRun, allowReviewed, allowActiveScopeExpansion };
}

function main(): void {
  const { filePath, domain, dryRun, allowReviewed, allowActiveScopeExpansion } = parseArgs();
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

  const files = resolveDataFiles(domain);
  appendJsonArray<Node>(files.nodeFile, candidate.nodes);
  appendJsonArray<Edge>(files.edgeFile, candidate.edges);
  appendJsonArray<Evidence>(files.evidenceFile, candidate.evidence);
  appendJsonArray<ResearchTask>(files.taskFile, candidate.tasks);
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

export function withImportDefaults(candidate: CandidateImport, importedAt: string): {
  nodes: Node[];
  edges: Edge[];
  evidence: Evidence[];
  tasks: ResearchTask[];
} {
  const compactTime = importedAt.replace(/[^0-9]/g, "").slice(0, 14);
  /**
   * Per ADR-0002 "maturityAsOf required when any maturity field is set", an
   * agent-imported candidate that carries maturity data without a
   * `maturityAsOf` is silently undated. Defaulting to the current YYYY-MM
   * here (rather than rejecting at the schema level) keeps imports working
   * for cost-bearing candidates that already carry `costAsOf`, while
   * preserving the audit trail: the defaulted month equals the import month,
   * which is the most defensible answer when the agent omits one. Hand-
   * authored data still has to backfill `maturityAsOf` explicitly because
   * `validate:data` runs the same refine on the live graph.
   */
  const importedMonth = importedAt.slice(0, 7);
  return {
    nodes: candidate.nodes.map((node) => ({
      ...node,
      maturityLabel: node.maturityLabel ?? "unknown",
      reviewStatus: node.reviewStatus ?? "unreviewed",
      maturityAsOf:
        node.maturityAsOf ??
        ((node.maturityScore !== undefined ||
          (node.maturityLabel !== undefined && node.maturityLabel !== "unknown"))
          ? importedMonth
          : undefined),
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

export function validateCandidateImport(
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
    if (!maturityAsOfRequiredWhenSet(node)) {
      // Defense in depth: the loose-schema read path defaults `maturityAsOf`
      // to the import month, so this should be unreachable. Keep the error
      // so a refactor that drops the default still fails loudly with the
      // same ADR-0002 message instead of silently writing undated maturity.
      errors.push(`Node ${node.id}: ${maturityAsOfRequiredMessage}`);
    }
    if (node.reviewStatus === "reviewed" && !options.allowReviewed) {
      errors.push(reviewedStatusError("Node", node.id));
    }
    if (node.reviewStatus === "disputed" && !options.allowReviewed) {
      errors.push(humanOnlyStatusError("Node", node.id, "disputed"));
    }
    if (node.reviewStatus === "deprecated" && !options.allowReviewed) {
      errors.push(humanOnlyStatusError("Node", node.id, "deprecated"));
    }
    if (isCostBearingCandidateNode(node) && !(node.evidenceIds?.length)) {
      errors.push(
        `cost candidate without evidence rejected: node ${node.id} carries a cost-bearing metric but has no evidenceIds. Per ADR-0003, agent-imported cost candidates must carry provenance.`,
      );
    }
    for (const evidenceId of node.evidenceIds ?? []) {
      if (!existingEvidenceIds.has(evidenceId) && !candidateEvidenceIds.has(evidenceId)) {
        errors.push(`Node ${node.id} references missing evidence: ${evidenceId}`);
      }
    }
  }
  for (const edge of candidate.edges) {
    if (existingEdgeIds.has(edge.id)) errors.push(`Edge id already exists: ${edge.id}`);
    if (edge.reviewStatus === "reviewed" && !options.allowReviewed) {
      errors.push(reviewedStatusError("Edge", edge.id));
    }
    if (edge.reviewStatus === "disputed" && !options.allowReviewed) {
      errors.push(humanOnlyStatusError("Edge", edge.id, "disputed"));
    }
    if (edge.reviewStatus === "deprecated" && !options.allowReviewed) {
      errors.push(humanOnlyStatusError("Edge", edge.id, "deprecated"));
    }
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
    if (item.reviewStatus === "disputed" && !options.allowReviewed) {
      errors.push(humanOnlyStatusError("Evidence", item.id, "disputed"));
    }
    if (item.reviewStatus === "deprecated" && !options.allowReviewed) {
      errors.push(humanOnlyStatusError("Evidence", item.id, "deprecated"));
    }
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

/**
 * Per ADR-0003, agent-imported cost candidates MUST carry `evidenceIds`.
 * "Cost-bearing" means the node carries a `metric` whose unit is a recognized
 * currency or whose `currency` field is set. The check fires on any candidate
 * node — even non-`metric` kinds — because cost claims sometimes attach as
 * inline `metrics` arrays on subsystem nodes.
 */
const COST_CURRENCY_CODES = new Set(["RMB", "USD", "EUR", "JPY"]);

function isCostBearingCandidateNode(node: Node): boolean {
  if (!node.metrics?.length) return false;
  return node.metrics.some((entry) => {
    if (entry.currency && COST_CURRENCY_CODES.has(entry.currency)) return true;
    if (!entry.unit) return false;
    const upper = entry.unit.toUpperCase();
    for (const code of COST_CURRENCY_CODES) {
      if (upper === code || upper.startsWith(`${code}/`) || upper.startsWith(`${code} `)) return true;
    }
    return false;
  });
}

function reviewedStatusError(label: "Node" | "Edge" | "Evidence", id: string): string {
  return `${label} ${id} is marked reviewed. Candidate imports default to unreviewed; use --dry-run --allow-reviewed only to inspect records that have already been human reviewed.`;
}

/**
 * Per ADR-0001 §Consequences, `disputed` and `deprecated` reviewStatus values
 * both imply a human has already engaged with the record (found
 * counter-evidence, or superseded it). They are gated behind the same
 * `--allow-reviewed` (dry-run-only) flag as `reviewed` so a human can
 * inspect candidate files that already encode human-only statuses without
 * writing them to live data. Per iter-15 review (P0 #4), the prior
 * unconditional rejection contradicted ADR-0001 §Consequences which
 * explicitly extends `--dry-run --allow-reviewed` to all three human-only
 * statuses.
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
  return `${label} ${id} is marked reviewStatus: "${status}". This status ${reason} (per ADR-0001). Fresh agent-imported candidates cannot carry it; use --dry-run --allow-reviewed to inspect candidate files that already encode this status, or hand-edit the live data files to apply it.`;
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
  // A new domain's data files don't exist until the first import lands.
  const existing = fs.existsSync(filePath) ? (JSON.parse(fs.readFileSync(filePath, "utf8")) as T[]) : [];
  fs.writeFileSync(filePath, `${JSON.stringify([...existing, ...items], null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

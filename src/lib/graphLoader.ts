import fs from "node:fs";
import path from "node:path";
import {
  edgeSchema,
  evidenceSchema,
  gateQuestionSchema,
  gateReportSchema,
  GraphData,
  nodeSchema,
  researchTaskSchema,
  type Edge,
  type Evidence,
  type GateQuestion,
  type GateReport,
  type Node,
  type ResearchTask,
} from "./schema";
import { scopeGraphToReachableNodes, V0_TARGET_NODE_ID } from "./graphTraversal";

const root = process.cwd();
const dataRoot = path.join(root, "data");

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readJsonArray<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => readJsonFile<T[]>(path.join(dir, file)));
}

export function loadGraphData(): GraphData {
  const nodes = readJsonArray<Node>(path.join(dataRoot, "nodes")).map((node) => nodeSchema.parse(node));
  const edges = readJsonArray<Edge>(path.join(dataRoot, "edges")).map((edge) => edgeSchema.parse(edge));
  const evidence = readJsonArray<Evidence>(path.join(dataRoot, "evidence")).map((item) => evidenceSchema.parse(item));

  return {
    graphVersion: "v0-parcel-sorting-robot",
    nodes,
    edges,
    evidence,
  };
}

export function loadActiveGraphData(targetNodeId: string = V0_TARGET_NODE_ID): GraphData {
  return scopeGraphToReachableNodes(loadGraphData(), targetNodeId);
}

export function loadGateQuestions(): GateQuestion[] {
  return readJsonFile<GateQuestion[]>(path.join(dataRoot, "gate_questions", "default_product_questions.json")).map((question) =>
    gateQuestionSchema.parse(question),
  );
}

export function loadGateReports(): GateReport[] {
  return readJsonArray<GateReport>(path.join(dataRoot, "gate_reports")).map((report) => gateReportSchema.parse(report));
}

export function loadTasks(): ResearchTask[] {
  const filePath = path.join(dataRoot, "tasks", "pending_tasks.json");
  if (!fs.existsSync(filePath)) return [];
  return readJsonFile<ResearchTask[]>(filePath).map((task) => researchTaskSchema.parse(task));
}

export function writeGateReport(report: GateReport): string {
  const dir = path.join(dataRoot, "gate_reports");
  fs.mkdirSync(dir, { recursive: true });
  const safeTime = report.generatedAt.replace(/[:.]/g, "-");
  const fileName = `${report.targetNodeId}.${safeTime}.json`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
  return filePath;
}

export function writeTasks(tasks: ResearchTask[]): void {
  const filePath = path.join(dataRoot, "tasks", "pending_tasks.json");
  fs.writeFileSync(filePath, `${JSON.stringify(tasks, null, 2)}\n`);
}

function appendJsonArray<T>(filePath: string, additions: T[]): void {
  if (additions.length === 0) return;
  const existing = fs.existsSync(filePath) ? readJsonFile<T[]>(filePath) : [];
  fs.writeFileSync(filePath, `${JSON.stringify([...existing, ...additions], null, 2)}\n`);
}

export function appendGraphPatchToParcelData(patch: { nodes: Node[]; edges: Edge[] }): void {
  appendJsonArray<Node>(path.join(dataRoot, "nodes", "parcel_sorting_robot.json"), patch.nodes);
  appendJsonArray<Edge>(path.join(dataRoot, "edges", "parcel_sorting_robot_edges.json"), patch.edges);
}

export function validateGraphReferences(graph: GraphData): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const evidenceIds = new Set(graph.evidence.map((item) => item.id));

  for (const [label, ids] of [
    ["node", graph.nodes.map((node) => node.id)],
    ["edge", graph.edges.map((edge) => edge.id)],
    ["evidence", graph.evidence.map((item) => item.id)],
  ] as const) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`Duplicate ${label} id: ${id}`);
      seen.add(id);
    }
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} source does not exist: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} target does not exist: ${edge.target}`);
    for (const evidenceId of edge.evidenceIds ?? []) {
      if (!evidenceIds.has(evidenceId)) errors.push(`Edge ${edge.id} evidence does not exist: ${evidenceId}`);
    }
  }

  for (const node of graph.nodes) {
    for (const evidenceId of node.evidenceIds ?? []) {
      if (!evidenceIds.has(evidenceId)) errors.push(`Node ${node.id} evidence does not exist: ${evidenceId}`);
    }
  }

  for (const item of graph.evidence) {
    for (const nodeId of item.supportsNodeIds ?? []) {
      if (!nodeIds.has(nodeId)) errors.push(`Evidence ${item.id} supports missing node: ${nodeId}`);
    }
    for (const edgeId of item.supportsEdgeIds ?? []) {
      if (!edgeIds.has(edgeId)) errors.push(`Evidence ${item.id} supports missing edge: ${edgeId}`);
    }
  }

  return errors;
}

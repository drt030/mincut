import type { GraphData, ResearchTask } from "./schema";

const AGENT_EXPANSION_TASK_PREFIX = "task_agent_expand_";

function safeTaskIdSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function timestampSegment(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 14);
}

function nodeDisplayName(graph: GraphData, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}

function assertKnownTarget(graph: GraphData, targetNodeId: string): void {
  if (!graph.nodes.some((node) => node.id === targetNodeId)) {
    throw new Error(`Cannot create agent expansion task for unknown node: ${targetNodeId}`);
  }
}

export function buildAgentExpansionTask(
  graph: GraphData,
  targetNodeId: string,
  createdAt = new Date().toISOString(),
): ResearchTask {
  assertKnownTarget(graph, targetNodeId);
  const displayName = nodeDisplayName(graph, targetNodeId);
  return {
    id: `${AGENT_EXPANSION_TASK_PREFIX}${safeTaskIdSegment(targetNodeId)}_${timestampSegment(createdAt)}`,
    title: `Expand ${displayName} one dependency layer`,
    reason:
      `Queued from the graph research-root view for ${targetNodeId}. ` +
      "Follow docs/NODE_EXPANSION.md, research sources as needed, prepare a small candidate import batch, " +
      "and add one deeper requires layer where it affects maturity, cost, manufacturability, reliability, or bottlenecks. " +
      "Keep generated claims unreviewed until human review.",
    targetNodeId,
    suggestedNodeKind: "module",
    priority: "medium",
    status: "pending",
    createdAt,
  };
}

function isOpenAgentExpansionTask(task: ResearchTask, targetNodeId: string): boolean {
  const generatedIdMatches = task.id.startsWith(`${AGENT_EXPANSION_TASK_PREFIX}${safeTaskIdSegment(targetNodeId)}_`);
  const titleMatches = task.title.startsWith("Expand ") && task.title.includes(" one dependency layer");
  return (
    task.targetNodeId === targetNodeId &&
    (task.status === "pending" || task.status === "in_progress") &&
    (generatedIdMatches || titleMatches)
  );
}

export function upsertAgentExpansionTask(
  graph: GraphData,
  tasks: ResearchTask[],
  targetNodeId: string,
  createdAt = new Date().toISOString(),
): { task: ResearchTask; tasks: ResearchTask[]; created: boolean } {
  assertKnownTarget(graph, targetNodeId);
  const existing = tasks.find((task) => isOpenAgentExpansionTask(task, targetNodeId));
  if (existing) {
    return { task: existing, tasks, created: false };
  }
  const task = buildAgentExpansionTask(graph, targetNodeId, createdAt);
  return { task, tasks: [...tasks, task], created: true };
}

import type { GateReport, ResearchTask } from "./schema";

export function tasksFromGateReport(report: GateReport): ResearchTask[] {
  const createdAt = report.generatedAt;
  const reportId = `${report.targetNodeId}:${report.generatedAt}`;
  return report.recommendedNextTasks.map((task, index) => ({
    id: `task_${report.targetNodeId}_${index + 1}_${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
    title: task.title,
    reason: task.reason,
    targetNodeId: task.targetNodeId ?? report.targetNodeId,
    suggestedNodeKind: task.suggestedNodeKind,
    priority: task.priority,
    status: "pending",
    createdAt,
    sourceGateReportId: reportId,
  }));
}

export function mergeTasks(existing: ResearchTask[], generated: ResearchTask[]): ResearchTask[] {
  const byTitle = new Map(existing.map((task) => [`${task.targetNodeId}:${task.title}`, task]));
  for (const task of generated) {
    const key = `${task.targetNodeId}:${task.title}`;
    const current = byTitle.get(key);
    if (!current) {
      byTitle.set(key, task);
      continue;
    }

    if (current.status === "pending") {
      byTitle.set(key, {
        ...current,
        reason: task.reason,
        suggestedNodeKind: task.suggestedNodeKind,
        priority: task.priority,
        sourceGateReportId: task.sourceGateReportId,
      });
    }
  }
  return [...byTitle.values()];
}

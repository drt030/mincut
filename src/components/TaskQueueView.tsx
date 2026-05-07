"use client";

import type { ResearchTask } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";

type Props = {
  tasks: ResearchTask[];
  currentGateReportIds: string[];
  activeScopeNodeIds: string[];
};

export function TaskQueueView({ tasks, currentGateReportIds, activeScopeNodeIds }: Props) {
  const { t } = useLanguage();
  if (!tasks.length) {
    return <p className="muted">{t("noTasks")}</p>;
  }

  const currentGateReportIdSet = new Set(currentGateReportIds);
  const activeScopeNodeIdSet = new Set(activeScopeNodeIds);
  const { activeTasks, deferredTasks } = partitionTasksByActiveScope(tasks, activeScopeNodeIdSet);
  const latestGateTasks = sortTasks(
    activeTasks.filter((task) => task.sourceGateReportId && currentGateReportIdSet.has(task.sourceGateReportId)),
  );
  const olderGateTasks = sortTasks(
    activeTasks.filter((task) => task.sourceGateReportId && !currentGateReportIdSet.has(task.sourceGateReportId)),
  );
  const backlogTasks = sortTasks(activeTasks.filter((task) => !task.sourceGateReportId));
  const deferredBacklogTasks = sortTasks(deferredTasks);
  const latestGateReportHint = currentGateReportIds.length ? currentGateReportIds.join(", ") : undefined;

  return (
    <div className="detail-list">
      {latestGateTasks.length ? (
        <TaskGroup title={t("latestGateFollowUp")} hint={latestGateReportHint} tasks={latestGateTasks} />
      ) : null}

      {olderGateTasks.length ? (
        <details>
          <summary>
            <strong>{t("olderGateFollowUp")}</strong>
            <span className="muted"> · {olderGateTasks.length}</span>
          </summary>
          <div className="details-body">
            <TaskTable tasks={olderGateTasks} />
          </div>
        </details>
      ) : null}

      {backlogTasks.length ? (
        <details>
          <summary>
            <strong>{t("activeResearchBacklog")}</strong>
            <span className="muted"> · {backlogTasks.length}</span>
          </summary>
          <div className="details-body">
            <p className="muted">{t("activeV0TaskScopeHint")}</p>
            <TaskTable tasks={backlogTasks} />
          </div>
        </details>
      ) : null}

      {deferredBacklogTasks.length ? (
        <details>
          <summary>
            <strong>{t("deferredFixtureBacklog")}</strong>
            <span className="muted"> · {deferredBacklogTasks.length}</span>
          </summary>
          <div className="details-body">
            <p className="muted">{t("deferredFixtureBacklogHint")}</p>
            <TaskTable tasks={deferredBacklogTasks} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TaskGroup({ title, hint, tasks }: { title: string; hint?: string; tasks: ResearchTask[] }) {
  return (
    <section className="task-group">
      <h2>{title}</h2>
      {hint ? <p className="muted">{hint}</p> : null}
      <TaskTable tasks={tasks} />
    </section>
  );
}

function TaskTable({ tasks }: { tasks: ResearchTask[] }) {
  const { t } = useLanguage();

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>{t("priority")}</th>
          <th>{t("task")}</th>
          <th>{t("status")}</th>
          <th>{t("target")}</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td>{task.priority}</td>
            <td>
              <strong>{task.title}</strong>
              <p className="muted">{task.reason}</p>
            </td>
            <td>{task.status}</td>
            <td>{task.targetNodeId ?? "none"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function sortTasks(tasks: ResearchTask[]): ResearchTask[] {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const statusRank = { pending: 0, in_progress: 1, done: 2, wont_do: 3 };

  return tasks.slice().sort((left, right) => {
    const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDelta) return priorityDelta;

    const statusDelta = statusRank[left.status] - statusRank[right.status];
    if (statusDelta) return statusDelta;

    return timestampFromTask(right.createdAt) - timestampFromTask(left.createdAt);
  });
}

function partitionTasksByActiveScope(
  tasks: ResearchTask[],
  activeScopeNodeIdSet: Set<string>,
): { activeTasks: ResearchTask[]; deferredTasks: ResearchTask[] } {
  const activeTasks: ResearchTask[] = [];
  const deferredTasks: ResearchTask[] = [];

  for (const task of tasks) {
    const scopeNodeId = task.targetNodeId ?? targetNodeIdFromGateReportId(task.sourceGateReportId);
    if (scopeNodeId && !activeScopeNodeIdSet.has(scopeNodeId)) {
      deferredTasks.push(task);
    } else {
      activeTasks.push(task);
    }
  }

  return { activeTasks, deferredTasks };
}

function targetNodeIdFromGateReportId(sourceGateReportId: string | undefined): string | undefined {
  return sourceGateReportId?.split(":")[0];
}

function timestampFromTask(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

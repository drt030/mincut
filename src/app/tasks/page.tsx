import { notFound } from "next/navigation";
import { TaskQueueView } from "@/components/TaskQueueView";
import { TranslatedHeading } from "@/components/TranslatedText";
import { loadGateReports, loadGraphData, loadTasks } from "@/lib/graphLoader";
import { reachableNodeIdsFrom, V0_TARGET_NODE_ID } from "@/lib/graphTraversal";
import { INTERNAL_ROUTE_METADATA, internalRoutesAvailable } from "@/lib/internalRouteGuard";
import type { GateReport } from "@/lib/schema";

export const metadata = INTERNAL_ROUTE_METADATA;

export default function TasksPage() {
  if (!internalRoutesAvailable()) notFound();
  const tasks = loadTasks();
  const graph = loadGraphData();
  const reports = loadGateReports();
  const activeScopeNodeIds = [...reachableNodeIdsFrom(graph, V0_TARGET_NODE_ID)].sort();
  const activeScopeNodeIdSet = new Set(activeScopeNodeIds);
  const currentGateReportIds = latestGateReportIdsByTarget(reports.filter((report) => activeScopeNodeIdSet.has(report.targetNodeId)));

  return (
    <div className="page">
      <TranslatedHeading textKey="researchTasks" />
      <TaskQueueView
        tasks={tasks}
        currentGateReportIds={currentGateReportIds}
        activeScopeNodeIds={activeScopeNodeIds}
      />
    </div>
  );
}

function latestGateReportIdsByTarget(reports: GateReport[]): string[] {
  const latestByTarget = new Map<string, GateReport>();
  for (const report of reports) {
    const existing = latestByTarget.get(report.targetNodeId);
    if (!existing || timestampForSort(report.generatedAt) > timestampForSort(existing.generatedAt)) {
      latestByTarget.set(report.targetNodeId, report);
    }
  }
  return [...latestByTarget.values()].map((report) => `${report.targetNodeId}:${report.generatedAt}`).sort();
}

function timestampForSort(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

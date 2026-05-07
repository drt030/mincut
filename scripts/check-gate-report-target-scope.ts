import { selectGateReportsForTarget } from "../src/components/GateReportView";
import type { GateReport } from "../src/lib/schema";

const currentTarget = "low_cost_parcel_sorting_robot_300k_rmb";
const otherTarget = "future_out_of_scope_product";

const reports: GateReport[] = [
  makeReport(currentTarget, "2026-01-01T00:00:00.000Z", 2),
  makeReport(otherTarget, "2027-01-01T00:00:00.000Z", 5),
  makeReport(currentTarget, "2026-02-01T00:00:00.000Z", 3),
];

const selectedReports = selectGateReportsForTarget(reports, currentTarget);

assert(selectedReports.length === 2, `expected 2 current-target reports, got ${selectedReports.length}`);
assert(
  selectedReports.every((report) => report.targetNodeId === currentTarget),
  "selected reports should exclude other target reports",
);
assert(
  selectedReports[0]?.generatedAt === "2026-02-01T00:00:00.000Z",
  `expected current target latest report first, got ${selectedReports[0]?.targetNodeId}:${selectedReports[0]?.generatedAt}`,
);

function makeReport(targetNodeId: string, generatedAt: string, overallScore: number): GateReport {
  return {
    graphVersion: "test",
    targetNodeId,
    generatedAt,
    overallScore,
    passed: overallScore >= 4,
    questionResults: [
      {
        question: "test question",
        answer: "test answer",
        score: overallScore,
      },
    ],
    recommendedNextTasks: [],
  };
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

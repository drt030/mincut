import { loadGateQuestions, loadGraphData, loadTasks, writeGateReport, writeTasks } from "../src/lib/graphLoader";
import { runGate } from "../src/lib/gateRunner";
import { mergeTasks, tasksFromGateReport } from "../src/lib/taskGenerator";

function parseArgs(): { targetNodeId: string; dryRun: boolean } {
  const targetIndex = process.argv.indexOf("--target");
  const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;
  const dryRun = process.argv.includes("--dry-run");
  if (!target) {
    console.error("Usage: npm run gate -- --target <node_id> [--dry-run]");
    process.exit(1);
  }
  return { targetNodeId: target, dryRun };
}

const { targetNodeId, dryRun } = parseArgs();
const graph = loadGraphData();
const questions = loadGateQuestions();
const report = runGate(graph, questions, targetNodeId);
const generatedTasks = tasksFromGateReport(report);

console.log(JSON.stringify(report, null, 2));

if (dryRun) {
  console.log("Gate dry run completed; no report or task files were written.");
  console.log(`Would generate or retain ${generatedTasks.length} task candidates.`);
} else {
  const reportPath = writeGateReport(report);
  writeTasks(mergeTasks(loadTasks(), generatedTasks));
  console.log(`Gate report written to ${reportPath}`);
  console.log(`Generated or retained ${generatedTasks.length} task candidates.`);
}

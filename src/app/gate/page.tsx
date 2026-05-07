import { GateReportView } from "@/components/GateReportView";
import { TranslatedHeading, TranslatedParagraph } from "@/components/TranslatedText";
import { loadActiveGraphData, loadGateReports } from "@/lib/graphLoader";
import { nodeById, V0_TARGET_NODE_ID } from "@/lib/graphTraversal";

export default function GatePage() {
  const reports = loadGateReports();
  const graph = loadActiveGraphData();
  const targetNode = nodeById(graph, V0_TARGET_NODE_ID);
  return (
    <div className="page">
      <TranslatedHeading textKey="validationGate" />
      <TranslatedParagraph textKey="generatedReports" className="muted" />
      <p>
        <code>npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run</code>
      </p>
      <GateReportView
        reports={reports}
        targetNodeId={V0_TARGET_NODE_ID}
        targetMaturityAsOf={targetNode?.maturityAsOf}
      />
    </div>
  );
}

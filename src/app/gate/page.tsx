import React from "react";
import { notFound } from "next/navigation";
import { GateReportView } from "@/components/GateReportView";
import { TranslatedHeading, TranslatedParagraph } from "@/components/TranslatedText";
import { loadActiveGraphData, loadGateQuestions, loadGateReports, loadGraphData } from "@/lib/graphLoader";
import { runGate } from "@/lib/gateRunner";
import { nodeById, V0_TARGET_NODE_ID } from "@/lib/graphTraversal";
import { INTERNAL_ROUTE_METADATA, internalRoutesAvailable } from "@/lib/internalRouteGuard";

export const metadata = INTERNAL_ROUTE_METADATA;

export default function GatePage() {
  if (!internalRoutesAvailable()) notFound();
  const currentReport = runGate(loadGraphData(), loadGateQuestions(), V0_TARGET_NODE_ID);
  const reports = [currentReport, ...loadGateReports()];
  const graph = loadActiveGraphData();
  const targetNode = nodeById(graph, V0_TARGET_NODE_ID);
  return (
    <div className="page">
      <TranslatedHeading textKey="validationGate" />
      <TranslatedParagraph textKey="generatedReports" className="muted" />
      <p>
        <code>{`npm run gate -- --target ${V0_TARGET_NODE_ID} --dry-run`}</code>
      </p>
      <GateReportView
        reports={reports}
        targetNodeId={V0_TARGET_NODE_ID}
        targetNode={targetNode}
        graph={graph}
      />
    </div>
  );
}

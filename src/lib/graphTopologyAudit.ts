import { filterCanvasGraph, resolveCanvasRootId } from "./canvasGraph";
import { radialLayout } from "./radialLayout";
import { subsystemHue } from "./subsystemHue";
import type { GraphData, NodeKind } from "./schema";

const STRUCTURAL_TOPOLOGY_KINDS: ReadonlySet<NodeKind> = new Set([
  "product",
  "technical_route",
  "module",
  "equipment",
  "material",
  "engineering_method",
  "manufacturing_process",
]);

export type MultiParentVisibleNodeAudit = {
  nodeId: string;
  parentIds: string[];
  primaryParentId: string | null;
};

export type GraphTopologyAudit = {
  rootId: string;
  structuralNodeCount: number;
  neutralMaterialCount: number;
  neutralNonMaterialCount: number;
  neutralNonMaterialIds: string[];
  primaryEdgeCount: number;
  crossEdgeCount: number;
  multiParentVisibleNodes: MultiParentVisibleNodeAudit[];
};

export function auditGraphTopology(graph: GraphData, rootId: string): GraphTopologyAudit {
  const resolvedRootId = resolveCanvasRootId(graph, rootId) ?? rootId;
  const canvas = filterCanvasGraph(graph, resolvedRootId);
  const layout = radialLayout(canvas, resolvedRootId);

  const structuralNodes = canvas.nodes.filter((node) => STRUCTURAL_TOPOLOGY_KINDS.has(node.kind));
  const neutralMaterialIds: string[] = [];
  const neutralNonMaterialIds: string[] = [];

  for (const node of structuralNodes) {
    const hue = subsystemHue(node.id, canvas, resolvedRootId);
    if (hue.saturation !== 0) continue;
    if (node.kind === "material") {
      neutralMaterialIds.push(node.id);
    } else if (node.id !== resolvedRootId) {
      neutralNonMaterialIds.push(node.id);
    }
  }

  let primaryEdgeCount = 0;
  let crossEdgeCount = 0;
  for (const edgeStyle of layout.edges.values()) {
    if (edgeStyle.style === "primary") primaryEdgeCount += 1;
    if (edgeStyle.style === "cross") crossEdgeCount += 1;
  }

  const incomingVisibleParents = new Map<string, Array<{ parentId: string; style: "primary" | "cross" }>>();
  for (const edge of canvas.edges) {
    const style = layout.edges.get(edge.id)?.style;
    if (style === undefined) continue;
    const parents = incomingVisibleParents.get(edge.target) ?? [];
    parents.push({ parentId: edge.source, style });
    incomingVisibleParents.set(edge.target, parents);
  }

  const multiParentVisibleNodes = [...incomingVisibleParents.entries()]
    .map(([nodeId, parents]) => {
      const parentIds = [...new Set(parents.map((parent) => parent.parentId))].sort((a, b) =>
        a.localeCompare(b),
      );
      const primaryParents = parents
        .filter((parent) => parent.style === "primary")
        .map((parent) => parent.parentId);
      const uniquePrimaryParents = [...new Set(primaryParents)];
      return {
        nodeId,
        parentIds,
        primaryParentId: uniquePrimaryParents.length === 1 ? uniquePrimaryParents[0] : null,
      };
    })
    .filter((entry) => entry.parentIds.length >= 2)
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  neutralMaterialIds.sort((a, b) => a.localeCompare(b));
  neutralNonMaterialIds.sort((a, b) => a.localeCompare(b));

  return {
    rootId: resolvedRootId,
    structuralNodeCount: structuralNodes.length,
    neutralMaterialCount: neutralMaterialIds.length,
    neutralNonMaterialCount: neutralNonMaterialIds.length,
    neutralNonMaterialIds,
    primaryEdgeCount,
    crossEdgeCount,
    multiParentVisibleNodes,
  };
}

import { filterCanvasGraph, isArtifactCanvasNode, resolveCanvasRootId } from "./canvasGraph";
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
  neutralMaterialIds: string[];
  neutralNonMaterialCount: number;
  neutralNonMaterialIds: string[];
  primaryEdgeCount: number;
  crossEdgeCount: number;
  multiParentVisibleNodes: MultiParentVisibleNodeAudit[];
  materialParentNonMaterialChildEdges: string[];
  artifactTitlePollutionNodeIds: string[];
};

const ARTIFACT_TITLE_POLLUTION_PATTERN =
  /\b(?:limiting tool|current bottleneck|winner|locked supplier|ticker|tickers|NYSE|NASDAQ|public-company|exposure thesis)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function organizationTitleAlias(name: string): string | null {
  const alias = name
    .replace(/\b(?:GmbH|Inc\.?|Corporation|Corp\.?|Co\.?|Company|Ltd\.?|Limited|LLC|plc|AG|S\.A\.)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return alias.length >= 4 ? alias : null;
}

function containsOrganizationName(title: string, organizationNames: readonly string[]): boolean {
  for (const name of organizationNames) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(name)}([^A-Za-z0-9]|$)`, "i");
    if (pattern.test(title)) return true;
  }
  return false;
}

export function auditGraphTopology(graph: GraphData, rootId: string): GraphTopologyAudit {
  const resolvedRootId = resolveCanvasRootId(graph, rootId) ?? rootId;
  const canvas = filterCanvasGraph(graph, resolvedRootId);
  const layout = radialLayout(canvas, resolvedRootId);
  const organizationNames = graph.nodes.flatMap((node) => {
    if (node.kind !== "organization") return [];
    const alias = organizationTitleAlias(node.name);
    return alias ? [alias] : [];
  });

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

  const canvasNodeById = new Map(canvas.nodes.map((node) => [node.id, node]));
  const materialParentNonMaterialChildEdges = canvas.edges
    .flatMap((edge) => {
      const source = canvasNodeById.get(edge.source);
      const target = canvasNodeById.get(edge.target);
      if (!source || !target) return [];
      if (source.kind !== "material" || target.kind === "material") return [];
      return [`${edge.id}:${edge.source}->${edge.target}(${target.kind})`];
    })
    .sort((a, b) => a.localeCompare(b));

  const artifactTitlePollutionNodeIds = canvas.nodes
    .flatMap((node) => {
      if (!isArtifactCanvasNode(node)) return [];
      if (
        node.kind === "product" ||
        (!ARTIFACT_TITLE_POLLUTION_PATTERN.test(node.name) &&
          !containsOrganizationName(node.name, organizationNames))
      ) {
        return [];
      }
      return [`${node.id}:${node.name}`];
    })
    .sort((a, b) => a.localeCompare(b));

  neutralMaterialIds.sort((a, b) => a.localeCompare(b));
  neutralNonMaterialIds.sort((a, b) => a.localeCompare(b));

  return {
    rootId: resolvedRootId,
    structuralNodeCount: structuralNodes.length,
    neutralMaterialCount: neutralMaterialIds.length,
    neutralMaterialIds,
    neutralNonMaterialCount: neutralNonMaterialIds.length,
    neutralNonMaterialIds,
    primaryEdgeCount,
    crossEdgeCount,
    multiParentVisibleNodes,
    materialParentNonMaterialChildEdges,
    artifactTitlePollutionNodeIds,
  };
}

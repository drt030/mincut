"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk-api.js";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  PanOnScrollMode,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
} from "@xyflow/react";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useLanguage } from "./LanguageProvider";
import type { Edge, EdgeRelation, GraphData, Node, NodeKind } from "@/lib/schema";

const kindColors: Record<string, string> = {
  product: "#0f766e",
  module: "#2563eb",
  technical_route: "#7c3aed",
  metric: "#ca8a04",
  bottleneck: "#dc2626",
  placeholder_breakthrough: "#ea580c",
  scientific_principle: "#0891b2",
  empirical_principle: "#0d9488",
  manufacturing_process: "#475569",
  standard_or_regulation: "#4b5563",
  capability: "#16a34a",
};

const NODE_WIDTH = 232;
const DEFAULT_NODE_HEIGHT = 104;
const TALL_NODE_HEIGHT = 124;
const METRICS_STRIP_HEIGHT = 60;
const INCREMENTAL_LAYER_GAP = 156;
const INCREMENTAL_NODE_GAP = 28;
let elk: InstanceType<typeof ELK> | null = null;
let activeFoldCountById: Map<string, number> = new Map();

type GraphPoint = { x: number; y: number };

type FoldedMetricEntry = {
  id: string;
  name: string;
  unit?: string;
  currentValue?: string | number;
  targetValue?: string | number;
};

type CapabilityNodeData = {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  maturityScore?: number;
  color: string;
  selected: boolean;
  related: boolean;
  risk: boolean;
  scoreLabel: string;
  selectedMetricId?: string;
  foldedMetrics: FoldedMetricEntry[];
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onSelectMetric: (metricId: string) => void;
};

const nodeTypes = {
  capability: memo(function CapabilityNode({ data }: NodeProps<FlowNode<CapabilityNodeData>>) {
    return (
      <div
        className={[
          "graph-node-card",
          data.selected ? "selected" : "",
          data.related ? "related" : "",
          data.risk ? "risk" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--node-color": data.color } as CSSProperties}
        onClick={(event) => {
          event.stopPropagation();
          data.onSelect(data.id);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          data.onSelect(data.id);
          data.onToggle(data.id);
        }}
      >
        <Handle className="graph-node-handle" type="target" position={Position.Left} />
        <div className="graph-node-inner">
          <div className="graph-node-title">{data.name}</div>
          <div className="graph-node-meta">
            <span>{data.kindLabel}</span>
            {typeof data.maturityScore === "number" ? <span>{data.scoreLabel} {data.maturityScore}</span> : null}
          </div>
          {data.foldedMetrics.length > 0 ? (
            <div className="graph-node-metrics" role="list">
              {data.foldedMetrics.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  role="listitem"
                  className={[
                    "graph-node-metric-chip",
                    data.selectedMetricId === metric.id ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={(event) => {
                    event.stopPropagation();
                    data.onSelectMetric(metric.id);
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    data.onSelectMetric(metric.id);
                  }}
                  title={formatMetricTooltip(metric)}
                >
                  <span className="graph-node-metric-name">{metric.name}</span>
                  <span className="graph-node-metric-value">{formatMetricValue(metric)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Handle className="graph-node-handle" type="source" position={Position.Right} />
      </div>
    );
  }),
};

function formatMetricValue(metric: FoldedMetricEntry) {
  const current = metric.currentValue;
  const target = metric.targetValue;
  const unit = metric.unit ? ` ${metric.unit}` : "";
  if (current !== undefined && target !== undefined) return `${current} / ${target}${unit}`;
  if (current !== undefined) return `${current}${unit}`;
  if (target !== undefined) return `→ ${target}${unit}`;
  return metric.unit ?? "—";
}

function formatMetricTooltip(metric: FoldedMetricEntry) {
  const parts = [metric.name];
  if (metric.currentValue !== undefined) parts.push(`current: ${metric.currentValue}${metric.unit ? ` ${metric.unit}` : ""}`);
  if (metric.targetValue !== undefined) parts.push(`target: ${metric.targetValue}${metric.unit ? ` ${metric.unit}` : ""}`);
  return parts.join(" · ");
}

type Props = {
  graph: GraphData;
};

type ExplorationMode = "layered" | "bottleneck" | "full";

const rootNodeId = "low_cost_parcel_sorting_robot_300k_rmb";

const dependencyRelations = new Set<EdgeRelation>([
  "requires",
  "has_route",
  "implemented_by",
  "manufactured_by",
  "regulated_by",
]);

const layeredRelations = new Set<EdgeRelation>([...dependencyRelations, "bottlenecked_by"]);
const bottleneckPathRelations = new Set<EdgeRelation>(["requires", "has_route", "bottlenecked_by"]);
export function GraphExplorer({ graph }: Props) {
  const { kindName, nodeName, relationName, t } = useLanguage();
  const [selectedId, setSelectedId] = useState(rootNodeId);
  const [domain, setDomain] = useState("all");
  const [kind, setKind] = useState<NodeKind | "all">("all");
  const [relation, setRelation] = useState<EdgeRelation | "all">("all");
  const [maturity, setMaturity] = useState("all");
  const [routeFocus, setRouteFocus] = useState("all");
  const [mode, setMode] = useState<ExplorationMode>("layered");
  const [showMetricsAsNodes, setShowMetricsAsNodes] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set([rootNodeId]));
  const [expandedBottleneckIds, setExpandedBottleneckIds] = useState<Set<string>>(() => new Set([rootNodeId]));
  const [layoutPositions, setLayoutPositions] = useState<Map<string, GraphPoint>>(() => new Map());
  const layoutPositionsRef = useRef(layoutPositions);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const domains = useMemo(() => [...new Set(graph.nodes.flatMap((node) => node.domain))].sort(), [graph.nodes]);
  const kinds = useMemo(() => [...new Set(graph.nodes.map((node) => node.kind))].sort(), [graph.nodes]);
  const relations = useMemo(() => [...new Set(graph.edges.map((edge) => edge.relation))].sort(), [graph.edges]);
  const focusIds = useMemo(() => routeFocusIds(graph, routeFocus), [graph, routeFocus]);

  const visibleIds = useMemo(() => {
    if (mode === "full") return null;
    if (mode === "bottleneck") return bottleneckVisibleIds(graph, expandedBottleneckIds);
    return layeredVisibleIds(graph, expandedIds);
  }, [expandedBottleneckIds, expandedIds, graph, mode]);

  const prefilteredNodes = useMemo(
    () =>
      graph.nodes.filter((node) => {
        if (visibleIds && !visibleIds.has(node.id)) return false;
        if (focusIds && !focusIds.has(node.id)) return false;
        if (domain !== "all" && !node.domain.includes(domain)) return false;
        if (kind !== "all" && node.kind !== kind) return false;
        if (maturity !== "all" && (node.maturityScore ?? 0) < Number(maturity)) return false;
        return true;
      }),
    [domain, focusIds, graph.nodes, kind, maturity, visibleIds],
  );

  // Step 8: fold metric-kind nodes whose visible non-metric `measured_by` parents
  // resolve to exactly one. Shared metrics (multiple visible parents) stay as nodes.
  const { foldedMetricIds, foldedMetricsByParent } = useMemo(() => {
    const foldedIds = new Set<string>();
    const byParent = new Map<string, FoldedMetricEntry[]>();
    if (showMetricsAsNodes) return { foldedMetricIds: foldedIds, foldedMetricsByParent: byParent };

    const prefilteredIds = new Set(prefilteredNodes.map((node) => node.id));
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

    for (const node of prefilteredNodes) {
      if (node.kind !== "metric") continue;
      const visibleNonMetricParents: string[] = [];
      for (const edge of graph.edges) {
        if (edge.relation !== "measured_by") continue;
        if (edge.target !== node.id) continue;
        if (!prefilteredIds.has(edge.source)) continue;
        const parent = nodesById.get(edge.source);
        if (!parent || parent.kind === "metric") continue;
        visibleNonMetricParents.push(edge.source);
      }
      const uniqueParents = [...new Set(visibleNonMetricParents)];
      if (uniqueParents.length !== 1) continue;
      const parentId = uniqueParents[0];
      foldedIds.add(node.id);
      const inline = node.metrics?.[0];
      const entry: FoldedMetricEntry = {
        id: node.id,
        name: inline?.name ?? node.name,
        unit: inline?.unit,
        currentValue: inline?.currentValue,
        targetValue: inline?.targetValue,
      };
      const list = byParent.get(parentId) ?? [];
      list.push(entry);
      byParent.set(parentId, list);
    }

    return { foldedMetricIds: foldedIds, foldedMetricsByParent: byParent };
  }, [graph.edges, graph.nodes, prefilteredNodes, showMetricsAsNodes]);

  const filteredNodes = useMemo(
    () => prefilteredNodes.filter((node) => !foldedMetricIds.has(node.id)),
    [foldedMetricIds, prefilteredNodes],
  );

  const filteredIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);
  const selectedNeighbors = useMemo(() => {
    const ids = new Set<string>([selectedId]);
    for (const edge of graph.edges) {
      if (edge.source === selectedId) ids.add(edge.target);
      if (edge.target === selectedId) ids.add(edge.source);
    }
    return ids;
  }, [graph.edges, selectedId]);

  const layoutEdges = useMemo(
    () =>
      graph.edges
        .filter((edge) => filteredIds.has(edge.source) && filteredIds.has(edge.target))
        .filter((edge) => relation === "all" || edge.relation === relation)
        .filter((edge) => mode === "full" || layeredRelations.has(edge.relation)),
    [filteredIds, graph.edges, mode, relation],
  );

  const toggleSelectedExpansion = useCallback((nodeId: string) => {
    const toggle = (current: Set<string>) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    };

    if (mode === "bottleneck") setExpandedBottleneckIds(toggle);
    else setExpandedIds(toggle);
  }, [mode]);

  const flowNodes: FlowNode[] = useMemo(
    () =>
      filteredNodes.map((node) => {
        const related = selectedNeighbors.has(node.id);
        const folded = foldedMetricsByParent.get(node.id) ?? [];
        const localizedFolded: FoldedMetricEntry[] = folded.map((metric) => ({
          ...metric,
          name: nodeName(metric.id, metric.name),
        }));
        return {
        id: node.id,
        type: "capability",
        position: layoutPositions.get(node.id) ?? fallbackPositionFor(node, filteredNodes, graph.edges, routeFocus),
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          id: node.id,
          name: nodeName(node.id, node.name),
          kind: node.kind,
          kindLabel: kindName(node.kind),
          maturityScore: node.maturityScore,
          color: kindColors[node.kind] ?? "#64748b",
          selected: selectedId === node.id,
          related,
          risk: node.kind === "bottleneck" || node.kind === "placeholder_breakthrough",
          scoreLabel: t("score"),
          selectedMetricId: selectedId,
          foldedMetrics: localizedFolded,
          onSelect: setSelectedId,
          onToggle: toggleSelectedExpansion,
          onSelectMetric: setSelectedId,
        },
        style: {
          width: NODE_WIDTH,
          height: heightForNode(node, localizedFolded.length),
        },
      };
      }),
    [filteredNodes, foldedMetricsByParent, graph.edges, kindName, layoutPositions, nodeName, routeFocus, selectedId, selectedNeighbors, t, toggleSelectedExpansion],
  );

  const flowEdges: FlowEdge[] = useMemo(
    () =>
      layoutEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          label: shouldShowEdgeLabel(edge, selectedId, relation) ? relationName(edge.relation) : undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          className: [
            "graph-edge",
            `relation-${edge.relation}`,
            edge.source === selectedId || edge.target === selectedId ? "selected" : "",
            !selectedNeighbors.has(edge.source) && !selectedNeighbors.has(edge.target) ? "dimmed" : "",
          ]
            .filter(Boolean)
            .join(" "),
          style: {
            strokeWidth: edge.source === selectedId || edge.target === selectedId ? 2.6 : 1.4,
          },
        })),
    [layoutEdges, relation, relationName, selectedId, selectedNeighbors],
  );

  const foldCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const [parentId, metrics] of foldedMetricsByParent) map.set(parentId, metrics.length);
    return map;
  }, [foldedMetricsByParent]);

  useEffect(() => {
    let cancelled = false;

    async function applyLayout() {
      const nextPositions = await layoutWithElk(filteredNodes, layoutEdges, selectedIdRef.current, layoutPositionsRef.current, foldCountById);
      if (!cancelled) {
        layoutPositionsRef.current = nextPositions;
        setLayoutPositions(nextPositions);
      }
    }

    void applyLayout();
    return () => {
      cancelled = true;
    };
  }, [filteredNodes, foldCountById, layoutEdges]);

  const selectedNode = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0];
  const selectedDependencyCount = graph.edges.filter((edge) => edge.source === selectedNode?.id && shouldShowLayeredEdge(graph, edge)).length;
  const selectedBottleneckCount = graph.edges.filter((edge) => edge.source === selectedNode?.id && edge.relation === "bottlenecked_by").length;
  const selectedExpanded = mode === "bottleneck" ? expandedBottleneckIds.has(selectedNode.id) : expandedIds.has(selectedNode.id);

  return (
    <div>
      <div className="explorer-toolbar">
        <div className="segmented-control" aria-label={t("viewMode")}>
          {(["layered", "bottleneck", "full"] as ExplorationMode[]).map((item) => (
            <button
              key={item}
              className={mode === item ? "active" : ""}
              type="button"
              onClick={() => {
                setMode(item);
                setRouteFocus("all");
              }}
            >
              {t(`${item}Mode`)}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            className="small-button"
            type="button"
            onClick={() => toggleSelectedExpansion(selectedNode.id)}
          >
            {selectedExpanded ? t("collapseSelected") : t("expandSelected")} ({selectedDependencyCount})
          </button>
          <button
            className="small-button danger-button"
            type="button"
            onClick={() => {
              setMode("bottleneck");
              setExpandedBottleneckIds((current) => new Set(current).add(selectedNode.id));
            }}
          >
            {t("showBottlenecks")} ({selectedBottleneckCount})
          </button>
          <button
            className={["small-button", "secondary-button", showMetricsAsNodes ? "active" : ""].filter(Boolean).join(" ")}
            type="button"
            aria-pressed={showMetricsAsNodes}
            onClick={() => setShowMetricsAsNodes((value) => !value)}
            title={t("showMetricsAsNodesHint")}
          >
            {t("showMetricsAsNodes")}{showMetricsAsNodes ? ` · ${t("toggleOn")}` : ` · ${t("toggleOff")}`}
          </button>
          <button
            className="small-button secondary-button"
            type="button"
            onClick={() => {
              setMode("layered");
              setSelectedId(rootNodeId);
              setDomain("all");
              setKind("all");
              setRelation("all");
              setMaturity("all");
              setExpandedIds(new Set([rootNodeId]));
              setExpandedBottleneckIds(new Set([rootNodeId]));
              setRouteFocus("all");
            }}
          >
            {t("resetExpansion")}
          </button>
        </div>
      </div>
      <div className="explorer-hint">
        {mode === "layered" ? t("layeredModeHint") : mode === "bottleneck" ? t("bottleneckModeHint") : t("fullModeHint")}
      </div>
      <div className="filters">
        <select value={domain} onChange={(event) => setDomain(event.target.value)}>
          <option value="all">{t("allDomains")}</option>
          {domains.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(event) => setKind(event.target.value as NodeKind | "all")}>
          <option value="all">{t("allNodeKinds")}</option>
          {kinds.map((item) => (
            <option key={item} value={item}>
              {kindName(item)}
            </option>
          ))}
        </select>
        <select value={relation} onChange={(event) => setRelation(event.target.value as EdgeRelation | "all")}>
          <option value="all">{t("allRelations")}</option>
          {relations.map((item) => (
            <option key={item} value={item}>
              {relationName(item)}
            </option>
          ))}
        </select>
        <select value={maturity} onChange={(event) => setMaturity(event.target.value)}>
          <option value="all">{t("allMaturity")}</option>
          <option value="30">{t("score")} &gt;= 30</option>
          <option value="50">{t("score")} &gt;= 50</option>
          <option value="70">{t("score")} &gt;= 70</option>
        </select>
      </div>
      <div className="graph-layout">
        <div className="graph-canvas">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            fitViewOptions={{ maxZoom: 1, minZoom: 0.55, padding: 0.12 }}
            minZoom={0.35}
            panOnScroll
            panOnScrollMode={PanOnScrollMode.Free}
            zoomOnPinch
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            onNodeClick={(_, node) => {
              setSelectedId(node.id);
            }}
            onNodeDoubleClick={(event, node) => {
              event.preventDefault();
              setSelectedId(node.id);
              toggleSelectedExpansion(node.id);
            }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <NodeDetailPanel graph={graph} node={selectedNode} onSelectNode={setSelectedId} />
      </div>
    </div>
  );
}

function layeredVisibleIds(graph: GraphData, expandedIds: Set<string>) {
  const ids = new Set<string>([rootNodeId]);
  const queue = [rootNodeId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    ids.add(nodeId);
    if (!expandedIds.has(nodeId)) continue;

    for (const edge of graph.edges) {
      if (edge.source === nodeId && shouldShowLayeredEdge(graph, edge)) {
        ids.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return ids;
}

function shouldShowLayeredEdge(graph: GraphData, edge: Edge) {
  if (!layeredRelations.has(edge.relation)) return false;
  if (edge.source !== rootNodeId) return true;
  if (edge.relation !== "requires") return edge.relation === "bottlenecked_by";
  return graph.nodes.find((node) => node.id === edge.target)?.kind === "module";
}

function bottleneckVisibleIds(graph: GraphData, expandedIds: Set<string>) {
  const ids = new Set<string>([rootNodeId]);
  const queue = [rootNodeId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    ids.add(nodeId);
    if (nodeId !== rootNodeId && !expandedIds.has(nodeId)) continue;

    const outgoing = graph.edges.filter((edge) => edge.source === nodeId && bottleneckPathRelations.has(edge.relation));
    const directBottlenecks = outgoing.filter((edge) => edge.relation === "bottlenecked_by");
    const nextEdges = directBottlenecks.length > 0 ? directBottlenecks : outgoing.filter((edge) => edge.relation !== "bottlenecked_by");

    for (const edge of nextEdges) {
      ids.add(edge.target);
      if (expandedIds.has(edge.target) || directBottlenecks.length === 0) queue.push(edge.target);
    }
  }

  return ids;
}

function routeFocusIds(graph: GraphData, routeId: string) {
  if (routeId === "all") return null;

  const ids = new Set<string>([routeId]);
  const routeSources = graph.edges.filter((edge) => edge.relation === "has_route" && edge.target === routeId).map((edge) => edge.source);

  for (const source of routeSources) {
    ids.add(source);
    for (const edge of graph.edges) {
      if (edge.target === source && edge.relation === "requires") ids.add(edge.source);
    }
  }

  for (const edge of graph.edges) {
    if (edge.source === routeId || edge.target === routeId) {
      ids.add(edge.source);
      ids.add(edge.target);
    }
  }

  return ids;
}

async function layoutWithElk(
  nodes: Node[],
  edges: Edge[],
  anchorId: string,
  previousPositions: Map<string, GraphPoint>,
  foldCountById: Map<string, number> = new Map(),
) {
  activeFoldCountById = foldCountById;
  const incrementalPositions = incrementalLayout(nodes, edges, anchorId, previousPositions);
  if (incrementalPositions) return incrementalPositions;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "54",
      "elk.spacing.edgeNode": "30",
      "elk.layered.spacing.nodeNodeBetweenLayers": "112",
      "elk.layered.spacing.edgeNodeBetweenLayers": "34",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "22",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: heightForNode(node, foldCountById.get(node.id) ?? 0),
    })),
    edges: edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })) as ElkExtendedEdge[],
  };

  const layouted = await elkInstance().layout(elkGraph);
  const nextPositions = new Map(
    (layouted.children ?? []).map((node) => [
      node.id,
      {
        x: node.x ?? 0,
        y: node.y ?? 0,
      },
    ]),
  );

  return anchorLayout(nextPositions, previousPositions, anchorId);
}

function incrementalLayout(nodes: Node[], edges: Edge[], anchorId: string, previousPositions: Map<string, GraphPoint>) {
  if (!previousPositions.size) return null;

  const foldCountById = activeFoldCountById;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visibleIds = new Set(nodes.map((node) => node.id));
  const nextPositions = new Map<string, GraphPoint>();

  for (const [id, position] of previousPositions) {
    if (visibleIds.has(id)) nextPositions.set(id, position);
  }

  const newNodes = nodes.filter((node) => !nextPositions.has(node.id)).sort(compareNodes);
  if (!newNodes.length) return nextPositions;

  const groupedByParent = new Map<string, Node[]>();
  for (const node of newNodes) {
    const incoming = edges.find((edge) => edge.target === node.id && nextPositions.has(edge.source));
    const parentId = incoming?.source ?? anchorId;
    const siblings = groupedByParent.get(parentId) ?? [];
    siblings.push(node);
    groupedByParent.set(parentId, siblings);
  }

  for (const [parentId, children] of groupedByParent) {
    const parentNode = nodesById.get(parentId);
    const parentPosition = nextPositions.get(parentId) ?? nextPositions.get(anchorId) ?? { x: 40, y: 40 };
    const parentHeight = parentNode ? heightForNode(parentNode, foldCountById.get(parentId) ?? 0) : DEFAULT_NODE_HEIGHT;
    const totalHeight =
      children.reduce((sum, child) => sum + heightForNode(child, foldCountById.get(child.id) ?? 0), 0) +
      Math.max(0, children.length - 1) * INCREMENTAL_NODE_GAP;
    let cursorY = parentPosition.y + parentHeight / 2 - totalHeight / 2;

    for (const child of children) {
      const proposed = {
        x: parentPosition.x + NODE_WIDTH + INCREMENTAL_LAYER_GAP,
        y: cursorY,
      };
      nextPositions.set(child.id, firstOpenPosition(proposed, child, nextPositions, nodesById));
      cursorY += heightForNode(child, foldCountById.get(child.id) ?? 0) + INCREMENTAL_NODE_GAP;
    }
  }

  return nextPositions;
}

function elkInstance() {
  elk ??= new ELK({
    workerUrl: "/elk-worker.min.js",
  });
  return elk;
}

function anchorLayout(
  nextPositions: Map<string, GraphPoint>,
  previousPositions: Map<string, GraphPoint>,
  anchorId: string,
) {
  const previousAnchor = previousPositions.get(anchorId);
  const nextAnchor = nextPositions.get(anchorId);
  if (!previousAnchor || !nextAnchor) return nextPositions;

  const dx = previousAnchor.x - nextAnchor.x;
  const dy = previousAnchor.y - nextAnchor.y;
  if (dx === 0 && dy === 0) return nextPositions;

  return new Map(
    [...nextPositions.entries()].map(([id, position]) => [
      id,
      {
        x: position.x + dx,
        y: position.y + dy,
      },
    ]),
  );
}

function firstOpenPosition(
  proposed: GraphPoint,
  node: Node,
  positions: Map<string, GraphPoint>,
  nodesById: Map<string, Node>,
) {
  const next = { ...proposed };
  while (overlapsExisting(next, node, positions, nodesById)) {
    next.y += heightForNode(node, activeFoldCountById.get(node.id) ?? 0) + INCREMENTAL_NODE_GAP;
  }
  return next;
}

function overlapsExisting(
  proposed: GraphPoint,
  node: Node,
  positions: Map<string, GraphPoint>,
  nodesById: Map<string, Node>,
) {
  const nodeHeight = heightForNode(node, activeFoldCountById.get(node.id) ?? 0);
  for (const [id, position] of positions) {
    const existing = nodesById.get(id);
    if (!existing) continue;
    const existingHeight = heightForNode(existing, activeFoldCountById.get(id) ?? 0);
    const horizontallyOverlaps = proposed.x < position.x + NODE_WIDTH + INCREMENTAL_NODE_GAP && proposed.x + NODE_WIDTH + INCREMENTAL_NODE_GAP > position.x;
    const verticallyOverlaps = proposed.y < position.y + existingHeight + INCREMENTAL_NODE_GAP && proposed.y + nodeHeight + INCREMENTAL_NODE_GAP > position.y;
    if (horizontallyOverlaps && verticallyOverlaps) return true;
  }
  return false;
}

function heightForNode(node: Node, foldedMetricCount = 0) {
  const base = node.kind === "technical_route" || node.kind === "product" ? TALL_NODE_HEIGHT : DEFAULT_NODE_HEIGHT;
  return foldedMetricCount > 0 ? base + METRICS_STRIP_HEIGHT : base;
}

function shouldShowEdgeLabel(edge: Edge, selectedId: string, relation: EdgeRelation | "all") {
  if (relation !== "all") return true;
  return edge.source === selectedId || edge.target === selectedId;
}

function fallbackPositionFor(node: Node, nodes: Node[], edges: Edge[], routeFocus: string) {
  const sorted = [...nodes].sort(compareNodes);
  const laneById = depthMap(edges, sorted);
  const lane = laneById.get(node.id) ?? laneFor(node, edges, routeFocus);
  const sameLane = sorted.filter((item) => (laneById.get(item.id) ?? laneFor(item, edges, routeFocus)) === lane);
  const index = sameLane.findIndex((item) => item.id === node.id);
  const laneStart = laneStarts(sorted, edges, routeFocus, laneById)[lane] ?? 40;
  const xOffset = 0;
  const rowHeight = heightForNode(node) + 28;
  const columns = 1;
  const yOffset = Math.floor(Math.max(index, 0) / columns) * rowHeight;

  return { x: lane * (NODE_WIDTH + 112) + xOffset, y: laneStart + yOffset };
}

function laneStarts(nodes: Node[], edges: Edge[], routeFocus: string, laneById = depthMap(edges, nodes)) {
  const starts: number[] = [];
  let cursor = 40;
  const maxLane = Math.max(3, ...nodes.map((node) => laneById.get(node.id) ?? laneFor(node, edges, routeFocus)));

  for (let lane = 0; lane <= maxLane; lane += 1) {
    starts[lane] = cursor;
    const count = nodes.filter((node) => (laneById.get(node.id) ?? laneFor(node, edges, routeFocus)) === lane).length;
    const columns = lane === 0 || routeFocus !== "all" ? 1 : 3;
    const rows = Math.max(1, Math.ceil(count / columns));
    cursor += rows * (TALL_NODE_HEIGHT + 38) + 58;
  }

  return starts;
}

function laneFor(node: Node, edges: Edge[], routeFocus: string) {
  if (node.kind === "product") return 0;
  if (node.kind === "module") return 1;
  if (node.kind === "technical_route") return 2;
  if (node.kind === "metric") return 3;
  if (node.kind === "bottleneck" || node.kind === "placeholder_breakthrough") return 3;
  if (edges.some((edge) => edge.target === node.id && (edge.relation === "manufactured_by" || edge.relation === "regulated_by"))) return 3;
  if (node.kind === "scientific_principle" || node.kind === "empirical_principle") return 3;
  return 3;
}

function depthMap(edges: Edge[], nodes: Node[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const depths = new Map<string, number>();
  if (!nodeIds.has(rootNodeId)) return depths;

  const queue: Array<{ id: string; depth: number }> = [{ id: rootNodeId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const knownDepth = depths.get(current.id);
    if (knownDepth !== undefined && knownDepth <= current.depth) continue;
    depths.set(current.id, current.depth);

    for (const edge of edges) {
      if (edge.source === current.id && nodeIds.has(edge.target) && layeredRelations.has(edge.relation)) {
        queue.push({ id: edge.target, depth: current.depth + 1 });
      }
    }
  }

  return depths;
}

function compareNodes(a: Node, b: Node) {
  const maturityDelta = (b.maturityScore ?? -1) - (a.maturityScore ?? -1);
  if (a.kind === b.kind && maturityDelta !== 0) return maturityDelta;
  return a.id.localeCompare(b.id);
}

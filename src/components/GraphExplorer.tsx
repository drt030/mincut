"use client";

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { defaultFocalProduct, V0_TARGET_NODE_ID } from "@/lib/graphTraversal";
import { useSearchParams } from "next/navigation";
import {
  Background,
  Controls,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useStore,
  type Edge as FlowEdge,
  type EdgeProps,
  type Node as FlowNode,
  type NodeProps,
  type ReactFlowInstance,
  type ReactFlowState,
} from "@xyflow/react";
import { useLanguage } from "./LanguageProvider";
import { RadialNode } from "./RadialNode";
import { RadialEdge } from "./RadialEdge";
import { GraphControls } from "./GraphControls";
import { RouteDetailRail } from "./RouteDetailRail";
import { CmdKSearch, handleCmdKKeydown } from "./CmdKSearch";
import { LayerToggleFloatingButton } from "./LayerToggleFloatingButton";
import { useHolderTeasers } from "./HolderTeaserProvider";
import { selectTopN } from "@/lib/prioritySelection";
import { effectiveLodZoom, type LodDisplayMode } from "@/lib/lod";
import { radialLayout, type PolarPosition } from "@/lib/radialLayout";
import { packRectangularNodes } from "@/lib/cardAwareLayout";
import { subsystemHue } from "@/lib/subsystemHue";
import {
  edgeStyleFor,
  nodeCostSignalRmb,
  type ColorMode,
} from "@/lib/edgeStyleFor";
import { nodeRiskSignal } from "@/lib/nodeRisk";
import { focusedSubset } from "@/lib/focusedSubset";
import { filterCanvasGraph, isRootableCanvasNode, resolveCanvasRootId, isCanvasTreeEdge, isKnowHowNode } from "@/lib/canvasGraph";
import { selectCostDriverRoute } from "@/lib/routeHighlight";
import type { RouteExposureAccessState } from "@/lib/routeAccess";
import type { Edge, GraphData, Node } from "@/lib/schema";
import {
  DEFAULT_GRAPH_LAYER,
  knowHowBottleneckCounts,
  knowHowLayerFill,
  layerHidesNode,
  type GraphLayer,
} from "@/lib/knowHowLayer";
import { holdersForNode } from "@/lib/supplyConcentration";

/**
 * Per ADR-0007, the `/graph` surface is a Stable Balanced Radial Tree:
 * a stable product-decomposition map where branch highlight and analysis
 * modes are overlays on the same geometry. The old chrome (mode tabs,
 * KPI row, pill banners, advanced filters, color-mode dropdown, page
 * heading) stays deleted so the canvas remains the primary surface.
 *
 * Layout: `radialLayout` returns balanced polar `(r, theta)` positions
 * for every structural node plus first-layer sector metadata; we convert
 * positions to Cartesian and feed React Flow.
 *
 * Color (A3): `subsystemHue` returns the HSL family for a node id. The
 * focal product, materials, shared modules (>=2 requires parents in the
 * focal subtree), and orphans get neutral grey (saturation 0).
 *
 * LOD (A4): each node and edge renders one of three band variants
 * branched by `radialBandFor(zoom)`:
 *   Band 1 (z < 0.5)   — overview dot, plain thin edge.
 *   Band 2 (.5–1.5)    — larger circle with truncated label + outline;
 *                        edge gains an arrowhead.
 *   Band 3 (z ≥ 1.5)   — 136×72 HTML card; edge gains a relation label
 *                        when one endpoint is the focused node.
 *
 * To avoid each child component subscribing to the React Flow store
 * (and to keep `RadialNode` / `RadialEdge` testable in isolation
 * without a `<ReactFlow>` provider in scope), a single subscriber
 * inside `CanvasInner` reads the transform and broadcasts the
 * effective display zoom via React context. In Auto mode this is still
 * quantized by `Math.floor(zoom * 2)` per ADR-0006 §LOD; in manual display
 * modes it is pinned to the chosen band so pan/zoom no longer changes
 * node/edge disclosure.
 */

const BAND3_BOX = { width: 136, height: 72 } as const;

const ZoomContext = createContext<number>(1);

const transformSelector = (s: ReactFlowState) => s.transform[2];

type RadialNodeData = {
  id: string;
  name: string;
  kindLabel: string;
  fill: string;
  /** Neutral outline for selection affordance; analysis colour stays on edges. */
  outlineColor: string;
  maturityLabel: string;
  selected: boolean;
  isFocal: boolean;
  /**
   * B3: true when this node falls outside the focused `requires`
   * subtree (or when there is no focus and the node is otherwise
   * out-of-scope — never the case in current data). The radial-dim
   * class lowers opacity while preserving hue so node family remains
   * legible outside the focused path.
   */
  dim: boolean;
  visualRole: "root" | "anchor" | "branch" | "leaf";
  showLabel: boolean;
  onSelect: (nodeId: string) => void;
  shape: "circle" | "diamond";
  knowHowBottleneckCount: number;
};

const RadialDotNode = memo(function RadialDotNode({ data }: NodeProps<FlowNode<RadialNodeData>>) {
  const zoom = useContext(ZoomContext);
  const box = BAND3_BOX;
  return (
    <div
      className={[
        "radial-dot",
        data.selected ? "selected" : "",
        data.isFocal ? "focal" : "",
        data.dim ? "radial-dim" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: box.width, height: box.height, position: "relative" }}
      role="button"
      tabIndex={0}
      aria-label={`${data.name} · ${data.kindLabel}`}
      aria-pressed={data.selected}
      title={data.name}
      onClick={(event) => {
        event.stopPropagation();
        data.onSelect(data.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          event.stopPropagation();
          data.onSelect(data.id);
        }
      }}
    >
      <RadialNode
        id={data.id}
        name={data.name}
        fill={data.fill}
        maturityLabel={data.maturityLabel}
        outlineColor={data.outlineColor}
        zoom={zoom}
        visualRole={data.visualRole}
        showLabel={data.showLabel}
        withHandles
        shape={data.shape}
        knowHowBottleneckCount={data.knowHowBottleneckCount}
      />
    </div>
  );
});

type RadialEdgeData = {
  label: string;
  isFocusEndpoint: boolean;
  edgeKind: "primary" | "cross";
  highlighted: boolean;
  emphasis: "branch" | "normal";
  sourceRadius: number;
  targetRadius: number;
  sourceAnchor?: { x: number; y: number };
  targetAnchor?: { x: number; y: number };
  /** Per-edge stroke + width from `edgeStyleFor` driven by colour mode. */
  stroke: string;
  strokeWidth: number;
  rootNodeId: string;
  /**
   * B3: true when at least one endpoint is outside the focused
   * `requires` subtree. The `.radial-dim` class wraps the SVG `<g>`
   * so opacity fades the stroke + arrowhead uniformly with the node.
   */
  dim: boolean;
};

const RadialEdgeFlow = memo(function RadialEdgeFlow(
  props: EdgeProps<FlowEdge<RadialEdgeData>>,
) {
  const zoom = useContext(ZoomContext);
  const { id, source, target, sourceX, sourceY, targetX, targetY, data } = props;
  return (
    <RadialEdge
      id={id}
      source={source}
      target={target}
      label={data?.label ?? ""}
      isFocusEndpoint={data?.isFocusEndpoint ?? false}
      zoom={zoom}
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourceAnchorX={data?.sourceAnchor?.x}
      sourceAnchorY={data?.sourceAnchor?.y}
      targetAnchorX={data?.targetAnchor?.x}
      targetAnchorY={data?.targetAnchor?.y}
      stroke={data?.stroke}
      strokeWidth={data?.strokeWidth}
      rootNodeId={data?.rootNodeId}
      dim={data?.dim ?? false}
      highlighted={data?.highlighted ?? false}
      emphasis={data?.emphasis ?? "normal"}
      edgeKind={data?.edgeKind ?? "primary"}
      sourceRadius={data?.sourceRadius ?? 0}
      targetRadius={data?.targetRadius ?? 0}
    />
  );
});

const nodeTypes = {
  radialDot: RadialDotNode,
};

const edgeTypes = {
  radialEdge: RadialEdgeFlow,
};

/**
 * `SectorTintLayer` renders the per-sector translucent K4 background
 * tint wedges. The layer subscribes to React Flow's transform via
 * `useStore` so the wedges pan + zoom with the canvas. Mounted inside
 * `<ReactFlow>` as a child, it overlays the Background grid but stays
 * below node DOM via `pointerEvents: none` + an explicit `z-index: 0`.
 *
 * Wedge fill opacity stays low so subsystem grouping remains a soft
 * background hint over the balanced tree rather than a rigid sector
 * constraint.
 */
function SectorTintLayer({
  wedges,
  backgroundOuterR,
}: {
  wedges: Array<{ id: string; d: string; fill: string }>;
  backgroundOuterR: number;
}) {
  const transform = useStore((s) => s.transform);
  const guideRadii = [100, 140, 180, 220, 260, 300, 340, 380]
    .filter((r) => r < backgroundOuterR - 8)
    .map((r) => r * PX_SCALE);
  if (wedges.length === 0 && guideRadii.length === 0) return null;
  const [tx, ty, scale] = transform;
  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
        {wedges.map((w) => (
          <path
            key={w.id}
            d={w.d}
            fill={w.fill}
            fillOpacity={0.045}
            stroke="none"
          />
        ))}
        {guideRadii.map((r) => (
          <circle
            key={r}
            className="radial-guide-ring"
            cx={0}
            cy={0}
            r={r}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle
          className="radial-guide-boundary"
          cx={0}
          cy={0}
          r={backgroundOuterR * PX_SCALE}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}

function SectorLabelLayer({
  labels,
}: {
  labels: Array<{
    id: string;
    x: number;
    y: number;
    rotate: number;
    label: string;
    dim: boolean;
  }>;
}) {
  const transform = useStore((s) => s.transform);
  if (labels.length === 0) return null;
  const [tx, ty, scale] = transform;
  const fontSize = Math.max(12 / scale, 12);
  const strokeWidth = Math.max(4 / scale, 4);
  return (
    <svg
      className="sector-label-layer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 3,
      }}
      aria-hidden="true"
    >
      <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
        {labels.map((item) => {
          const labelX = svgNumber(item.x);
          const labelY = svgNumber(item.y);
          const labelRotate = svgNumber(item.rotate);
          return (
            <text
              key={item.id}
              className={item.dim ? "sector-label dimmed" : "sector-label"}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              transform={`rotate(${labelRotate} ${labelX} ${labelY})`}
              style={{ fontSize, strokeWidth }}
            >
              {item.label}
              <title>{item.label}</title>
            </text>
          );
        })}
      </g>
    </svg>
  );
}

function ZoomBridge({
  children,
  displayMode,
}: {
  children: React.ReactNode;
  displayMode: LodDisplayMode;
}) {
  const rawZoom = useStore(transformSelector);
  // In Auto, quantize so the context value is stable between band
  // crossings. In manual modes, return a fixed representative zoom for
  // that display band, independent of viewport scale.
  const representative = effectiveLodZoom(rawZoom, displayMode);
  return <ZoomContext.Provider value={representative}>{children}</ZoomContext.Provider>;
}

const DEFAULT_ROOT_NODE_ID = V0_TARGET_NODE_ID;

// Operator-only affordances (agent expansion writes to local data files) are
// hidden on public deployments; the API behind them is also guarded by
// OPERATOR_WRITES (server-side). NEXT_PUBLIC_ vars are inlined at build time.
const OPERATOR_MODE = process.env.NEXT_PUBLIC_OPERATOR_MODE === "1";

type AgentExpansionStatus = "idle" | "listing" | "queued" | "error";

type AgentExpansionProgress = {
  listedNodes: number;
  listedEdges: number;
  taskTitle?: string;
  taskCreated?: boolean;
};

type AgentExpansionResponse = {
  created?: boolean;
  task?: { title?: string };
  graphPatch?: {
    nodes?: Node[];
    edges?: Edge[];
  };
  progress?: {
    listedNodes?: number;
    listedEdges?: number;
    evidenceTaskQueued?: boolean;
  };
};

function compactSectorLabel(label: string): string {
  const max = 24;
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function graphRootHref(nodeId: string): string {
  if (nodeId === DEFAULT_ROOT_NODE_ID) return "/graph";
  return `/graph?root=${encodeURIComponent(nodeId)}`;
}

function mergeGraphPatch(graph: GraphData, patch: { nodes?: Node[]; edges?: Edge[] }): GraphData {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  for (const node of patch.nodes ?? []) {
    if (nodeIds.has(node.id)) continue;
    nodeIds.add(node.id);
    nodes.push(node);
  }
  for (const edge of patch.edges ?? []) {
    if (edgeIds.has(edge.id)) continue;
    edgeIds.add(edge.id);
    edges.push(edge);
  }
  return { ...graph, nodes, edges };
}

function GraphProductStrip({
  rootNode,
  resetRootNode,
  graphLayer,
  parentRootNode,
  subsystemCount,
  routeCount,
  isCustomRoot,
  operatorMode,
  agentExpansionStatus,
  agentExpansionProgress,
  exposureAccess,
  onBackToParentRoot,
  onResetRoot,
  onRequestAgentExpansion,
}: {
  rootNode: Node;
  resetRootNode: Node;
  graphLayer: GraphLayer;
  parentRootNode: Node | null;
  subsystemCount: number;
  routeCount: number;
  isCustomRoot: boolean;
  operatorMode: boolean;
  agentExpansionStatus: AgentExpansionStatus;
  agentExpansionProgress: AgentExpansionProgress | null;
  exposureAccess?: RouteExposureAccessState;
  onBackToParentRoot: () => void;
  onResetRoot: () => void;
  onRequestAgentExpansion: () => void;
}) {
  const { language, nodeName } = useLanguage();
  const copy = language === "zh"
    ? {
      product: "产品视图",
      knowHow: "技术诀窍视图",
      majorComponents: "直接依赖",
      technicalNodes: "技术节点",
      costTargets: "成本目标",
      parentRoot: "回到上一级",
      resetRoot: "回到产品根节点",
      agentExpand: "Agent 继续展开",
      agentListing: "正在列候选节点",
      agentQueued: (count: number) => count > 0 ? `已列出 ${count} 个候选` : "证据任务已入队",
      agentError: "加入失败，重试",
      agentProgress: (nodes: number, edges: number) => `已加入 ${nodes} 个节点 / ${edges} 条边；证据收集任务已入队`,
      auditPreviewOnly: "未来付费领域",
      freeReference: "免费参考图谱",
      paidLayerLocked: "付费层已锁定",
    }
    : {
      product: "Research root",
      knowHow: "Technical know-how",
      majorComponents: "direct dependencies",
      technicalNodes: "technical nodes",
      costTargets: "cost targets",
      parentRoot: "Parent root",
      resetRoot: "Product root",
      agentExpand: "Agent expand",
      agentListing: "Listing candidates",
      agentQueued: (count: number) => count > 0 ? `Listed ${count} candidates` : "Evidence task queued",
      agentError: "Retry queue",
      agentProgress: (nodes: number, edges: number) => `Added ${nodes} nodes / ${edges} edges; evidence task queued`,
      auditPreviewOnly: "Future paid domain",
      freeReference: "Free reference map",
      paidLayerLocked: "Paid layer locked",
    };
  const agentLabel = agentExpansionStatus === "listing"
    ? copy.agentListing
    : agentExpansionStatus === "queued"
      ? copy.agentQueued(agentExpansionProgress?.listedNodes ?? 0)
      : agentExpansionStatus === "error"
        ? copy.agentError
        : copy.agentExpand;
  const showAgentProgress = agentExpansionStatus === "listing" || agentExpansionStatus === "queued";
  const progressPct = agentExpansionStatus === "listing"
    ? 36
    : agentExpansionProgress && agentExpansionProgress.listedNodes > 0
      ? 82
      : 64;
  const routeState = exposureAccess?.status === "audit-preview"
    ? { className: "audit-preview", label: copy.auditPreviewOnly }
    : exposureAccess?.status === "full-free"
      ? { className: "full-free", label: copy.freeReference }
    : exposureAccess?.status === "locked" || exposureAccess?.status === "paid-candidate"
      ? { className: "paid-locked", label: copy.paidLayerLocked }
      : null;
  return (
    <div className="graph-product-strip" data-testid="graph-product-strip">
      <div className="graph-product-title-block">
        <span>{graphLayer === "knowhow" ? copy.knowHow : copy.product}</span>
        <strong>{nodeName(rootNode.id, rootNode.name)}</strong>
      </div>
      <div className="graph-product-stat-row">
        {routeState ? (
          <span className={`graph-route-state ${routeState.className}`}>{routeState.label}</span>
        ) : null}
        <span>{subsystemCount} {graphLayer === "knowhow" ? copy.technicalNodes : copy.majorComponents}</span>
        {routeCount > 0 ? <span>{routeCount} {copy.costTargets}</span> : null}
        {parentRootNode ? (
          <a
            className="graph-root-reset-button graph-root-parent-button"
            data-testid="parent-root-node-button"
            href={graphRootHref(parentRootNode.id)}
            onClick={(event) => {
              event.preventDefault();
              onBackToParentRoot();
            }}
          >
            {copy.parentRoot}
          </a>
        ) : null}
        {isCustomRoot ? (
          <a
            className="graph-root-reset-button"
            data-testid="reset-root-node-button"
            href={graphRootHref(resetRootNode.id)}
            onClick={(event) => {
              event.preventDefault();
              onResetRoot();
            }}
          >
            {copy.resetRoot}
          </a>
        ) : null}
        {operatorMode ? (
          <button
            type="button"
            className="graph-root-reset-button graph-agent-expand-button"
            data-testid="agent-expand-root-button"
            aria-disabled={agentExpansionStatus === "listing"}
            aria-busy={agentExpansionStatus === "listing"}
            onClick={() => {
              if (agentExpansionStatus === "listing") return;
              onRequestAgentExpansion();
            }}
          >
            {agentLabel}
          </button>
        ) : null}
      </div>
      {operatorMode && showAgentProgress ? (
        <div
          className="graph-agent-progress"
          data-testid="agent-expand-progress"
          role="status"
          aria-live="polite"
        >
          <span>
            {agentExpansionStatus === "listing"
              ? agentLabel
              : copy.agentProgress(
                agentExpansionProgress?.listedNodes ?? 0,
                agentExpansionProgress?.listedEdges ?? 0,
              )}
          </span>
          <div className="graph-agent-progress-track" aria-hidden="true">
            <i style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Px scale: radialLayout returns abstract polar units (R1 = 100,
// R_STEP = 40, R_OUTER = R1 + (maxDepth+2)*R_STEP). Multiply by a
// pixel scale so the default viewport puts everything in ~600px box.
const PX_SCALE = 2.4;

type Props = {
  graph: GraphData;
  /** Per-domain routes (/d/[slug]) pin the canvas root server-side; ?root= still wins for in-canvas navigation. */
  initialRootId?: string;
  exposureAccess?: RouteExposureAccessState;
  operatorMode?: boolean;
};

function svgNumber(value: number): string {
  if (Math.abs(value) < 1e-9) return "0";
  return Number(value.toFixed(6)).toString();
}

type RectPortSide = "left" | "right" | "top" | "bottom";

function rectPortSideForVector(dx: number, dy: number): RectPortSide {
  if (dx === 0 && dy === 0) return "right";
  const horizontalReach = Math.abs(dx) / (BAND3_BOX.width / 2);
  const verticalReach = Math.abs(dy) / (BAND3_BOX.height / 2);
  if (horizontalReach >= verticalReach) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function rectPortOffset(index: number, count: number, side: RectPortSide): number {
  if (count <= 1) return 0;
  const usable = side === "left" || side === "right"
    ? BAND3_BOX.height - 16
    : BAND3_BOX.width - 20;
  const preferredSpacing = side === "left" || side === "right" ? 18 : 20;
  const span = Math.min(usable, (count - 1) * preferredSpacing);
  return -span / 2 + (span * index) / (count - 1);
}

function rectPortPoint(
  center: { x: number; y: number },
  side: RectPortSide,
  offset: number,
): { x: number; y: number } {
  const halfW = BAND3_BOX.width / 2;
  const halfH = BAND3_BOX.height / 2;
  switch (side) {
    case "left":
      return { x: center.x - halfW, y: center.y + offset };
    case "right":
      return { x: center.x + halfW, y: center.y + offset };
    case "top":
      return { x: center.x + offset, y: center.y - halfH };
    case "bottom":
      return { x: center.x + offset, y: center.y + halfH };
  }
}

/**
 * Compute the focal-subtree set: BFS from the first product node via
 * canvas tree edges. Only nodes in this set are rendered on the canvas
 * in A3 — orphans (sibling products etc.) are deferred per ADR-0006.
 */
function buildFocalSubtree(graph: GraphData, rootId: string): Set<string> {
  const focal = graph.nodes.find((n) => n.id === rootId) ?? defaultFocalProduct(graph);
  if (!focal) return new Set();
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }
  const subtree = new Set<string>();
  const queue: string[] = [focal.id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (subtree.has(cur)) continue;
    subtree.add(cur);
    for (const child of childrenByParent.get(cur) ?? []) queue.push(child);
  }
  return subtree;
}

function polarToCartesian(polar: PolarPosition): { x: number; y: number } {
  return {
    x: polar.r * PX_SCALE * Math.cos(polar.theta),
    y: polar.r * PX_SCALE * Math.sin(polar.theta),
  };
}

/**
 * Resolve which direct `requires`-child of `outerId` is the nearest
 * ancestor of `clickedId`, or `clickedId` itself if it IS a direct
 * child. Returns `null` if the click does not resolve to any inner
 * sub-subsystem of `outerId` (e.g. the click was on the outer dot
 * itself, or on a node outside the outer's subtree).
 *
 * Production data uses `source = parent, target = child` for
 * `requires`-edges; the C1 unit-test fixture uses the opposite. We
 * walk in both directions and pick whichever returns a match —
 * mirrors the dual-direction logic used by the older elastic-geometry
 * helpers and keeps bookmarked deep focus paths working.
 */
function innerChildContaining(
  clickedId: string,
  outerId: string,
  graph: GraphData,
): string | null {
  if (clickedId === outerId) return null;
  // Collect direct inner children both ways.
  const innersFwd = new Set<string>();
  const innersRev = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (edge.source === outerId) innersFwd.add(edge.target);
    if (edge.target === outerId) innersRev.add(edge.source);
  }
  // Try production direction first.
  const tryFromInners = (inners: Set<string>, forward: boolean): string | null => {
    for (const inner of inners) {
      if (inner === clickedId) return inner;
      const visited = new Set<string>();
      const queue: string[] = [inner];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        // Don't cross into another inner branch.
        if (cur !== inner && (inners.has(cur) || cur === outerId)) continue;
        if (cur === clickedId) return inner;
        for (const edge of graph.edges) {
          if (edge.relation !== "requires") continue;
          const next = forward
            ? edge.source === cur
              ? edge.target
              : null
            : edge.target === cur
              ? edge.source
              : null;
          if (next === null) continue;
          if (visited.has(next)) continue;
          queue.push(next);
        }
      }
    }
    return null;
  };
  return tryFromInners(innersFwd, true) ?? tryFromInners(innersRev, false);
}

function focusPathForNode(nodeId: string, graph: GraphData, rootId: string): string[] {
  if (nodeId === rootId) return [];
  const firstLayer = graph.edges
    .filter((edge) => edge.relation === "requires" && edge.source === rootId)
    .map((edge) => edge.target)
    .sort((a, b) => a.localeCompare(b));
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.localeCompare(b));

  for (const outer of firstLayer) {
    if (outer === nodeId) return [outer];
    const visited = new Set<string>();
    const queue: string[] = [outer];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      if (cur === nodeId) {
        const inner = innerChildContaining(nodeId, outer, graph);
        if (!inner || inner === outer) return [outer];
        return [outer, inner];
      }
      for (const child of childrenByParent.get(cur) ?? []) {
        if (!visited.has(child)) queue.push(child);
      }
    }
  }
  return [];
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function findRequiresNodePath(graph: GraphData, rootId: string, targetId: string): string[] | null {
  if (rootId === targetId) return [rootId];
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push(edge.target);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.localeCompare(b));

  const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: rootId, path: [rootId] }];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);
    for (const child of childrenByParent.get(current.nodeId) ?? []) {
      if (visited.has(child)) continue;
      const path = [...current.path, child];
      if (child === targetId) return path;
      queue.push({ nodeId: child, path });
    }
  }
  return null;
}

function parentResearchRootId(graph: GraphData, currentRootId: string, baseRootId = DEFAULT_ROOT_NODE_ID): string | null {
  if (currentRootId === baseRootId) return null;
  const canonicalPath = findRequiresNodePath(graph, baseRootId, currentRootId);
  if (canonicalPath && canonicalPath.length >= 2) {
    return canonicalPath[canonicalPath.length - 2];
  }
  const incomingParents = graph.edges
    .filter((edge) => edge.relation === "requires" && edge.target === currentRootId)
    .map((edge) => edge.source)
    .sort((a, b) => a.localeCompare(b));
  return incomingParents[0] ?? null;
}

export function GraphExplorer({ graph, initialRootId: initialRootProp, exposureAccess, operatorMode = OPERATOR_MODE }: Props) {
  const { kindName, nodeName, t } = useLanguage();
  const holderTeasers = useHolderTeasers();
  const searchParams = useSearchParams();
  const initialRootId =
    resolveCanvasRootId(graph, searchParams?.get("root")) ??
    resolveCanvasRootId(graph, initialRootProp ?? null) ??
    DEFAULT_ROOT_NODE_ID;
  const [currentRootId, setCurrentRootId] = useState(initialRootId);
  const [workingGraph, setWorkingGraph] = useState(graph);
  useEffect(() => {
    setWorkingGraph(graph);
  }, [graph]);
  const canvasGraph = useMemo(() => filterCanvasGraph(workingGraph, currentRootId), [workingGraph, currentRootId]);
  const rootableNodeIds = useMemo(
    () => workingGraph.nodes.filter(isRootableCanvasNode).map((node) => node.id),
    [workingGraph.nodes],
  );

  // Initial selection: URL ?focus= if present and valid; otherwise, a
  // bookmarked ?path= view selects the deepest path node so the detail
  // rail matches the expanded branch. Fall back to the focal product.
  const initialFocus = (() => {
    const raw = searchParams?.get("focus");
    if (raw && canvasGraph.nodes.some((n) => n.id === raw)) return raw;
    const pathRaw = searchParams?.get("path");
    if (pathRaw) {
      const known = new Set(canvasGraph.nodes.map((n) => n.id));
      const ids = pathRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const deepest = ids.at(-1);
      if (deepest && known.has(deepest)) return deepest;
    }
    return currentRootId;
  })();
  const [selectedId, setSelectedId] = useState(initialFocus);
  const [railPanel, setRailPanel] = useState<"route" | "detail">("route");

  // Retail launch entry opens on the bottleneck heat lens; /explore can
  // still request other modes via its query wiring.
  const [colorMode, setColorMode] = useState<ColorMode>("bottleneck-risk");
  const [displayMode] = useState<LodDisplayMode>("labels");
  const [graphLayer, setGraphLayer] = useState<GraphLayer>(DEFAULT_GRAPH_LAYER);

  // C2: Cmd+K search modal. Opened via the global keydown listener
  // below; closed via Esc, backdrop click, or selecting a result. The
  // modal is presentational — selecting a result calls our local
  // `onSelect` which both selects (rail content updates) and focuses
  // (sector elastically expands toward the chosen node).
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [rootTransitioning, setRootTransitioning] = useState(false);
  const [agentExpansionStatus, setAgentExpansionStatus] = useState<AgentExpansionStatus>("idle");
  const [agentExpansionRootId, setAgentExpansionRootId] = useState<string | null>(null);
  const [agentExpansionProgress, setAgentExpansionProgress] = useState<AgentExpansionProgress | null>(null);
  const rootTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // B2 + C1: focus path. `[]` = overview. `[outerId]` = Level 1
  // (focused first-layer subsystem). `[outerId, innerId]` = Level 2
  // (sub-subsystem expansion inside the outer). Length ≥ 3 keeps
  // geometry at L2 but viewport zooms deeper.
  //
  // Click rules (see `onNodeClick` below):
  //   - From overview: click any node → push its first-layer ancestor.
  //   - From L1: click a node in the same outer sector → push its
  //     direct inner sub-subsystem (the requires-child of path[0]
  //     that's also an ancestor of the clicked node).
  //   - From L2+: click a node in the same inner subtree → push the
  //     clicked node id (deeper viewport only).
  //   - Click in a different outer sector at any level → reset to
  //     [newOuter].
  // Esc pops one level; empty-canvas click pops one level.
  //
  // URL sync: `?focus=outerId[,innerId[,deeperId]]` — a single
  // comma-separated param keeps the URL human-readable and lets a
  // bookmarked link restore the full path with one parse.
  const [focusPath, setFocusPath] = useState<string[]>(() => {
    // Restore the focus path from `?path=<outer>[,<inner>[,<deeper>]]`
    // on first render so bookmarked / shared links land at the right
    // expansion level. We trust the URL only when every id is a real
    // node in this graph; a stale id (e.g. after a data refresh) is
    // silently dropped to avoid skewing geometry.
    const known = new Set(canvasGraph.nodes.map((n) => n.id));
    const focusIdFromUrl = searchParams?.get("focus");
    if (focusIdFromUrl && known.has(focusIdFromUrl) && focusIdFromUrl !== currentRootId) {
      return focusPathForNode(focusIdFromUrl, canvasGraph, currentRootId);
    }
    const raw = searchParams?.get("path");
    if (!raw) {
      return [];
    }
    const ids = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (ids.length === 0) return [];
    if (!ids.every((id) => known.has(id))) return [];
    return focusPathForNode(ids[ids.length - 1], canvasGraph, currentRootId);
  });
  const searchParamsSignature = searchParams?.toString() ?? "";
  useEffect(() => {
    const nextRootId =
      resolveCanvasRootId(workingGraph, searchParams?.get("root")) ??
      resolveCanvasRootId(workingGraph, initialRootProp ?? null) ??
      DEFAULT_ROOT_NODE_ID;
    const known = new Set(workingGraph.nodes.map((node) => node.id));
    const focusIdFromUrl = searchParams?.get("focus");
    const pathRaw = searchParams?.get("path");

    let nextSelectedId = nextRootId;
    let nextFocusPath: string[] = [];
    let shouldOpenDetail = false;

    if (focusIdFromUrl && known.has(focusIdFromUrl)) {
      nextSelectedId = focusIdFromUrl;
      nextFocusPath = focusPathForNode(focusIdFromUrl, workingGraph, nextRootId);
      shouldOpenDetail = focusIdFromUrl !== nextRootId;
    } else if (pathRaw) {
      const ids = pathRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const deepest = ids.at(-1);
      if (deepest && ids.every((id) => known.has(id))) {
        nextSelectedId = deepest;
        nextFocusPath = focusPathForNode(deepest, workingGraph, nextRootId);
        shouldOpenDetail = deepest !== nextRootId;
      }
    }

    setCurrentRootId((prev) => (prev === nextRootId ? prev : nextRootId));
    setSelectedId((prev) => (prev === nextSelectedId ? prev : nextSelectedId));
    setFocusPath((prev) => (samePath(prev, nextFocusPath) ? prev : nextFocusPath));
    if (shouldOpenDetail) setRailPanel("detail");
  }, [initialRootProp, searchParams, searchParamsSignature, workingGraph]);
  // Back-compat alias for code that still references a single focused
  // id (e.g. dim flag, sector-tint colour, viewport math).
  const focusedId = focusPath.length > 0 ? focusPath[0] : null;

  // Focal subtree — A3 renders only these nodes. Orphans (sibling
  // products) are hidden per spec.
  const focalSubtree = useMemo(
    () => buildFocalSubtree(canvasGraph, currentRootId),
    [canvasGraph, currentRootId],
  );

  const activeRoute = useMemo(
    () => selectCostDriverRoute(canvasGraph, currentRootId, { limit: 4, costGraph: workingGraph }),
    [canvasGraph, currentRootId, workingGraph],
  );
  const routeHighlight = colorMode === "cost" ? activeRoute : null;

  // Radial layout positions in polar coords. Pure / deterministic per A2.
  const layout = useMemo(() => radialLayout(canvasGraph, currentRootId), [canvasGraph, currentRootId]);

  const radialNodePositions = useMemo(() => {
    const raw = new Map<string, { x: number; y: number }>();
    for (const [nodeId, polar] of layout.positions) {
      if (!focalSubtree.has(nodeId)) continue;
      raw.set(nodeId, polarToCartesian(polar));
    }
    return raw;
  }, [focalSubtree, layout.positions]);

  const packedNodePositions = useMemo(() => {
    return packRectangularNodes(radialNodePositions, {
      width: BAND3_BOX.width,
      height: BAND3_BOX.height,
      padding: 36,
      fixedIds: new Set([currentRootId]),
    });
  }, [radialNodePositions, currentRootId]);

  // Every LOD band is mounted inside the same 136x72 React Flow node box.
  // Therefore even label mode needs packed centers; otherwise adjacent node
  // boxes can overlap and a click on one node is intercepted by its neighbor.
  const activeNodePositions = packedNodePositions;
  // Focal root id (used so the central dot can render as the visual anchor).
  const focalId = useMemo(
    () => canvasGraph.nodes.some((n) => n.id === currentRootId) ? currentRootId : null,
    [canvasGraph.nodes, currentRootId],
  );

  const onSelect = useCallback((nodeId: string) => {
    const target = canvasGraph.nodes.find((node) => node.id === nodeId);
    const isKnowHowSelection = Boolean(target && isKnowHowNode(target));
    if (isKnowHowSelection) {
      setGraphLayer("knowhow");
    }
    const nextFocusPath = focusPathForNode(nodeId, canvasGraph, currentRootId);
    setSelectedId(nodeId);
    setFocusPath((prev) => (samePath(prev, nextFocusPath) ? prev : nextFocusPath));
    setRailPanel("detail");
  }, [canvasGraph, currentRootId]);

  const requestAgentExpansion = useCallback(async () => {
    setAgentExpansionRootId(currentRootId);
    setAgentExpansionStatus("listing");
    setAgentExpansionProgress({ listedNodes: 0, listedEdges: 0 });
    try {
      const response = await fetch("/api/research-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetNodeId: currentRootId }),
      });
      if (!response.ok) throw new Error("Failed to queue agent expansion task");
      const data = await response.json() as AgentExpansionResponse;
      const graphPatch = data.graphPatch ?? { nodes: [], edges: [] };
      if ((graphPatch.nodes?.length ?? 0) > 0 || (graphPatch.edges?.length ?? 0) > 0) {
        setWorkingGraph((prev) => mergeGraphPatch(prev, graphPatch));
      }
      setAgentExpansionProgress({
        listedNodes: data.progress?.listedNodes ?? graphPatch.nodes?.length ?? 0,
        listedEdges: data.progress?.listedEdges ?? graphPatch.edges?.length ?? 0,
        taskTitle: data.task?.title,
        taskCreated: data.created,
      });
      setAgentExpansionStatus("queued");
    } catch {
      setAgentExpansionStatus("error");
    }
  }, [currentRootId]);

  // First-layer subsystems for the sector-tint background layer (B1)
  // and B2 elastic angle assignment. Order-independent: B2 sorts by id
  // internally; the tint layer also sorts before rendering.
  const firstLayerSubsystems = useMemo(() => {
    const out: string[] = [];
    for (const edge of canvasGraph.edges) {
      if (edge.relation !== "requires") continue;
      if (edge.source !== currentRootId) continue;
      const target = canvasGraph.nodes.find((n) => n.id === edge.target);
      if (!target || target.kind === "material") continue;
      out.push(edge.target);
    }
    return out;
  }, [canvasGraph, currentRootId]);
  const firstLayerSubsystemSet = useMemo(
    () => new Set(firstLayerSubsystems),
    [firstLayerSubsystems],
  );

  const layerVisibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    for (const node of canvasGraph.nodes) {
      if (layerHidesNode(node, graphLayer) && !firstLayerSubsystemSet.has(node.id)) continue;
      visible.add(node.id);
    }
    return visible;
  }, [canvasGraph.nodes, firstLayerSubsystemSet, graphLayer]);

  const childrenByParent = useMemo(() => {
    const out = new Map<string, string[]>();
    const nodeById = new Map(canvasGraph.nodes.map((n) => [n.id, n]));
    for (const edge of canvasGraph.edges) {
      if (!isCanvasTreeEdge(edge, nodeById)) continue;
      if (!out.has(edge.source)) out.set(edge.source, []);
      out.get(edge.source)!.push(edge.target);
    }
    return out;
  }, [canvasGraph.edges, canvasGraph.nodes]);

  /**
   * Per-node outline colour is intentionally sparse and neutral. The
   * node fill and sector tint carry stable subsystem-family colour,
   * while edge colour + width carry the active analysis lens. Root
   * identity is already encoded by position and the product strip, so
   * only the selected node keeps a contour.
   */
  const outlineColorFor = useCallback(
    (_node: Node, selected: boolean, isFocal: boolean): string => {
      if (isFocal) return "#0f172a";
      if (selected) return "#0f172a";
      return "transparent";
    },
    [],
  );

  // B3: focused-subtree membership (focusedId + its `requires`
  // descendants). With `focusedId === null` every node + every edge
  // is in the set — the overview reads "everything bright". The
  // memoised result becomes the source-of-truth for the per-node
  // and per-edge `dim` flag below; flipping the flag triggers the
  // opacity transition on `.radial-dim`.
  const subset = useMemo(
    () => focusedSubset(focusedId, canvasGraph),
    [focusedId, canvasGraph],
  );

  const khBottleneckCounts = useMemo(
    () => (graphLayer === "product" ? knowHowBottleneckCounts(canvasGraph) : new Map<string, number>()),
    [graphLayer, canvasGraph],
  );

  const khZeroHolderIds = useMemo(() => {
    if (graphLayer !== "knowhow") return new Set<string>();
    const ids = new Set<string>();
    for (const node of canvasGraph.nodes) {
      if (!isKnowHowNode(node)) continue;
      const total = holderTeasers[node.id]?.total ?? holdersForNode(canvasGraph, node.id).total;
      if (total === 0) ids.add(node.id);
    }
    return ids;
  }, [graphLayer, canvasGraph, holderTeasers]);

  /**
   * C3: top-5 priorities under the active colour mode, scoped to the
   * currently-focused subtree (or the focal product's subtree when no
   * sector is focused). Mapped from `nodeId → rank` so the per-node
   * iteration below is a Map lookup.
   *
   * `selectTopN` is pure + memo-stable: same `graph` / `mode` / scope
   * yields the same result, so the `useMemo` deps mirror its inputs.
   */
  const visiblePriorityScope = useMemo(() => {
    if (focusedId !== null) return subset.nodes;
    return new Set(canvasGraph.nodes.map((node) => node.id));
  }, [canvasGraph.nodes, focusedId, subset.nodes]);

  const topPriorityEntries = useMemo(() => {
    return selectTopN(workingGraph, colorMode, 5, visiblePriorityScope);
  }, [workingGraph, colorMode, visiblePriorityScope]);

  const readerStartNodeId = topPriorityEntries[0]?.nodeId ?? null;

  const flowNodes: FlowNode<RadialNodeData>[] = useMemo(() => {
    const nodes: FlowNode<RadialNodeData>[] = [];
    for (const node of canvasGraph.nodes) {
      if (!focalSubtree.has(node.id)) continue;
      if (!layerVisibleNodeIds.has(node.id)) continue;
      const packed = activeNodePositions.get(node.id);
      if (!packed) continue;
      const { x, y } = packed;
      const hue = subsystemHue(node.id, canvasGraph, currentRootId);
      const baseFill = `hsl(${hue.hue}, ${hue.saturation * 100}%, ${hue.lightness * 100}%)`;
      const isKh = isKnowHowNode(node);
      const layerFill = graphLayer === "knowhow"
        ? knowHowLayerFill(node, baseFill)
        : baseFill;
      const isFocal = node.id === focalId;
      const dim = !subset.nodes.has(node.id) && node.id !== selectedId && !isFocal;
      const hasStructuralChildren = (childrenByParent.get(node.id) ?? []).some((childId) =>
        layout.positions.has(childId),
      );
      const visualRole = isFocal
        ? "root"
        : firstLayerSubsystemSet.has(node.id)
          ? "anchor"
          : hasStructuralChildren
            ? "branch"
            : "leaf";
      const showLabel = true;
      let outlineColor = outlineColorFor(node, selectedId === node.id, isFocal);
      if (graphLayer === "knowhow" && khZeroHolderIds.has(node.id) && !subset.nodes.has(node.id) && node.id !== selectedId && !isFocal) {
        outlineColor = "#dc2626";
      }
      nodes.push({
        id: node.id,
        type: "radialDot",
        // Center every display mode on the same detail-sized footprint.
        // The rendered content changes by mode, but layout coordinates
        // stay pinned to the 136×72 card box so switching modes cannot
        // shift nodes or make detail cards grow out of a 56px dot box.
        position: { x: x - BAND3_BOX.width / 2, y: y - BAND3_BOX.height / 2 },
        data: {
          id: node.id,
          name: nodeName(node.id, node.name),
          kindLabel: kindName(node.kind),
          fill: layerFill,
          outlineColor,
          maturityLabel: node.maturityLabel ?? "",
          selected: selectedId === node.id,
          isFocal,
          dim,
          visualRole,
          showLabel,
          onSelect,
          shape: graphLayer === "knowhow" && isKh ? ("diamond" as const) : ("circle" as const),
          knowHowBottleneckCount: khBottleneckCounts.get(node.id) ?? 0,
        },
        draggable: false,
        selectable: true,
      });
    }
    return nodes;
  }, [canvasGraph, currentRootId, focalSubtree, activeNodePositions, layout.positions, focalId, kindName, nodeName, selectedId, onSelect, outlineColorFor, childrenByParent, firstLayerSubsystemSet, subset.nodes, graphLayer, layerVisibleNodeIds, khBottleneckCounts, khZeroHolderIds]);

  const flowEdges: FlowEdge<RadialEdgeData>[] = useMemo(() => {
    type RenderableEdge = {
      id: string;
      source: string;
      target: string;
      relation: string;
      edgeKind: "primary" | "cross";
      highlighted: boolean;
      emphasis: "branch" | "normal";
      isFocusEndpoint: boolean;
      sourceRadius: number;
      targetRadius: number;
      stroke: string;
      strokeWidth: number;
      dim: boolean;
    };
    const renderableEdges: RenderableEdge[] = [];
    const nodeById = new Map(canvasGraph.nodes.map((node) => [node.id, node]));
    const visualRoleFor = (nodeId: string): "root" | "anchor" | "branch" | "leaf" => {
      if (nodeId === focalId) return "root";
      if (firstLayerSubsystemSet.has(nodeId)) return "anchor";
      const hasStructuralChildren = (childrenByParent.get(nodeId) ?? []).some((childId) =>
        layout.positions.has(childId),
      );
      return hasStructuralChildren ? "branch" : "leaf";
    };
    const radiusFor = (nodeId: string): number => {
      const role = visualRoleFor(nodeId);
      if (!nodeById.has(nodeId)) return 12;
      return role === "root" ? 26 : role === "anchor" ? 22 : role === "branch" ? 16 : 10;
    };
    const focusPathPairs = new Set<string>();
    if (focusPath.length > 0) {
      const pathIds = [currentRootId, ...focusPath];
      for (let i = 0; i < pathIds.length - 1; i += 1) {
        focusPathPairs.add(`${pathIds[i]}→${pathIds[i + 1]}`);
      }
    }
    for (const edge of canvasGraph.edges) {
      if (!isCanvasTreeEdge(edge, nodeById)) continue;
      if (!layerVisibleNodeIds.has(edge.source) || !layerVisibleNodeIds.has(edge.target)) continue;
      if (!focalSubtree.has(edge.source) || !focalSubtree.has(edge.target)) continue;
      // Only render edges whose target was actually laid out (defensive
      // — radialLayout assigns every reachable structural node a
      // position, but descriptive subtree members are skipped).
      if (!layout.positions.has(edge.source) || !layout.positions.has(edge.target)) continue;
      // A4 wires `isFocusEndpoint` to the current selection; Phase B
      // will replace `selectedId` with a richer focus state.
      const isFocusEndpoint = edge.source === selectedId || edge.target === selectedId;
      const { stroke, width } = edgeStyleFor(edge, colorMode, workingGraph, { costScopeGraph: canvasGraph });
      const isRouteEdge = routeHighlight?.edgeIds.has(edge.id) ?? false;
      const dim = !subset.edges.has(edge.id) && edge.source !== selectedId && edge.target !== selectedId;
      const edgeKind = layout.edges.get(edge.id)?.style ?? "primary";
      const emphasis = isRouteEdge
        ? "branch"
        : edgeKind === "primary" && focusPathPairs.has(`${edge.source}→${edge.target}`)
        ? "branch"
        : "normal";
      renderableEdges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
        edgeKind,
        highlighted: isRouteEdge || edge.source === selectedId || edge.target === selectedId,
        emphasis,
        isFocusEndpoint,
        sourceRadius: radiusFor(edge.source),
        targetRadius: radiusFor(edge.target),
        stroke,
        strokeWidth: width,
        dim,
      });
    }

    const sourceGroups = new Map<string, Array<RenderableEdge & { side: RectPortSide }>>();
    const targetGroups = new Map<string, Array<RenderableEdge & { side: RectPortSide }>>();
    for (const edge of renderableEdges) {
      const sourceCenter = activeNodePositions.get(edge.source);
      const targetCenter = activeNodePositions.get(edge.target);
      if (!sourceCenter || !targetCenter) continue;
      const sourceSide = rectPortSideForVector(
        targetCenter.x - sourceCenter.x,
        targetCenter.y - sourceCenter.y,
      );
      const targetSide = rectPortSideForVector(
        sourceCenter.x - targetCenter.x,
        sourceCenter.y - targetCenter.y,
      );
      const sourceKey = `${edge.source}:${sourceSide}`;
      const targetKey = `${edge.target}:${targetSide}`;
      if (!sourceGroups.has(sourceKey)) sourceGroups.set(sourceKey, []);
      if (!targetGroups.has(targetKey)) targetGroups.set(targetKey, []);
      sourceGroups.get(sourceKey)!.push({ ...edge, side: sourceSide });
      targetGroups.get(targetKey)!.push({ ...edge, side: targetSide });
    }

    const sourceAnchorByEdge = new Map<string, { x: number; y: number }>();
    const targetAnchorByEdge = new Map<string, { x: number; y: number }>();
    const sortByCounterpart = (
      items: Array<RenderableEdge & { side: RectPortSide }>,
      role: "source" | "target",
    ) => items.sort((a, b) => {
      const aCounterpart = activeNodePositions.get(role === "source" ? a.target : a.source);
      const bCounterpart = activeNodePositions.get(role === "source" ? b.target : b.source);
      const axis = a.side === "left" || a.side === "right" ? "y" : "x";
      const delta = (aCounterpart?.[axis] ?? 0) - (bCounterpart?.[axis] ?? 0);
      return delta === 0 ? a.id.localeCompare(b.id) : delta;
    });
    for (const group of sourceGroups.values()) {
      const sorted = sortByCounterpart(group, "source");
      sorted.forEach((edge, index) => {
        const center = activeNodePositions.get(edge.source);
        if (!center) return;
        sourceAnchorByEdge.set(
          edge.id,
          rectPortPoint(center, edge.side, rectPortOffset(index, sorted.length, edge.side)),
        );
      });
    }
    for (const group of targetGroups.values()) {
      const sorted = sortByCounterpart(group, "target");
      sorted.forEach((edge, index) => {
        const center = activeNodePositions.get(edge.target);
        if (!center) return;
        targetAnchorByEdge.set(
          edge.id,
          rectPortPoint(center, edge.side, rectPortOffset(index, sorted.length, edge.side)),
        );
      });
    }

    const edges: FlowEdge<RadialEdgeData>[] = [];
    for (const edge of renderableEdges) {
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "radialEdge",
        data: {
          label: edge.relation,
          isFocusEndpoint: edge.isFocusEndpoint,
          edgeKind: edge.edgeKind,
          highlighted: edge.highlighted,
          emphasis: edge.emphasis,
          sourceRadius: edge.sourceRadius,
          targetRadius: edge.targetRadius,
          sourceAnchor: displayMode === "detail" ? sourceAnchorByEdge.get(edge.id) : undefined,
          targetAnchor: displayMode === "detail" ? targetAnchorByEdge.get(edge.id) : undefined,
          stroke: edge.stroke,
          strokeWidth: edge.strokeWidth,
          rootNodeId: currentRootId,
          dim: edge.dim,
        },
      });
    }
    return edges;
  }, [canvasGraph, workingGraph, focalSubtree, layout, selectedId, colorMode, focusPath, currentRootId, focalId, firstLayerSubsystemSet, childrenByParent, activeNodePositions, displayMode, routeHighlight, subset.edges, layerVisibleNodeIds]);

  const backgroundOuterR = useMemo(() => {
    let maxNodeR = 0;
    for (const [nodeId, point] of activeNodePositions) {
      if (!focalSubtree.has(nodeId)) continue;
      maxNodeR = Math.max(maxNodeR, Math.hypot(point.x, point.y) / PX_SCALE);
    }
    return Math.max(160, Math.ceil(maxNodeR + 18));
  }, [focalSubtree, activeNodePositions]);

  /**
   * Per-branch translucent background tint. Each first-layer subsystem
   * gets a stable hue-family wedge drawn under the nodes. The background
   * is structural only: it identifies subsystem families, but does not
   * change when the user switches line-colouring modes.
   */
  const sectorTintWedges = useMemo(() => {
    if (layout.sectors.size === 0) return [] as Array<{
      id: string;
      d: string;
      fill: string;
    }>;
    const wedges: Array<{ id: string; d: string; fill: string }> = [];
    const sortedSubs = [...layout.sectors.keys()].sort((a, b) => a.localeCompare(b));
    const R_INNER = 0;
    const R_OUTER = backgroundOuterR;
    for (const sub of sortedSubs) {
      const node = canvasGraph.nodes.find((n) => n.id === sub);
      if (!node) continue;
      const entry = layout.sectors.get(sub);
      if (!entry) continue;
      const hue = subsystemHue(sub, canvasGraph, currentRootId);
      const fill = `hsl(${hue.hue}, ${hue.saturation * 100}%, ${hue.lightness * 100}%)`;
      const startTheta = entry.center - entry.width / 2;
      const endTheta = entry.center + entry.width / 2;
      // Build an SVG path describing a wedge (annular sector with
      // R_INNER = 0 → just a triangle to the centre, then an arc).
      const px = (r: number, t: number) => ({
        x: svgNumber(r * PX_SCALE * Math.cos(t)),
        y: svgNumber(r * PX_SCALE * Math.sin(t)),
      });
      const p1 = px(R_INNER, startTheta);
      const p2 = px(R_OUTER, startTheta);
      const p3 = px(R_OUTER, endTheta);
      // Large-arc flag: focused sector subtends 120° (< 180°) so the
      // flag stays 0; but the test is robust to future widening.
      const largeArc = endTheta - startTheta > Math.PI ? 1 : 0;
      const d = [
        `M ${p1.x} ${p1.y}`,
        `L ${p2.x} ${p2.y}`,
        `A ${svgNumber(R_OUTER * PX_SCALE)} ${svgNumber(R_OUTER * PX_SCALE)} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
        `Z`,
      ].join(" ");
      wedges.push({ id: sub, d, fill });
    }
    return wedges;
  }, [layout.sectors, canvasGraph, currentRootId, backgroundOuterR]);

  const sectorLabels = useMemo(() => {
    const labels: Array<{
      id: string;
      x: number;
      y: number;
      rotate: number;
      label: string;
      dim: boolean;
    }> = [];
    const LABEL_R = backgroundOuterR + 10;
    const sortedSubs = [...layout.sectors.keys()].sort((a, b) => a.localeCompare(b));
    for (const sub of sortedSubs) {
      const entry = layout.sectors.get(sub);
      const node = canvasGraph.nodes.find((n) => n.id === sub);
      if (!entry || !node) continue;
      const theta = entry.center;
      const x = LABEL_R * PX_SCALE * Math.cos(theta);
      const y = LABEL_R * PX_SCALE * Math.sin(theta);
      let rotate = (theta * 180) / Math.PI;
      if (rotate > 90 && rotate < 270) rotate += 180;
      labels.push({
        id: sub,
        x,
        y,
        rotate,
        label: compactSectorLabel(nodeName(sub, node.name)),
        dim: false,
      });
    }
    return labels;
  }, [layout.sectors, canvasGraph.nodes, nodeName, backgroundOuterR]);

  const flowInstanceRef = useRef<ReactFlowInstance<FlowNode<RadialNodeData>, FlowEdge<RadialEdgeData>> | null>(null);
  const initialFitDoneRef = useRef(false);
  const readerFitNodes = useMemo(() => {
    const candidateIds = new Set<string>([currentRootId]);
    if (firstLayerSubsystems.length <= 6 || !readerStartNodeId) {
      for (const id of firstLayerSubsystems) candidateIds.add(id);
    }
    if (readerStartNodeId) {
      candidateIds.add(readerStartNodeId);
      for (const ancestor of focusPathForNode(readerStartNodeId, canvasGraph, currentRootId)) {
        candidateIds.add(ancestor);
      }
      if (firstLayerSubsystems.length <= 6) {
        for (const child of childrenByParent.get(readerStartNodeId) ?? []) {
          candidateIds.add(child);
        }
      }
    }
    const nodes: Array<{ id: string }> = [];
    for (const id of candidateIds) {
      if (!focalSubtree.has(id)) continue;
      if (!activeNodePositions.has(id)) continue;
      if (!layerVisibleNodeIds.has(id)) continue;
      nodes.push({ id });
    }
    return nodes.length > 1 ? nodes : [{ id: currentRootId }];
  }, [currentRootId, firstLayerSubsystems, readerStartNodeId, canvasGraph, childrenByParent, focalSubtree, activeNodePositions, layerVisibleNodeIds]);
  const focusFitNodes = useMemo(() => {
    const focusId = selectedId !== currentRootId ? selectedId : focusPath.at(-1);
    if (!focusId) return readerFitNodes;
    const candidateIds = new Set<string>([focusId]);
    const visibleChildren = (childrenByParent.get(focusId) ?? [])
      .filter((id) => focalSubtree.has(id) && activeNodePositions.has(id) && layerVisibleNodeIds.has(id))
      .slice(0, 3);
    for (const child of visibleChildren) candidateIds.add(child);

    const nodes: Array<{ id: string }> = [];
    for (const id of candidateIds) {
      if (!focalSubtree.has(id)) continue;
      if (!activeNodePositions.has(id)) continue;
      if (!layerVisibleNodeIds.has(id)) continue;
      nodes.push({ id });
    }
    return nodes.length > 0 ? nodes : [{ id: focusId }];
  }, [currentRootId, selectedId, focusPath, childrenByParent, focalSubtree, activeNodePositions, layerVisibleNodeIds, readerFitNodes]);
  const fitFullSystemView = useCallback((
    inst: ReactFlowInstance<FlowNode<RadialNodeData>, FlowEdge<RadialEdgeData>>,
    duration: number,
  ) => {
    inst.fitView({
      nodes: readerFitNodes,
      padding: 0.32,
      duration: 0,
      maxZoom: 0.72,
      minZoom: 0.18,
    });
    const viewport = inst.getViewport();
    inst.setViewport(
      {
        ...viewport,
        x: viewport.x,
        y: viewport.y + 12,
      },
      { duration },
    );
  }, [readerFitNodes]);

  // Fit the radial overview to the viewport once nodes are measured.
  // The radial layout spans roughly 1990×1597 unscaled px; at ReactFlow's
  // default scale(1) translate(0,0) the focal-subtree extends well past
  // the ~896×588 canvas so a first-time visitor sees an empty corner.
  // We call `fitView` after mount via the instance reference. The
  // `onInit` callback alone is not enough because ReactFlow measures
  // node dimensions on the next layout effect, so we retry a few times
  // with short delays (cheap; runs once on mount only) to cover the
  // race between the instance becoming available and node dimensions
  // being known. `check:graph-ux` forbids the boolean `fitView` prop
  // (which would re-fit on every render); imperative `instance.fitView`
  // calls run only when invoked.
  useEffect(() => {
    if (initialFitDoneRef.current) return;
    const inst = flowInstanceRef.current;
    if (!inst) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const fit = () => {
      if (initialFitDoneRef.current) return;
      try {
        fitFullSystemView(inst, 0);
        initialFitDoneRef.current = true;
      } catch {
        // ReactFlow may throw before nodes are measured; the next
        // scheduled attempt will retry.
      }
    };
    [0, 80, 240, 600].forEach((d) => timeouts.push(setTimeout(fit, d)));
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [flowNodes.length, fitFullSystemView]);

  const setGraphRoot = useCallback((nodeId: string) => {
    const resolved = resolveCanvasRootId(workingGraph, nodeId);
    if (!resolved) return;
    if (rootTransitionTimeoutRef.current) {
      clearTimeout(rootTransitionTimeoutRef.current);
    }
    setRootTransitioning(resolved !== currentRootId);
    setCurrentRootId(resolved);
    setSelectedId(resolved);
    setFocusPath([]);
    setRailPanel("route");
    rootTransitionTimeoutRef.current = setTimeout(() => {
      setRootTransitioning(false);
      rootTransitionTimeoutRef.current = null;
    }, 650);
  }, [currentRootId, workingGraph]);

  useEffect(() => {
    return () => {
      if (rootTransitionTimeoutRef.current) {
        clearTimeout(rootTransitionTimeoutRef.current);
      }
    };
  }, []);

  // Persist selection + focus path in URL so a learner can bookmark
  // / share a view.
  //
  // `?root=<id>` — current research root. Omitted for the canonical
  //   parcel-sorting product root.
  // `?focus=<id>` — selected node id (drives the detail panel).
  //   Omitted when selection is the current root.
  // `?path=<outer>[,<inner>[,<deeper>]]` — the canvas focus path
  //   (drives sector expansion + viewport zoom). Comma-separated so
  //   the URL stays human-readable and one parse restores the full
  //   stack. Omitted when path is empty (overview).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (currentRootId === DEFAULT_ROOT_NODE_ID) params.delete("root");
    else params.set("root", currentRootId);
    if (selectedId === currentRootId) params.delete("focus");
    else params.set("focus", selectedId);
    if (focusPath.length === 0) params.delete("path");
    else params.set("path", focusPath.join(","));
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [currentRootId, selectedId, focusPath]);

  // B2 + C1: Esc pops one level from the focus path (L2 → L1 → L0).
  // Document-level listener so a focused node does not need to hold
  // keyboard focus for the gesture to work.
  //
  // C2 coexistence rule: when the Cmd+K modal is open, the modal's own
  // Esc handler closes it first; we skip the focus-path pop so the
  // user's first Esc dismisses the modal without also collapsing the
  // sector behind it. Once the modal closes (next Esc), this listener
  // runs normally and pops the focus path.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (cmdKOpen) return;
        setFocusPath((prev) =>
          prev.length === 0 ? prev : prev.slice(0, prev.length - 1),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cmdKOpen]);

  // C2: global Cmd+K / Ctrl+K listener. The handler is a pure
  // dispatcher (`handleCmdKKeydown`) so the open/close logic stays
  // unit-testable without mounting the component. Esc closing the
  // modal is handled inside `CmdKSearch` (so the modal's keydown
  // captures Esc before the document-level rail listener above sees
  // it), but we also pass Esc through here as a safety net for the
  // case where the input loses focus.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => handleCmdKKeydown(e, setCmdKOpen);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Viewport "soft zoom" follows the reader's selected bottleneck.
  //   L0 (overview): fit the route overview.
  //   Focused selection: fit the selected node plus a small local
  //   downstream neighborhood so labels remain readable during exploration.
  // Geometry stays stable; only the viewport moves.
  useEffect(() => {
    const inst = flowInstanceRef.current;
    if (!inst) return;
    const hasSelectedFocus = selectedId !== currentRootId;
    if (focusPath.length === 0 && !hasSelectedFocus) {
      // Return to the full-system view while keeping route highlight as an overlay.
      try {
        fitFullSystemView(inst, 600);
      } catch {
        // Ignore: React Flow may not be ready immediately.
      }
      return;
    }
    if (focusPath.length > 0 || hasSelectedFocus) {
      const focusId = selectedId !== currentRootId ? selectedId : focusPath.at(-1);
      const focusPosition = focusId ? activeNodePositions.get(focusId) : null;
      const flowBounds = typeof document === "undefined"
        ? null
        : document.querySelector(".react-flow")?.getBoundingClientRect() ?? null;
      if (focusPosition && flowBounds) {
        const zoom = 0.96;
        try {
          inst.setViewport(
            {
              x: flowBounds.width / 2 - focusPosition.x * zoom,
              y: flowBounds.height / 2 - focusPosition.y * zoom,
              zoom,
            },
            { duration: 600 },
          );
          return;
        } catch {
          // Fall through to the viewport fallback below.
        }
      }
      try {
        inst.fitView({
          nodes: focusFitNodes,
          padding: 0.28,
          duration: 600,
          maxZoom: 0.96,
          minZoom: 0.42,
        });
      } catch {
        // Ignore: React Flow may not be ready immediately.
      }
      return;
    }
  }, [focusPath, fitFullSystemView, focusFitNodes, selectedId, currentRootId, activeNodePositions]);

  const selectedNode: Node = useMemo(
    () => workingGraph.nodes.find((n) => n.id === selectedId) ?? workingGraph.nodes[0],
    [workingGraph.nodes, selectedId],
  );
  const rootNode: Node | null = useMemo(
    () => workingGraph.nodes.find((n) => n.id === currentRootId) ?? null,
    [workingGraph.nodes, currentRootId],
  );
  const resetRootNode: Node | null = useMemo(
    () => workingGraph.nodes.find((n) => n.id === initialRootId) ?? null,
    [workingGraph.nodes, initialRootId],
  );
  const parentRootNode: Node | null = useMemo(() => {
    const parentId = parentResearchRootId(workingGraph, currentRootId, initialRootId);
    if (!parentId) return null;
    return workingGraph.nodes.find((node) => node.id === parentId) ?? null;
  }, [workingGraph, currentRootId, initialRootId]);
  const visibleAgentExpansionStatus =
    agentExpansionRootId === currentRootId ? agentExpansionStatus : "idle";
  const visibleAgentExpansionProgress =
    agentExpansionRootId === currentRootId ? agentExpansionProgress : null;
  return (
    <div className="graph-explorer-shell">
      <div className="graph-layout graph-layout-radial">
        <div className="graph-map-column">
          {rootNode && resetRootNode ? (
            <GraphProductStrip
              rootNode={rootNode}
              resetRootNode={resetRootNode}
              graphLayer={graphLayer}
              parentRootNode={parentRootNode}
              subsystemCount={firstLayerSubsystems.length}
              routeCount={activeRoute.steps.length}
              isCustomRoot={currentRootId !== initialRootId}
              operatorMode={operatorMode}
              agentExpansionStatus={visibleAgentExpansionStatus}
              agentExpansionProgress={visibleAgentExpansionProgress}
              exposureAccess={exposureAccess}
              onBackToParentRoot={() => {
                if (parentRootNode) setGraphRoot(parentRootNode.id);
              }}
              onResetRoot={() => setGraphRoot(initialRootId)}
              onRequestAgentExpansion={requestAgentExpansion}
            />
          ) : null}
          <div className="graph-toolbar-row" aria-label={t("layerToggleLabel")}>
            <LayerToggleFloatingButton
              layer={graphLayer}
              onSelect={setGraphLayer}
              labels={{ toggle: t("layerToggleLabel"), product: t("layerProduct"), knowHow: t("layerKnowHow") }}
            />
            <GraphControls
              routeMode={activeRoute.mode}
              analysisMode={colorMode}
              onAnalysisModeChange={setColorMode}
            />
          </div>
          <div
            className={[
              "graph-canvas graph-canvas-radial graph-canvas-route-led",
              rootTransitioning ? "graph-canvas-root-transitioning" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-flow-node-count={flowNodes.length}
            data-flow-edge-count={flowEdges.length}
          >
            <ReactFlowProvider>
              <ZoomBridge displayMode={displayMode}>
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onInit={(instance) => {
                    flowInstanceRef.current = instance;
                    // Try to fit immediately; if nodes aren't measured yet,
                    // the polling useEffect below retries with short
                    // delays. `requestAnimationFrame` lets React Flow's
                    // first measurement pass complete first.
                    if (typeof window !== "undefined") {
                      window.requestAnimationFrame(() => {
                        if (initialFitDoneRef.current) return;
                        try {
                          fitFullSystemView(instance, 0);
                          initialFitDoneRef.current = true;
                        } catch {
                          // Retry path in the useEffect below.
                        }
                      });
                    }
                  }}
                  fitViewOptions={{ maxZoom: 1.5, minZoom: 0.25, padding: 0.18 }}
                  minZoom={0.2}
                  maxZoom={2.5}
                  panOnScroll
                  panOnScrollMode={PanOnScrollMode.Free}
                  zoomOnPinch
                  zoomOnDoubleClick={false}
                  nodesDraggable={false}
                  onlyRenderVisibleElements={false}
                  onNodeClick={(_, node) => {
                    onSelect(node.id);
                  }}
                  onPaneClick={() => {
                    setSelectedId(currentRootId);
                    setFocusPath([]);
                    setRailPanel("route");
                  }}
                >
                  <Background />
                  <Controls />
                  {/* Sector tint (B1): translucent SVG wedge layer
                      rendered as a viewport overlay so it transforms
                      together with the radial canvas. The wedges sit
                      behind the React Flow node DOM via a fixed-position
                      SVG mounted as a sibling in the React Flow viewport,
                      rather than as a Background pattern, so they pick up
                      the same pan/zoom transform as the nodes. */}
                  <SectorTintLayer
                    wedges={sectorTintWedges}
                    backgroundOuterR={backgroundOuterR}
                  />
                  {displayMode === "detail" ? null : <SectorLabelLayer labels={sectorLabels} />}
                </ReactFlow>
              </ZoomBridge>
            </ReactFlowProvider>
          </div>
        </div>
        <RouteDetailRail
          graph={workingGraph}
          route={activeRoute}
          selectedNode={selectedNode}
          analysisMode={colorMode}
          graphLayer={graphLayer}
          priorityEntries={topPriorityEntries}
          exposureAccess={exposureAccess}
          systemNodeIds={firstLayerSubsystems}
          currentRootId={currentRootId}
          rootableNodeIds={rootableNodeIds}
          rootTransitioning={rootTransitioning}
          panel={railPanel}
          onPanelChange={setRailPanel}
          onSelectNode={onSelect}
          onSetRootNode={setGraphRoot}
        />
      </div>
      {/* C2: Cmd+K search modal. Mounted at the top level so the
          backdrop covers everything (canvas + rail + controls).
          Selecting a result both selects the node (rail content
          updates) and keeps the full-system map intact. */}
      <CmdKSearch
        graph={workingGraph}
        open={cmdKOpen}
        onClose={() => setCmdKOpen(false)}
        onSelect={(nodeId) => {
          onSelect(nodeId);
          setFocusPath([]);
        }}
      />
    </div>
  );
}

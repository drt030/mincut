"use client";

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useLanguage } from "./LanguageProvider";
import { RadialNode } from "./RadialNode";
import { RadialEdge } from "./RadialEdge";
import { ColorModeFloatingButton } from "./ColorModeFloatingButton";
import { radialBandFor } from "@/lib/lod";
import { radialLayout, type PolarPosition } from "@/lib/radialLayout";
import { subsystemHue } from "@/lib/subsystemHue";
import {
  bandForValue,
  edgeStyleFor,
  RAMP,
  nodeTypicalCostRmb,
  type ColorMode,
} from "@/lib/edgeStyleFor";
import { sectorAggregate } from "@/lib/sectorAggregate";
import { nodeRisk } from "@/lib/nodeRisk";
import type { GraphData, Node } from "@/lib/schema";

/**
 * Per ADR-0006 and the 2026-05-13 radial-progressive-disclosure spec
 * (slices A3 + A4), the `/graph` surface is a static radial overview of
 * the focal product's structural subtree. The chrome (mode tabs, KPI
 * row, pill banners, advanced filters, color-mode dropdown, page
 * heading, two-stage state machine) was deleted in slice A3 — the
 * canvas is the surface. Phase B will re-add focus interaction; Phase
 * B1 will add a floating color-mode button.
 *
 * Layout (A2): `radialLayout` returns polar `(r, theta)` for every
 * structural node; we convert to Cartesian and feed React Flow node
 * positions.
 *
 * Color (A3): `subsystemHue` returns the HSL family for a node id. The
 * focal product, materials, shared modules (>=2 requires parents in the
 * focal subtree), and orphans get neutral grey (saturation 0).
 *
 * LOD (A4): each node and edge renders one of three band variants
 * branched by `radialBandFor(zoom)`:
 *   Band 1 (z < 0.5)   — 5px dot, plain thin edge.
 *   Band 2 (.5–1.5)    — 12px circle with truncated label + outline;
 *                        edge gains an arrowhead.
 *   Band 3 (z ≥ 1.5)   — 80×40 HTML card; edge gains a relation label
 *                        when one endpoint is the focused node.
 *
 * To avoid each child component subscribing to the React Flow store
 * (and to keep `RadialNode` / `RadialEdge` testable in isolation
 * without a `<ReactFlow>` provider in scope), a single subscriber
 * inside `CanvasInner` reads the transform and broadcasts the
 * quantized zoom via React context. The quantization is
 * `Math.floor(zoom * 2)` per ADR-0006 §LOD — that integer value only
 * changes at band boundaries, so the context value is stable between
 * crossings and React Flow's re-renders don't thrash node/edge subtrees.
 */

const DOT_SIZE = 14; // wrapper box for band-1 hit-area (matches RadialNode band-1 SVG)
const BAND2_BOX = { width: 72, height: 42 } as const;
const BAND3_BOX = { width: 80, height: 40 } as const;

const ZoomContext = createContext<number>(1);

const transformSelector = (s: ReactFlowState) => s.transform[2];

type RadialNodeData = {
  id: string;
  name: string;
  kindLabel: string;
  fill: string;
  /** Per-node outline colour from the active colour mode (B1). */
  outlineColor: string;
  maturityLabel: string;
  selected: boolean;
  isFocal: boolean;
  onSelect: (nodeId: string) => void;
};

const RadialDotNode = memo(function RadialDotNode({ data }: NodeProps<FlowNode<RadialNodeData>>) {
  const zoom = useContext(ZoomContext);
  const band = radialBandFor(zoom);
  const box = band === 1 ? { width: DOT_SIZE, height: DOT_SIZE }
    : band === 2 ? BAND2_BOX
    : BAND3_BOX;
  return (
    <div
      className={["radial-dot", data.selected ? "selected" : "", data.isFocal ? "focal" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ width: box.width, height: box.height }}
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
        withHandles
      />
    </div>
  );
});

type RadialEdgeData = {
  label: string;
  isFocusEndpoint: boolean;
  /** Per-edge stroke + width from `edgeStyleFor` driven by colour mode. */
  stroke: string;
  strokeWidth: number;
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
      stroke={data?.stroke}
      strokeWidth={data?.strokeWidth}
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
 * `ZoomBridge` subscribes once to React Flow's transform via `useStore`,
 * quantizes to `Math.floor(zoom * 2)` per ADR-0006 §LOD so the context
 * value only mutates at band boundaries, and publishes via context. Must
 * live inside `<ReactFlowProvider>` (or `<ReactFlow>`) for `useStore` to
 * resolve.
 */
/**
 * `SectorTintLayer` renders the per-sector translucent K4 background
 * tint wedges (B1). The layer subscribes to React Flow's transform via
 * `useStore` so the wedges pan + zoom with the canvas. Mounted inside
 * `<ReactFlow>` as a child, it overlays the Background grid but stays
 * below node DOM via `pointerEvents: none` + an explicit `z-index: 0`.
 *
 * Wedge fill opacity is capped at ≤15% per ADR-0006 so the tint is a
 * background hint, not a competing surface. We use 12% (`0.12`) for a
 * touch of headroom.
 */
function SectorTintLayer({
  wedges,
}: {
  wedges: Array<{ id: string; d: string; fill: string }>;
}) {
  const transform = useStore((s) => s.transform);
  if (wedges.length === 0) return null;
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
            fillOpacity={0.12}
            stroke="none"
          />
        ))}
      </g>
    </svg>
  );
}

function ZoomBridge({ children }: { children: React.ReactNode }) {
  const rawZoom = useStore(transformSelector);
  // Quantize so the context value is stable between band crossings —
  // React's `===` equality on the context value means subscribers don't
  // re-render on every pan/zoom delta, only on band transitions.
  const quantized = Math.floor(rawZoom * 2);
  // Re-derive a representative zoom *inside* each band so radialBandFor
  // returns the right band. We use quantized/2 (the band's lower edge).
  const representative = quantized / 2;
  return <ZoomContext.Provider value={representative}>{children}</ZoomContext.Provider>;
}

const rootNodeId = "low_cost_parcel_sorting_robot_300k_rmb";

// Px scale: radialLayout returns abstract polar units (R1 = 100,
// R_STEP = 40, R_OUTER = R1 + (maxDepth+2)*R_STEP). Multiply by a
// pixel scale so the default viewport puts everything in ~600px box.
const PX_SCALE = 2.4;

type Props = {
  graph: GraphData;
};

/**
 * Compute the focal-subtree set: BFS from the first product node via
 * `requires` edges. Only nodes in this set are rendered on the canvas
 * in A3 — orphans (sibling products etc.) are deferred per ADR-0006.
 */
function buildFocalSubtree(graph: GraphData): Set<string> {
  const focal = graph.nodes.find((n) => n.kind === "product");
  if (!focal) return new Set();
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
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

export function GraphExplorer({ graph }: Props) {
  const { kindName, nodeName } = useLanguage();
  const searchParams = useSearchParams();

  // Initial selection: URL ?focus= if present and valid, otherwise the
  // focal product (so the detail panel starts on the canonical entry
  // point rather than nothing).
  const initialFocus = (() => {
    const raw = searchParams?.get("focus");
    if (raw && graph.nodes.some((n) => n.id === raw)) return raw;
    return rootNodeId;
  })();
  const [selectedId, setSelectedId] = useState(initialFocus);

  // B1: colour-mode state lives on the canvas wrapper so the floating
  // button can toggle modes and every node/edge re-renders against the
  // shared band thresholds.
  const [colorMode, setColorMode] = useState<ColorMode>("bottleneck-risk");
  const [colorModeExpanded, setColorModeExpanded] = useState(false);

  // Focal subtree — A3 renders only these nodes. Orphans (sibling
  // products) are hidden per spec.
  const focalSubtree = useMemo(() => buildFocalSubtree(graph), [graph]);

  // Radial layout positions in polar coords. Pure / deterministic per A2.
  const layout = useMemo(() => radialLayout(graph), [graph]);

  // Focal product id (used so the central dot can render slightly
  // larger as a visual anchor — optional emphasis per spec).
  const focalId = useMemo(
    () => graph.nodes.find((n) => n.kind === "product")?.id ?? null,
    [graph],
  );

  const onSelect = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
  }, []);

  // First-layer subsystems for the sector-tint background layer (B1).
  const firstLayerSubsystems = useMemo(() => {
    const out: string[] = [];
    for (const edge of graph.edges) {
      if (edge.relation !== "requires") continue;
      if (edge.source !== rootNodeId) continue;
      const target = graph.nodes.find((n) => n.id === edge.target);
      if (!target || target.kind === "material") continue;
      out.push(edge.target);
    }
    return out;
  }, [graph]);

  /**
   * Per-node outline colour from the active colour mode. Pure function
   * of (node, mode, graph); memoised across the node iteration below.
   */
  const outlineColorFor = useCallback(
    (node: Node): string => {
      switch (colorMode) {
        case "relation":
          return "#888";
        case "cost": {
          const cost = nodeTypicalCostRmb(node, graph) ?? 0;
          return RAMP[bandForValue(cost, "cost", graph) - 1];
        }
        case "maturity": {
          if (typeof node.maturityScore !== "number") return "#888";
          return RAMP[bandForValue(node.maturityScore, "maturity") - 1];
        }
        case "bottleneck-risk": {
          if (Array.isArray(node.bottleneckOf) && node.bottleneckOf.length > 0) {
            return RAMP[4];
          }
          const risk = nodeRisk(node, graph);
          return RAMP[bandForValue(risk, "bottleneck-risk") - 1];
        }
        case "overall": {
          if (Array.isArray(node.bottleneckOf) && node.bottleneckOf.length > 0) {
            return RAMP[4];
          }
          const risk = nodeRisk(node, graph);
          return RAMP[bandForValue(risk, "overall") - 1];
        }
        default:
          return "#888";
      }
    },
    [colorMode, graph],
  );

  const flowNodes: FlowNode<RadialNodeData>[] = useMemo(() => {
    const nodes: FlowNode<RadialNodeData>[] = [];
    for (const node of graph.nodes) {
      if (!focalSubtree.has(node.id)) continue;
      const polar = layout.positions.get(node.id);
      if (!polar) continue;
      const { x, y } = polarToCartesian(polar);
      const hue = subsystemHue(node.id, graph);
      const fill = `hsl(${hue.hue}, ${hue.saturation * 100}%, ${hue.lightness * 100}%)`;
      const isFocal = node.id === focalId;
      nodes.push({
        id: node.id,
        type: "radialDot",
        // Center the dot on (x, y) using the band-1 footprint. Band 2/3
        // grow inside the wrapper so the layout position stays stable
        // across zoom (positions are computed once and never moved per
        // ADR-0006).
        position: { x: x - DOT_SIZE / 2, y: y - DOT_SIZE / 2 },
        data: {
          id: node.id,
          name: nodeName(node.id, node.name),
          kindLabel: kindName(node.kind),
          fill,
          outlineColor: outlineColorFor(node),
          maturityLabel: node.maturityLabel ?? "",
          selected: selectedId === node.id,
          isFocal,
          onSelect,
        },
        draggable: false,
        selectable: true,
      });
    }
    return nodes;
  }, [graph, focalSubtree, layout, focalId, kindName, nodeName, selectedId, onSelect, outlineColorFor]);

  const flowEdges: FlowEdge<RadialEdgeData>[] = useMemo(() => {
    const edges: FlowEdge<RadialEdgeData>[] = [];
    for (const edge of graph.edges) {
      if (edge.relation !== "requires") continue;
      if (!focalSubtree.has(edge.source) || !focalSubtree.has(edge.target)) continue;
      // Only render edges whose target was actually laid out (defensive
      // — radialLayout assigns every reachable structural node a
      // position, but descriptive subtree members are skipped).
      if (!layout.positions.has(edge.source) || !layout.positions.has(edge.target)) continue;
      // A4 wires `isFocusEndpoint` to the current selection; Phase B
      // will replace `selectedId` with a richer focus state.
      const isFocusEndpoint = edge.source === selectedId || edge.target === selectedId;
      const { stroke, width } = edgeStyleFor(edge, colorMode, graph);
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "radialEdge",
        data: {
          label: edge.relation,
          isFocusEndpoint,
          stroke,
          strokeWidth: width,
        },
      });
    }
    return edges;
  }, [graph, focalSubtree, layout, selectedId, colorMode]);

  /**
   * Per-sector translucent background tint. Each first-layer subsystem
   * gets a wedge-shaped path drawn under the nodes. The wedge fill is
   * the sector's K4-band colour at ≤15% opacity per the ADR (we use
   * 12% for headroom). When the layout has no first-layer sectors
   * (e.g. fixture with no product node), the sector layer is empty.
   */
  const sectorTintWedges = useMemo(() => {
    if (firstLayerSubsystems.length === 0) return [] as Array<{
      id: string;
      d: string;
      fill: string;
    }>;
    const wedges: Array<{ id: string; d: string; fill: string }> = [];
    const N = firstLayerSubsystems.length;
    const sortedSubs = [...firstLayerSubsystems].sort((a, b) => a.localeCompare(b));
    // Match radialLayout's R_OUTER computation: outer ring is roughly
    // R1 + (maxDepth + 2) * R_STEP. We use a generous upper radius
    // (R1 + 10 * R_STEP) so the wedge always covers the entire sector.
    const R_INNER = 0;
    const R_OUTER = 500; // generous bound in layout units
    for (let i = 0; i < N; i += 1) {
      const sub = sortedSubs[i];
      const node = graph.nodes.find((n) => n.id === sub);
      if (!node) continue;
      const { band } = sectorAggregate(sub, colorMode, graph);
      const fill = colorMode === "relation" ? "transparent" : RAMP[band - 1];
      const startTheta = (i / N) * 2 * Math.PI;
      const endTheta = ((i + 1) / N) * 2 * Math.PI;
      // Build an SVG path describing a wedge (annular sector with
      // R_INNER = 0 → just a triangle to the centre, then an arc).
      const px = (r: number, t: number) => ({
        x: r * PX_SCALE * Math.cos(t),
        y: r * PX_SCALE * Math.sin(t),
      });
      const p1 = px(R_INNER, startTheta);
      const p2 = px(R_OUTER, startTheta);
      const p3 = px(R_OUTER, endTheta);
      // Large-arc flag = 0 because each sector subtends < 180° for N ≥ 3.
      const largeArc = endTheta - startTheta > Math.PI ? 1 : 0;
      const d = [
        `M ${p1.x} ${p1.y}`,
        `L ${p2.x} ${p2.y}`,
        `A ${R_OUTER * PX_SCALE} ${R_OUTER * PX_SCALE} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
        `Z`,
      ].join(" ");
      wedges.push({ id: sub, d, fill });
    }
    return wedges;
  }, [firstLayerSubsystems, graph, colorMode]);

  const flowInstanceRef = useRef<ReactFlowInstance<FlowNode<RadialNodeData>, FlowEdge<RadialEdgeData>> | null>(null);
  const initialFitDoneRef = useRef(false);

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
        inst.fitView({ padding: 0.18, duration: 0, maxZoom: 1.5, minZoom: 0.25 });
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
  }, [flowNodes.length]);

  // Persist selection in URL so a learner can bookmark / share a view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (selectedId === rootNodeId) params.delete("focus");
    else params.set("focus", selectedId);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [selectedId]);

  const selectedNode: Node = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? graph.nodes[0],
    [graph.nodes, selectedId],
  );

  return (
    <div>
      <div className="graph-layout graph-layout-radial">
        <div className="graph-canvas graph-canvas-radial">
          <ReactFlowProvider>
            <ZoomBridge>
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
                        instance.fitView({ padding: 0.18, duration: 0, maxZoom: 1.5, minZoom: 0.25 });
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
                onNodeClick={(_, node) => {
                  setSelectedId(node.id);
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
                <SectorTintLayer wedges={sectorTintWedges} />
              </ReactFlow>
            </ZoomBridge>
          </ReactFlowProvider>
        </div>
        <NodeDetailPanel
          graph={graph}
          node={selectedNode}
          onSelectNode={(id) => {
            setSelectedId(id);
          }}
        />
      </div>
      {/* B1: colour-mode floating button (fixed bottom-left). Lives
          outside the ReactFlow canvas so the fixed positioning survives
          ReactFlow's viewport transform. */}
      <ColorModeFloatingButton
        mode={colorMode}
        expanded={colorModeExpanded}
        onSelect={(next) => {
          setColorMode(next);
          setColorModeExpanded(false);
        }}
        onToggle={() => setColorModeExpanded((prev) => !prev)}
      />
    </div>
  );
}

"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Background,
  Controls,
  PanOnScrollMode,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useLanguage } from "./LanguageProvider";
import { radialLayout, type PolarPosition } from "@/lib/radialLayout";
import { subsystemHue } from "@/lib/subsystemHue";
import type { GraphData, Node } from "@/lib/schema";

/**
 * Per ADR-0006 and the 2026-05-13 radial-progressive-disclosure spec
 * (slice A3), the `/graph` surface is a static radial overview of the
 * focal product's structural subtree. The chrome (mode tabs, KPI row,
 * pill banners, advanced filters, color-mode dropdown, page
 * heading, two-stage state machine) was deleted in this slice — the
 * canvas is the surface. Phase B will re-add focus interaction,
 * Phase B1 will add a floating color-mode button.
 *
 * Layout: `radialLayout` returns polar `(r, theta)` for every
 * structural node; we convert to Cartesian and feed React Flow node
 * positions.
 *
 * Color: `subsystemHue` returns the HSL family for a node id. The
 * focal product, materials, shared modules (>=2 requires parents in
 * the focal subtree), and orphans get neutral grey (saturation 0).
 *
 * Rendering: each node is a 5px SVG circle inside a tiny foreignObject
 * (React Flow node API uses an HTML wrapper). A4 will expand this with
 * 12px / 80x40 band-2/3 variants via a LOD subscriber. A3 ships band 1
 * only.
 */

const DOT_SIZE = 14; // wrapper box; the actual visible circle is 10px diameter
const FOCAL_DOT_SIZE = 18; // slight emphasis for the focal product

type RadialNodeData = {
  id: string;
  name: string;
  kindLabel: string;
  fill: string;
  selected: boolean;
  isFocal: boolean;
  onSelect: (nodeId: string) => void;
};

const RadialDotNode = memo(function RadialDotNode({ data }: NodeProps<FlowNode<RadialNodeData>>) {
  const size = data.isFocal ? FOCAL_DOT_SIZE : DOT_SIZE;
  const radius = data.isFocal ? 7 : 5;
  return (
    <div
      className={["radial-dot", data.selected ? "selected" : "", data.isFocal ? "focal" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
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
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill={data.fill} stroke="#0f172a" strokeWidth={data.selected ? 1.5 : 0.5} />
      </svg>
    </div>
  );
});

const nodeTypes = {
  radialDot: RadialDotNode,
};

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
      const size = isFocal ? FOCAL_DOT_SIZE : DOT_SIZE;
      nodes.push({
        id: node.id,
        type: "radialDot",
        // Center the dot on (x, y): React Flow positions the top-left
        // of the wrapper, so subtract half the wrapper size.
        position: { x: x - size / 2, y: y - size / 2 },
        data: {
          id: node.id,
          name: nodeName(node.id, node.name),
          kindLabel: kindName(node.kind),
          fill,
          selected: selectedId === node.id,
          isFocal,
          onSelect,
        },
        style: { width: size, height: size },
        draggable: false,
        selectable: true,
      });
    }
    return nodes;
  }, [graph, focalSubtree, layout, focalId, kindName, nodeName, selectedId, onSelect]);

  const flowEdges: FlowEdge[] = useMemo(() => {
    const edges: FlowEdge[] = [];
    for (const edge of graph.edges) {
      if (edge.relation !== "requires") continue;
      if (!focalSubtree.has(edge.source) || !focalSubtree.has(edge.target)) continue;
      // Only render edges whose target was actually laid out (defensive
      // — radialLayout assigns every reachable structural node a
      // position, but descriptive subtree members are skipped).
      if (!layout.positions.has(edge.source) || !layout.positions.has(edge.target)) continue;
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "straight",
        // Thin grey 1px lines per spec; B1 will reintroduce color
        // mode rendering.
        style: { stroke: "#cbd5e1", strokeWidth: 1 },
      });
    }
    return edges;
  }, [graph, focalSubtree, layout]);

  const flowInstanceRef = useRef<ReactFlowInstance<FlowNode<RadialNodeData>, FlowEdge> | null>(null);
  const initialFitDoneRef = useRef(false);

  // Fit the radial overview to the viewport once nodes are measured.
  useEffect(() => {
    if (initialFitDoneRef.current) return;
    const inst = flowInstanceRef.current;
    if (!inst) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const fit = () => {
      const btn = document.querySelector<HTMLButtonElement>(".react-flow__controls-fitview");
      if (!btn) return;
      btn.click();
      initialFitDoneRef.current = true;
    };
    [80, 240, 600].forEach((d) => timeouts.push(setTimeout(fit, d)));
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
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              flowInstanceRef.current = instance;
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
          </ReactFlow>
        </div>
        <NodeDetailPanel
          graph={graph}
          node={selectedNode}
          onSelectNode={(id) => {
            setSelectedId(id);
          }}
        />
      </div>
    </div>
  );
}

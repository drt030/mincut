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
import { sectorAngles, type SectorAngleAssignment } from "@/lib/sectorAngles";
import { applySectorAngles } from "@/lib/applySectorAngles";
import { focusedSubset } from "@/lib/focusedSubset";
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
  /**
   * B3: true when this node falls outside the focused `requires`
   * subtree (or when there is no focus and the node is otherwise
   * out-of-scope — never the case in current data). The radial-dim
   * class applies a `filter: saturate(0)` over a 400ms transition so
   * the cross-fade between focus changes feels smooth.
   */
  dim: boolean;
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
      className={[
        "radial-dot",
        data.selected ? "selected" : "",
        data.isFocal ? "focal" : "",
        data.dim ? "radial-dim" : "",
      ]
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
  /**
   * B3: true when at least one endpoint is outside the focused
   * `requires` subtree. The `.radial-dim` class wraps the SVG `<g>`
   * so `filter: saturate(0)` desaturates the stroke + arrowhead
   * uniformly with the node fade.
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
      stroke={data?.stroke}
      strokeWidth={data?.strokeWidth}
      dim={data?.dim ?? false}
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
 * mirrors the dual-direction logic in `sectorAngles` /
 * `applySectorAngles`.
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
    const raw = searchParams?.get("path");
    if (!raw) return [];
    const ids = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (ids.length === 0) return [];
    const known = new Set(graph.nodes.map((n) => n.id));
    if (!ids.every((id) => known.has(id))) return [];
    return ids;
  });
  // Back-compat alias for code that still references a single focused
  // id (e.g. greyscale dim flag, sector-tint colour, viewport math).
  const focusedId = focusPath.length > 0 ? focusPath[0] : null;

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

  // First-layer subsystems for the sector-tint background layer (B1)
  // and B2 elastic angle assignment. Order-independent: B2 sorts by id
  // internally; the tint layer also sorts before rendering.
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

  // B2: build a `nodeId → first-layer-ancestor-id` lookup once per
  // graph so the click handler can map any descendant click to the
  // sector it belongs to. The same canonical-parent rule used by
  // `radialLayout` / `subsystemHue` / `applySectorAngles` applies:
  // smallest sector index wins for shared nodes.
  const firstLayerAncestorById = useMemo(() => {
    const childrenByParent = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (edge.relation !== "requires") continue;
      if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
      childrenByParent.get(edge.source)!.push(edge.target);
    }
    const sortedFirstLayer = [...firstLayerSubsystems].sort();
    const sectorIndex = new Map<string, number>();
    sortedFirstLayer.forEach((id, i) => sectorIndex.set(id, i));
    const ancestorById = new Map<string, string>();
    for (const sub of sortedFirstLayer) {
      const visited = new Set<string>();
      const queue: string[] = [sub];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        const existing = ancestorById.get(cur);
        if (existing === undefined || sectorIndex.get(sub)! < sectorIndex.get(existing)!) {
          ancestorById.set(cur, sub);
        }
        for (const child of childrenByParent.get(cur) ?? []) {
          if (visited.has(child)) continue;
          queue.push(child);
        }
      }
    }
    for (const sub of sortedFirstLayer) ancestorById.set(sub, sub);
    return ancestorById;
  }, [graph, firstLayerSubsystems]);

  // B2 + C1: per-render angle assignment driven by `focusPath`. No
  // focus → 14 equal sectors (matches A3 behaviour bit-for-bit). L1
  // → 120° expanded + (4π/3)/(N-1) compressed siblings. L2 → inner
  // 80°/40° split within the focused outer 120°. L3+ no geometry
  // change (handled inside sectorAngles).
  const sectorAssignment: SectorAngleAssignment = useMemo(
    () => sectorAngles(firstLayerSubsystems, focusPath, graph),
    [firstLayerSubsystems, focusPath, graph],
  );

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

  // B2: effective positions = static `layout.positions` remapped via
  // the current sector assignment. With no focus, this is identical
  // to `layout.positions` (every node falls in its default sector and
  // the new sector range equals the old). With focus, descendants of
  // the focused sector spread across 120°; siblings compress.
  const effectivePositions = useMemo(
    () => applySectorAngles(layout.positions, graph, sectorAssignment),
    [layout.positions, graph, sectorAssignment],
  );

  // B3: focused-subtree membership (focusedId + its `requires`
  // descendants). With `focusedId === null` every node + every edge
  // is in the set — the overview reads "everything bright". The
  // memoised result becomes the source-of-truth for the per-node
  // and per-edge `dim` flag below; flipping the flag triggers the
  // 400ms saturate(0) CSS transition on `.radial-dim`.
  const subset = useMemo(
    () => focusedSubset(focusedId, graph),
    [focusedId, graph],
  );

  const flowNodes: FlowNode<RadialNodeData>[] = useMemo(() => {
    const nodes: FlowNode<RadialNodeData>[] = [];
    for (const node of graph.nodes) {
      if (!focalSubtree.has(node.id)) continue;
      const polar = effectivePositions.get(node.id);
      if (!polar) continue;
      const { x, y } = polarToCartesian(polar);
      const hue = subsystemHue(node.id, graph);
      const fill = `hsl(${hue.hue}, ${hue.saturation * 100}%, ${hue.lightness * 100}%)`;
      const isFocal = node.id === focalId;
      // B3: dim every node outside the focused subtree. With no focus
      // (`focusedId === null`), `subset.nodes` contains every node id
      // so `dim` is always false — the overview stays fully
      // saturated.
      const dim = focusedId !== null && !subset.nodes.has(node.id);
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
          dim,
          onSelect,
        },
        draggable: false,
        selectable: true,
      });
    }
    return nodes;
  }, [graph, focalSubtree, effectivePositions, focalId, kindName, nodeName, selectedId, onSelect, outlineColorFor, focusedId, subset]);

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
      // B3: dim an edge when at least one endpoint falls outside the
      // focused subtree. `subset.edges` is the canonical
      // both-endpoints-in set, so membership check is direct. With no
      // focus, every edge is in `subset.edges` and `dim` stays false.
      const dim = focusedId !== null && !subset.edges.has(edge.id);
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
          dim,
        },
      });
    }
    return edges;
  }, [graph, focalSubtree, layout, selectedId, colorMode, focusedId, subset]);

  /**
   * Per-sector translucent background tint. Each first-layer subsystem
   * gets a wedge-shaped path drawn under the nodes. The wedge fill is
   * the sector's K4-band colour at ≤15% opacity per the ADR (we use
   * 12% for headroom). Slice B2 drives the wedge angles from
   * `sectorAssignment` so the tint expands and contracts in lockstep
   * with the elastic sector when a node is focused. With no focus the
   * 14 wedges are equal-width and identical to the A3 layout.
   */
  const sectorTintWedges = useMemo(() => {
    if (sectorAssignment.angles.size === 0) return [] as Array<{
      id: string;
      d: string;
      fill: string;
    }>;
    const wedges: Array<{ id: string; d: string; fill: string }> = [];
    const sortedSubs = [...sectorAssignment.angles.keys()].sort((a, b) => a.localeCompare(b));
    // Match radialLayout's R_OUTER computation: outer ring is roughly
    // R1 + (maxDepth + 2) * R_STEP. We use a generous upper radius
    // (R1 + 10 * R_STEP) so the wedge always covers the entire sector.
    const R_INNER = 0;
    const R_OUTER = 500; // generous bound in layout units
    for (const sub of sortedSubs) {
      const node = graph.nodes.find((n) => n.id === sub);
      if (!node) continue;
      const entry = sectorAssignment.angles.get(sub);
      if (!entry) continue;
      const { band } = sectorAggregate(sub, colorMode, graph);
      const fill = colorMode === "relation" ? "transparent" : RAMP[band - 1];
      const startTheta = entry.center - entry.width / 2;
      const endTheta = entry.center + entry.width / 2;
      // Build an SVG path describing a wedge (annular sector with
      // R_INNER = 0 → just a triangle to the centre, then an arc).
      const px = (r: number, t: number) => ({
        x: r * PX_SCALE * Math.cos(t),
        y: r * PX_SCALE * Math.sin(t),
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
        `A ${R_OUTER * PX_SCALE} ${R_OUTER * PX_SCALE} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
        `Z`,
      ].join(" ");
      wedges.push({ id: sub, d, fill });
    }
    return wedges;
  }, [sectorAssignment, graph, colorMode]);

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

  // Persist selection + focus path in URL so a learner can bookmark
  // / share a view.
  //
  // `?focus=<id>` — selected node id (drives the detail panel).
  //   Omitted when selection is the canonical root.
  // `?path=<outer>[,<inner>[,<deeper>]]` — the canvas focus path
  //   (drives sector expansion + viewport zoom). Comma-separated so
  //   the URL stays human-readable and one parse restores the full
  //   stack. Omitted when path is empty (overview).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (selectedId === rootNodeId) params.delete("focus");
    else params.set("focus", selectedId);
    if (focusPath.length === 0) params.delete("path");
    else params.set("path", focusPath.join(","));
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [selectedId, focusPath]);

  // B2 + C1: Esc pops one level from the focus path (L2 → L1 → L0).
  // Document-level listener so a focused node does not need to hold
  // keyboard focus for the gesture to work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocusPath((prev) =>
          prev.length === 0 ? prev : prev.slice(0, prev.length - 1),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // B2 + C1: viewport "soft zoom" stepped per focus level.
  //   L0 (overview): fitView.
  //   L1: zoom 1.5× toward the focused sector's mid-ring.
  //   L2: zoom 2.25× (1.5²) toward the focused inner sub-subsystem.
  //   L3+: zoom 3.0× toward the deepest path element.
  // setViewport easing duration = 600ms each, matching ADR-0006.
  useEffect(() => {
    const inst = flowInstanceRef.current;
    if (!inst) return;
    if (focusPath.length === 0) {
      // Return to fit-all overview.
      try {
        inst.fitView({ padding: 0.18, duration: 600, maxZoom: 1.5, minZoom: 0.25 });
      } catch {
        // Ignore: React Flow may not be ready immediately.
      }
      return;
    }
    // Pick the (theta, r) target by level.
    const outerId = focusPath[0];
    const outerEntry = sectorAssignment.angles.get(outerId);
    if (!outerEntry) return;
    let targetTheta = outerEntry.center;
    let targetR = 160; // L1 default: midway through descendants
    let zoom = 1.5;
    if (focusPath.length >= 2) {
      const innerId = focusPath[1];
      const innerMap = sectorAssignment.subSectorAngles?.get(outerId);
      const innerEntry = innerMap?.get(innerId);
      if (innerEntry) {
        targetTheta = innerEntry.center;
        targetR = 200; // a touch further out so the inner subtree fills the view
      }
      zoom = 2.25;
    }
    if (focusPath.length >= 3) {
      zoom = 3.0;
      // For deeper levels we still centre on the inner sub-sector
      // direction; reading the actual clicked node's polar position
      // would require effectivePositions, which is already memoised
      // by the time this effect runs — but adding it as a dep would
      // re-fire on every layout tick. Centring on the inner sector
      // angle at a deeper radius reads as "zooming into the same
      // direction", which matches the ADR's "geometry no longer
      // changes; only viewport zoom" wording.
      targetR = 240;
    }
    const cx = targetR * PX_SCALE * Math.cos(targetTheta);
    const cy = targetR * PX_SCALE * Math.sin(targetTheta);
    // Half-viewport guess; React Flow doesn't expose the container
    // bounds synchronously for non-fit transitions. Slightly-off
    // centring is acceptable per ADR-0006 ("soft" zoom).
    const W_HALF = 448;
    const H_HALF = 294;
    try {
      inst.setViewport(
        { x: W_HALF - cx * zoom, y: H_HALF - cy * zoom, zoom },
        { duration: 600 },
      );
    } catch {
      // Ignore: React Flow may throw before nodes are measured.
    }
  }, [focusPath, sectorAssignment]);

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
                  // B2 + C1: progressive-disclosure click rules.
                  const ancestor = firstLayerAncestorById.get(node.id);
                  if (ancestor === undefined) return; // out-of-subtree click
                  setFocusPath((prev) => {
                    // L0 → L1: any click sets path to [outerAncestor].
                    if (prev.length === 0) return [ancestor];
                    // Cross-sector click at any level: reset to the
                    // new outer's L1. (No camera jump rule per ADR;
                    // the viewport effect below animates softly.)
                    if (ancestor !== prev[0]) return [ancestor];
                    // Same outer sector. If clicking the outer dot
                    // itself, stay at L1 (avoid pushing the outer as
                    // its own inner).
                    if (node.id === ancestor) return prev;
                    // L1 → L2: push the direct sub-subsystem of the
                    // outer that's the clicked node OR an ancestor
                    // of it. We use the inner-child enumeration from
                    // sectorAssignment.subSectorAngles when present
                    // (so the inner child set matches the geometry).
                    if (prev.length === 1) {
                      const innerChild = innerChildContaining(
                        node.id,
                        ancestor,
                        graph,
                      );
                      if (innerChild === null) return prev;
                      return [ancestor, innerChild];
                    }
                    // L2 → L3+: push the clicked node id for deeper
                    // viewport zoom. Geometry stays at L2 per the
                    // sectorAngles contract.
                    if (prev.length === 2) {
                      if (node.id === prev[1]) return prev;
                      return [ancestor, prev[1], node.id];
                    }
                    // L3+: replace the deepest element with the new
                    // click so the viewport target updates.
                    if (node.id === prev[prev.length - 1]) return prev;
                    return [...prev.slice(0, prev.length - 1), node.id];
                  });
                }}
                onPaneClick={() => {
                  // B2 + C1: empty-canvas click pops one level
                  // (Esc-equivalent). [] stays at overview.
                  setFocusPath((prev) =>
                    prev.length === 0 ? prev : prev.slice(0, prev.length - 1),
                  );
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
            // Esc / explicit close passes `null`; the radial canvas
            // doesn't have a "no focus" mode yet, so clearing falls
            // back to the root focal node. This keeps the wiring
            // contract honest (the panel can ask to clear) without
            // forcing GraphExplorer state to learn `null`.
            setSelectedId(id ?? rootNodeId);
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

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
import { maturityAsOfVisualFor, maturityVisualFor } from "@/lib/maturityVisual";
import { formatMetricValue } from "@/lib/metricValueFormat";
import { isDecompositionFrontier } from "@/lib/graphTraversal";
import type { Edge, EdgeRelation, GraphData, MetricCurrency, MetricValue, Node, NodeKind } from "@/lib/schema";

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

type GraphPoint = { x: number; y: number };

type FoldedMetricEntry = {
  id: string;
  name: string;
  unit?: string;
  // Per ADR-0003 the metric value union accepts a `{min, typical, max}`
  // range in addition to scalar number/string. Range rendering happens via
  // the shared `formatMetricValue` helper (compact form for the strip,
  // full form for the detail panel).
  currentValue?: MetricValue;
  targetValue?: MetricValue;
  /** Per ADR-0003: year the cost (or other time-sensitive) reading is stated in. */
  costAsOf?: string;
  /** Per ADR-0003: explicit currency for cost-bearing metrics. */
  currency?: MetricCurrency;
  /** Pre-computed: true iff this metric is cost-bearing — drives costAsOf pill. */
  isCostBearing: boolean;
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
  isBottleneck: boolean;
  isAlternativeSibling: boolean;
  isHardToDevelop: boolean;
  hardToDevelopTooltip: string;
  isFrontier: boolean;
  frontierTooltip: string;
  bottleneckedByCount: number;
  bottleneckedByTooltip: string;
  maturityPillLabel: string;
  maturityPillBg: string;
  maturityPillFg: string;
  maturityPillHasLabel: boolean;
  asOfPillLabel: string;
  asOfPillHasValue: boolean;
  asOfPillTooltip: string;
  selectedMetricId?: string;
  foldedMetrics: FoldedMetricEntry[];
  /**
   * Per iter-44 a11y audit, the metric chip strip uses role="group" with
   * an `aria-label` so SR users hear "metric chips, group" before the
   * individual chip buttons. Localized at flowNodes-build time so the
   * label switches with the language toggle.
   */
  metricsStripLabel: string;
  /**
   * Per iter-15 review (P1 #5), the metric chip tooltip and the chip
   * `costAsOf` micro-pill route through `t()` so zh-mode users no longer
   * see hardcoded English (`Cost as of 2024`, `current: …, target: …`).
   * `t` is captured at flowNodes-build time and passed through node data
   * because the inner `CapabilityNode` is a `memo`'d render-time component
   * that doesn't have access to `useLanguage()` directly.
   */
  formatMetricChipTooltip: (metric: FoldedMetricEntry) => string;
  formatCostAsOfChipTooltip: (year: string) => string;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onSelectMetric: (metricId: string) => void;
};

const nodeTypes = {
  capability: memo(function CapabilityNode({ data }: NodeProps<FlowNode<CapabilityNodeData>>) {
    const showWarningGlyph = data.isBottleneck || data.bottleneckedByCount > 0;
    const glyphTooltip = data.isBottleneck ? data.kindLabel : data.bottleneckedByTooltip;
    const pillStyle: CSSProperties = {
      background: data.maturityPillBg,
      color: data.maturityPillFg,
      opacity: data.maturityPillHasLabel ? 1 : 0.65,
    };
    // Per iter-43 a11y audit: graph node cards are interactive (onClick selects,
    // onDoubleClick toggles expansion) but the React Flow wrapper announces
    // "group" with no accessible name. We expose the card itself as a button
    // with a composed aria-label so SR users hear node name + kind + maturity,
    // and KB users can Tab to the card and activate via Enter / Space.
    const ariaLabel = [data.name, data.kindLabel, data.maturityPillLabel]
      .filter((part) => part && part.length > 0)
      .join(" · ");
    return (
      <div
        className={[
          "graph-node-card",
          data.selected ? "selected" : "",
          data.related ? "related" : "",
          data.risk ? "risk" : "",
          data.isBottleneck ? "is-bottleneck" : "",
          data.isAlternativeSibling && !data.selected ? "alt-sibling" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--node-color": data.color } as CSSProperties}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-pressed={data.selected}
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
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            data.onSelect(data.id);
            data.onToggle(data.id);
          } else if (event.key === " " || event.key === "Spacebar") {
            event.preventDefault();
            event.stopPropagation();
            data.onSelect(data.id);
          }
        }}
      >
        <Handle className="graph-node-handle" type="target" position={Position.Left} />
        {/*
         * Per iter-45 a11y audit (MINOR): glyph spans gain role="img" so
         * AT explicitly announces them as image-with-alt-equivalent text
         * (the aria-label) instead of the raw emoji + the aria-label
         * (which some screen readers double-announce). The role makes
         * the alt-text contract explicit.
         */}
        {data.isHardToDevelop ? (
          <span
            className="graph-node-key-glyph"
            role="img"
            title={data.hardToDevelopTooltip}
            aria-label={data.hardToDevelopTooltip}
          >
            🔑
          </span>
        ) : null}
        {showWarningGlyph ? (
          <span
            className={["graph-node-warning-glyph", data.isBottleneck ? "self" : "downstream"].join(" ")}
            role="img"
            title={glyphTooltip}
            aria-label={glyphTooltip}
          >
            ⚠
          </span>
        ) : null}
        {data.isFrontier ? (
          <span
            className="graph-node-frontier-glyph"
            role="img"
            title={data.frontierTooltip}
            aria-label={data.frontierTooltip}
          >
            🔭
          </span>
        ) : null}
        <div className="graph-node-inner">
          <div className="graph-node-title">{data.name}</div>
          <div className="graph-node-meta">
            <span>{data.kindLabel}</span>
            <span
              className={[
                "graph-node-maturity-pill",
                data.maturityPillHasLabel ? "" : "missing",
              ]
                .filter(Boolean)
                .join(" ")}
              style={pillStyle}
              title={
                data.maturityPillHasLabel
                  ? typeof data.maturityScore === "number"
                    ? `${data.maturityPillLabel} · ${data.maturityScore}`
                    : data.maturityPillLabel
                  : "Maturity label not set"
              }
            >
              {data.maturityPillLabel}
              {typeof data.maturityScore === "number" ? ` · ${data.maturityScore}` : ""}
            </span>
            <span
              className={[
                "graph-node-asof-pill",
                data.asOfPillHasValue ? "" : "missing",
              ]
                .filter(Boolean)
                .join(" ")}
              title={data.asOfPillTooltip}
              aria-label={data.asOfPillTooltip}
            >
              <span className="graph-node-asof-icon" aria-hidden="true">🕒</span>
              {data.asOfPillLabel}
            </span>
          </div>
          {data.foldedMetrics.length > 0 ? (
            // Per iter-44 a11y audit (MAJOR): role="list"/"listitem" was
            // misused — `<button>`'s implicit role overrides the
            // `listitem` role, leaving SR users without list semantics.
            // Switch to role="group" + aria-label so the chip cluster is
            // announced as a labelled group; the button children keep
            // their implicit button role.
            <div className="graph-node-metrics" role="group" aria-label={data.metricsStripLabel}>
              {data.foldedMetrics.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
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
                  title={data.formatMetricChipTooltip(metric)}
                >
                  <span className="graph-node-metric-name">{metric.name}</span>
                  <span className="graph-node-metric-value">{formatMetricChipValue(metric)}</span>
                  {metric.isCostBearing && metric.costAsOf ? (
                    <span
                      className="graph-node-metric-asof"
                      title={data.formatCostAsOfChipTooltip(metric.costAsOf)}
                      aria-label={data.formatCostAsOfChipTooltip(metric.costAsOf)}
                    >
                      {metric.costAsOf}
                    </span>
                  ) : null}
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

/**
 * Per ADR-0003, the value union accepts `{min, typical, max}` in addition to
 * scalar number/string. The shared `formatMetricValue` helper handles all three
 * shapes. The strip uses the `compact` form (≤24 chars target).
 */
function formatMetricChipValue(metric: FoldedMetricEntry): string {
  const current = formatMetricValue(metric.currentValue, metric.unit, metric.currency);
  const target = formatMetricValue(metric.targetValue, metric.unit, metric.currency);
  if (current.compact !== "—" && target.compact !== "—") {
    return `${current.compact} / ${target.compact}`;
  }
  if (current.compact !== "—") return current.compact;
  if (target.compact !== "—") return `→ ${target.compact}`;
  return metric.unit ?? "—";
}

/**
 * Per ADR-0003 a metric is cost-bearing if its inline reading carries a
 * recognized currency or its `unit` parses as a currency code. Used to drive
 * the small `costAsOf` year pill on the strip and detail rows.
 */
const COST_CURRENCY_CODES = new Set(["RMB", "USD", "EUR", "JPY"]);
function isCostBearingMetricEntry(metric: { unit?: string; currency?: string } | undefined): boolean {
  if (!metric) return false;
  if (metric.currency && COST_CURRENCY_CODES.has(metric.currency)) return true;
  const unit = metric.unit?.trim().toUpperCase();
  if (!unit) return false;
  for (const code of COST_CURRENCY_CODES) {
    if (unit === code || unit.startsWith(`${code}/`) || unit.startsWith(`${code} `)) return true;
  }
  return false;
}

/**
 * Per iter-15 review (P1 #5), chip tooltips route through `t()` so zh-mode
 * users see Chinese tooltip text. The labels `current` / `target` already
 * exist in LanguageProvider; `metricTooltipAsOf` is a new key for the
 * "as of YYYY" suffix, mirroring the iter-7 maturity-as-of pattern.
 */
function formatMetricTooltip(metric: FoldedMetricEntry, t: (key: string) => string): string {
  const parts = [metric.name];
  const current = formatMetricValue(metric.currentValue, metric.unit, metric.currency);
  const target = formatMetricValue(metric.targetValue, metric.unit, metric.currency);
  if (current.full !== "—") parts.push(`${t("current")}: ${current.full}`);
  if (target.full !== "—") parts.push(`${t("target")}: ${target.full}`);
  if (metric.costAsOf) parts.push(t("metricTooltipAsOf").replace("{year}", metric.costAsOf));
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
  // Per ADR-0001, deprecated nodes/edges are excluded from the default
  // render — soft-deleted records pollute the active dependency view. The
  // toggle restores them so a learner can audit history when needed.
  const [showDeprecated, setShowDeprecated] = useState(false);
  // Iter-23: per-card 🔭 frontier glyph density made the signal noisy in
  // the v0 graph (73-of-112 cards qualified). The toggle defaults ON to
  // preserve iter-22 behaviour; turning it OFF hides the per-card glyph
  // while leaving the toolbar count pill alone — count is a separate
  // signal from per-card decoration.
  const [showFrontiers, setShowFrontiers] = useState(true);
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

  const capabilityCluster = useMemo(() => capabilityClusterFor(graph, rootNodeId), [graph]);

  // Per ADR-0005, isDecompositionFrontier is a per-node judgment over the
  // graph (tag override OR maturity-not-stop AND no expanded children).
  // We memoize this once per graph change — keeping the cost O(N) by
  // walking nodes once instead of recomputing inside every flowNodes pass
  // (which would be O(N) per render and re-evaluate hasExpandedChildren's
  // edge scan for each node, ~N*E in the worst case).
  const frontierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of graph.nodes) {
      if (isDecompositionFrontier(graph, node)) ids.add(node.id);
    }
    return ids;
  }, [graph]);

  const visibleIds = useMemo(() => {
    if (mode === "full") return null;
    const baseIds = mode === "bottleneck"
      ? bottleneckVisibleIds(graph, expandedBottleneckIds)
      : layeredVisibleIds(graph, expandedIds);
    for (const id of capabilityCluster.allClusterIds) baseIds.add(id);
    return baseIds;
  }, [capabilityCluster, expandedBottleneckIds, expandedIds, graph, mode]);

  const prefilteredNodes = useMemo(
    () =>
      graph.nodes.filter((node) => {
        if (visibleIds && !visibleIds.has(node.id)) return false;
        if (focusIds && !focusIds.has(node.id)) return false;
        if (domain !== "all" && !node.domain.includes(domain)) return false;
        if (kind !== "all" && node.kind !== kind) return false;
        if (maturity !== "all" && (node.maturityScore ?? 0) < Number(maturity)) return false;
        // Per ADR-0001, hide deprecated records from default render.
        if (!showDeprecated && node.reviewStatus === "deprecated") return false;
        return true;
      }),
    [domain, focusIds, graph.nodes, kind, maturity, showDeprecated, visibleIds],
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
        costAsOf: inline?.costAsOf,
        currency: inline?.currency,
        isCostBearing: isCostBearingMetricEntry(inline),
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
        // Per ADR-0001, hide deprecated edges from default render. The
        // toggle restores them alongside deprecated nodes so the entire
        // soft-deleted slice surfaces together.
        .filter((edge) => showDeprecated || edge.reviewStatus !== "deprecated")
        .filter((edge) => filteredIds.has(edge.source) && filteredIds.has(edge.target))
        .filter((edge) => relation === "all" || edge.relation === relation)
        // In Layered / Bottleneck modes, allow `measured_by` edges through
        // when the metric is rendered as a standalone node (showMetricsAsNodes
        // toggle is on). When metrics fold into the parent's strip the metric
        // node is removed from filteredIds and the edge is dropped naturally.
        // Also allow `enables` edges that participate in the capability cluster
        // (product -> capability) so the cluster wiring renders in non-Full modes.
        .filter(
          (edge) =>
            mode === "full" ||
            layeredRelations.has(edge.relation) ||
            edge.relation === "measured_by" ||
            (edge.relation === "enables" && capabilityCluster.allClusterIds.has(edge.source) && capabilityCluster.capabilityIds.has(edge.target)),
        ),
    [capabilityCluster, filteredIds, graph.edges, mode, relation, showDeprecated],
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

  const visibleBottleneckIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of filteredNodes) {
      if (node.kind === "bottleneck") ids.add(node.id);
    }
    return ids;
  }, [filteredNodes]);

  const bottleneckedByCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (visibleBottleneckIds.size === 0) return counts;
    for (const edge of graph.edges) {
      if (edge.relation !== "bottlenecked_by") continue;
      if (!visibleBottleneckIds.has(edge.target)) continue;
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    }
    return counts;
  }, [graph.edges, visibleBottleneckIds]);

  // Per iter-19 review (P1): the fallback layout pre-computes its lane and
  // start data once per render, instead of recomputing it for every node
  // missing a layout position. With ~235 nodes and ~580 edges, the previous
  // shape ran depthMap (a BFS over all edges) per node-without-position —
  // ~135k edge traversals on first paint until ELK populates positions.
  const fallbackLayoutContext = useMemo(() => {
    const sorted = [...filteredNodes].sort(compareNodes);
    const laneById = depthMap(graph.edges, sorted);
    const starts = laneStarts(sorted, graph.edges, routeFocus, laneById);
    return { sorted, laneById, starts };
  }, [filteredNodes, graph.edges, routeFocus]);

  const flowNodes: FlowNode[] = useMemo(
    () =>
      filteredNodes.map((node) => {
        const related = selectedNeighbors.has(node.id);
        const folded = foldedMetricsByParent.get(node.id) ?? [];
        const localizedFolded: FoldedMetricEntry[] = folded.map((metric) => ({
          ...metric,
          name: nodeName(metric.id, metric.name),
        }));
        const visual = maturityVisualFor(node);
        const asOfVisual = maturityAsOfVisualFor(node);
        const asOfTooltip = asOfVisual.hasValue
          ? t("maturityAsOfTooltip").replace("{date}", asOfVisual.label)
          : t("maturityAsOfMissing");
        const isBottleneck = node.kind === "bottleneck";
        const bottleneckedByCount = isBottleneck ? 0 : bottleneckedByCounts.get(node.id) ?? 0;
        const isAlternativeSibling = capabilityCluster.siblingProductIds.has(node.id);
        const isHardToDevelop = node.tags?.includes("hard_to_develop") ?? false;
        // Per iter-23, the per-card 🔭 glyph is gated by the toolbar
        // toggle. The frontier-count pill upstream still uses
        // `frontierIds` directly so the count is independent of toggle
        // state.
        const isFrontier = showFrontiers && frontierIds.has(node.id);
        return {
        id: node.id,
        type: "capability",
        position: layoutPositions.get(node.id) ?? fallbackPositionFor(node, graph.edges, routeFocus, fallbackLayoutContext),
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
          isBottleneck,
          isAlternativeSibling,
          isHardToDevelop,
          hardToDevelopTooltip: isHardToDevelop ? t("hardToDevelopGlyphTooltip") : "",
          isFrontier,
          frontierTooltip: isFrontier ? t("frontierGlyphTooltip") : "",
          bottleneckedByCount,
          bottleneckedByTooltip: bottleneckedByCount > 0 ? t("bottleneckedByGlyphTooltip").replace("{count}", String(bottleneckedByCount)) : "",
          maturityPillLabel: visual.label,
          maturityPillBg: visual.bg,
          maturityPillFg: visual.fg,
          maturityPillHasLabel: visual.hasLabel,
          asOfPillLabel: asOfVisual.label,
          asOfPillHasValue: asOfVisual.hasValue,
          asOfPillTooltip: asOfTooltip,
          selectedMetricId: selectedId,
          foldedMetrics: localizedFolded,
          metricsStripLabel: t("metricsStrip"),
          formatMetricChipTooltip: (metric: FoldedMetricEntry) => formatMetricTooltip(metric, t),
          formatCostAsOfChipTooltip: (year: string) => t("metricChipCostAsOfTooltip").replace("{year}", year),
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
    [bottleneckedByCounts, capabilityCluster, fallbackLayoutContext, filteredNodes, foldedMetricsByParent, frontierIds, graph.edges, kindName, layoutPositions, nodeName, routeFocus, selectedId, selectedNeighbors, showFrontiers, t, toggleSelectedExpansion],
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
      // Flip cluster edges (product -> capability) for ELK layout so the
      // capability sits in a layer LEFT of the active product. Sibling
      // products land in the same layer as the active product. The visible
      // `flowEdges` keep their natural direction.
      const elkEdges: Edge[] = layoutEdges.map((edge) => {
        if (
          edge.relation === "enables" &&
          capabilityCluster.allClusterIds.has(edge.source) &&
          capabilityCluster.capabilityIds.has(edge.target)
        ) {
          return { ...edge, source: edge.target, target: edge.source };
        }
        return edge;
      });
      const nextPositions = await layoutWithElk(filteredNodes, elkEdges, selectedIdRef.current, layoutPositionsRef.current, foldCountById);
      if (!cancelled) {
        layoutPositionsRef.current = nextPositions;
        setLayoutPositions(nextPositions);
      }
    }

    void applyLayout();
    return () => {
      cancelled = true;
    };
  }, [capabilityCluster, filteredNodes, foldCountById, layoutEdges]);

  // In-scope frontier count: nodes currently rendered on the canvas that
  // satisfy isDecompositionFrontier. This is shown read-only next to the
  // metrics-as-nodes toggle so a learner gets a quick scan of "how much
  // research is queued in this graph". We count the post-filter set
  // (filteredNodes) so the number tracks Layered/Bottleneck expansion as
  // well as kind/maturity filters. Folded metric children are excluded
  // because they aren't rendered as cards in the default view.
  const frontierCountInScope = useMemo(
    () => filteredNodes.reduce((count, node) => count + (frontierIds.has(node.id) ? 1 : 0), 0),
    [filteredNodes, frontierIds],
  );

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
            className={["small-button", "secondary-button", showFrontiers ? "active" : ""].filter(Boolean).join(" ")}
            type="button"
            aria-pressed={showFrontiers}
            onClick={() => setShowFrontiers((value) => !value)}
            title={t("showFrontiersToggleHint")}
          >
            {t("showFrontiersToggle")}{showFrontiers ? ` · ${t("toggleOn")}` : ` · ${t("toggleOff")}`}
          </button>
          <button
            className={["small-button", "secondary-button", showDeprecated ? "active" : ""].filter(Boolean).join(" ")}
            type="button"
            aria-pressed={showDeprecated}
            onClick={() => setShowDeprecated((value) => !value)}
            title={t("showDeprecatedHint")}
          >
            {t("showDeprecated")}{showDeprecated ? ` · ${t("toggleOn")}` : ` · ${t("toggleOff")}`}
          </button>
          <span
            className="frontier-count-status"
            title={t("frontierCountInScopeTooltip")}
            aria-label={t("frontierCountInScopeTooltip")}
          >
            <span className="frontier-count-icon" aria-hidden="true">🔭</span>
            {t("frontierCountInScope").replace("{count}", String(frontierCountInScope))}
          </span>
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
        <select
          aria-label={t("filterDomainLabel")}
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
        >
          <option value="all">{t("allDomains")}</option>
          {domains.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filterKindLabel")}
          value={kind}
          onChange={(event) => setKind(event.target.value as NodeKind | "all")}
        >
          <option value="all">{t("allNodeKinds")}</option>
          {kinds.map((item) => (
            <option key={item} value={item}>
              {kindName(item)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filterRelationLabel")}
          value={relation}
          onChange={(event) => setRelation(event.target.value as EdgeRelation | "all")}
        >
          <option value="all">{t("allRelations")}</option>
          {relations.map((item) => (
            <option key={item} value={item}>
              {relationName(item)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filterMaturityLabel")}
          value={maturity}
          onChange={(event) => setMaturity(event.target.value)}
        >
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

/**
 * The capability cluster surrounding a Product, per ADR-0004:
 * - capabilityIds: Capabilities the Product `enables` (one hop).
 * - siblingProductIds: Other Products that `enables` the same Capabilities.
 *
 * Used by the Layered builder to surface the boundary structure on-graph
 * even though sibling Products and the Capability are not in the active
 * Product's reachable subtree.
 */
function capabilityClusterFor(
  graph: GraphData,
  productId: string,
): { capabilityIds: Set<string>; siblingProductIds: Set<string>; allClusterIds: Set<string> } {
  const capabilityIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source !== productId || edge.relation !== "enables") continue;
    const targetNode = graph.nodes.find((node) => node.id === edge.target);
    if (targetNode?.kind === "capability") capabilityIds.add(edge.target);
  }
  const siblingProductIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.relation !== "enables" || !capabilityIds.has(edge.target)) continue;
    if (edge.source === productId) continue;
    const sourceNode = graph.nodes.find((node) => node.id === edge.source);
    if (sourceNode?.kind === "product") siblingProductIds.add(edge.source);
  }
  const allClusterIds = new Set<string>([productId, ...capabilityIds, ...siblingProductIds]);
  return { capabilityIds, siblingProductIds, allClusterIds };
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

  addReachableMetrics(graph, ids);
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

  addReachableMetrics(graph, ids);
  return ids;
}

/**
 * Pull metric nodes into the visible set when at least one of their
 * `measured_by` parents is already visible. Layered and Bottleneck
 * modes don't traverse `measured_by` for layout (metrics shouldn't
 * deepen the dependency tree), but the metric-fold strip needs the
 * metric data present so it can fold inline. Without this step the
 * KPI strip silently disappears outside Full graph mode.
 */
function addReachableMetrics(graph: GraphData, ids: Set<string>) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges) {
    if (edge.relation !== "measured_by") continue;
    if (!ids.has(edge.source)) continue;
    const target = nodesById.get(edge.target);
    if (!target || target.kind !== "metric") continue;
    ids.add(edge.target);
  }
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
  // Per iter-19 review (P1): `foldCountById` is threaded through the call
  // chain instead of stored in a module-level mutable map. The previous
  // shape risked cross-instance leak if two GraphExplorers ever rendered
  // simultaneously (unlikely in current callers, but the wiring was a
  // module-scope mutable Map shared by every call site).
  const incrementalPositions = incrementalLayout(nodes, edges, anchorId, previousPositions, foldCountById);
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

function incrementalLayout(
  nodes: Node[],
  edges: Edge[],
  anchorId: string,
  previousPositions: Map<string, GraphPoint>,
  foldCountById: Map<string, number>,
) {
  if (!previousPositions.size) return null;

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
      nextPositions.set(child.id, firstOpenPosition(proposed, child, nextPositions, nodesById, foldCountById));
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
  foldCountById: Map<string, number>,
) {
  const next = { ...proposed };
  while (overlapsExisting(next, node, positions, nodesById, foldCountById)) {
    next.y += heightForNode(node, foldCountById.get(node.id) ?? 0) + INCREMENTAL_NODE_GAP;
  }
  return next;
}

function overlapsExisting(
  proposed: GraphPoint,
  node: Node,
  positions: Map<string, GraphPoint>,
  nodesById: Map<string, Node>,
  foldCountById: Map<string, number>,
) {
  const nodeHeight = heightForNode(node, foldCountById.get(node.id) ?? 0);
  for (const [id, position] of positions) {
    const existing = nodesById.get(id);
    if (!existing) continue;
    const existingHeight = heightForNode(existing, foldCountById.get(id) ?? 0);
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

type FallbackLayoutContext = {
  sorted: Node[];
  laneById: Map<string, number>;
  starts: number[];
};

function fallbackPositionFor(
  node: Node,
  edges: Edge[],
  routeFocus: string,
  context: FallbackLayoutContext,
) {
  const { sorted, laneById, starts } = context;
  const lane = laneById.get(node.id) ?? laneFor(node, edges, routeFocus);
  const sameLane = sorted.filter((item) => (laneById.get(item.id) ?? laneFor(item, edges, routeFocus)) === lane);
  const index = sameLane.findIndex((item) => item.id === node.id);
  const laneStart = starts[lane] ?? 40;
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

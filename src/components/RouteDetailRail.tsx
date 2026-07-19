"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { isKnowHowNode } from "@/lib/canvasGraph";
import {
  chokepointRankSignal,
  chokepointScores,
  directDependents,
  type ChokepointResult,
} from "@/lib/chokepointScore";
import { leadTimeAnswerForGraphNode, type LeadTimeAnswer } from "@/lib/commercialDataCompleteness";
import { defaultFocalProduct } from "@/lib/graphTraversal";
import type { ColorMode } from "@/lib/edgeStyleFor";
import type { GraphLayer } from "@/lib/knowHowLayer";
import { selectTopN } from "@/lib/prioritySelection";
import {
  readerFacingCostSignalText,
} from "@/lib/readerFacingText";
import type { RouteExposureAccessState } from "@/lib/routeAccess";
import type { RouteHighlight } from "@/lib/routeHighlight";
import type { GraphData, Node } from "@/lib/schema";
import { holdersForNode } from "@/lib/supplyConcentration";
import { systemOverviewForRoot } from "@/lib/systemOverview";
import { useLanguage } from "./LanguageProvider";
import { useHolderTeaser } from "./HolderTeaserProvider";
import { ChokepointHeadline, NodeCoreReadoutBrief, NodeDetailContent } from "./NodeDetailPanel";

type RailAnalysisMode = "relation" | "cost" | "bottleneck-risk";
type DetailIntent = "default" | "exposure";
type ChokepointAxis = keyof ChokepointResult["axes"];
const NON_DECOMPOSITION_CHILD_KINDS = new Set(["organization", "metric", "evidence", "context", "regulation", "principle"]);

const CHOKEPOINT_AXIS_LABEL_KEYS: Record<ChokepointAxis, string> = {
  criticality: "chokepointAxisLabelCriticality",
  concentration: "chokepointAxisLabelConcentration",
  barrier: "chokepointAxisLabelBarrier",
};

export type LensPriorityEntry = {
  nodeId: string;
  rank: number;
  band: 1 | 2 | 3 | 4 | 5;
};

export type RouteDetailRailProps = {
  graph: GraphData;
  route: RouteHighlight;
  selectedNode: Node | null;
  analysisMode?: ColorMode;
  graphLayer?: GraphLayer;
  priorityEntries?: readonly LensPriorityEntry[];
  exposureAccess?: RouteExposureAccessState;
  systemNodeIds?: readonly string[];
  panel?: "route" | "detail";
  initialPanel?: "route" | "detail";
  onPanelChange?: (panel: "route" | "detail") => void;
  onSelectNode?: (nodeId: string) => void;
};

function formatRmb(value: number): string {
  return `est. RMB ${Math.round(value).toLocaleString("en-US")}`;
}

function compactDescription(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length <= 170) return trimmed;
  return `${trimmed.slice(0, 169)}…`;
}

function firstSentenceDescription(text: string | undefined): string | null {
  const compact = compactDescription(text);
  if (!compact) return null;
  // CJK terminators (。！？) end a sentence with no trailing whitespace, so the
  // earlier `(?:\s|$)` guard never matched mid-string and the whole zh body was
  // treated as one sentence — which surfaced later clauses (e.g. hidden
  // supplier names that EN keeps in sentence 2) in the rail body and broke
  // FF-1. Match CJK terminators without a space requirement; keep ASCII
  // terminators gated on whitespace/end so "U.S."-style abbreviations don't
  // over-split.
  const match = compact.match(/^[\s\S]*?(?:[。！？]|[.!?](?=\s|$))/);
  return match ? match[0].trim() : compact;
}

function sentenceClause(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || /[.!?。！？…]$/u.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function formatCopy(template: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function readerClauseFragment(text: string): string {
  return text.trim().replace(/[.!?。！？…]+$/u, "");
}

function railAnalysisMode(mode: ColorMode | undefined): RailAnalysisMode {
  if (mode === "relation" || mode === "bottleneck-risk") return mode;
  if (mode === "maturity" || mode === "overall") return "bottleneck-risk";
  return "cost";
}

function strongestChokepointAxis(result: ChokepointResult | undefined): { axis: ChokepointAxis; value: number } | null {
  const candidates = (Object.entries(result?.axes ?? {}) as Array<[ChokepointAxis, number | null]>)
    .filter((entry): entry is [ChokepointAxis, number] => entry[1] !== null)
    .sort((left, right) => right[1] - left[1]);
  if (candidates.length === 0) return null;
  const [axis, value] = candidates[0];
  return { axis, value };
}

function routeStepAriaLabel(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function directEvidenceSummary(graph: GraphData, node: Node): { reviewed: number; total: number } {
  const directIds = new Set(node.evidenceIds ?? []);
  const rejectedIds = new Set(node.rejectedEvidenceIds ?? []);
  let reviewed = 0;
  let total = 0;

  for (const evidence of graph.evidence) {
    const directlyLinked = directIds.has(evidence.id) || evidence.supportsNodeIds?.includes(node.id);
    if (!directlyLinked || rejectedIds.has(evidence.id)) continue;
    total += 1;
    if (evidence.reviewStatus === "reviewed") reviewed += 1;
  }

  return { reviewed, total };
}

function isAiComputeNode(node: Node | null | undefined): boolean {
  return Boolean(node?.domain?.includes("ai_compute_chain"));
}

function isAiComputeFlagshipRoute(nodes: readonly Node[]): boolean {
  return nodes.some((node) => isAiComputeNode(node));
}

function isParcelDepthDemoNode(node: Node | null | undefined): boolean {
  return Boolean(
    node?.id === "low_cost_parcel_sorting_robot_300k_rmb" ||
    node?.domain?.includes("parcel_sorting_robot"),
  );
}

const AI_COMPUTE_MAINLINE_START_IDS = [
  "high_bandwidth_memory",
  "advanced_packaging",
  "hbm_stack_assembly_die_bonding",
] as const;

function aiComputeMainlineScore(node: Node): number {
  const text = [
    node.id,
    node.name,
    node.description,
    ...(node.tags ?? []),
  ].join(" ").toLowerCase();

  if (node.id === "high_bandwidth_memory") return 100;
  if (node.id === "advanced_packaging") return 96;
  if (node.id === "hbm_stack_assembly_die_bonding") return 92;
  if (text.includes("hbm") || text.includes("high-bandwidth memory") || text.includes("high bandwidth memory")) return 86;
  if (text.includes("cowos") || text.includes("advanced packaging") || text.includes("2.5d") || text.includes("3d package")) return 82;
  if (text.includes("interposer") || text.includes("substrate")) return 64;
  if (text.includes("logic die") || text.includes("ai accelerator")) return 56;
  if (text.includes("specialty") || text.includes("compound") || text.includes("analog")) return 0;
  return 0;
}

function requiresDescendantIds(graph: GraphData, rootId: string, maxDepth = 3): Set<string> {
  const children = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation !== "requires") continue;
    if (!children.has(edge.source)) children.set(edge.source, []);
    children.get(edge.source)!.push(edge.target);
  }

  const descendants = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: rootId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    for (const childId of children.get(current.nodeId) ?? []) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      queue.push({ nodeId: childId, depth: current.depth + 1 });
    }
  }
  return descendants;
}

function selectAiComputeStartNodeId(options: {
  graph: GraphData;
  routeRootId: string;
  nodeById: Map<string, Node>;
  firstLayerNodes: readonly Node[];
  routeSteps: readonly RouteHighlight["steps"][number][];
  priorityEntries: readonly LensPriorityEntry[];
}): string | null {
  const rootNode = options.nodeById.get(options.routeRootId);
  if (!isAiComputeNode(rootNode)) return null;

  const scopedIds = requiresDescendantIds(options.graph, options.routeRootId);
  for (const node of options.firstLayerNodes) scopedIds.add(node.id);
  for (const step of options.routeSteps) scopedIds.add(step.nodeId);
  for (const entry of options.priorityEntries) scopedIds.add(entry.nodeId);

  for (const nodeId of AI_COMPUTE_MAINLINE_START_IDS) {
    const node = options.nodeById.get(nodeId);
    if (node && scopedIds.has(nodeId) && node.reviewStatus !== "deprecated") return nodeId;
  }

  return [...scopedIds]
    .map((nodeId) => options.nodeById.get(nodeId))
    .filter((node): node is Node => node !== undefined && node.reviewStatus !== "deprecated" && isAiComputeNode(node))
    .map((node) => ({ node, score: aiComputeMainlineScore(node) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id))[0]?.node.id ?? null;
}

const CONSTRAINT_FACTOR_TAG_KEYS: ReadonlyArray<{ tag: string; labelKey: string }> = [
  { tag: "constraint_technical_maturity", labelKey: "constraintFactorTechnicalMaturity" },
  { tag: "constraint_integration_commissioning", labelKey: "constraintFactorIntegrationCommissioning" },
  { tag: "constraint_maintenance_operations", labelKey: "constraintFactorMaintenanceOperations" },
  { tag: "constraint_component_availability", labelKey: "constraintFactorComponentAvailability" },
  { tag: "constraint_material_supply_chain", labelKey: "constraintFactorMaterialSupplyChain" },
  { tag: "constraint_capacity_scale", labelKey: "constraintFactorCapacityScale" },
  { tag: "constraint_regulatory_approval", labelKey: "constraintFactorRegulatoryApproval" },
  { tag: "constraint_economic_validation", labelKey: "constraintFactorEconomicValidation" },
] as const;

function constraintFactorsForNode(node: Node, t: (key: string) => string): string[] {
  const tags = new Set(node.tags ?? []);
  return CONSTRAINT_FACTOR_TAG_KEYS
    .filter((entry) => tags.has(entry.tag))
    .map((entry) => t(entry.labelKey));
}

function barrierDetailKey(node: Node): "chokepointBarrierMustBuild" | "chokepointBarrierHardToReplicate" {
  if (node.transactability === "must_build") return "chokepointBarrierMustBuild";
  return "chokepointBarrierHardToReplicate";
}

/**
 * FF-2 (Gate F): per-node locked-supplier teaser. On gated audit-preview
 * `/d/<slug>` routes the holder organizations are stripped before this rail
 * renders, so post-strip holder counts are 0. The PRE-STRIP count is threaded
 * via `HolderTeaserProvider`/`computeHolderTeasers` (Decision-10) and surfaced
 * here as "N suppliers · M listed" for any component/material node with hidden
 * holders — quantifying the paywall where the researcher actually is. COUNT
 * ONLY: never a supplier name or ticker (those stay stripped per FF-1).
 */
function LockedSupplierTeaser({ nodeId }: { nodeId: string }) {
  const { t } = useLanguage();
  const teaser = useHolderTeaser(nodeId);
  if (!teaser || teaser.total <= 0) return null;
  return (
    <div
      className="route-reader-locked-suppliers"
      data-testid="route-locked-supplier-teaser"
      data-suppliers-total={teaser.total}
      data-suppliers-listed={teaser.listed}
    >
      <span>{t("readerLockedSuppliersHeading")}</span>
      <strong>{formatCopy(t("readerLockedSupplierTeaser"), { total: teaser.total, listed: teaser.listed })}</strong>
      <small>{t("readerLockedSupplierTeaserHint")}</small>
    </div>
  );
}

export function RouteDetailRail({
  graph,
  route,
  selectedNode,
  analysisMode,
  graphLayer = "product",
  priorityEntries,
  exposureAccess,
  systemNodeIds,
  panel: controlledPanel,
  initialPanel = "route",
  onPanelChange,
  onSelectNode,
}: RouteDetailRailProps) {
  const [uncontrolledPanel, setUncontrolledPanel] = useState<"route" | "detail">(initialPanel);
  const [detailIntent, setDetailIntent] = useState<DetailIntent>("default");
  const panel = controlledPanel ?? uncontrolledPanel;
  const activePanel = panel === "detail" && !selectedNode ? "route" : panel;
  const mobileDetailCloseRef = useRef<HTMLButtonElement | null>(null);
  const detailOpenScrollYRef = useRef<number | null>(null);
  const previousPanelRef = useRef(activePanel);
  const isKnowHowLayer = graphLayer === "knowhow";
  const selectedKnowHowNode = selectedNode && isKnowHowNode(selectedNode) ? selectedNode : null;
  const setPanel = (next: "route" | "detail") => {
    if (controlledPanel === undefined) {
      setUncontrolledPanel(next);
    }
    onPanelChange?.(next);
  };
  const { kindName, language, nodeDescription, nodeName, t } = useLanguage();
  // FF-3 (Gate F): surface the zh DESCRIPTION body (核心判断 / 具体卡点) when the
  // active language is zh and a translation exists, falling back to the English
  // `description`. Every place the rail reads `node.description` for reader prose
  // must route through this so the body matches the language of the chrome.
  const descriptionOf = (node: Node): string | undefined => {
    const english = node.description;
    const localized = nodeDescription(node.id, english ?? "");
    return localized || english;
  };
  const costSignalText = (value: number, kind: "modeled" | "estimated" | "missing") =>
    readerFacingCostSignalText({
      valueText: formatRmb(value),
      kind: kind === "estimated" ? "estimated" : "modeled",
      t,
    });
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const directChildIdsByNodeId = useMemo(() => {
    const children = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (edge.relation !== "requires") continue;
      if (!children.has(edge.source)) children.set(edge.source, []);
      children.get(edge.source)!.push(edge.target);
    }
    return children;
  }, [graph.edges]);
  const activeAnalysisMode = railAnalysisMode(analysisMode);
  const productId = defaultFocalProduct(graph)?.id ?? null;
  const firstLayerNodes = useMemo(() => {
    if (systemNodeIds) {
      return systemNodeIds
        .map((nodeId) => nodeById.get(nodeId))
        .filter((node): node is Node => Boolean(node));
    }
    if (!productId) return [] as Node[];
    return graph.edges
      .filter((edge) => edge.relation === "requires" && edge.source === productId)
      .map((edge) => nodeById.get(edge.target))
      .filter((node): node is Node => Boolean(node));
  }, [graph.edges, nodeById, productId, systemNodeIds]);
  const childCountByNodeId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of graph.edges) {
      if (edge.relation !== "requires") continue;
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    }
    return counts;
  }, [graph.edges]);
  const activePriorityEntries = useMemo(() => {
    if (priorityEntries) return [...priorityEntries];
    if (activeAnalysisMode === "cost") return [];
    return selectTopN(graph, activeAnalysisMode, 5, null);
  }, [activeAnalysisMode, graph, priorityEntries]);
  const chokepointScoreByNodeId = useMemo(() => chokepointScores(graph), [graph]);
  const copy = language === "zh"
    ? {
      fullSystem: "完整系统",
      costDrivers: "成本驱动",
      systemDecomposition: "系统分解",
      chokepointSignals: "关键瓶颈",
      route: "路线",
      structure: "结构",
      detail: "详情",
      nodeDetail: "节点详情",
      primaryCostChain: "主要成本链",
      majorSubsystems: "一级子系统",
      structureHint: "中性视角只展示系统拆解，不表达成本或瓶颈信号。",
      chokepointHint: "按依赖强度、供应集中度和壁垒排序；成本负担请切到成本视角。",
      costLensHint: "线条颜色/粗细使用下游节点成本分位，不是父子成本差额；此列表展示当前路线中成本最高的可达节点。",
      chokepointBand: "瓶颈 {band}/5",
      selected: "选中节点",
      links: "条链路",
      children: "个子节点",
      noPriorityNodes: "当前视角暂无可排序节点。",
      noNodeSelected: "未选择节点。",
      routeEntry: "路线入口",
      backToMap: "返回地图",
    }
    : {
      fullSystem: "Full system",
      costDrivers: "Cost drivers",
      systemDecomposition: "System decomposition",
      chokepointSignals: "Key chokepoints",
      route: "Route",
      structure: "Structure",
      detail: "Detail",
      nodeDetail: "Node detail",
      primaryCostChain: "Primary cost chain",
      majorSubsystems: "Major subsystems",
      structureHint: "Neutral view: system breakdown only, with no cost or chokepoint signal.",
      chokepointHint: "Ranks dependency, concentration, and barrier signals. Use Cost for cost burden.",
      costLensHint: "Edge color/width uses target-node cost percentile, not parent-child cost delta; this list shows the highest-cost reachable nodes.",
      chokepointBand: "Chokepoint {band}/5",
      selected: "Selected",
      links: "links",
      children: "children",
      noPriorityNodes: "No sortable nodes in this lens yet.",
      noNodeSelected: "No node selected.",
      routeEntry: "Route entry",
      backToMap: "Back to map",
    };

  useEffect(() => {
    const previousPanel = previousPanelRef.current;
    previousPanelRef.current = activePanel;
    if (activePanel === "route" && detailIntent !== "default") {
      setDetailIntent("default");
    }
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 900px)").matches) return;

    if (activePanel === "detail") {
      if (previousPanel !== "detail" || detailOpenScrollYRef.current === null) {
        detailOpenScrollYRef.current = window.scrollY;
      }
      window.requestAnimationFrame(() => {
        mobileDetailCloseRef.current?.focus({ preventScroll: true });
      });
      return;
    }

    if (previousPanel !== "detail" || !selectedNode) return;
    const detailOpenScrollY = detailOpenScrollYRef.current;
    detailOpenScrollYRef.current = null;
    window.requestAnimationFrame(() => {
      const graphShell = mobileDetailCloseRef.current?.closest(".graph-explorer-shell") ?? document;
      const graphNodes = Array.from(
        graphShell.querySelectorAll<HTMLElement>("[data-graph-node-id]"),
      );
      const selectedGraphNode = graphNodes.find(
        (element) => element.dataset.graphNodeId === selectedNode.id,
      );
      const rootGraphNode = graphNodes.find(
        (element) => element.dataset.graphNodeId === route.rootId,
      );
      (selectedGraphNode ?? rootGraphNode ?? graphNodes[0])?.focus({ preventScroll: true });
      if (detailOpenScrollY !== null && Math.abs(window.scrollY - detailOpenScrollY) > 1) {
        window.scrollTo({ top: detailOpenScrollY, behavior: "auto" });
      }
    });
  }, [activePanel, detailIntent, route.rootId, selectedNode]);
  const evidenceStatusText = (node: Node): string => {
    const summary = directEvidenceSummary(graph, node);
    if (summary.total === 0) return t("noDirectEvidence");
    if (summary.total === 1) return t("readerEvidenceStatusCountSingular");
    return formatCopy(t("readerEvidenceStatusCount"), {
      reviewed: summary.reviewed,
      total: summary.total,
    });
  };
  const nodeRoleText = (node: Node): string => firstSentenceDescription(descriptionOf(node)) ?? t("noDescription");
  function decompositionConstraintSignalText(node: Node): string | null {
    const special: Record<string, string[]> = {
      logic_die_fabrication: [t("decompositionSignalFoundry"), t("decompositionSignalEuv"), t("decompositionSignalYield")],
      advanced_packaging: [t("decompositionSignalCowos"), t("decompositionSignalBonding"), t("decompositionSignalInspection")],
      high_bandwidth_memory: [t("decompositionSignalHbmSupply"), t("decompositionSignalHbmAssembly"), t("decompositionSignalHbmTest")],
      substrate_and_interposer: [t("decompositionSignalOrganicSubstrate"), t("decompositionSignalInterposer"), t("decompositionSignalPdn")],
      interconnect_and_optics: [t("decompositionSignalSerdes"), t("decompositionSignalOptics"), t("decompositionSignalCopper")],
      power_delivery: [t("decompositionSignalVrm"), t("decompositionSignalPowerStage"), t("decompositionSignal48v")],
      thermal_cooling: [t("decompositionSignalColdPlate"), t("decompositionSignalLiquidLoop"), t("decompositionSignalCdu")],
    };
    const signals = special[node.id];
    return signals ? signals.slice(0, 3).join(" · ") : null;
  }
  function structuralConstraintSignalText(node: Node): string | null {
    const strongest = strongestChokepointAxis(chokepointScoreByNodeId.get(node.id));
    if (!strongest) return null;
    switch (strongest.axis) {
      case "criticality": {
        const count = directDependents(graph, node.id).length;
        return count > 0 ? formatCopy(t("chokepointAxisCriticality"), { count }) : null;
      }
      case "concentration": {
        const concrete = decompositionConstraintSignalText(node);
        if (concrete) return concrete;
        const { total } = holdersForNode(graph, node.id);
        if (total <= 0) return t("chokepointAxisConcentrationGap");
        return formatCopy(t("chokepointAxisConcentration"), { count: total });
      }
      case "barrier":
        return decompositionConstraintSignalText(node) ?? formatCopy(t("chokepointAxisBarrier"), { detail: t(barrierDetailKey(node)) });
    }
  }
  function decompositionConstraintSignals(node: Node): string[] {
    const special: Record<string, string[]> = {
      ai_accelerator_module_hbm_cowos: [
        t("readerAiComputeStuckHbmCapacity"),
        t("readerAiComputeStuckPackagingCapacity"),
        t("readerAiComputeStuckYieldLearning"),
        t("readerAiComputeStuckSupplierConcentration"),
      ],
      logic_die_fabrication: [t("decompositionSignalFoundry"), t("decompositionSignalEuv"), t("decompositionSignalYield")],
      advanced_packaging: [t("decompositionSignalCowos"), t("decompositionSignalBonding"), t("decompositionSignalInspection")],
      high_bandwidth_memory: [t("decompositionSignalHbmSupply"), t("decompositionSignalHbmAssembly"), t("decompositionSignalHbmTest")],
      substrate_and_interposer: [t("decompositionSignalOrganicSubstrate"), t("decompositionSignalInterposer"), t("decompositionSignalPdn")],
      interconnect_and_optics: [t("decompositionSignalSerdes"), t("decompositionSignalOptics"), t("decompositionSignalCopper")],
      power_delivery: [t("decompositionSignalVrm"), t("decompositionSignalPowerStage"), t("decompositionSignal48v")],
      thermal_cooling: [t("decompositionSignalColdPlate"), t("decompositionSignalLiquidLoop"), t("decompositionSignalCdu")],
    };
    const signals = special[node.id];
    if (signals) return signals;
    return graph.edges
      .filter((edge) => edge.source === node.id && edge.relation === "requires" && edge.reviewStatus !== "deprecated")
      .map((edge) => nodeById.get(edge.target))
      .filter((child): child is Node => Boolean(child && child.reviewStatus !== "deprecated" && !NON_DECOMPOSITION_CHILD_KINDS.has(child.kind)))
      .slice(0, 3)
      .map((child) => nodeName(child.id, child.name));
  }
  function constraintSummaryText(node: Node): string {
    const factors = constraintFactorsForNode(node, t);
    if (factors.length > 0) return factors.join(" · ");
    if (isAiComputeNode(node) && node.kind === "product") return t("readerAiComputeConstraintSummary");
    const structuralSignal = structuralConstraintSignalText(node);
    if (structuralSignal && structuralSignal !== t("chokepointAxisConcentrationGap")) return structuralSignal;
    const decompositionSignals = decompositionConstraintSignals(node);
    if (decompositionSignals.length > 0) return decompositionSignals.slice(0, 3).join(" · ");
    return t("readerConstraintUnclassified");
  }
  const bottleneckTargetNames = (node: Node): string[] =>
    (node.bottleneckOf ?? [])
      .map((nodeId) => {
        const target = nodeById.get(nodeId);
        return target && target.reviewStatus !== "deprecated" ? nodeName(target.id, target.name) : null;
      })
      .filter((value): value is string => Boolean(value));
  const bottleneckThesisText = (node: Node): string => {
    const where = sentenceClause(nodeRoleText(node));
    const targetNames = bottleneckTargetNames(node);
    const visibleTargets = targetNames.slice(0, 2).join(", ");
    const impact = targetNames.length > 0
      ? visibleTargets
      : routeRoot
        ? nodeName(routeRoot.id, routeRoot.name)
        : t("readerSelectedRouteImpact");
    return formatCopy(t("readerBottleneckThesisSentence"), {
      where,
      impact,
      factors: constraintSummaryText(node),
      relief: readerClauseFragment(reliefTimingText(node)),
      evidence: readerClauseFragment(evidenceStatusText(node)),
    });
  };
  const keyFactorsForNode = (node: Node): string[] => {
    const factors = constraintFactorsForNode(node, t);
    if (factors.length === 0) {
      const structuralSignal = structuralConstraintSignalText(node);
      if (structuralSignal && structuralSignal !== t("chokepointAxisConcentrationGap")) return [structuralSignal];
      const decompositionSignals = decompositionConstraintSignals(node);
      return decompositionSignals.length > 0 ? decompositionSignals.slice(0, 3) : [t("readerConstraintUnclassified")];
    }
    return factors.slice(0, 2);
  };
  const keyEvidenceSummaryText = (node: Node): string => {
    const summary = directEvidenceSummary(graph, node);
    if (summary.total === 0) return evidenceStatusText(node);
    return evidenceStatusText(node);
  };
  const chokepointSignalText = (node: Node, band: LensPriorityEntry["band"]): string => {
    const strongest = strongestChokepointAxis(chokepointScoreByNodeId.get(node.id));
    if (!strongest) return formatCopy(copy.chokepointBand, { band });
    return `${t(CHOKEPOINT_AXIS_LABEL_KEYS[strongest.axis])} ${Math.round(strongest.value * 100)}/100`;
  };
  const reliefTimingText = (node: Node): string => {
    const answer = leadTimeAnswerForGraphNode(graph, node);
    if (answer) {
      const { months } = answer;
      if (answer.basis === "estimated") {
        return formatCopy(t("readerReliefTimingEstimated"), {
          months,
          reason: leadTimeReasonText(answer),
        });
      }
      if (months <= 3) return formatCopy(t("readerReliefTimingShort"), { months });
      if (months <= 12) return formatCopy(t("readerReliefTimingMedium"), { months });
      const reason = reliefTimingReasonText(node);
      if (reason !== t("readerReliefTimingUnknown")) {
        return formatCopy(t("readerReliefTimingLongWithReason"), { months, reason });
      }
      return formatCopy(t("readerReliefTimingLong"), { months });
    }
    if (isAiComputeNode(node) && node.kind === "product") return t("readerReliefTimingLikelyLong");
    return reliefTimingReasonText(node);
  };
  const reliefTimingReasonText = (node: Node): string => {
    const tags = new Set(node.tags ?? []);
    if (tags.has("constraint_economic_validation")) return t("readerReliefTimingEconomics");
    if (tags.has("constraint_material_supply_chain")) return t("readerReliefTimingMaterial");
    if (tags.has("constraint_component_availability")) return t("readerReliefTimingComponent");
    if (tags.has("constraint_regulatory_approval")) return t("readerReliefTimingRegulatory");
    if (
      tags.has("constraint_capacity_scale")
    ) {
      return t("readerReliefTimingLikelyLong");
    }
    if (tags.has("constraint_integration_commissioning") || tags.has("constraint_technical_maturity")) {
      return t("readerReliefTimingExecution");
    }
    return t("readerReliefTimingUnknown");
  };
  const leadTimeReasonText = (answer: LeadTimeAnswer): string => {
    const key = (() => {
      switch (answer.reasonCode) {
        case "capacity_tooling":
          return "readerReliefReasonCapacityTooling";
        case "material_qualification":
          return "readerReliefReasonMaterialQualification";
        case "component_second_source":
          return "readerReliefReasonComponentSecondSource";
        case "regulatory_external":
          return "readerReliefReasonRegulatoryExternal";
        case "economic_validation":
          return "readerReliefReasonEconomicValidation";
        case "engineering_qualification":
          return "readerReliefReasonEngineeringQualification";
        case "early_product":
          return "readerReliefReasonEarlyProduct";
        case "mature_commodity":
          return "readerReliefReasonMatureCommodity";
        case "child_decomposition":
          return "readerReliefReasonChildDecomposition";
        case "default_proxy":
        case "explicit":
        default:
          return "readerReliefReasonDefaultProxy";
      }
    })();
    const localized = t(key);
    return localized === key ? answer.reason : localized;
  };
  const routeDecisionBrief = (node: Node): React.ReactNode => {
    return (
      <NodeCoreReadoutBrief
        graph={graph}
        node={node}
        className="route-reader-decision-brief"
        testId="route-selected-decision-brief"
      />
    );
  };
  const defaultStartNodeId = activeAnalysisMode === "relation"
    ? firstLayerNodes[0]?.id
    : activeAnalysisMode === "cost"
      ? route.steps[0]?.nodeId
      : activePriorityEntries[0]?.nodeId;
  const isAiComputeRoute = isAiComputeNode(nodeById.get(route.rootId)) ||
    isAiComputeNode(selectedNode) ||
    isAiComputeFlagshipRoute(firstLayerNodes);
  const startNodeId = (isAiComputeRoute
    ? selectAiComputeStartNodeId({
      graph,
      routeRootId: route.rootId,
      nodeById,
      firstLayerNodes,
      routeSteps: route.steps,
      priorityEntries: activePriorityEntries,
    })
    : null) ?? defaultStartNodeId;
  const startNode = startNodeId ? nodeById.get(startNodeId) ?? null : null;
  const knowHowStartNode = useMemo(() => {
    if (!isKnowHowLayer) return null;
    const scopedIds = requiresDescendantIds(graph, route.rootId, 4);
    for (const node of firstLayerNodes) scopedIds.add(node.id);
    for (const step of route.steps) scopedIds.add(step.nodeId);
    for (const entry of activePriorityEntries) scopedIds.add(entry.nodeId);

    const priorityCandidate = activePriorityEntries
      .map((entry) => nodeById.get(entry.nodeId))
      .find((node): node is Node => Boolean(node && isKnowHowNode(node) && node.reviewStatus !== "deprecated"));
    if (priorityCandidate) return priorityCandidate;

    return [...scopedIds]
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node): node is Node => Boolean(node && isKnowHowNode(node) && node.reviewStatus !== "deprecated"))
      .sort((left, right) => chokepointRankSignal(graph, right) - chokepointRankSignal(graph, left) || left.name.localeCompare(right.name))[0] ?? null;
  }, [activePriorityEntries, firstLayerNodes, graph, isKnowHowLayer, nodeById, route.rootId, route.steps]);
  const featuredStartNode = isKnowHowLayer
    ? selectedKnowHowNode ?? knowHowStartNode ?? startNode
    : startNode;
  const selectedSummaryNode = selectedNode &&
    selectedNode.id === route.rootId &&
    featuredStartNode &&
    featuredStartNode.id !== selectedNode.id
    ? featuredStartNode
    : selectedNode;
  const selectedSummaryUsesRouteEntry = Boolean(
    selectedNode &&
    selectedSummaryNode &&
    selectedSummaryNode.id !== selectedNode.id,
  );
  const isAiComputeFlagship = isAiComputeRoute || isAiComputeNode(startNode);
  const routeRoot = nodeById.get(route.rootId) ?? null;
  const systemOverview = systemOverviewForRoot(route.rootId, language === "zh" ? "zh" : "en");
  const isSystemOverviewState = Boolean(
    systemOverview &&
    activePanel === "route" &&
    !isKnowHowLayer &&
    (!selectedNode || selectedNode.id === route.rootId),
  );
  const isHumanoidRoute = Boolean(
    routeRoot?.domain?.includes("humanoid_robotics") ||
    startNode?.domain?.includes("humanoid_robotics") ||
    selectedNode?.domain?.includes("humanoid_robotics"),
  );
  const isControlledFusionRoute = Boolean(
    routeRoot?.domain?.includes("controlled_fusion") ||
    startNode?.domain?.includes("controlled_fusion") ||
    selectedNode?.domain?.includes("controlled_fusion"),
  );
  const effectiveExposureAccess = exposureAccess &&
    isAiComputeFlagship &&
    (exposureAccess.status === "locked" || exposureAccess.status === "unlocked")
    ? ({ status: "full-free" } as const)
    : exposureAccess;
  const exposureAccessText = effectiveExposureAccess && effectiveExposureAccess.status !== "full-free"
    ? effectiveExposureAccess.status === "locked"
      ? {
        className: "locked",
        title: t("readerExposureLayerLocked"),
        body: formatCopy(t("readerExposureLayerLockedBody"), { n: effectiveExposureAccess.hiddenOrgCount }),
      }
      : effectiveExposureAccess.status === "preview"
          ? {
            className: "preview",
            title: t("readerPreviewAccessTitle"),
            body: t("readerPreviewAccessBody"),
          }
          : effectiveExposureAccess.status === "audit-preview"
            ? {
              className: "audit-preview",
              title: t("readerAuditPreviewAccessTitle"),
              body: t("readerAuditPreviewAccessBody"),
            }
          : effectiveExposureAccess.status === "waitlist"
            ? {
              className: "waitlist",
              title: t("readerWaitlistAccessTitle"),
              body: t("readerWaitlistAccessBody"),
            }
            : effectiveExposureAccess.status === "paid-candidate"
              ? {
                className: "paid-candidate",
                title: t("readerPaidCandidateAccessTitle"),
                body: t("readerPaidCandidateAccessBody"),
              }
              : {
          className: "unlocked",
          title: t("readerExposureLayerUnlocked"),
          body: t("readerExposureLayerUnlockedBody"),
        }
    : null;
  const aiComputeStartThesisText = (node: Node): string | null => {
    if (!isAiComputeRoute || aiComputeMainlineScore(node) <= 0) return null;
    if (node.id === "high_bandwidth_memory") return t("readerAiComputeStartHbm");
    if (node.id === "advanced_packaging") return t("readerAiComputeStartAdvancedPackaging");
    if (node.id === "hbm_stack_assembly_die_bonding") return t("readerAiComputeStartHbmAssembly");
    return formatCopy(t("readerAiComputeStartDefault"), { node: nodeName(node.id, node.name) });
  };
  const startThesisText = (node: Node): string => aiComputeStartThesisText(node) ?? bottleneckThesisText(node);
  const startRoleText = (node: Node): string =>
    aiComputeStartThesisText(node) ? t("readerAiComputeStartRole") : nodeRoleText(node);
  const startNextBody = effectiveExposureAccess?.status === "locked"
      ? t("readerStartNextLockedBody")
      : effectiveExposureAccess?.status === "unlocked"
        ? t("readerStartNextUnlockedBody")
        : effectiveExposureAccess?.status === "audit-preview"
          ? t("readerStartNextAuditPreviewBody")
          : t("readerStartNextDefaultBody");
  const exposureIntentRef = useRef<HTMLDivElement | null>(null);
  const exposureAccessStatus = effectiveExposureAccess?.status;
  const exposureHiddenOrgCount = effectiveExposureAccess?.status === "locked"
    ? effectiveExposureAccess.hiddenOrgCount
    : 0;
  const exposurePointOfNeed = useMemo(() => {
    if (exposureAccessStatus === "locked") {
      return {
        className: "locked",
        title: formatCopy(t("readerExposurePointOfNeedTitle"), { n: exposureHiddenOrgCount }),
        body: t("readerExposurePointOfNeedBody"),
        scope: isControlledFusionRoute
          ? t("readerExposurePointOfNeedScopeFusion")
          : isHumanoidRoute
            ? t("readerExposurePointOfNeedScopeHumanoid")
            : t("readerExposurePointOfNeedScopeDefault"),
        bullets: [
          t("readerExposurePointOfNeedTickers"),
          t("readerExposurePointOfNeedCapacity"),
          t("readerExposurePointOfNeedEvidence"),
          t("readerExposurePointOfNeedEvidenceBoundary"),
          t("readerExposurePointOfNeedCheckout"),
        ],
      };
    }
    if (exposureAccessStatus === "audit-preview") {
      return {
        className: "audit-preview",
        title: t("exposureEvidencePolicyTitle"),
        body: t("exposureCandidateAuditHint"),
        scope: t("readerExposurePointOfNeedScopeAuditPreview"),
        bullets: [
          t("readerExposurePointOfNeedEvidenceBoundary"),
          t("readerExposurePointOfNeedAuditBoundary"),
        ],
      };
    }
    if (exposureAccessStatus === "unlocked") {
      return {
        className: "unlocked",
        title: t("readerExposureLayerUnlocked"),
        body: t("readerExposureLayerUnlockedBody"),
        scope: t("readerExposurePointOfNeedScopeUnlocked"),
        bullets: [] as string[],
      };
    }
    return null;
  }, [exposureAccessStatus, exposureHiddenOrgCount, isControlledFusionRoute, isHumanoidRoute, t]);
  const openStartDetail = (intent: DetailIntent = "default") => {
    if (!featuredStartNode) return;
    setDetailIntent(intent);
    onSelectNode?.(featuredStartNode.id);
    setPanel("detail");
  };
  useEffect(() => {
    if (activePanel !== "detail" || detailIntent !== "exposure") return;
    const element = exposureIntentRef.current;
    if (!element || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 760px)").matches) return;

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
  }, [activePanel, detailIntent, selectedNode?.id]);
  useEffect(() => {
    if (activePanel !== "detail" || detailIntent !== "exposure" || exposurePointOfNeed) return;
    if (typeof window === "undefined") return;
    const element = document.querySelector<HTMLElement>('[data-testid="detail-exposure-evidence-summary"]');
    if (!element) return;

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    });
  }, [activePanel, detailIntent, exposurePointOfNeed, selectedNode?.id]);
  const inspectNextNodes = useMemo(() => {
    if (!selectedSummaryNode) return [] as Node[];
    const childIds = directChildIdsByNodeId.get(selectedSummaryNode.id) ?? [];
    const childIdSet = new Set(childIds);
    const orderedIds = [
      ...activePriorityEntries
        .filter((entry) => childIdSet.has(entry.nodeId))
        .map((entry) => entry.nodeId),
      ...childIds,
      ...activePriorityEntries
        .filter((entry) => entry.nodeId !== selectedSummaryNode.id)
        .map((entry) => entry.nodeId),
    ];
    const seen = new Set<string>();
    const nodes: Node[] = [];
    for (const nodeId of orderedIds) {
      if (seen.has(nodeId)) continue;
      seen.add(nodeId);
      const node = nodeById.get(nodeId);
      if (!node) continue;
      nodes.push(node);
      if (nodes.length >= 3) break;
    }
    return nodes;
  }, [activePriorityEntries, directChildIdsByNodeId, nodeById, selectedSummaryNode]);
  const keyChokepointEntries = useMemo(
    () => activePriorityEntries.filter((entry) => {
      const node = nodeById.get(entry.nodeId);
      return entry.band >= 5 || (node?.bottleneckOf?.length ?? 0) > 0;
    }),
    [activePriorityEntries, nodeById],
  );
  const railTitle = activeAnalysisMode === "relation"
    ? copy.systemDecomposition
    : activeAnalysisMode === "bottleneck-risk"
    ? copy.chokepointSignals
    : copy.costDrivers;
  const displayRailTitle = isSystemOverviewState && systemOverview
    ? systemOverview.title
    : isKnowHowLayer
      ? t("knowHowLayerTitle")
      : railTitle;
  const primaryTabLabel = isKnowHowLayer ? t("knowHowStartHere") : t("readerStartHere");
  const railCount = activeAnalysisMode === "relation"
    ? firstLayerNodes.length
    : activeAnalysisMode === "cost"
    ? route.steps.length
    : keyChokepointEntries.length;
  const isAuditPreviewAccess = effectiveExposureAccess?.status === "audit-preview";
  const routeAccessChipText = isAuditPreviewAccess ? null : exposureAccessText;
  const startNextItems = [
    {
      key: "evidence",
      label: t("readerStartNextEvidence"),
      intent: "default" as DetailIntent,
      hint: t("readerStartNextOpenDetail"),
    },
    ...(
      isAuditPreviewAccess
        ? [
          {
            key: "exposure",
            label: t("readerStartNextCompanies"),
            intent: "exposure" as DetailIntent,
            hint: t("readerStartNextCheckAvailability"),
          },
        ]
        : [
          {
            key: "exposure",
            label: t("readerStartNextSuppliersTickers"),
            intent: "exposure" as DetailIntent,
            hint: effectiveExposureAccess?.status === "locked"
              ? t("readerStartNextOpenExposure")
              : t("readerStartNextOpenDetail"),
          },
        ]
    ),
    {
      key: "thesis",
      label: t("detailNodeInterpretation"),
      intent: "default" as DetailIntent,
      hint: t("readerStartNextOpenDetail"),
    },
  ];
  const closeDetail = () => {
    setDetailIntent("default");
    setPanel("route");
  };

  return (
    <aside
      className={[
        "route-detail-rail",
        activePanel === "detail" ? "route-detail-rail-detail-mode" : "",
        isAuditPreviewAccess ? "route-detail-rail-audit-preview" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="route-detail-rail"
      aria-label={activePanel === "detail" ? copy.nodeDetail : displayRailTitle}
    >
      {activePanel === "detail" && selectedNode ? (
        <div className="route-rail-mobile-detail-header">
          <div>
            <span>{copy.nodeDetail}</span>
            <strong>{nodeName(selectedNode.id, selectedNode.name)}</strong>
          </div>
          <button
            ref={mobileDetailCloseRef}
            type="button"
            data-testid="route-rail-mobile-close"
            onClick={closeDetail}
          >
            {copy.backToMap}
          </button>
        </div>
      ) : null}
      <header className="route-rail-header">
        <div>
          <div className="route-rail-kicker">{isKnowHowLayer ? t("knowHowLayerKicker") : copy.fullSystem}</div>
          <h2>{activePanel === "detail" ? copy.nodeDetail : displayRailTitle}</h2>
        </div>
        {activePanel === "route" && !isSystemOverviewState ? (
          <div className="route-rail-header-badges">
            {routeAccessChipText ? (
              <span className={`route-access-chip ${routeAccessChipText.className}`}>
                {routeAccessChipText.title}
              </span>
            ) : null}
            <span className="route-rail-count">{formatCopy(t("readerRailCountTop"), { count: railCount })}</span>
          </div>
        ) : null}
      </header>

      {selectedNode && !isSystemOverviewState ? (
        <div className="route-rail-panel-actions" aria-label="Route rail panel actions">
          {activePanel === "detail" ? (
            <button
              type="button"
              className="route-rail-panel-action"
              data-testid="route-rail-start-action"
              onClick={() => {
                setDetailIntent("default");
                setPanel("route");
              }}
            >
              {primaryTabLabel}
            </button>
          ) : (
            <button
              type="button"
              className="route-rail-panel-action"
              data-testid="route-rail-detail-action"
              onClick={() => {
                setDetailIntent("default");
                setPanel("detail");
              }}
            >
              {copy.detail}
            </button>
          )}
        </div>
      ) : null}

      <div className="route-rail-body">
        {activePanel === "detail" && selectedNode ? (
          <section
            className="route-rail-card route-rail-node-detail"
            data-testid="route-rail-node-detail"
          >
            {isAuditPreviewAccess ? <LockedSupplierTeaser nodeId={selectedNode.id} /> : null}
            {detailIntent === "exposure" && exposurePointOfNeed ? (
              <div
                ref={exposureIntentRef}
                className={`route-reader-access route-reader-access-priority ${exposurePointOfNeed.className}`}
                data-testid="route-reader-exposure-intent"
              >
                <strong>{exposurePointOfNeed.title}</strong>
                <span>{exposurePointOfNeed.body}</span>
                <span>{exposurePointOfNeed.scope}</span>
                {exposurePointOfNeed.bullets.length > 0 ? (
                  <ul>
                    {exposurePointOfNeed.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                {exposureAccessStatus === "audit-preview" ? null : (
                  <a href="#paid-exposure-access">{t("readerExposurePointOfNeedAccessDetails")}</a>
                )}
              </div>
            ) : null}
            <NodeDetailContent
              graph={graph}
              node={selectedNode}
              onSelectNode={onSelectNode}
              lockedExposureMode={isAuditPreviewAccess ? "audit-preview" : "paid-candidate"}
              showExposureSummary={detailIntent === "exposure" || !isAuditPreviewAccess}
              defaultOpenExposureSummary={detailIntent === "exposure"}
            />
          </section>
        ) : isSystemOverviewState && systemOverview ? (
          <>
            <section
              className="route-rail-system-read"
              data-testid="route-rail-system-overview"
            >
              <p className="route-system-overview-subtitle">{systemOverview.subtitle}</p>
              <div className="route-system-read-table">
                {systemOverview.rows.map((row) => (
                  <div key={row.key} className="route-system-read-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/*
              First-glance chokepoint verdict for the focused node — including
              the product ROOT, which lands on this route panel after a
              pane-click (docs/ACCEPTANCE.md §3a, GAP #3). It reads the SAME
              shared verdict band as the canvas (chokepointVerdictBandFor), so
              the route-panel verdict, the detail-panel verdict, and the canvas
              band all agree. For a structural-root product it renders
              "Structural root · not itself a chokepoint".
            */}
            {selectedNode && !selectedSummaryUsesRouteEntry ? <ChokepointHeadline graph={graph} node={selectedNode} /> : null}
            <section className="route-rail-card route-rail-start">
              <div className="route-rail-section-title">{primaryTabLabel}</div>
              {isKnowHowLayer ? <p className="route-rail-hint">{t("knowHowLayerHint")}</p> : null}
              {featuredStartNode ? (
                <>
                  {routeDecisionBrief(featuredStartNode)}
                  <div className="route-reader-thesis">
                    <span>{t("detailNodeInterpretation")}</span>
                    <p>{startThesisText(featuredStartNode)}</p>
                  </div>
                  <button
                    type="button"
                    className="route-start-button"
                    onClick={() => openStartDetail("default")}
                    aria-label={routeStepAriaLabel([
                      nodeName(featuredStartNode.id, featuredStartNode.name),
                      startThesisText(featuredStartNode),
                      t("readerStartNextTitle"),
                    ])}
                  >
                    <span className="route-start-name">{nodeName(featuredStartNode.id, featuredStartNode.name)}</span>
                    <span className="route-start-role">{startRoleText(featuredStartNode)}</span>
                  </button>
                  {isAuditPreviewAccess ? <LockedSupplierTeaser nodeId={featuredStartNode.id} /> : null}
                  <div className="route-rail-chip-row" aria-label={t("readerStartNextTitle")}>
                    {startNextItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="route-reader-next-step-button"
                        data-testid={item.key === "exposure" ? "route-suppliers-tickers-button" : undefined}
                        onClick={() => openStartDetail(item.intent)}
                      >
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="route-rail-hint">{startNextBody}</p>
                </>
              ) : (
                <p className="muted">{copy.noPriorityNodes}</p>
              )}
            </section>

            {activeAnalysisMode === "relation" ? (
              <section className="route-rail-card route-rail-route">
                <div className="route-rail-section-title">{copy.majorSubsystems}</div>
                <p className="route-rail-hint">{copy.structureHint}</p>
                <ol className="route-step-list route-priority-list">
                  {firstLayerNodes.map((node) => {
                    const children = childCountByNodeId.get(node.id) ?? 0;
                    return (
                      <li key={node.id} className="route-step">
                        <button
                          type="button"
                          className="route-step-button"
                          aria-label={routeStepAriaLabel([
                            nodeName(node.id, node.name),
                            kindName(node.kind),
                            `${children} ${copy.children}`,
                          ])}
                          onClick={() => onSelectNode?.(node.id)}
                        >
                          <span className="route-step-marker structural" aria-hidden="true" />
                          <span className="route-step-main">
                            <span className="route-step-name">{nodeName(node.id, node.name)}</span>
                            <span className="route-step-meta">{kindName(node.kind)}</span>
                          </span>
                          <span className="route-step-cost">{children} {copy.children}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : activeAnalysisMode === "cost" ? (
              <section className="route-rail-card route-rail-route">
                <div className="route-rail-section-title">{copy.primaryCostChain}</div>
                <p className="route-rail-hint">{copy.costLensHint}</p>
                <ol className="route-step-list">
                  {route.steps.map((step) => {
                    const node = nodeById.get(step.nodeId);
                    const label = node ? nodeName(node.id, node.name) : step.nodeId;
                    const kindLabel = node ? kindName(node.kind) : "node";
                    const signal = costSignalText(step.costTypicalRmb, step.costSignalKind);
                    const factors = node ? keyFactorsForNode(node) : [signal];
                    return (
                      <li key={step.nodeId} className="route-step">
                        <button
                          type="button"
                          className="route-step-button"
                          aria-label={routeStepAriaLabel([
                            label,
                            kindLabel,
                            `${step.pathEdgeIds.length} ${copy.links}`,
                            signal,
                          ])}
                          onClick={() => onSelectNode?.(step.nodeId)}
                        >
                          <span className="route-step-marker cost" aria-hidden="true" />
                          <span className="route-step-main">
                            <span className="route-step-name">{label}</span>
                            <span className="route-step-reason">
                              {node ? nodeRoleText(node) : kindLabel}
                            </span>
                            <span className="route-step-factors">{factors.join(" · ")}</span>
                          </span>
                          <span className="route-step-signal">{signal}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : (
              <section className="route-rail-card route-rail-route">
                <div className="route-rail-section-title">{t("readerKeyChokepoints")}</div>
                <p className="route-rail-hint">
                  {copy.chokepointHint}
                </p>
                {keyChokepointEntries.length > 0 ? (
                  <ol className="route-step-list route-priority-list">
                    {keyChokepointEntries.slice(0, 3).map((entry) => {
                      const node = nodeById.get(entry.nodeId);
                      const label = node ? nodeName(node.id, node.name) : entry.nodeId;
                      const kindLabel = node ? kindName(node.kind) : "node";
                      const metaLabel = node
                        ? `${nodeRoleText(node)} · ${evidenceStatusText(node)}`
                        : kindLabel;
                      const valueLabel = node
                        ? chokepointSignalText(node, entry.band)
                        : formatCopy(copy.chokepointBand, { band: entry.band });
                      const factors = node ? keyFactorsForNode(node) : [];
                      return (
                        <li key={entry.nodeId} className="route-step">
                          <button
                            type="button"
                            className="route-step-button"
                            aria-label={routeStepAriaLabel([label, metaLabel, valueLabel])}
                            onClick={() => onSelectNode?.(entry.nodeId)}
                          >
                            <span
                              className={`route-step-marker priority band-${entry.band}`}
                              aria-hidden="true"
                            />
                            <span className="route-step-main">
                              <span className="route-step-name">{label}</span>
                              <span className="route-step-reason">{node ? nodeRoleText(node) : kindLabel}</span>
                              <span className="route-step-factors">
                                {factors.length > 0 ? factors.join(" · ") : metaLabel}
                              </span>
                            </span>
                            <span className="route-step-signal">{valueLabel}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="muted">{copy.noPriorityNodes}</p>
                )}
              </section>
            )}

            {!selectedSummaryUsesRouteEntry ? (
              <section
                className="route-rail-card route-rail-selected"
                data-testid="route-rail-selected-summary"
              >
                <div className="route-rail-section-title">{copy.selected}</div>
                {selectedSummaryNode ? (
                  <>
                    <h3>{nodeName(selectedSummaryNode.id, selectedSummaryNode.name)}</h3>
                    {routeDecisionBrief(selectedSummaryNode)}
                    <div className="route-reader-thesis">
                      <span>{t("detailNodeInterpretation")}</span>
                      <p>{bottleneckThesisText(selectedSummaryNode)}</p>
                    </div>
                    {isAuditPreviewAccess ? <LockedSupplierTeaser nodeId={selectedSummaryNode.id} /> : null}
                    <div className="route-reader-evidence-summary">
                      <span>{t("detailEvidenceTrail")}</span>
                      <p>{keyEvidenceSummaryText(selectedSummaryNode)}</p>
                    </div>
                    {inspectNextNodes.length > 0 ? (
                      <div className="route-reader-inspect">
                        <div className="route-rail-section-title">{t("readerInspectNext")}</div>
                        <div className="route-reader-inspect-list">
                          {inspectNextNodes.map((node) => (
                            <button
                              key={node.id}
                              type="button"
                              onClick={() => onSelectNode?.(node.id)}
                              aria-label={`${t("readerInspect")} ${nodeName(node.id, node.name)}`}
                            >
                              <span>{nodeName(node.id, node.name)}</span>
                              <small>{keyFactorsForNode(node)[0] ?? evidenceStatusText(node)}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="muted">{copy.noNodeSelected}</p>
                )}
              </section>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

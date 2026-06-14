"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { isKnowHowNode } from "@/lib/canvasGraph";
import { costDisclosureText } from "@/lib/costDisclosure";
import { defaultFocalProduct } from "@/lib/graphTraversal";
import { nodeCostSignalRmb, type ColorMode } from "@/lib/edgeStyleFor";
import type { GraphLayer } from "@/lib/knowHowLayer";
import { nodeRiskSignal } from "@/lib/nodeRisk";
import { selectTopN } from "@/lib/prioritySelection";
import { readerFacingConstraintReason, readerFacingCostAnswer } from "@/lib/readerFacingText";
import type { RouteExposureAccessState } from "@/lib/routeAccess";
import type { RouteHighlight } from "@/lib/routeHighlight";
import type { GraphData, Node } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";
import { NodeDetailContent } from "./NodeDetailPanel";

type RailAnalysisMode = "relation" | "cost" | "bottleneck-risk" | "maturity";
type DetailIntent = "default" | "exposure";

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
  currentRootId?: string;
  rootableNodeIds?: readonly string[];
  rootTransitioning?: boolean;
  onPanelChange?: (panel: "route" | "detail") => void;
  onSelectNode?: (nodeId: string) => void;
  onSetRootNode?: (nodeId: string) => void;
};

function formatRmb(value: number): string {
  return `p50 RMB ${Math.round(value).toLocaleString("en-US")}`;
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
  const match = compact.match(/^.*?[.!?。！？](?:\s|$)/);
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

function graphRootHref(nodeId: string): string {
  return `/graph?root=${encodeURIComponent(nodeId)}`;
}

function railAnalysisMode(mode: ColorMode | undefined): RailAnalysisMode {
  if (mode === "relation" || mode === "bottleneck-risk" || mode === "maturity") return mode;
  return "cost";
}

function formatHeatScore(value: number): string {
  return `${Math.round(value * 100)}/100`;
}

function formatMaturityScore(node: Node): string | null {
  if (typeof node.maturityScore !== "number") return null;
  return `${Math.round(node.maturityScore)}/100`;
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
  currentRootId,
  rootableNodeIds,
  rootTransitioning = false,
  onPanelChange,
  onSelectNode,
  onSetRootNode,
}: RouteDetailRailProps) {
  const [uncontrolledPanel, setUncontrolledPanel] = useState<"route" | "detail">(initialPanel);
  const [detailIntent, setDetailIntent] = useState<DetailIntent>("default");
  const panel = controlledPanel ?? uncontrolledPanel;
  const activePanel = panel === "detail" && !selectedNode ? "route" : panel;
  const isKnowHowLayer = graphLayer === "knowhow";
  const selectedKnowHowNode = selectedNode && isKnowHowNode(selectedNode) ? selectedNode : null;
  const setPanel = (next: "route" | "detail") => {
    if (controlledPanel === undefined) {
      setUncontrolledPanel(next);
    }
    onPanelChange?.(next);
  };
  const { kindName, language, nodeName, t } = useLanguage();
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
  const copy = language === "zh"
    ? {
      fullSystem: "完整系统",
      costDrivers: "成本驱动",
      systemDecomposition: "系统分解",
      bottleneckRisks: "瓶颈风险",
      maturityWeakPoints: "成熟度薄弱项",
      route: "路线",
      structure: "结构",
      risk: "热度",
      weakPoints: "薄弱项",
      detail: "详情",
      nodeDetail: "节点详情",
      primaryCostChain: "主要成本链",
      majorSubsystems: "一级子系统",
      keyRiskNodes: "关键风险节点",
      leastMatureDependencies: "最不成熟的依赖",
      structureHint: "中性视角只展示系统拆解，不表达成本、风险或成熟度。",
      riskHint: "按风险信号排序，帮助先看最可能卡住的节点。",
      maturityHint: "优先看分数低、标签不成熟或不确定的依赖。",
      selected: "选中节点",
      links: "条链路",
      children: "个子节点",
      riskScore: "热度",
      maturityScore: "成熟度",
      maturityUnknown: "成熟度未设置",
      noPriorityNodes: "当前视角暂无可排序节点。",
      noNodeSelected: "未选择节点。",
      routeEntry: "路线入口",
      setAsRoot: "作为产品根研究",
      settingRoot: "正在切换产品视图",
      setAsRootLabel: (name: string) => `将 ${name} 设为新的产品研究根`,
    }
    : {
      fullSystem: "Full system",
      costDrivers: "Cost drivers",
      systemDecomposition: "System decomposition",
      bottleneckRisks: "Bottleneck risks",
      maturityWeakPoints: "Maturity weak points",
      route: "Route",
      structure: "Structure",
      risk: "Heat",
      weakPoints: "Weak points",
      detail: "Detail",
      nodeDetail: "Node detail",
      primaryCostChain: "Primary cost chain",
      majorSubsystems: "Major subsystems",
      keyRiskNodes: "Key risk nodes",
      leastMatureDependencies: "Least mature dependencies",
      structureHint: "Neutral view: system breakdown only, with no cost, risk, or maturity signal.",
      riskHint: "Sorted by risk signal so likely bottlenecks are easier to inspect first.",
      maturityHint: "Start with the lowest scores and least mature labels.",
      selected: "Selected",
      links: "links",
      children: "children",
      riskScore: "Heat",
      maturityScore: "Maturity",
      maturityUnknown: "maturity not set",
      noPriorityNodes: "No sortable nodes in this lens yet.",
      noNodeSelected: "No node selected.",
      routeEntry: "Route entry",
      setAsRoot: "Set as research root",
      settingRoot: "Switching research root",
      setAsRootLabel: (name: string) => `Set ${name} as the graph research root`,
    };
  const evidenceStatusText = (node: Node): string => {
    const summary = directEvidenceSummary(graph, node);
    if (summary.total === 0) return t("noDirectEvidence");
    if (summary.total === 1) return t("readerEvidenceStatusCountSingular");
    return formatCopy(t("readerEvidenceStatusCount"), {
      reviewed: summary.reviewed,
      total: summary.total,
    });
  };
  const nodeRoleText = (node: Node): string => firstSentenceDescription(node.description) ?? t("noDescription");
  const bottleneckTargetNames = (node: Node): string[] =>
    (node.bottleneckOf ?? [])
      .map((nodeId) => {
        const target = nodeById.get(nodeId);
        return target && target.reviewStatus !== "deprecated" ? nodeName(target.id, target.name) : null;
      })
      .filter((value): value is string => Boolean(value));
  const bottleneckRoleText = (node: Node): string => {
    const targetNames = bottleneckTargetNames(node);
    if (targetNames.length === 0) return t("readerNoBottleneckMarker");
    const visible = targetNames.slice(0, 2);
    const suffix = targetNames.length > visible.length ? ` +${targetNames.length - visible.length}` : "";
    return formatCopy(t("readerBottleneckFor"), { targets: `${visible.join(", ")}${suffix}` });
  };
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
      relief: reliefTimingText(node),
      evidence: evidenceStatusText(node),
    });
  };
  const keyFactorsForNode = (node: Node): string[] => {
    const factors = constraintFactorsForNode(node, t);
    if (factors.length === 0) {
      factors.push(directEvidenceSummary(graph, node).total === 0
        ? t("readerEvidenceThin")
        : t("readerThesisCandidateConstraint"));
    }
    return factors.slice(0, 2);
  };
  const keyStuckReasonForNode = (node: Node): string => readerFacingConstraintReason(node.description);
  const keyEvidenceSummaryText = (node: Node): string => {
    const summary = directEvidenceSummary(graph, node);
    if (summary.total === 0) return t("readerEvidenceThin");
    return evidenceStatusText(node);
  };
  const constraintSummaryText = (node: Node): string => {
    const factors = constraintFactorsForNode(node, t);
    if (factors.length > 0) return factors.join(" · ");
    if (isAiComputeNode(node) && node.kind === "product") return t("readerAiComputeConstraintSummary");
    return t("readerConstraintUnclassified");
  };
  const reliefTimingText = (node: Node): string => {
    const months = node.capacityLeadTimeMonths;
    if (typeof months === "number") {
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
  const routeDecisionBrief = (node: Node): React.ReactNode => {
    const cost = nodeCostSignalRmb(node, graph);
    const costAnswer = readerFacingCostAnswer({
      valueText: cost ? formatRmb(cost) : null,
      disclosureText: costDisclosureText(node, t, { includeReason: true }),
      fallback: t("readerCostNotModeled"),
      disclosurePrimary: t("readerCostNotPriceableShort"),
      disclosureSecondary: t("readerCostMissingReviewedSource"),
    });
    return (
      <div
        className="detail-decision-brief route-reader-decision-brief"
        data-testid="route-selected-decision-brief"
      >
        <strong>{t("readerDecisionBrief")}</strong>
        <div className="detail-decision-grid">
          <div title={costAnswer.full}>
            <span>{t("readerCostMagnitude")}</span>
            <strong>{costAnswer.primary}</strong>
            {costAnswer.secondary ? <small>{costAnswer.secondary}</small> : null}
          </div>
          <div>
            <span>{t("readerSupplyConstraint")}</span>
            <strong>{constraintSummaryText(node)}</strong>
          </div>
          <div>
            <span>{t("readerReliefTiming")}</span>
            <strong>{reliefTimingText(node)}</strong>
          </div>
          <div>
            <span>{t("readerSourceTrail")}</span>
            <strong>{evidenceStatusText(node)}</strong>
          </div>
        </div>
      </div>
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
      .sort((left, right) => nodeRiskSignal(right, graph) - nodeRiskSignal(left, graph) || left.name.localeCompare(right.name))[0] ?? null;
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
  const exposurePointOfNeed = effectiveExposureAccess?.status === "locked"
    ? {
      className: "locked",
      title: formatCopy(t("readerExposurePointOfNeedTitle"), { n: effectiveExposureAccess.hiddenOrgCount }),
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
    }
    : effectiveExposureAccess?.status === "audit-preview"
      ? {
        className: "audit-preview",
        title: t("exposureEvidencePolicyTitle"),
        body: t("exposureCandidateAuditHint"),
        scope: t("readerExposurePointOfNeedScopeAuditPreview"),
        bullets: [
          t("readerExposurePointOfNeedEvidenceBoundary"),
          t("readerExposurePointOfNeedAuditBoundary"),
        ],
      }
    : effectiveExposureAccess?.status === "unlocked"
      ? {
        className: "unlocked",
        title: t("readerExposureLayerUnlocked"),
        body: t("readerExposureLayerUnlockedBody"),
        scope: t("readerExposurePointOfNeedScopeUnlocked"),
        bullets: [] as string[],
      }
      : null;
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
  const startSignalLabel = featuredStartNode
    ? activeAnalysisMode === "maturity"
      ? `${copy.maturityScore} ${formatMaturityScore(featuredStartNode) ?? "—"}`
      : `${copy.riskScore} ${formatHeatScore(nodeRiskSignal(featuredStartNode, graph))}`
    : null;
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
  const canSetSelectedAsRoot = Boolean(
    selectedNode &&
    onSetRootNode &&
    selectedNode.id !== currentRootId &&
    (!rootableNodeIds || rootableNodeIds.includes(selectedNode.id)),
  );
  const railTitle = activeAnalysisMode === "relation"
    ? copy.systemDecomposition
    : activeAnalysisMode === "bottleneck-risk"
    ? copy.bottleneckRisks
    : activeAnalysisMode === "maturity"
      ? copy.maturityWeakPoints
      : copy.costDrivers;
  const displayRailTitle = isKnowHowLayer ? t("knowHowLayerTitle") : railTitle;
  const primaryTabLabel = isKnowHowLayer ? t("knowHowStartHere") : t("readerStartHere");
  const railCount = activeAnalysisMode === "relation"
    ? firstLayerNodes.length
    : activeAnalysisMode === "cost"
    ? route.steps.length
    : activePriorityEntries.length;
  const isAuditPreviewAccess = effectiveExposureAccess?.status === "audit-preview";
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
            label: t("readerStartNextPaidExposure"),
            intent: "exposure" as DetailIntent,
            hint: t("readerStartNextOpenExposurePolicy"),
          },
        ]
        : [
          {
            key: "exposure",
            label: t("readerStartNextSuppliersTickers"),
            intent: effectiveExposureAccess?.status === "locked" ? "exposure" as DetailIntent : "default" as DetailIntent,
            hint: effectiveExposureAccess?.status === "locked"
              ? t("readerStartNextOpenExposure")
              : t("readerStartNextOpenDetail"),
          },
        ]
    ),
    {
      key: "thesis",
      label: t("readerBottleneckThesis"),
      intent: "default" as DetailIntent,
      hint: t("readerStartNextOpenDetail"),
    },
  ];

  return (
    <aside
      className={["route-detail-rail", isAuditPreviewAccess ? "route-detail-rail-audit-preview" : ""]
        .filter(Boolean)
        .join(" ")}
      data-testid="route-detail-rail"
      aria-label={activePanel === "detail" ? copy.nodeDetail : displayRailTitle}
    >
      <header className="route-rail-header">
        <div>
          <div className="route-rail-kicker">{isKnowHowLayer ? t("knowHowLayerKicker") : copy.fullSystem}</div>
          <h2>{activePanel === "detail" ? copy.nodeDetail : displayRailTitle}</h2>
        </div>
        {activePanel === "route" ? (
          <div className="route-rail-header-badges">
            {exposureAccessText ? (
              <span className={`route-access-chip ${exposureAccessText.className}`}>
                {exposureAccessText.title}
              </span>
            ) : null}
            <span className="route-rail-count">{formatCopy(t("readerRailCountTop"), { count: railCount })}</span>
          </div>
        ) : null}
      </header>

      <div className="route-rail-tabs" role="tablist" aria-label="Route rail panel">
        <button
          type="button"
          className={activePanel === "route" ? "active" : ""}
          data-testid="route-rail-route-tab"
          role="tab"
          aria-selected={activePanel === "route"}
          onClick={() => {
            setDetailIntent("default");
            setPanel("route");
          }}
        >
          {primaryTabLabel}
        </button>
        <button
          type="button"
          className={activePanel === "detail" ? "active" : ""}
          data-testid="route-rail-detail-tab"
          role="tab"
          aria-selected={activePanel === "detail"}
          disabled={!selectedNode}
          onClick={() => {
            setDetailIntent("default");
            setPanel("detail");
          }}
        >
          {copy.detail}
        </button>
      </div>

      <div className="route-rail-body">
        {activePanel === "detail" && selectedNode ? (
          <section
            className="route-rail-card route-rail-node-detail"
            data-testid="route-rail-node-detail"
          >
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
                <a href="#paid-exposure-access">{t("readerExposurePointOfNeedAccessDetails")}</a>
              </div>
            ) : null}
            {detailIntent !== "exposure" && isAuditPreviewAccess && exposureAccessText ? (
              <div
                className={`route-reader-access route-reader-access-compact ${exposureAccessText.className}`}
                data-testid="route-detail-access-boundary"
              >
                <strong>{exposureAccessText.title}</strong>
                <span>{exposureAccessText.body}</span>
              </div>
            ) : null}
            <NodeDetailContent
              graph={graph}
              node={selectedNode}
              onSelectNode={onSelectNode}
              lockedExposureMode={isAuditPreviewAccess ? "audit-preview" : "paid-candidate"}
              showExposureSummary={detailIntent === "exposure" || !isAuditPreviewAccess}
            />
            {canSetSelectedAsRoot ? (
              <details className="route-reader-research-controls" data-testid="route-reader-research-controls">
                <summary>{t("readerResearchControls")}</summary>
                <div className="route-rail-action-row">
                  <a
                    className="route-rail-action-button"
                    data-testid="set-root-node-button"
                    href={graphRootHref(selectedNode.id)}
                    aria-label={copy.setAsRootLabel(nodeName(selectedNode.id, selectedNode.name))}
                    aria-disabled={rootTransitioning}
                    aria-busy={rootTransitioning}
                    onClick={(event) => {
                      event.preventDefault();
                      if (rootTransitioning) {
                        return;
                      }
                      onSetRootNode?.(selectedNode.id);
                    }}
                  >
                    {rootTransitioning ? copy.settingRoot : copy.setAsRoot}
                  </a>
                </div>
              </details>
            ) : null}
          </section>
        ) : (
          <>
            <section className="route-rail-card route-rail-start">
              <div className="route-rail-section-title">{primaryTabLabel}</div>
              {isKnowHowLayer ? <p className="route-rail-hint">{t("knowHowLayerHint")}</p> : null}
              {featuredStartNode ? (
                <>
                  <div className="route-reader-thesis">
                    <span>{t("readerBottleneckThesis")}</span>
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
                  {routeDecisionBrief(featuredStartNode)}
                  <div className="route-reader-factors route-reader-stuck" data-testid="route-start-where-stuck">
                    <span>{t("readerWhereStuck")}</span>
                    <div className="pill-row">
                      {keyFactorsForNode(featuredStartNode).map((factor) => (
                        <span className="pill" key={factor}>{factor}</span>
                      ))}
                    </div>
                    {keyStuckReasonForNode(featuredStartNode) ? (
                      <p>{keyStuckReasonForNode(featuredStartNode)}</p>
                    ) : null}
                  </div>
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
                  <details
                    className="route-reader-secondary-details"
                    data-testid="route-start-secondary-signals"
                  >
                    <summary>{t("readerSecondarySignals")}</summary>
                    <div className="route-rail-chip-row">
                      {startSignalLabel ? <span>{startSignalLabel}</span> : null}
                      <span>{t("readerEvidenceStatus")}: {evidenceStatusText(featuredStartNode)}</span>
                      {keyFactorsForNode(featuredStartNode).map((factor) => (
                        <span key={factor}>{factor}</span>
                      ))}
                    </div>
                    {exposureAccessText ? (
                      <div className={`route-reader-access ${exposureAccessText.className}`}>
                        <strong>{exposureAccessText.title}</strong>
                        <span>{exposureAccessText.body}</span>
                      </div>
                    ) : null}
                  </details>
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
                <div className="route-rail-section-title">{t("readerKeyChokepoints")}</div>
                <ol className="route-step-list">
                  {route.steps.map((step) => {
                    const node = nodeById.get(step.nodeId);
                    const label = node ? nodeName(node.id, node.name) : step.nodeId;
                    const kindLabel = node ? kindName(node.kind) : "node";
                    const factors = node ? keyFactorsForNode(node) : [formatRmb(step.costTypicalRmb)];
                    return (
                      <li key={step.nodeId} className="route-step">
                        <button
                          type="button"
                          className="route-step-button"
                          aria-label={routeStepAriaLabel([
                            label,
                            kindLabel,
                            `${step.pathEdgeIds.length} ${copy.links}`,
                            formatRmb(step.costTypicalRmb),
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
                          <span className="route-step-signal">{formatRmb(step.costTypicalRmb)}</span>
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
                  {activeAnalysisMode === "bottleneck-risk" ? copy.riskHint : copy.maturityHint}
                </p>
                {activePriorityEntries.length > 0 ? (
                  <ol className="route-step-list route-priority-list">
                    {activePriorityEntries.slice(0, 3).map((entry) => {
                      const node = nodeById.get(entry.nodeId);
                      const label = node ? nodeName(node.id, node.name) : entry.nodeId;
                      const kindLabel = node ? kindName(node.kind) : "node";
                      const scoreLabel = node && activeAnalysisMode === "bottleneck-risk"
                        ? formatHeatScore(nodeRiskSignal(node, graph))
                        : node
                          ? formatMaturityScore(node) ?? "—"
                          : "—";
                      const metaLabel = node
                        ? `${nodeRoleText(node)} · ${evidenceStatusText(node)}`
                        : kindLabel;
                      const valueLabel = activeAnalysisMode === "bottleneck-risk"
                        ? `${copy.riskScore} ${scoreLabel}`
                        : scoreLabel;
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

            <section
              className="route-rail-card route-rail-selected"
              data-testid="route-rail-selected-summary"
            >
              <div className="route-rail-section-title">
                {selectedSummaryUsesRouteEntry ? copy.routeEntry : copy.selected}
              </div>
              {selectedSummaryNode ? (
                <>
                  <h3>{nodeName(selectedSummaryNode.id, selectedSummaryNode.name)}</h3>
                  <div className="route-reader-thesis">
                    <span>{t("readerBottleneckThesis")}</span>
                    <p>{bottleneckThesisText(selectedSummaryNode)}</p>
                  </div>
                  {routeDecisionBrief(selectedSummaryNode)}
                  <div className="route-reader-evidence-summary">
                    <span>{t("readerKeyEvidenceSummary")}</span>
                    <p>{keyEvidenceSummaryText(selectedSummaryNode)}</p>
                  </div>
                  <div className="route-reader-factors">
                    <span>{t("readerWhereStuck")}</span>
                    <div className="route-rail-chip-row">
                      {keyFactorsForNode(selectedSummaryNode).map((factor) => (
                        <span key={factor}>{factor}</span>
                      ))}
                    </div>
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
                            <small>{copy.riskScore} {formatHeatScore(nodeRiskSignal(node, graph))}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <details className="route-reader-secondary-details" data-testid="route-selected-secondary-signals">
                    <summary>{t("readerSecondarySignals")}</summary>
                    <div className="route-rail-chip-row route-reader-secondary-signals">
                      <span>{copy.riskScore} {formatHeatScore(nodeRiskSignal(selectedSummaryNode, graph))}</span>
                      <span>{bottleneckRoleText(selectedSummaryNode)}</span>
                      <span>{t("readerEvidenceStatus")}: {evidenceStatusText(selectedSummaryNode)}</span>
                    </div>
                    {exposureAccessText ? (
                      <div className={`route-reader-access ${exposureAccessText.className}`}>
                        <strong>{exposureAccessText.title}</strong>
                        <span>{exposureAccessText.body}</span>
                      </div>
                    ) : null}
                    {(() => {
                      const maturity = formatMaturityScore(selectedSummaryNode);
                      const cost = nodeCostSignalRmb(selectedSummaryNode, graph);
                      if (!maturity && !cost) return null;
                      return (
                        <div className="route-rail-chip-row route-reader-secondary-meta">
                          {maturity ? <span>{copy.maturityScore} {maturity}</span> : null}
                          {cost ? <span>{formatRmb(cost)}</span> : null}
                        </div>
                      );
                    })()}
                  </details>
                  {selectedNode && canSetSelectedAsRoot ? (
                    <details className="route-reader-research-controls" data-testid="route-reader-research-controls">
                      <summary>{t("readerResearchControls")}</summary>
                      <div className="route-rail-action-row">
                        <a
                          className="route-rail-action-button"
                          data-testid="set-root-node-button"
                          href={graphRootHref(selectedNode.id)}
                          aria-label={copy.setAsRootLabel(nodeName(selectedNode.id, selectedNode.name))}
                          aria-disabled={rootTransitioning}
                          aria-busy={rootTransitioning}
                          onClick={(event) => {
                            event.preventDefault();
                            if (rootTransitioning) {
                              return;
                            }
                            onSetRootNode?.(selectedNode.id);
                          }}
                        >
                          {rootTransitioning ? copy.settingRoot : copy.setAsRoot}
                        </a>
                      </div>
                    </details>
                  ) : null}
                </>
              ) : (
                <p className="muted">{copy.noNodeSelected}</p>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

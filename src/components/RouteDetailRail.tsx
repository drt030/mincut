"use client";

import React, { useMemo, useState } from "react";
import { defaultFocalProduct } from "@/lib/graphTraversal";
import { nodeCostSignalRmb, type ColorMode } from "@/lib/edgeStyleFor";
import { nodeRisk } from "@/lib/nodeRisk";
import { selectTopN } from "@/lib/prioritySelection";
import type { RouteHighlight } from "@/lib/routeHighlight";
import type { GraphData, Node } from "@/lib/schema";
import { useLanguage } from "./LanguageProvider";
import { NodeDetailContent } from "./NodeDetailPanel";

type RailAnalysisMode = "relation" | "cost" | "bottleneck-risk" | "maturity";

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
  priorityEntries?: readonly LensPriorityEntry[];
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

function graphRootHref(nodeId: string): string {
  return `/graph?root=${encodeURIComponent(nodeId)}`;
}

function railAnalysisMode(mode: ColorMode | undefined): RailAnalysisMode {
  if (mode === "relation" || mode === "bottleneck-risk" || mode === "maturity") return mode;
  return "cost";
}

function formatRiskPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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

export function RouteDetailRail({
  graph,
  route,
  selectedNode,
  analysisMode,
  priorityEntries,
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
  const panel = controlledPanel ?? uncontrolledPanel;
  const activePanel = panel === "detail" && !selectedNode ? "route" : panel;
  const setPanel = (next: "route" | "detail") => {
    if (controlledPanel === undefined) {
      setUncontrolledPanel(next);
    }
    onPanelChange?.(next);
  };
  const { kindName, language, nodeName } = useLanguage();
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
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
      risk: "风险",
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
      riskScore: "风险",
      maturityScore: "成熟度",
      maturityUnknown: "成熟度未设置",
      noPriorityNodes: "当前视角暂无可排序节点。",
      noNodeSelected: "未选择节点。",
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
      risk: "Risk",
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
      riskScore: "Risk",
      maturityScore: "Maturity",
      maturityUnknown: "maturity not set",
      noPriorityNodes: "No sortable nodes in this lens yet.",
      noNodeSelected: "No node selected.",
      setAsRoot: "Set as research root",
      settingRoot: "Switching research root",
      setAsRootLabel: (name: string) => `Set ${name} as the graph research root`,
    };
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
  const primaryTabLabel = activeAnalysisMode === "relation"
    ? copy.structure
    : activeAnalysisMode === "bottleneck-risk"
    ? copy.risk
    : activeAnalysisMode === "maturity"
      ? copy.weakPoints
      : copy.route;
  const railCount = activeAnalysisMode === "relation"
    ? firstLayerNodes.length
    : activeAnalysisMode === "cost"
    ? route.steps.length
    : activePriorityEntries.length;

  return (
    <aside
      className="route-detail-rail"
      data-testid="route-detail-rail"
      aria-label={railTitle}
    >
      <header className="route-rail-header">
        <div>
          <div className="route-rail-kicker">{copy.fullSystem}</div>
          <h2>{activePanel === "detail" ? copy.nodeDetail : railTitle}</h2>
        </div>
        {activePanel === "route" ? (
          <span className="route-rail-count">{railCount}</span>
        ) : null}
      </header>

      <div className="route-rail-tabs" role="tablist" aria-label="Route rail panel">
        <button
          type="button"
          className={activePanel === "route" ? "active" : ""}
          data-testid="route-rail-route-tab"
          role="tab"
          aria-selected={activePanel === "route"}
          onClick={() => setPanel("route")}
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
          onClick={() => setPanel("detail")}
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
            {canSetSelectedAsRoot ? (
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
            ) : null}
            <NodeDetailContent
              graph={graph}
              node={selectedNode}
              onSelectNode={onSelectNode}
            />
          </section>
        ) : (
          <>
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
                <ol className="route-step-list">
                  {route.steps.map((step) => {
                    const node = nodeById.get(step.nodeId);
                    const label = node ? nodeName(node.id, node.name) : step.nodeId;
                    const kindLabel = node ? kindName(node.kind) : "node";
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
                            <span className="route-step-meta">
                              {kindLabel} · {step.pathEdgeIds.length} {copy.links}
                            </span>
                          </span>
                          <span className="route-step-cost">{formatRmb(step.costTypicalRmb)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : (
              <section className="route-rail-card route-rail-route">
                <div className="route-rail-section-title">
                  {activeAnalysisMode === "bottleneck-risk"
                    ? copy.keyRiskNodes
                    : copy.leastMatureDependencies}
                </div>
                <p className="route-rail-hint">
                  {activeAnalysisMode === "bottleneck-risk" ? copy.riskHint : copy.maturityHint}
                </p>
                {activePriorityEntries.length > 0 ? (
                  <ol className="route-step-list route-priority-list">
                    {activePriorityEntries.map((entry) => {
                      const node = nodeById.get(entry.nodeId);
                      const label = node ? nodeName(node.id, node.name) : entry.nodeId;
                      const kindLabel = node ? kindName(node.kind) : "node";
                      const scoreLabel = node && activeAnalysisMode === "bottleneck-risk"
                        ? formatRiskPercent(nodeRisk(node, graph))
                        : node
                          ? formatMaturityScore(node) ?? "—"
                          : "—";
                      const metaLabel = node && activeAnalysisMode === "bottleneck-risk"
                        ? `${kindLabel} · ${copy.riskScore} ${scoreLabel}`
                        : node
                          ? `${kindLabel} · ${node.maturityLabel ?? copy.maturityUnknown}`
                          : kindLabel;
                      const valueLabel = activeAnalysisMode === "bottleneck-risk"
                        ? `${copy.riskScore} ${scoreLabel}`
                        : scoreLabel;
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
                              <span className="route-step-meta">{metaLabel}</span>
                            </span>
                            <span className="route-step-cost">{valueLabel}</span>
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

            <section className="route-rail-card route-rail-selected">
              <div className="route-rail-section-title">{copy.selected}</div>
              {selectedNode ? (
                <>
                  <h3>{nodeName(selectedNode.id, selectedNode.name)}</h3>
                  <div className="route-rail-chip-row">
                    <span>{kindName(selectedNode.kind)}</span>
                    {selectedNode.maturityLabel ? <span>{selectedNode.maturityLabel}</span> : null}
                    {activeAnalysisMode === "bottleneck-risk" ? (
                      <span>{copy.riskScore} {formatRiskPercent(nodeRisk(selectedNode, graph))}</span>
                    ) : null}
                    {activeAnalysisMode === "maturity" && formatMaturityScore(selectedNode) ? (
                      <span>{copy.maturityScore} {formatMaturityScore(selectedNode)}</span>
                    ) : null}
                    {(() => {
                      const cost = nodeCostSignalRmb(selectedNode, graph);
                      return cost ? <span>{formatRmb(cost)}</span> : null;
                    })()}
                  </div>
                  {compactDescription(selectedNode.description) ? (
                    <p>{compactDescription(selectedNode.description)}</p>
                  ) : null}
                  {canSetSelectedAsRoot ? (
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
